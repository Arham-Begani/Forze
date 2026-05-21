// GET /api/track/click/:campaignId/:leadId?url=...&sig=<hmac>
// Records click and redirects to the original URL
// No session auth — link is in email body, but HMAC sig is required to update metrics
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTrackingToken } from '@/lib/tracking-hmac'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
): Promise<NextResponse> {
  const { slug } = await params
  const [campaignId, leadId] = slug ?? []
  const redirectUrl = req.nextUrl.searchParams.get('url') ?? '/'
  const sig = req.nextUrl.searchParams.get('sig')

  // Require a valid HMAC sig before honoring any external redirect target.
  // Without this gate the endpoint is an open redirect — an attacker could
  // craft `…/api/track/click/X/Y?url=https://malicious.example` and use the
  // forze.in origin to bounce victims to phishing pages. The HMAC also
  // protects the per-lead metric increments below from cross-user tampering.
  const sigValid = Boolean(campaignId && leadId && verifyTrackingToken(campaignId, leadId, sig))

  let safeUrl = '/'
  if (sigValid) {
    try {
      const parsed = new URL(redirectUrl)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        safeUrl = parsed.toString()
      }
    } catch {
      // Malformed URL — fall back to home
    }
  }

  // Track the click asynchronously — don't block redirect
  // Only update metrics if HMAC signature is valid (prevents cross-user metric tampering)
  if (sigValid) {
    // Hit by recipient email clients — no auth cookies. HMAC sig authenticates
    // the request; admin client bypasses RLS only for verified tracking events.
    const db = createAdminClient()
    const now = new Date().toISOString()

    // Don't downgrade replied → clicked. Lead must be in opened/fresh to bump.
    db.from('campaign_leads')
      .update({ email_clicked_at: now, engagement_status: 'clicked', updated_at: now })
      .eq('id', leadId)
      .is('email_clicked_at', null)
      .in('engagement_status', ['fresh', 'opened'])
      .then(() => {}, () => {})

    db.rpc('increment_campaign_metric', {
      p_campaign_id: campaignId,
      p_metric: 'clicked_count',
    }).then(() => {}, () => {})

    db.rpc('upsert_campaign_analytics', {
      p_campaign_id: campaignId,
      p_date: now.split('T')[0],
      p_clicked: 1,
    }).then(() => {}, () => {})
  }

  return NextResponse.redirect(safeUrl, { status: 302 })
}
