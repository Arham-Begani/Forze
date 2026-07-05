import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLeadActivity, getLeadActivityForLead, getLeadById, getVenture } from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { CreateLeadNoteSchema } from '@/lib/schemas/crm'

async function authorizeLead(ventureId: string, leadId: string, userId: string) {
  const venture = await getVenture(ventureId, userId)
  if (!venture) return null

  const lead = await getLeadById(leadId)
  if (!lead || lead.venture_id !== ventureId) return null

  return lead
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; leadId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await gateFeatureForResponse(session.userId, 'crm')
    if (!gate.ok) return gate.response

    const { id, leadId } = await params
    const lead = await authorizeLead(id, leadId, session.userId)
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const activity = await getLeadActivityForLead(leadId)
    return NextResponse.json({ activity })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/leads/:leadId/activity] GET error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; leadId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await gateFeatureForResponse(session.userId, 'crm')
    if (!gate.ok) return gate.response

    const { id, leadId } = await params
    const input = CreateLeadNoteSchema.safeParse(await request.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const lead = await authorizeLead(id, leadId, session.userId)
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const activity = await createLeadActivity({
      leadId,
      ventureId: id,
      actorId: session.userId,
      type: 'note',
      body: input.data.body,
    })

    return NextResponse.json({ success: true, activity })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/leads/:leadId/activity] POST error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
