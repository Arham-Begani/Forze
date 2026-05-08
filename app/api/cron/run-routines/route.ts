// POST/GET /api/cron/run-routines
//
// Hourly cron entrypoint. Claims every active routine whose next_run_at has
// passed and runs the executor for each one. Mirrors the auth pattern of
// /api/marketing/publish/dispatch — header-based shared secret. Vercel Cron
// can call either GET or POST; we handle both so the route works both as a
// scheduled cron and as a manual `curl` for local testing.
import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { claimDueRoutines } from '@/lib/queries/routine-queries'
import { executeRoutine } from '@/lib/routine-executor'

export const maxDuration = 300
// Cron must run on a Node.js runtime — the executor pulls in the Gmail
// sender and the Gemini SDK which both need server-only Node APIs.
export const runtime = 'nodejs'
// Never serve from cache. Each invocation must hit the DB to claim due rows.
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.ROUTINES_CRON_SECRET
  if (!expected) return false

  // Two accepted shapes:
  //   1. `x-routines-cron-secret: <secret>` — used by manual curl + tests.
  //   2. `Authorization: Bearer <secret>` — used by Vercel Cron, which sends
  //      this header when CRON_SECRET is configured on the project.
  const headerSecret = request.headers.get('x-routines-cron-secret')
  if (headerSecret && headerSecret === expected) return true

  const auth = request.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ') && auth.slice('Bearer '.length) === expected) return true

  return false
}

async function runOnce(): Promise<NextResponse> {
  const adminDb = createAdminClient()

  let claimed
  try {
    claimed = await claimDueRoutines(50, adminDb)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'claim failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }

  let succeeded = 0
  let failed = 0
  let skipped = 0

  // Sequential by design. Each fire is at most one Gmail send + one LLM
  // call, and 50 routines × ~5s = 4 minutes — well under maxDuration. Going
  // parallel would help raw throughput but bumps risk of hitting Gmail
  // per-second quota across users sharing one machine. Revisit if cron
  // queue depth ever exceeds 50/hour.
  for (const routine of claimed) {
    try {
      const result = await executeRoutine(routine, adminDb)
      if (result.status === 'success') succeeded += 1
      else if (result.status === 'skipped') skipped += 1
      else failed += 1
    } catch (err) {
      // Defensive — executeRoutine already catches its own errors and
      // records a routine_runs row. This catch is here so one wild throw
      // doesn't stop the rest of the batch.
      failed += 1
      console.error('[cron/run-routines] unhandled executor error:', err)
    }
  }

  return NextResponse.json({
    ok: true,
    summary: {
      claimed: claimed.length,
      succeeded,
      failed,
      skipped,
    },
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runOnce()
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runOnce()
}
