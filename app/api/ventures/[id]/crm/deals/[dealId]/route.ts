import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  createLeadActivity,
  deleteDeal,
  getDealById,
  getPipelineStagesForVenture,
  getVenture,
  updateDeal,
} from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { UpdateDealSchema } from '@/lib/schemas/crm'

async function authorizeDeal(ventureId: string, dealId: string, userId: string) {
  const venture = await getVenture(ventureId, userId)
  if (!venture) return null

  const deal = await getDealById(dealId)
  if (!deal || deal.venture_id !== ventureId) return null

  return deal
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dealId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await gateFeatureForResponse(session.userId, 'crm')
    if (!gate.ok) return gate.response

    const { id, dealId } = await params
    const deal = await authorizeDeal(id, dealId, session.userId)
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const input = UpdateDealSchema.safeParse(await request.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const { stageId, expectedCloseDate, lostReason, ownerId, ...rest } = input.data
    const updated = await updateDeal(dealId, {
      ...rest,
      ...(stageId ? { stage_id: stageId } : {}),
      ...(expectedCloseDate !== undefined ? { expected_close_date: expectedCloseDate } : {}),
      ...(lostReason !== undefined ? { lost_reason: lostReason } : {}),
      ...(ownerId !== undefined ? { owner_id: ownerId } : {}),
    })

    // Dragging a deal to a new kanban column — log it on the lead's timeline
    // so the stage change shows up alongside notes/status changes.
    if (stageId && stageId !== deal.stage_id) {
      const stages = await getPipelineStagesForVenture(id)
      const stage = stages.find((s) => s.id === stageId)
      await createLeadActivity({
        leadId: deal.lead_id,
        ventureId: id,
        actorId: session.userId,
        type: 'deal_stage_change',
        body: `Deal "${deal.title}" moved to stage "${stage?.name ?? stageId}"`,
        metadata: { dealId, fromStageId: deal.stage_id, toStageId: stageId },
      })
    }

    return NextResponse.json({ success: true, deal: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/deals/:dealId] PATCH error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; dealId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await gateFeatureForResponse(session.userId, 'crm')
    if (!gate.ok) return gate.response

    const { id, dealId } = await params
    const deal = await authorizeDeal(id, dealId, session.userId)
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    await deleteDeal(dealId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/deals/:dealId] DELETE error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
