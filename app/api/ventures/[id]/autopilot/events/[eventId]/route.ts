import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth, isAuthError } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { createCalendarEvent } from '@/lib/google-calendar'
import { getVentureEvent, updateVentureEvent } from '@/lib/queries/autopilot-queries'
import { logError } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string; eventId: string }> }

const patchSchema = z.object({
  action: z.enum(['save', 'dismiss', 'add_to_calendar']),
})

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'autopilot')
    if (!gate.ok) return gate.response

    const { id, eventId } = await params
    const venture = await getVenture(id, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    const body = await req.json().catch(() => null)
    const input = patchSchema.safeParse(body)
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const event = await getVentureEvent(eventId, session.userId)
    if (!event || event.venture_id !== id) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (input.data.action === 'save') {
      const updated = await updateVentureEvent(eventId, session.userId, { status: 'saved' })
      return NextResponse.json({ event: updated })
    }

    if (input.data.action === 'dismiss') {
      const updated = await updateVentureEvent(eventId, session.userId, { status: 'dismissed' })
      return NextResponse.json({ event: updated })
    }

    if (!event.starts_at) {
      return NextResponse.json(
        { error: 'This event has no confirmed date, so it cannot be added to your calendar' },
        { status: 400 }
      )
    }

    const start = event.starts_at
    const end =
      event.ends_at ?? new Date(new Date(start).getTime() + 2 * 60 * 60 * 1000).toISOString()

    try {
      const created = await createCalendarEvent(session.userId, {
        title: event.name,
        description: event.why_relevant,
        location: [event.venue, event.city].filter(Boolean).join(', ') || null,
        start,
        end,
        ventureId: id,
        sourceUrl: event.url,
      })

      const updated = await updateVentureEvent(eventId, session.userId, {
        status: 'added_to_calendar',
        calendar_event_id: created.id,
      })
      return NextResponse.json({ event: updated, calendarEvent: created })
    } catch (err) {
      logError('ventures/autopilot/events', err, { msg: 'calendar insert failed' })
      return NextResponse.json(
        { error: 'Could not add this to your calendar. Reconnect Google Calendar and try again.' },
        { status: 502 }
      )
    }
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('ventures/autopilot/events', e, { msg: 'event action failed' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
