// GET  /api/ventures/[id]/routines — list routines under a venture
// POST /api/ventures/[id]/routines — create a routine
import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, isAuthError } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { getCampaignForUser } from '@/lib/queries/campaign-queries'
import { CreateRoutineInputSchema } from '@/lib/schemas/routine'
import {
  createRoutine,
  listRoutinesByVenture,
} from '@/lib/queries/routine-queries'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth()
    const { id } = await params

    const venture = await getVenture(id, session.userId)
    if (!venture) {
      return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
    }

    const routines = await listRoutinesByVenture(id, session.userId)
    return NextResponse.json({ routines })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[ventures/routines] GET error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth()
    const { id } = await params

    // Ownership gate before parsing the body — cheap reject for impostors.
    const venture = await getVenture(id, session.userId)
    if (!venture) {
      return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
    }

    const body = await req.json()
    const input = CreateRoutineInputSchema.safeParse(body)
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }
    const data = input.data

    // For Gmail routines, verify the linked campaign belongs to this user
    // and to this venture. Otherwise a malicious user could couple their
    // routine to someone else's campaign.
    if (data.channel === 'gmail') {
      if (!data.campaign_id) {
        return NextResponse.json(
          { error: 'campaign_id is required for gmail routines' },
          { status: 400 }
        )
      }
      const campaign = await getCampaignForUser(data.campaign_id, session.userId)
      if (!campaign || campaign.venture_id !== id) {
        return NextResponse.json(
          { error: 'Campaign not found or does not belong to this venture' },
          { status: 400 }
        )
      }
    }

    const routine = await createRoutine(session.userId, id, data)
    return NextResponse.json({ routine }, { status: 201 })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[ventures/routines] POST error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
