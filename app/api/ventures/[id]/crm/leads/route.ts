// GET /api/ventures/[id]/crm/leads
// Syncs newly-seen Instagram commenters into the real `leads` table (see
// 035_crm_leads_unify_social.sql), then returns the venture's full, unified
// lead list — social and email leads are one model now, so there's no
// separate "social leads" response shape to maintain.

import { NextRequest, NextResponse } from 'next/server'
import { requireMarketingVenture, marketingErrorResponse } from '@/lib/marketing-api'
import { listMarketingAssetsByVenture } from '@/lib/marketing-queries'
import { aggregateCrmInbox, type CrmInboxItem } from '../inbox/route'
import { getLeadsForVenture, upsertSocialLead } from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'

function externalIdentityFor(item: CrmInboxItem): string | null {
  if (!item.username) return null
  return `${item.source}:${item.username.toLowerCase()}`
}

// One upsert per distinct commenter (not per comment) — aggregateCrmInbox
// already dedupes visually in the Inbox tab, but the sync here needs the
// canonical set of identities to upsert against.
async function syncSocialLeads(ventureId: string, items: CrmInboxItem[]): Promise<void> {
  const seen = new Set<string>()
  for (const item of items) {
    const externalIdentity = externalIdentityFor(item)
    if (!externalIdentity || seen.has(externalIdentity)) continue
    seen.add(externalIdentity)
    await upsertSocialLead(ventureId, externalIdentity, {
      name: item.username,
      source: item.source,
    })
  }
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
    const inboxItems = aggregateCrmInbox(assets)
    await syncSocialLeads(id, inboxItems)

    const leads = await getLeadsForVenture(id)
    return NextResponse.json({ leads })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
