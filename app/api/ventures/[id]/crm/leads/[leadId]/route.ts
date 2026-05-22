import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { deleteLead, getLeadById, getVenture, updateLeadStatus } from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'

const UpdateLeadSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'lost', 'won']),
})

async function authorizeLead(ventureId: string, leadId: string, userId: string) {
  const venture = await getVenture(ventureId, userId)
  if (!venture) return null

  const lead = await getLeadById(leadId)
  if (!lead || lead.venture_id !== ventureId) return null

  return lead
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

    await updateLeadStatus(leadId, input.data.status)
    return NextResponse.json({ success: true })
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
