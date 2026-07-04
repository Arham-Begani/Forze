// POST /api/campaigns/:campaignId/generate-email
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { GenerateEmailSchema } from '@/lib/schemas/campaign'
import { getCampaignForUser, updateCampaign } from '@/lib/queries/campaign-queries'
import { generateCampaignEmail } from '@/lib/email-generator'
import { getVenture } from '@/lib/queries'
import { buildOutreachBrief } from '@/lib/outreach-brief'
import { enforceRateLimit, AI_RUN_LIMIT, AI_RUN_WINDOW_SEC } from '@/lib/rate-limit'
import { gateFeatureForResponse } from '@/lib/billing-http'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'outreach')
    if (!gate.ok) return gate.response
    const { id } = await params

    const rl = await enforceRateLimit(session.userId, 'ai:generate-email', AI_RUN_WINDOW_SEC, AI_RUN_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded — 10 AI runs per hour' }, { status: 429 })
    }

    const campaign = await getCampaignForUser(id, session.userId)
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const body = await req.json()
    const input = GenerateEmailSchema.safeParse(body)
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    // Enrich the (often thin, post-pivot) client-sent description with the
    // venture's real positioning: landing copy + shadow board + legacy
    // context, server-side. Best-effort — a missing venture just means the
    // generator works from the client description alone.
    let ventureDescription = input.data.ventureDescription
    try {
      const venture = await getVenture(campaign.venture_id, session.userId)
      if (venture) {
        const brief = buildOutreachBrief(
          venture.name,
          venture.context as unknown as Record<string, unknown>
        )
        if (brief.includes('\n')) {
          ventureDescription = `${input.data.ventureDescription}\n\n${brief}`.slice(0, 2000)
        }
      }
    } catch {
      // non-fatal
    }

    const generated = await generateCampaignEmail(
      ventureDescription,
      input.data.targetAudience,
      input.data.exampleLeads
    )

    // Save to campaign
    await updateCampaign(id, {
      subject_line: generated.subject_line,
      subject_line_variants: generated.subject_line_variants,
      email_body: generated.email_body,
      email_body_variants: generated.email_body_variants,
    })

    return NextResponse.json({ generated })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[campaigns/generate-email] POST error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
