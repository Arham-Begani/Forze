// POST /api/ventures/:id/direct-mail/generate-email
// Generates a one-off AI draft for Direct Mail without creating a campaign.
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { GenerateEmailSchema } from '@/lib/schemas/campaign'
import { getVenture } from '@/lib/queries'
import { generateCampaignEmail } from '@/lib/email-generator'
import { enforceRateLimit, AI_RUN_LIMIT, AI_RUN_WINDOW_SEC } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const { id } = await params

    const venture = await getVenture(id, session.userId)
    if (!venture) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const rl = await enforceRateLimit(session.userId, 'ai:direct-mail-generate', AI_RUN_WINDOW_SEC, AI_RUN_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded — 10 AI runs per hour' }, { status: 429 })
    }

    const body = await req.json()
    const input = GenerateEmailSchema.safeParse(body)
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const generated = await generateCampaignEmail(
      input.data.ventureDescription,
      input.data.targetAudience,
      input.data.exampleLeads
    )

    return NextResponse.json({ generated })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[ventures/direct-mail/generate-email] POST error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
