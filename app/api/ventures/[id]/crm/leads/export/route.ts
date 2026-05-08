import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getLeadsForVenture, getVenture } from '@/lib/queries'
import { listMarketingAssetsByVenture } from '@/lib/marketing-queries'
import { aggregateCrmInbox } from '../../inbox/route'
import { aggregateLeads } from '../route'

const ExportQuerySchema = z.object({
  type: z.enum(['email', 'social']).default('email'),
})

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

    const { id } = await params
    const venture = await getVenture(id, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    const input = ExportQuerySchema.safeParse({
      type: request.nextUrl.searchParams.get('type') ?? 'email',
    })
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    let csv: string
    if (input.data.type === 'social') {
      const assets = await listMarketingAssetsByVenture(id, session.userId)
      const leads = aggregateLeads(aggregateCrmInbox(assets))
      csv = [
        csvRow(['handle', 'source', 'interactions', 'last_touch', 'last_text', 'last_permalink']),
        ...leads.map((lead) => csvRow([
          lead.identity,
          lead.source,
          lead.count,
          lead.lastTimestamp,
          lead.lastText,
          lead.lastPermalink,
        ])),
      ].join('\n')
    } else {
      const leads = await getLeadsForVenture(id)
      csv = [
        csvRow(['name', 'email', 'source', 'status', 'captured_at']),
        ...leads.map((lead) => csvRow([
          lead.name,
          lead.email,
          lead.source,
          lead.status,
          lead.created_at,
        ])),
      ].join('\n')
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-${id}.csv"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/leads/export] GET error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
