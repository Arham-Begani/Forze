// GET /api/ventures/[id]/crm/outreach-activity
// Read-only, additive merge of CRM's own outreach_campaigns (written by
// crm/dispatch) and the separate Campaigns/Auto-GTM system's campaigns
// table (written by app/api/campaigns/*) — the two systems don't share
// tables, so a send from one never shows up in the other's view today.
// This does not converge the data models; it just gives an honest, clearly
// labeled combined read so the tab isn't silently missing half the picture.
// Full convergence is explicitly out of scope (see the CRM roadmap plan).

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getOutreachCampaignsForVenture, getVenture } from '@/lib/queries'
import { listVentureCampaigns } from '@/lib/queries/campaign-queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import type { CampaignSummary } from '@/components/venture/crm/shared'

const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  initial_outreach: 'Initial Outreach',
  follow_up: 'Follow-up',
  newsletter: 'Newsletter',
}

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

    const [crmCampaigns, gtmCampaigns] = await Promise.all([
      getOutreachCampaignsForVenture(id),
      listVentureCampaigns(id).catch(() => []), // outreach feature gate may block; degrade gracefully
    ])

    const combined: CampaignSummary[] = [
      ...crmCampaigns.map((campaign) => ({
        id: campaign.id,
        name: `CRM: ${CAMPAIGN_TYPE_LABEL[campaign.type] ?? campaign.type}`,
        status: campaign.status,
        sent_count: campaign.sent_count,
        opened_count: 0,
        clicked_count: 0,
        replied_count: 0,
        origin: 'crm' as const,
      })),
      ...gtmCampaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        sent_count: campaign.sent_count,
        opened_count: campaign.opened_count,
        clicked_count: campaign.clicked_count,
        replied_count: campaign.replied_count,
        origin: 'campaigns' as const,
      })),
    ]

    return NextResponse.json({ campaigns: combined })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[crm/outreach-activity] GET error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
