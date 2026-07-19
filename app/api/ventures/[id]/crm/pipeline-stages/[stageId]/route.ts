import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { deletePipelineStage, getPipelineStagesForVenture, getVenture, updatePipelineStage } from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { UpdatePipelineStageSchema } from '@/lib/schemas/crm'
import { logError } from '@/lib/log'

async function authorizeStage(ventureId: string, stageId: string, userId: string) {
  const venture = await getVenture(ventureId, userId)
  if (!venture) return null

  const stages = await getPipelineStagesForVenture(ventureId)
  const stage = stages.find((s) => s.id === stageId)
  return stage ?? null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await gateFeatureForResponse(session.userId, 'crm')
    if (!gate.ok) return gate.response

    const { id, stageId } = await params
    const stage = await authorizeStage(id, stageId, session.userId)
    if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

    const input = UpdatePipelineStageSchema.safeParse(await request.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const { isWon, isLost, ...rest } = input.data
    const updated = await updatePipelineStage(stageId, {
      ...rest,
      ...(isWon !== undefined ? { is_won: isWon } : {}),
      ...(isLost !== undefined ? { is_lost: isLost } : {}),
    })
    return NextResponse.json({ success: true, stage: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    logError('ventures/id/crm/pipeline-stages/stageId', error, { msg: '[crm/pipeline-stages/:stageId] PATCH error' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await gateFeatureForResponse(session.userId, 'crm')
    if (!gate.ok) return gate.response

    const { id, stageId } = await params
    const stage = await authorizeStage(id, stageId, session.userId)
    if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

    await deletePipelineStage(stageId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    logError('ventures/id/crm/pipeline-stages/stageId', error, { msg: '[crm/pipeline-stages/:stageId] DELETE error' })
    // Deleting a stage that still has deals referencing it will hit the
    // stage_id FK constraint (deals.stage_id REFERENCES pipeline_stages(id),
    // no ON DELETE clause) — surface that as a normal 400, not a 500.
    if (message.includes('foreign key') || message.includes('violates')) {
      return NextResponse.json({ error: 'Move or delete deals in this stage first' }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
