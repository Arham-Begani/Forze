import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth, isAuthError } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { createDb } from '@/lib/db'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { getCalendarStatus } from '@/lib/google-calendar'
import { buildWeeklyAgenda, summarizeAgenda } from '@/lib/weekly-agenda'
import {
  getAutopilotSettings,
  listSuggestedActions,
  listVentureEvents,
  upsertAutopilotSettings,
} from '@/lib/queries/autopilot-queries'
import { logError } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

const settingsSchema = z
  .object({
    location: z.string().trim().max(200).nullable().optional(),
    default_approval_window_hours: z.number().int().min(0).max(168).optional(),
    event_radar_enabled: z.boolean().optional(),
    max_comment_replies_per_run: z.number().int().min(1).max(25).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export async function GET(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'autopilot')
    if (!gate.ok) return gate.response

    const { id } = await params
    const venture = await getVenture(id, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    const db = await createDb()

    const [calendar, settings, events, suggestions, agenda] = await Promise.all([
      getCalendarStatus(session.userId).catch(() => null),
      getAutopilotSettings(id, db),
      listVentureEvents(id, session.userId, db),
      listSuggestedActions(id, session.userId, db),
      buildWeeklyAgenda({ userId: session.userId, ventureId: id, adminDb: db }).catch(() => null),
    ])

    return NextResponse.json({
      calendar,
      settings,
      events,
      suggestions,
      agenda,
      summary: agenda ? summarizeAgenda(agenda) : null,
    })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('ventures/autopilot', e, { msg: 'autopilot summary failed' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'autopilot')
    if (!gate.ok) return gate.response

    const { id } = await params
    const venture = await getVenture(id, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    const body = await req.json().catch(() => null)
    const input = settingsSchema.safeParse(body)
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    await upsertAutopilotSettings(id, session.userId, input.data)
    const settings = await getAutopilotSettings(id)
    return NextResponse.json({ settings })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('ventures/autopilot', e, { msg: 'autopilot settings update failed' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
