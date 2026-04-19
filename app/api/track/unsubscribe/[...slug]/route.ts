// GET  /api/track/unsubscribe/:campaignId/:leadId — renders confirmation page
// POST /api/track/unsubscribe/:campaignId/:leadId — RFC 8058 one-click unsubscribe
// No auth — link/POST originates from a recipient's email client.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordCampaignEvent } from '@/lib/queries/campaign-queries'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ slug: string[] }> }

// Idempotent suppression: the WHERE-guard on `unsubscribed_at IS NULL` is what
// makes this safe to call repeatedly — only the first request flips the row
// and bumps the campaign counter. Admin client is required because recipient
// email clients don't carry auth cookies; RLS would otherwise reject the
// update with auth.uid() = NULL.
async function markUnsubscribed(campaignId: string, leadId: string): Promise<boolean> {
  const db = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await db
    .from('campaign_leads')
    .update({
      send_status: 'suppressed',
      engagement_status: 'unsubscribed',
      unsubscribed_at: now,
      updated_at: now,
    })
    .eq('id', leadId)
    .eq('campaign_id', campaignId)
    .is('unsubscribed_at', null)
    .select('id')
    .maybeSingle()

  if (error || !data) return false

  await db.rpc('increment_campaign_metric', {
    p_campaign_id: campaignId,
    p_metric: 'unsubscribed_count',
  }).then(() => {}, () => {})

  return true
}

function confirmationHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Unsubscribed</title>
  <style>
    html, body { margin: 0; padding: 0; background: #faf9f6; color: #1c1917; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 440px; width: 100%; background: #ffffff; border: 1px solid #e8e4dc; border-radius: 16px; padding: 32px; text-align: center; }
    .mark { width: 48px; height: 48px; margin: 0 auto 16px; border-radius: 50%; background: #c07a3a; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { margin: 0; color: #57534e; font-size: 14px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="mark" aria-hidden="true">&#10003;</div>
      <h1>You're unsubscribed</h1>
      <p>You will no longer receive emails from this campaign. It may take a few minutes for any in-flight messages to stop.</p>
    </div>
  </div>
</body>
</html>`
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
} as const

export async function GET(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { slug } = await params
  const [campaignId, leadId] = slug ?? []

  if (campaignId && leadId) {
    try {
      const flipped = await markUnsubscribed(campaignId, leadId)
      if (flipped) {
        await recordCampaignEvent({
          campaignId,
          leadId,
          eventType: 'unsubscribed',
          metadata: { channel: 'link' },
        })
      }
    } catch {
      // Best-effort — always show the confirmation page.
    }
  }

  return new NextResponse(confirmationHtml(), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...NO_STORE_HEADERS },
  })
}

// RFC 8058 one-click unsubscribe — triggered by the `List-Unsubscribe-Post`
// header already emitted in lib/gmail-sender.ts. Must return 2xx with no body.
export async function POST(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { slug } = await params
  const [campaignId, leadId] = slug ?? []

  if (campaignId && leadId) {
    try {
      const flipped = await markUnsubscribed(campaignId, leadId)
      if (flipped) {
        await recordCampaignEvent({
          campaignId,
          leadId,
          eventType: 'unsubscribed',
          metadata: { channel: 'list-unsubscribe-post' },
        })
      }
    } catch {
      // Swallow — mailbox providers retry POSTs; keep success idempotent.
    }
  }

  return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS })
}
