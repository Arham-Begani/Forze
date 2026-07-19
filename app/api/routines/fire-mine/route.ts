// POST /api/routines/fire-mine
//
// Auth'd, user-scoped trigger that claims and executes the calling user's
// due routines. The Routines panel calls this on mount so routines actually
// fire whenever the owner opens the page — independent of whether the
// hourly Vercel Cron is wired up correctly. Returns a small summary the
// client uses to decide whether to refetch the routines list.
//
// Why a separate endpoint instead of inlining in the GET handler:
//   • GET handlers should stay side-effect-free (idempotent, cacheable).
//   • Firing a batch of LLM + Gmail/Instagram calls can take 30+ seconds;
//     blocking the list response on it would make the panel feel broken.
//     The client kicks this off in parallel with the list fetch.
//   • Keeps the auth and rate-limit story isolated from list semantics.
import { NextResponse } from 'next/server'

import { requireAuth, isAuthError } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  claimDueRoutinesForUser,
  type ClaimedRoutine,
} from '@/lib/queries/routine-queries'
import { executeRoutine } from '@/lib/routine-executor'
import { logError } from '@/lib/log'

// Same ceiling as the cron route — one user shouldn't have more than a
// handful of routines firing at once anyway, so this is generous headroom.
export const maxDuration = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface FireMineSummary {
  claimed: number
  succeeded: number
  failed: number
  skipped: number
}

export async function POST() {
  try {
    const session = await requireAuth()
    const adminDb = createAdminClient()

    let claimed: ClaimedRoutine[]
    try {
      claimed = await claimDueRoutinesForUser(session.userId, 25, adminDb)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'claim failed'
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }

    if (claimed.length === 0) {
      const summary: FireMineSummary = { claimed: 0, succeeded: 0, failed: 0, skipped: 0 }
      return NextResponse.json({ ok: true, summary })
    }

    let succeeded = 0
    let failed = 0
    let skipped = 0

    // Sequential by design — one user's batch is small, and Gmail's per-user
    // send quota is shared across these calls. Parallel firing would risk
    // bursting the same Gmail credential past its per-second limit.
    for (const routine of claimed) {
      try {
        const result = await executeRoutine(routine, adminDb)
        if (result.status === 'success') succeeded += 1
        else if (result.status === 'skipped') skipped += 1
        else failed += 1
      } catch (err) {
        failed += 1
        logError('routines/fire-mine', err, { msg: '[routines/fire-mine] unhandled executor error' })
      }
    }

    const summary: FireMineSummary = {
      claimed: claimed.length,
      succeeded,
      failed,
      skipped,
    }
    return NextResponse.json({ ok: true, summary })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
