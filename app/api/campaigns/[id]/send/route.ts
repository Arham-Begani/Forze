// POST /api/campaigns/:campaignId/send
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { SendCampaignSchema } from '@/lib/schemas/campaign'
import {
  getCampaignForUser,
  updateCampaign,
  getUnsentLeads,
  upsertDailyAnalytics,
  claimLeadForSending,
  markLeadSent,
  markLeadFailed,
  recordCampaignEvent,
} from '@/lib/queries/campaign-queries'
import { sendEmailViaGmail } from '@/lib/gmail-sender'
import { personalizeEmail, personalizeSubject } from '@/lib/email-generator'
import { addTrackingPixel, rewriteLinksForTracking, injectUnsubscribeFooter, wrapInHtml } from '@/lib/email-utils'
import { signTrackingToken } from '@/lib/tracking-hmac'
import { enforceRateLimit, SEND_LIMIT, SEND_WINDOW_SEC } from '@/lib/rate-limit'
import { getGmailStatus } from '@/lib/gmail-oauth'
import { gateActionForResponse, gateFeatureForResponse } from '@/lib/billing-http'

type RouteContext = { params: Promise<{ id: string }> }

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export async function POST(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const { id } = await params

    const rl = await enforceRateLimit(session.userId, 'campaign:send', SEND_WINDOW_SEC, SEND_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded — 5 sends per hour' }, { status: 429 })
    }

    const campaign = await getCampaignForUser(id, session.userId)
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const body = await req.json()
    const input = SendCampaignSchema.safeParse(body)
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }
    const sendInput = input.data

    const leads = await getUnsentLeads(id)
    if (leads.length === 0) {
      return NextResponse.json({ error: 'No unsent leads in this campaign' }, { status: 400 })
    }

    // Gmail must be connected before we attempt any sends. Previously this
    // check was implicit (first lead would fail with "Gmail not connected"),
    // but the route returned 200 regardless, so the UI thought the campaign
    // shipped when zero emails actually went out.
    const gmailStatus = await getGmailStatus(session.userId)
    if (!gmailStatus.connected) {
      return NextResponse.json(
        { error: 'Gmail not connected. Connect your Gmail account before sending.', code: 'gmail_not_connected' },
        { status: 412 }
      )
    }

    // One 'campaign_send' counts per invocation (not per recipient) — matches
    // the user-visible 'campaign sends / week' ceiling on the pricing page.
    // Charged only after we know the send is actually possible (eligible
    // leads exist + Gmail connected) so a no-op request never burns a unit.
    const actionGate = await gateActionForResponse(session.userId, 'campaign_send')
    if (!actionGate.ok) return actionGate.response

    // Persist the approved copy + sequence settings on the campaign row. The
    // outreach cron reads these for scheduled/drip batches and follow-up
    // touches — without them a deferred send would have nothing to send.
    const sequenceSettings = {
      subject_line: sendInput.subjectLineApproved,
      email_body: sendInput.emailBodyApproved,
      send_mode: sendInput.sendMode,
      daily_send_cap: sendInput.sendMode === 'staggered' ? (sendInput.dailyCap ?? 50) : null,
      ...(sendInput.enableFollowups !== undefined ? { enable_followups: sendInput.enableFollowups } : {}),
      ...(sendInput.followupDelayHours !== undefined ? { followup_delay_hours: sendInput.followupDelayHours } : {}),
      ...(sendInput.maxFollowups !== undefined ? { max_followups: sendInput.maxFollowups } : {}),
    }

    // Deferred sends: an explicit future start time or drip mode hands the
    // campaign to the outreach cron instead of blasting inline.
    const scheduledForFuture =
      sendInput.scheduledTime && new Date(sendInput.scheduledTime).getTime() > Date.now() + 60 * 1000

    if (scheduledForFuture || sendInput.sendMode === 'staggered') {
      const scheduledAt = scheduledForFuture ? sendInput.scheduledTime! : new Date().toISOString()
      await updateCampaign(id, {
        ...sequenceSettings,
        status: 'scheduled',
        scheduled_send_time: scheduledAt,
      }, session.userId)

      await recordCampaignEvent({
        campaignId: id,
        userId: session.userId,
        eventType: 'send_scheduled',
        metadata: {
          leadCount: leads.length,
          sendMode: sendInput.sendMode,
          scheduledAt,
          dailyCap: sendInput.sendMode === 'staggered' ? (sendInput.dailyCap ?? 50) : null,
        },
      })

      return NextResponse.json(
        {
          status: 'scheduled',
          scheduledFor: scheduledAt,
          sendMode: sendInput.sendMode,
          leadCount: leads.length,
        },
        { status: 202 }
      )
    }

    if (!gmailStatus.canSend) {
      return NextResponse.json(
        { error: 'Gmail daily send limit reached or integration unhealthy.', code: 'gmail_cannot_send' },
        { status: 412 }
      )
    }

    // Immediate send still persists copy + sequence settings so the cron can
    // run follow-up touches for this campaign afterwards.
    await updateCampaign(id, sequenceSettings, session.userId)

    const baseUrl = getBaseUrl()
    const today = new Date().toISOString().split('T')[0]
    let sentCount = 0
    let failedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    await recordCampaignEvent({
      campaignId: id,
      userId: session.userId,
      eventType: 'send_batch_started',
      metadata: { leadCount: leads.length },
    })

    // Send in parallel chunks. Gmail quota is per-second, so we cap at 10 in-flight —
    // previously sending 100 leads serially took 100× a single API round-trip.
    const CONCURRENCY = 10

    async function sendOne(lead: typeof leads[number]): Promise<void> {
      // Atomic pending → sending. If another concurrent request already
      // claimed this lead, claimLeadForSending returns false and we skip —
      // the whole pipeline is safe to retry after a timeout without
      // double-sending.
      const claimed = await claimLeadForSending(lead.id)
      if (!claimed) {
        skippedCount++
        return
      }

      try {
        const personalizedSubject = personalizeSubject(sendInput.subjectLineApproved, {
          firstName: lead.first_name,
          company: lead.company ?? undefined,
          jobTitle: lead.job_title ?? undefined,
        })

        let personalizedBody = personalizeEmail(sendInput.emailBodyApproved, {
          firstName: lead.first_name,
          company: lead.company ?? undefined,
          jobTitle: lead.job_title ?? undefined,
        })

        if (!personalizedBody.trim().startsWith('<')) {
          personalizedBody = wrapInHtml(personalizedBody)
        }

        const trackingSig = signTrackingToken(id, lead.id)
        const pixelUrl = `${baseUrl}/api/track/pixel/${id}/${lead.id}?sig=${trackingSig}`
        // Order matters:
        //   1. rewrite existing hrefs first so only user-authored links become
        //      click-tracked,
        //   2. then inject the unsubscribe footer (its own href is already a
        //      /api/track/ route and is skipped by the rewriter anyway), and
        //   3. finally add the pixel before </body>.
        personalizedBody = rewriteLinksForTracking(personalizedBody, id, lead.id, baseUrl, trackingSig)
        personalizedBody = injectUnsubscribeFooter(personalizedBody, id, lead.id, baseUrl)
        personalizedBody = addTrackingPixel(personalizedBody, pixelUrl)

        const listUnsubscribeUrl = `${baseUrl}/api/track/unsubscribe/${id}/${lead.id}`

        const result = await sendEmailViaGmail(session.userId, {
          to: lead.email,
          subject: personalizedSubject,
          htmlBody: personalizedBody,
          listUnsubscribeUrl,
        })

        if (result.status === 'sent') {
          await markLeadSent(lead.id, {
            subject: personalizedSubject,
            body: personalizedBody,
            gmailMessageId: result.messageId,
            gmailThreadId: result.threadId,
          })
          sentCount++
          await recordCampaignEvent({
            campaignId: id,
            leadId: lead.id,
            userId: session.userId,
            eventType: 'send_sent',
          })
        } else {
          const msg = result.error ?? 'unknown error'
          errors.push(`${lead.email}: ${msg}`)
          failedCount++
          await markLeadFailed(lead.id, msg).catch(() => {})
          await recordCampaignEvent({
            campaignId: id,
            leadId: lead.id,
            userId: session.userId,
            eventType: 'send_failed',
            severity: 'error',
            message: msg,
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        errors.push(`${lead.email}: ${msg}`)
        failedCount++
        await markLeadFailed(lead.id, msg).catch(() => {})
        await recordCampaignEvent({
          campaignId: id,
          leadId: lead.id,
          userId: session.userId,
          eventType: 'send_failed',
          severity: 'error',
          message: msg,
        })
      }
    }

    for (let i = 0; i < leads.length; i += CONCURRENCY) {
      const chunk = leads.slice(i, i + CONCURRENCY)
      await Promise.allSettled(chunk.map(sendOne))
    }

    // Update campaign status + counters
    await updateCampaign(id, {
      status: 'active',
      sent_count: (campaign.sent_count ?? 0) + sentCount,
      started_at: campaign.started_at ?? new Date().toISOString(),
    }, session.userId)

    await upsertDailyAnalytics(id, today, { sent: sentCount }).catch(() => {})

    // If every send failed, this is a definitive failure — return 502 with the
    // Gmail errors so the UI doesn't falsely report success. Partial failures
    // (some sent, some failed) still return 200 with the errors array attached.
    if (sentCount === 0) {
      await recordCampaignEvent({
        campaignId: id,
        userId: session.userId,
        eventType: 'send_batch_failed',
        severity: 'error',
        metadata: { failedCount, skippedCount, errors: errors.slice(0, 20) },
      })
      return NextResponse.json(
        {
          error: 'All sends failed — see errors for details.',
          code: 'all_sends_failed',
          sentCount,
          failedCount,
          skippedCount,
          errors: errors.slice(0, 20),
        },
        { status: 502 }
      )
    }

    await recordCampaignEvent({
      campaignId: id,
      userId: session.userId,
      eventType: 'send_batch_completed',
      metadata: { sentCount, failedCount, skippedCount },
    })

    return NextResponse.json({
      status: 'sending',
      sentCount,
      failedCount,
      skippedCount,
      ...(errors.length > 0 ? { errors: errors.slice(0, 20) } : {}),
    })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[campaigns/send] POST error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
