import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth, isAuthError } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { createDb } from '@/lib/db'
import { gateActionForResponse, gateFeatureForResponse } from '@/lib/billing-http'
import { enforceRateLimit, AI_RUN_LIMIT, AI_RUN_WINDOW_SEC } from '@/lib/rate-limit'
import { discoverEvents } from '@/lib/event-radar'
import { listUpcomingEvents } from '@/lib/google-calendar'
import {
  getAutopilotSettings,
  listVentureEvents,
  saveDiscoveredEvents,
} from '@/lib/queries/autopilot-queries'
import { logError } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type RouteContext = { params: Promise<{ id: string }> }

const runSchema = z.object({
  location: z.string().trim().max(200).optional(),
  windowDays: z.number().int().min(7).max(365).optional(),
})

export async function GET(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'autopilot')
    if (!gate.ok) return gate.response

    const { id } = await params
    const venture = await getVenture(id, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    const events = await listVentureEvents(id, session.userId, await createDb())
    return NextResponse.json({ events })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('ventures/autopilot/events', e, { msg: 'event list failed' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'autopilot')
    if (!gate.ok) return gate.response

    const { id } = await params
    const venture = await getVenture(id, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const input = runSchema.safeParse(body ?? {})
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const rl = await enforceRateLimit(
      session.userId,
      'ai:event-radar',
      AI_RUN_WINDOW_SEC,
      AI_RUN_LIMIT
    )
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded — try again later' }, { status: 429 })
    }

    const settings = await getAutopilotSettings(id)
    const location = input.data.location?.trim() || settings.location

    const actionGate = await gateActionForResponse(session.userId, 'event_radar')
    if (!actionGate.ok) return actionGate.response

    // A missing or unreadable calendar must not block discovery — it only
    // means conflicts cannot be annotated on this pass.
    const calendarEvents = await listUpcomingEvents(session.userId, {
      timeMax: new Date(
        Date.now() + (input.data.windowDays ?? 90) * 24 * 60 * 60 * 1000
      ).toISOString(),
      maxResults: 250,
    }).catch(() => [])

    const ranked = await discoverEvents({
      ventureName: venture.name,
      context: (venture.context ?? {}) as unknown as Record<string, unknown>,
      location,
      windowDays: input.data.windowDays,
      calendarEvents,
    })

    await saveDiscoveredEvents(
      id,
      session.userId,
      ranked.map((event) => ({
        name: event.name,
        url: event.url,
        url_key: event.urlKey,
        source_url: event.sourceUrl,
        starts_at: event.startsAt,
        ends_at: event.endsAt,
        city: event.city,
        venue: event.venue,
        format: event.format,
        price_note: event.priceNote,
        audience: event.audience,
        why_relevant: event.whyRelevant,
        score: event.score,
        conflicts: event.conflicts,
        status: 'suggested' as const,
        calendar_event_id: null,
      }))
    ).catch((err) => {
      logError('ventures/autopilot/events', err, { msg: 'saving discovered events failed' })
      return 0
    })

    const events = await listVentureEvents(id, session.userId, await createDb())
    return NextResponse.json({
      discovered: ranked.length,
      calendarChecked: calendarEvents.length > 0,
      events,
    })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('ventures/autopilot/events', e, { msg: 'event radar run failed' })
    return NextResponse.json({ error: 'Could not scan for events right now' }, { status: 500 })
  }
}
