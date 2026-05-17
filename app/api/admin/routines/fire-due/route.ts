// POST /api/admin/routines/fire-due
//
// Admin-only manual trigger that runs the same logic as the hourly cron
// (/api/cron/run-routines), but uses requireAdmin() so you can call it from
// the browser without exposing ROUTINES_CRON_SECRET. Returns a verbose
// per-routine summary so you can see *why* a fire succeeded, failed, or
// claimed zero rows — which the cron endpoint deliberately doesn't surface.
import { NextResponse } from 'next/server'

import { requireAdmin, isAuthError } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { claimDueRoutines, type ClaimedRoutine } from '@/lib/queries/routine-queries'
import { executeRoutine } from '@/lib/routine-executor'

export const maxDuration = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PerRoutineResult {
  routineId: string
  name: string
  channel: ClaimedRoutine['channel']
  status: 'success' | 'failed' | 'skipped' | 'threw'
  errorMessage?: string
  durationMs: number
}

export async function POST() {
  try {
    await requireAdmin()
    const startedAt = Date.now()
    const adminDb = createAdminClient()

    // Pre-claim snapshot: count active routines and how many are due. This
    // tells us whether the executor is the bottleneck or the claim function
    // is silently returning zero.
    const nowIso = new Date().toISOString()
    const { data: dueSnapshot } = await adminDb
      .from('routines')
      .select('id, name, next_run_at, last_run_at, last_error, status', { count: 'exact' })
      .eq('status', 'active')
      .lte('next_run_at', nowIso)
      .order('next_run_at', { ascending: true })
      .limit(50)

    // Also pull every active routine's full schedule so we can spot a
    // "next_run_at is unexpectedly in the future" or timezone misconfig.
    const { data: allActive } = await adminDb
      .from('routines')
      .select('id, name, channel, status, cadence, send_hour, send_minute, timezone, next_run_at, last_run_at, last_error, run_count, campaign_id')
      .neq('status', 'archived')
      .order('next_run_at', { ascending: true })
      .limit(100)

    let claimed: ClaimedRoutine[]
    try {
      claimed = await claimDueRoutines(50, adminDb)
    } catch (err) {
      return NextResponse.json({
        ok: false,
        stage: 'claim',
        error: err instanceof Error ? err.message : 'claim failed',
        dueBeforeClaim: dueSnapshot ?? [],
      }, { status: 500 })
    }

    const results: PerRoutineResult[] = []
    for (const routine of claimed) {
      const startedAtMs = Date.now()
      try {
        const result = await executeRoutine(routine, adminDb)
        results.push({
          routineId: routine.id,
          name: routine.name,
          channel: routine.channel,
          status: result.status,
          errorMessage: result.errorMessage,
          durationMs: Date.now() - startedAtMs,
        })
      } catch (err) {
        results.push({
          routineId: routine.id,
          name: routine.name,
          channel: routine.channel,
          status: 'threw',
          errorMessage: err instanceof Error ? err.message : 'unknown executor error',
          durationMs: Date.now() - startedAtMs,
        })
      }
    }

    const summary = {
      dueBeforeClaim: dueSnapshot?.length ?? 0,
      claimed: claimed.length,
      succeeded: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed' || r.status === 'threw').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      durationMs: Date.now() - startedAt,
    }

    return NextResponse.json({
      ok: true,
      serverNowUtc: nowIso,
      summary,
      dueBeforeClaim: dueSnapshot ?? [],
      allActive: allActive ?? [],
      results,
    })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
