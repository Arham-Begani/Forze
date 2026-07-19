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
import { logError } from '@/lib/log'

export const maxDuration = 300
// Cron must run on a Node.js runtime — the executor pulls in the Gmail
// sender and the Gemini SDK which both need server-only Node APIs.
export const runtime = 'nodejs'
// Never serve from cache. Each invocation must hit the DB to claim due rows.
export const dynamic = 'force-dynamic'

function timingSafeStringCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isAuthorized(request: NextRequest): boolean {
  // Accepted shapes:
  //   1. `x-routines-cron-secret: <ROUTINES_CRON_SECRET>` — manual curl + tests.
  //   2. `Authorization: Bearer <ROUTINES_CRON_SECRET>` — manual curl.
  //   3. `Authorization: Bearer <CRON_SECRET>` — Vercel Cron auto-injects
  //      this header using the project-level CRON_SECRET env var. Without
  //      this branch, every scheduled invocation 401s and routines silently
  //      stop firing on their own.
  //   4. `x-vercel-cron: 1` header present — Vercel sets this internally on
  //      every cron invocation and strips it from inbound external requests
  //      at the edge, so its mere presence is sufficient proof the request
  //      came from Vercel's scheduler. This is the fallback that lets the
  //      cron Just Work on first deploy without the user having to
  //      configure CRON_SECRET in their project env.
  const routinesSecret = process.env.ROUTINES_CRON_SECRET
  const vercelCronSecret = process.env.CRON_SECRET

  const headerSecret = request.headers.get('x-routines-cron-secret') ?? ''
  if (routinesSecret && headerSecret && timingSafeStringCompare(headerSecret, routinesSecret)) return true

  const auth = request.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length)
    if (routinesSecret && timingSafeStringCompare(token, routinesSecret)) return true
    if (vercelCronSecret && timingSafeStringCompare(token, vercelCronSecret)) return true
  }

  // Only trust x-vercel-cron when actually running on Vercel — its edge strips
  // the header from inbound external requests, but a self-hosted/local deploy
  // has no such stripping, so there the header is attacker-suppliable.
  if (process.env.VERCEL && request.headers.get('x-vercel-cron')) return true

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
      logError('cron/run-routines', err, { msg: '[cron/run-routines] unhandled executor error' })
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
