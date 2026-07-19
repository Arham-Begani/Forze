// PATCH  /api/ventures/[id]/routines/[routineId] — update fields / pause / resume
// DELETE /api/ventures/[id]/routines/[routineId] — delete routine
import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, isAuthError } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { UpdateRoutineInputSchema } from '@/lib/schemas/routine'
import {
  deleteRoutine,
  getRoutineForUser,
  updateRoutine,
} from '@/lib/queries/routine-queries'
import { logError } from '@/lib/log'

type RouteContext = { params: Promise<{ id: string; routineId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth()
    const { id, routineId } = await params

    const venture = await getVenture(id, session.userId)
    if (!venture) {
      return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
    }

    const existing = await getRoutineForUser(routineId, session.userId)
    if (!existing || existing.venture_id !== id) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 })
    }

    const body = await req.json()
    const input = UpdateRoutineInputSchema.safeParse(body)
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const updated = await updateRoutine(routineId, session.userId, input.data)
    return NextResponse.json({ routine: updated })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('ventures/id/routines/routineId', e, { msg: '[ventures/routines/:routineId] PATCH error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth()
    const { id, routineId } = await params

    const existing = await getRoutineForUser(routineId, session.userId)
    if (!existing || existing.venture_id !== id) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 })
    }

    await deleteRoutine(routineId, session.userId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('ventures/id/routines/routineId', e, { msg: '[ventures/routines/:routineId] DELETE error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
