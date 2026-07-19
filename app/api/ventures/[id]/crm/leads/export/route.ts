import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLeadsForVenture, getVenture } from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { ExportQuerySchema } from '@/lib/schemas/crm'
import { logError } from '@/lib/log'

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',')
}

export async function GET(
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

    const input = ExportQuerySchema.safeParse({
      type: request.nextUrl.searchParams.get('type') ?? 'email',
    })
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    // Social and email leads share one table now (035_crm_leads_unify_social.sql)
    // — `type` filters the export rather than selecting a different source.
    const allLeads = await getLeadsForVenture(id)
    const leads = input.data.type === 'social'
      ? allLeads.filter((lead) => lead.external_identity)
      : allLeads.filter((lead) => lead.email)

    const csv = [
      csvRow(['name', 'email', 'handle', 'company', 'phone', 'source', 'status', 'tags', 'captured_at']),
      ...leads.map((lead) => csvRow([
        lead.name,
        lead.email,
        lead.external_identity,
        lead.company,
        lead.phone,
        lead.source,
        lead.status,
        (lead.tags ?? []).join('; '),
        lead.created_at,
      ])),
    ].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-${id}.csv"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    logError('ventures/id/crm/leads/export', error, { msg: '[crm/leads/export] GET error' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
