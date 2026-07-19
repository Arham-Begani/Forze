// GET  /api/campaigns/:campaignId/poll-replies — read stored replies (no Gmail hit)
// POST /api/campaigns/:campaignId/poll-replies — actively poll Gmail for new replies
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { getCampaignForUser, getLeadEmailsForCampaign, findLeadByEmail, createCampaignReply, replyMessageIdExists, updateLeadEngagement, getCampaignReplies } from '@/lib/queries/campaign-queries'
import { pollGmailForReplies } from '@/lib/gmail-sender'
import { analyzeReply } from '@/lib/email-generator'
import { advanceCrmLeadStatus } from '@/lib/lead-capture'
import { updateCampaign } from '@/lib/queries/campaign-queries'
import { enforceRateLimit, POLL_LIMIT, POLL_WINDOW_SEC } from '@/lib/rate-limit'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { logError } from '@/lib/log'

type RouteContext = { params: Promise<{ id: string }> }

// Cheap read path — CampaignDetail's mount no longer hammers the Gmail API
// just to render existing replies it already stored.
export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'outreach')
    if (!gate.ok) return gate.response
    const { id } = await params

    const campaign = await getCampaignForUser(id, session.userId)
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // Filter out empty/whitespace-only replies — these were stored before we
    // gated storage on non-empty body. We keep them in the DB for auditability
    // but don't surface them in the UI.
    const allReplies = await getCampaignReplies(id)
    const replies = allReplies.filter((r) => r.body && r.body.trim().length > 0)
    return NextResponse.json({ replies })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('campaigns/id/poll-replies', e, { msg: '[campaigns/poll-replies] GET error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'outreach')
    if (!gate.ok) return gate.response
    const { id } = await params

    const rl = await enforceRateLimit(session.userId, 'campaign:poll', POLL_WINDOW_SEC, POLL_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded — try again later' }, { status: 429 })
    }

    const campaign = await getCampaignForUser(id, session.userId)
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const leadEmails = await getLeadEmailsForCampaign(id)
    const gmailMessages = await pollGmailForReplies(session.userId, id, leadEmails)

    const newReplies = []

    for (const msg of gmailMessages) {
      // Skip empty-body messages — Gemini invents garbage summaries for them
      // ("The reply is empty…") and they pollute the replies list.
      if (!msg.body || msg.body.trim().length === 0) continue

      // Skip already-stored messages
      const alreadyExists = await replyMessageIdExists(msg.gmailMessageId)
      if (alreadyExists) continue

      // Extract sender email from "Name <email>" format
      const emailMatch = msg.from.match(/<([^>]+)>/)
      const fromEmail = emailMatch ? emailMatch[1] : msg.from.trim()
      const fromName = emailMatch ? msg.from.split('<')[0].trim() : undefined

      // Find matching lead
      const lead = await findLeadByEmail(id, fromEmail)

      // Analyze the reply with Gemini
      const analysis = await analyzeReply(
        campaign.subject_line ?? '',
        campaign.email_body ?? '',
        fromEmail,
        msg.subject,
        msg.body
      ).catch(() => ({ type: 'unknown' as const, sentiment_score: 0, summary: '' }))

      const reply = await createCampaignReply(id, lead?.id ?? null, {
        from_email: fromEmail,
        from_name: fromName,
        subject: msg.subject,
        body: msg.body,
        gmail_message_id: msg.gmailMessageId,
        gmail_thread_id: msg.gmailThreadId,
        received_at: msg.receivedAt,
        reply_type: analysis.type,
        sentiment_score: analysis.sentiment_score,
        summary: analysis.summary,
      })

      // Update lead engagement status
      if (lead) {
        await updateLeadEngagement(lead.id, {
          email_replied_at: msg.receivedAt,
          engagement_status: 'replied',
        }).catch(() => {})
        // A human reply is the strongest qualification signal the CRM gets.
        if (lead.lead_id) {
          await advanceCrmLeadStatus(lead.lead_id, ['new', 'contacted'], 'qualified')
        }
      }

      newReplies.push(reply)
    }

    // Update campaign replied_count
    if (newReplies.length > 0) {
      await updateCampaign(id, {
        replied_count: (campaign.replied_count ?? 0) + newReplies.length,
      }).catch(() => {})
    }

    const storedReplies = await getCampaignReplies(id)
    const allReplies = storedReplies.filter((r) => r.body && r.body.trim().length > 0)

    return NextResponse.json({
      newRepliesFound: newReplies.length,
      replies: allReplies,
    })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('campaigns/id/poll-replies', e, { msg: '[campaigns/poll-replies] POST error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
