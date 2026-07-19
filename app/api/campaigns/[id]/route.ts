// GET   /api/campaigns/:campaignId
// PATCH /api/campaigns/:campaignId
// DELETE /api/campaigns/:campaignId
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { UpdateCampaignSchema } from '@/lib/schemas/campaign'
import { getCampaignForUser, updateCampaign, deleteCampaign, getCampaignMetrics } from '@/lib/queries/campaign-queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { logError } from '@/lib/log'

type RouteContext = { params: Promise<{ id: string }> }

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

    const metrics = await getCampaignMetrics(id)
    return NextResponse.json({ campaign: { ...campaign, metrics } })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('campaigns/id', e, { msg: '[campaigns/[id]] GET error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'outreach')
    if (!gate.ok) return gate.response
    const { id } = await params

    const existing = await getCampaignForUser(id, session.userId)
    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const body = await req.json()
    const input = UpdateCampaignSchema.safeParse(body)
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const updated = await updateCampaign(id, input.data, session.userId)
    return NextResponse.json({ campaign: updated })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('campaigns/id', e, { msg: '[campaigns/[id]] PATCH error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'outreach')
    if (!gate.ok) return gate.response
    const { id } = await params

    const existing = await getCampaignForUser(id, session.userId)
    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    await deleteCampaign(id, session.userId)
    return NextResponse.json({ success: true })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('campaigns/id', e, { msg: '[campaigns/[id]] DELETE error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
