// GET /api/campaigns/:campaignId/analytics?period=7d
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { getCampaignForUser, getCampaignMetrics, getLeadsByStatus, getLeadsBySendStatus, getEngagementTimeline } from '@/lib/queries/campaign-queries'

type RouteContext = { params: Promise<{ id: string }> }

const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  all: 365,
}

export async function GET(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const { id } = await params

    const campaign = await getCampaignForUser(id, session.userId)
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const period = req.nextUrl.searchParams.get('period') ?? '7d'
    const days = PERIOD_DAYS[period] ?? 7

    const [metrics, leadsByStatus, leadsBySendStatus, engagementTimeline] = await Promise.all([
      getCampaignMetrics(id),
      getLeadsByStatus(id),
      getLeadsBySendStatus(id),
      getEngagementTimeline(id, days),
    ])

    return NextResponse.json({
      ...metrics,
      leadsByStatus,
      leadsBySendStatus,
      engagementTimeline,
    })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[campaigns/analytics] GET error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
