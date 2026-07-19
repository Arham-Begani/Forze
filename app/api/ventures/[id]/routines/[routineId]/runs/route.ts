// GET /api/ventures/[id]/routines/[routineId]/runs — recent runs (default 20)
import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, isAuthError } from '@/lib/auth'
import {
  getRoutineForUser,
  listRoutineRuns,
} from '@/lib/queries/routine-queries'
import { logError } from '@/lib/log'

type RouteContext = { params: Promise<{ id: string; routineId: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth()
    const { id, routineId } = await params

    const routine = await getRoutineForUser(routineId, session.userId)
    if (!routine || routine.venture_id !== id) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 })
    }

    const limitParam = req.nextUrl.searchParams.get('limit')
    const limit = limitParam ? Math.max(1, Math.min(100, Number(limitParam) || 20)) : 20

    const runs = await listRoutineRuns(routineId, session.userId, limit)
    return NextResponse.json({ runs })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('ventures/id/routines/routineId/runs', e, { msg: '[ventures/routines/runs] GET error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
