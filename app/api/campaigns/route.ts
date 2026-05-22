// POST /api/campaigns — create campaign
// GET  /api/campaigns?venture_id=... — list campaigns
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { z } from 'zod'
import { CreateCampaignSchema } from '@/lib/schemas/campaign'
import { createCampaign, listVentureCampaigns } from '@/lib/queries/campaign-queries'
import { getVenture } from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'

const ListQuerySchema = z.object({
  venture_id: z.string().uuid().optional(),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'outreach')
    if (!gate.ok) return gate.response
    const { searchParams } = req.nextUrl
    const query = ListQuerySchema.safeParse({ venture_id: searchParams.get('venture_id') ?? undefined })

    if (!query.success) {
      return NextResponse.json({ error: 'Invalid query params' }, { status: 400 })
    }

    if (!query.data.venture_id) {
      return NextResponse.json({ error: 'venture_id is required' }, { status: 400 })
    }

    // Verify venture belongs to this user
    const venture = await getVenture(query.data.venture_id, session.userId)
    if (!venture) {
      return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
    }

    const campaigns = await listVentureCampaigns(query.data.venture_id)
    return NextResponse.json({ campaigns })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[campaigns] GET error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'outreach')
    if (!gate.ok) return gate.response
    const body = await req.json()
    const input = CreateCampaignSchema.safeParse(body)

    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    // Verify venture belongs to this user
    const venture = await getVenture(input.data.venture_id, session.userId)
    if (!venture) {
      return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
    }

    const campaign = await createCampaign(session.userId, input.data.venture_id, {
      name: input.data.name,
      description: input.data.description,
      data_source: input.data.data_source,
      data_source_config: input.data.data_source_config,
    })

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[campaigns] POST error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
