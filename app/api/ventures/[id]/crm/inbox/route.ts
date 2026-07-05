// GET /api/ventures/[id]/crm/inbox
// Aggregates inbound social signal for a venture's CRM inbox.
// Today: Instagram comments from published marketing_assets. LinkedIn/Reddit/
// Telegram integrations don't exist yet, so the aggregator only ever produces
// 'instagram' items — the UI filter options for the others were removed
// rather than left as permanent dead ends. Gmail replies are a separate
// concept surfaced via GET /api/ventures/[id]/crm/replies, not this endpoint.

import { NextRequest, NextResponse } from 'next/server'
import { requireMarketingVenture, marketingErrorResponse } from '@/lib/marketing-api'
import { listMarketingAssetsByVenture } from '@/lib/marketing-queries'
import type { MarketingAsset } from '@/lib/marketing.shared'
import { gateFeatureForResponse } from '@/lib/billing-http'

export type CrmInboxItem = {
  id: string
  source: 'instagram'
  username: string | null
  text: string
  timestamp: string | null
  permalink: string | null
  assetId: string | null
}

interface InstagramCommentRecord {
  id?: unknown
  text?: unknown
  username?: unknown
  timestamp?: unknown
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function aggregateCrmInbox(assets: MarketingAsset[]): CrmInboxItem[] {
  const items: CrmInboxItem[] = []

  for (const asset of assets) {
    if (asset.provider !== 'instagram' || asset.status !== 'published') continue
    const insights = (asset.payload?.insights ?? null) as
      | { comments?: InstagramCommentRecord[]; permalink?: string | null }
      | null
    if (!insights || !Array.isArray(insights.comments)) continue
    const permalink = asString(insights.permalink) ?? asset.provider_permalink ?? null
    for (const raw of insights.comments) {
      const id = asString(raw.id)
      const text = asString(raw.text)
      if (!id || !text) continue
      items.push({
        id: `instagram:${id}`,
        source: 'instagram',
        username: asString(raw.username),
        text,
        timestamp: asString(raw.timestamp),
        permalink,
        assetId: asset.id,
      })
    }
  }

  items.sort((a, b) => {
    const at = a.timestamp ? Date.parse(a.timestamp) : 0
    const bt = b.timestamp ? Date.parse(b.timestamp) : 0
    return bt - at
  })

  return items
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
    const items = aggregateCrmInbox(assets)
    return NextResponse.json({ items })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
