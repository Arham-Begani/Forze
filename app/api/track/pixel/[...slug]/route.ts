// GET /api/track/pixel/:campaignId/:leadId?sig=<hmac>
// Records email open and returns a 1x1 transparent GIF
// No session auth — pixel is loaded by email clients, but HMAC sig is required
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTrackingToken } from '@/lib/tracking-hmac'

// 1x1 transparent GIF (35 bytes)
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
): Promise<NextResponse> {
  try {
    const { slug } = await params
    const [campaignId, leadId] = slug ?? []

    if (campaignId && leadId && verifyTrackingToken(campaignId, leadId, _req.nextUrl.searchParams.get('sig'))) {
      // Hit by recipient email clients — no auth cookies, so the user-scoped
      // client would be blocked by RLS. The HMAC sig above authenticates the
      // request at the application layer; admin client bypasses RLS only for
      // verified tracking events.
      const db = createAdminClient()
      const now = new Date().toISOString()

      // Don't downgrade a replied/clicked lead to opened. First open wins.
      // `.select('id')` tells us whether this hit was the first open — the
      // campaign counter and daily analytics must only increment on the first
      // open per lead, otherwise every reload/Gmail-proxy prefetch inflates
      // the open rate.
      const { data: firstOpen } = await db
        .from('campaign_leads')
        .update({ email_opened_at: now, engagement_status: 'opened', updated_at: now })
        .eq('id', leadId)
        .is('email_opened_at', null)
        .in('engagement_status', ['fresh'])
        .select('id')

      if ((firstOpen ?? []).length > 0) {
        // Increment campaign opened_count
        const { error: rpcErr } = await db.rpc('increment_campaign_metric', {
          p_campaign_id: campaignId,
          p_metric: 'opened_count',
        })
        if (rpcErr) {
          const { data: camp } = await db.from('campaigns').select('opened_count').eq('id', campaignId).single()
          if (camp) {
            await db.from('campaigns').update({ opened_count: (camp.opened_count ?? 0) + 1, updated_at: now }).eq('id', campaignId)
          }
        }

        await db.rpc('upsert_campaign_analytics', {
          p_campaign_id: campaignId,
          p_date: now.split('T')[0],
          p_opened: 1,
        }).then(() => {}, () => {})
      }
    }
  } catch {
    // Tracking failure must never break the pixel response
  }

  return new NextResponse(PIXEL_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
    },
  })
}
