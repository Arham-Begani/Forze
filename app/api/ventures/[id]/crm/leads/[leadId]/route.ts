import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  createLeadActivity,
  deleteLead,
  getLeadActivityForLead,
  getLeadById,
  getVenture,
  updateLead,
  updateLeadStatus,
  type Lead,
} from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { UpdateLeadSchema } from '@/lib/schemas/crm'

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
    return NextResponse.json({ lead, activity })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/leads/:leadId] GET error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; leadId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await gateFeatureForResponse(session.userId, 'crm')
    if (!gate.ok) return gate.response

    const { id, leadId } = await params
    const input = UpdateLeadSchema.safeParse(await request.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const lead = await authorizeLead(id, leadId, session.userId)
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const { status, ...fieldUpdates } = input.data
    let updated: Lead = lead

    if (status && status !== lead.status) {
      await updateLeadStatus(leadId, status)
      updated = { ...updated, status }
      await createLeadActivity({
        leadId,
        ventureId: id,
        actorId: session.userId,
        type: 'status_change',
        body: `Status changed from ${lead.status} to ${status}`,
        metadata: { from: lead.status, to: status },
      })
    }

    const hasFieldUpdates = Object.values(fieldUpdates).some((value) => value !== undefined)
    if (hasFieldUpdates) {
      updated = await updateLead(leadId, fieldUpdates)
      await createLeadActivity({
        leadId,
        ventureId: id,
        actorId: session.userId,
        type: 'field_change',
        body: `Updated ${Object.keys(fieldUpdates).filter((k) => (fieldUpdates as Record<string, unknown>)[k] !== undefined).join(', ')}`,
        metadata: fieldUpdates,
      })
    }

    return NextResponse.json({ success: true, lead: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/leads/:leadId] PATCH error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
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

    await deleteLead(leadId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/leads/:leadId] DELETE error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
