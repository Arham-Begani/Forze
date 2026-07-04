// POST /api/campaigns/:campaignId/scout-leads
//
// Two modes:
//   { mode: 'icp' }              → cheap Flash pass; returns an editable ICP
//                                  draft built from the venture's positioning.
//   { mode: 'scout', icp: '…' }  → web-search Gemini pass; returns prospect
//                                  candidates. Metered as the weekly
//                                  'lead_scout' action (migration 042).
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, isAuthError } from '@/lib/auth'
import { getCampaignForUser } from '@/lib/queries/campaign-queries'
import { getVenture, getProject } from '@/lib/queries'
import { generateIcpDraft, runLeadScout } from '@/agents/lead-scout'
import { enforceRateLimit, AI_RUN_LIMIT, AI_RUN_WINDOW_SEC } from '@/lib/rate-limit'
import { gateActionForResponse, gateFeatureForResponse } from '@/lib/billing-http'

type RouteContext = { params: Promise<{ id: string }> }

const BodySchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('icp') }),
  z.object({
    mode: z.literal('scout'),
    icp: z.string().min(40).max(2000),
    count: z.number().int().min(5).max(20).optional(),
  }),
])

export async function POST(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'outreach')
    if (!gate.ok) return gate.response

    const { id } = await params
    const campaign = await getCampaignForUser(id, session.userId)
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const input = BodySchema.safeParse(await req.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const rl = await enforceRateLimit(session.userId, 'ai:lead-scout', AI_RUN_WINDOW_SEC, AI_RUN_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded — try again later' }, { status: 429 })
    }

    const venture = await getVenture(campaign.venture_id, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    if (input.data.mode === 'icp') {
      let globalIdea: string | null = null
      try {
        const project = venture.project_id ? await getProject(venture.project_id, session.userId) : null
        globalIdea = project?.global_idea ?? null
      } catch {
        // best-effort enrichment only
      }

      const icp = await generateIcpDraft(
        venture.name,
        venture.context as unknown as Record<string, unknown>,
        globalIdea
      )
      return NextResponse.json({ icp })
    }

    // Scout mode — the expensive web-search pass burns one weekly
    // lead_scout unit. Charged only after all validation passed.
    const actionGate = await gateActionForResponse(session.userId, 'lead_scout')
    if (!actionGate.ok) return actionGate.response

    const result = await runLeadScout(venture.name, input.data.icp, input.data.count ?? 15)
    return NextResponse.json(result)
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[campaigns/scout-leads] POST error:', e)
    return NextResponse.json({ error: 'Lead scout failed — try again in a moment' }, { status: 502 })
  }
}
