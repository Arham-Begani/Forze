import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { bulkDeleteLeads, bulkUpdateLeadStatus, getLeadsForVenture, getVenture } from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { BulkLeadDeleteSchema, BulkLeadStatusSchema } from '@/lib/schemas/crm'

// Scopes a caller-supplied set of lead IDs down to ones that actually belong
// to this venture, so a bulk action can't be used to mutate another
// venture's leads by ID guessing (RLS is the hard backstop; this keeps the
// app layer honest too).
async function scopeToVenture(ventureId: string, leadIds: string[]): Promise<string[]> {
  const leads = await getLeadsForVenture(ventureId)
  const ownedIds = new Set(leads.map((lead) => lead.id))
  return leadIds.filter((id) => ownedIds.has(id))
}

export async function PATCH(
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

    const input = BulkLeadStatusSchema.safeParse(await request.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const scopedIds = await scopeToVenture(id, input.data.leadIds)
    if (scopedIds.length === 0) {
      return NextResponse.json({ error: 'No matching leads for this venture' }, { status: 404 })
    }

    await bulkUpdateLeadStatus(scopedIds, input.data.status)
    return NextResponse.json({ success: true, updated: scopedIds.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/leads/bulk] PATCH error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
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

    const input = BulkLeadDeleteSchema.safeParse(await request.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const scopedIds = await scopeToVenture(id, input.data.leadIds)
    if (scopedIds.length === 0) {
      return NextResponse.json({ error: 'No matching leads for this venture' }, { status: 404 })
    }

    await bulkDeleteLeads(scopedIds)
    return NextResponse.json({ success: true, deleted: scopedIds.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/leads/bulk] DELETE error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
