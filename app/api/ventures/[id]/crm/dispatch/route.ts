import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  createLeadActivity,
  createOutreachCampaign,
  createOutreachMessage,
  getLeadsForVenture,
  getVenture,
  updateOutreachCampaign,
} from '@/lib/queries'
import { getGmailStatus } from '@/lib/gmail-oauth'
import { sendEmailViaGmail } from '@/lib/gmail-sender'
import { gateActionForResponse, gateFeatureForResponse } from '@/lib/billing-http'
import { DispatchSchema } from '@/lib/schemas/crm'
import { logError } from '@/lib/log'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderBody(template: string, name: string | null): string {
  const text = template.replace(/{{\s*name\s*}}/g, name?.trim() || 'there')
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">${escapeHtml(text).replace(/\r?\n/g, '<br>')}</div>`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Feature gate (Builder+). The per-action weekly counter is incremented
    // once per recipient inside the send loop below.
    const gate = await gateFeatureForResponse(session.userId, 'crm')
    if (!gate.ok) return gate.response

    const ventureId = (await params).id
    const venture = await getVenture(ventureId, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    const input = DispatchSchema.safeParse(await req.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }
    const { campaignType, emailSubject, emailBody } = input.data

    // Fetch leads to send to
    const leads = await getLeadsForVenture(ventureId)
    const targetLeads = leads.filter(l => l.status !== 'lost' && Boolean(l.email))
    if (targetLeads.length === 0) {
      return NextResponse.json({ error: 'No qualified email leads to send to' }, { status: 400 })
    }

    const gmailStatus = await getGmailStatus(session.userId)
    if (!gmailStatus.connected) {
      return NextResponse.json(
        {
          error: gmailStatus.errorMessage ?? 'Gmail not connected. Connect or reconnect Gmail before sending.',
          code: gmailStatus.state === 'needs_reauth' ? 'gmail_reauth_required' : 'gmail_not_connected',
        },
        { status: gmailStatus.state === 'needs_reauth' ? 401 : 412 }
      )
    }
    if (!gmailStatus.canSend) {
      return NextResponse.json(
        { error: 'Gmail daily send limit reached or integration unhealthy.', code: 'gmail_cannot_send' },
        { status: 412 }
      )
    }

    const campaign = await createOutreachCampaign(ventureId, campaignType, {
      status: 'running',
      sentCount: 0,
    })

    let sentCount = 0
    const threadIds = new Set<string>()
    const errors: string[] = []

    for (const lead of targetLeads) {
      if (lead.email) {
        // Per-send weekly cap. The gate throws 429 on the first lead that
        // would exceed the plan's crmEmailsSent limit; everyone already sent
        // is preserved, the response captures sentCount + remaining errors.
        const actionGate = await gateActionForResponse(session.userId, 'crm_email_send')
        if (!actionGate.ok) {
          errors.push(`Weekly CRM email limit reached — stopped at ${sentCount} sent`)
          break
        }
        try {
          const result = await sendEmailViaGmail(session.userId, {
            to: lead.email,
            subject: emailSubject,
            htmlBody: renderBody(emailBody, lead.name),
          })

          if (result.status !== 'sent' || !result.messageId || !result.threadId) {
            errors.push(`${lead.email}: ${result.error ?? 'Gmail did not return message and thread IDs'}`)
            continue
          }

          await createOutreachMessage({
            campaignId: campaign.id,
            leadId: lead.id,
            googleMessageId: result.messageId,
            googleThreadId: result.threadId,
            subject: emailSubject,
            body: emailBody,
          })
          await createLeadActivity({
            leadId: lead.id,
            ventureId,
            actorId: session.userId,
            type: 'email_sent',
            body: `Sent "${emailSubject}"`,
            metadata: { campaignType, googleThreadId: result.threadId },
          })
          threadIds.add(result.threadId)
          sentCount++
        } catch (e) {
          const message = e instanceof Error ? e.message : 'unknown error'
          errors.push(`${lead.email}: ${message}`)
          console.error(`Failed to send to ${lead.email}`, e)
        }
      }
    }

    const updatedCampaign = await updateOutreachCampaign(campaign.id, {
      status: 'complete',
      sent_count: sentCount,
      thread_ids: Array.from(threadIds),
    })

    if (sentCount === 0) {
      return NextResponse.json(
        { error: 'All Gmail sends failed', success: false, sentCount, errors: errors.slice(0, 20) },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      sentCount,
      ...(errors.length > 0 ? { errors: errors.slice(0, 20) } : {}),
    })
  } catch (error: unknown) {
    logError('ventures/id/crm/dispatch', error, { msg: 'Error dispatching outreach' })
    return NextResponse.json({ error: 'Failed to dispatch outreach' }, { status: 500 })
  }
}
