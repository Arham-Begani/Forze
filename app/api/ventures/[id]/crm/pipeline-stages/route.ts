import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createPipelineStage, ensurePipelineStagesForVenture, getVenture } from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { CreatePipelineStageSchema } from '@/lib/schemas/crm'

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

    // Lazily seeds the default stage set (New/Contacted/Qualified/Proposal/
    // Won/Lost) on first visit rather than at venture-creation time.
    const stages = await ensurePipelineStagesForVenture(id)
    return NextResponse.json({ stages })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/pipeline-stages] GET error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

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

    const input = CreatePipelineStageSchema.safeParse(await request.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const stage = await createPipelineStage(id, input.data)
    return NextResponse.json({ success: true, stage })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/pipeline-stages] POST error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
