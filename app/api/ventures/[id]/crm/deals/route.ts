import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  createDeal,
  createLeadActivity,
  ensurePipelineStagesForVenture,
  getDealsForVenture,
  getLeadById,
  getVenture,
} from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { CreateDealSchema } from '@/lib/schemas/crm'
import { logError } from '@/lib/log'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await gateFeatureForResponse(session.userId, 'crm')
    if (!gate.ok) return gate.response

    const { id } = await params
    const venture = await getVenture(id, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    const deals = await getDealsForVenture(id)
    return NextResponse.json({ deals })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    logError('ventures/id/crm/deals', error, { msg: '[crm/deals] GET error' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// "Convert to Deal" — the only path a deal is ever created from. No
// migration backfills deals for existing leads, so every deal traces back to
// an explicit action here, keeping the pipeline's value/stage data honest.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await gateFeatureForResponse(session.userId, 'crm')
    if (!gate.ok) return gate.response

    const { id } = await params
    const venture = await getVenture(id, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    const input = CreateDealSchema.safeParse(await request.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const lead = await getLeadById(input.data.leadId)
    if (!lead || lead.venture_id !== id) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const stages = await ensurePipelineStagesForVenture(id)
    const firstStage = stages[0]
    if (!firstStage) {
      return NextResponse.json({ error: 'No pipeline stages configured for this venture' }, { status: 500 })
    }

    const deal = await createDeal(id, {
      leadId: input.data.leadId,
      stageId: firstStage.id,
      title: input.data.title,
      value: input.data.value ?? null,
    })

    await createLeadActivity({
      leadId: input.data.leadId,
      ventureId: id,
      actorId: session.userId,
      type: 'deal_stage_change',
      body: `Converted to deal "${deal.title}" in stage "${firstStage.name}"`,
      metadata: { dealId: deal.id, stageId: firstStage.id },
    })

    return NextResponse.json({ success: true, deal })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    logError('ventures/id/crm/deals', error, { msg: '[crm/deals] POST error' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
