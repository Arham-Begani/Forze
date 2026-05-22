import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLeadsForVenture, getVenture } from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'

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

    const leads = await getLeadsForVenture(id)
    return NextResponse.json({ leads })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/leads/email] GET error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
