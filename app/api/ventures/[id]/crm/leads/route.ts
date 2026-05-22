// GET /api/ventures/[id]/crm/leads
// Deduplicates inbox items by username/source into per-person rows.

import { NextRequest, NextResponse } from 'next/server'
import { requireMarketingVenture, marketingErrorResponse } from '@/lib/marketing-api'
import { listMarketingAssetsByVenture } from '@/lib/marketing-queries'
import { aggregateCrmInbox, type CrmInboxItem } from '../inbox/route'
import { gateFeatureForResponse } from '@/lib/billing-http'

export type CrmLead = {
  id: string
  identity: string
  source: CrmInboxItem['source']
  count: number
  lastTimestamp: string | null
  lastText: string
  lastPermalink: string | null
}

function leadKey(item: CrmInboxItem): string {
  const handle = (item.username ?? 'unknown').toLowerCase()
  return `${item.source}:${handle}`
}

export function aggregateLeads(items: CrmInboxItem[]): CrmLead[] {
  const byKey = new Map<string, CrmLead>()
  for (const item of items) {
    const key = leadKey(item)
    const ts = item.timestamp ? Date.parse(item.timestamp) : 0
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        id: key,
        identity: item.username ?? 'unknown',
        source: item.source,
        count: 1,
        lastTimestamp: item.timestamp,
        lastText: item.text,
        lastPermalink: item.permalink,
      })
      continue
    }
    existing.count += 1
    const existingTs = existing.lastTimestamp ? Date.parse(existing.lastTimestamp) : 0
    if (ts > existingTs) {
      existing.lastTimestamp = item.timestamp
      existing.lastText = item.text
      existing.lastPermalink = item.permalink
    }
  }
  const leads = Array.from(byKey.values())
  leads.sort((a, b) => {
    const at = a.lastTimestamp ? Date.parse(a.lastTimestamp) : 0
    const bt = b.lastTimestamp ? Date.parse(b.lastTimestamp) : 0
    return bt - at
  })
  return leads
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { session } = await requireMarketingVenture(id)
    const gate = await gateFeatureForResponse(session.userId, 'crm')
    if (!gate.ok) return gate.response
    const assets = await listMarketingAssetsByVenture(id, session.userId)
    const leads = aggregateLeads(aggregateCrmInbox(assets))
    return NextResponse.json({ leads })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
