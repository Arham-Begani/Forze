// GET/POST /api/cron/sweep-stuck-runs
//
// Failsafe for agent runs whose serverless invocation died before writing a
// terminal status (maxDuration kill, OOM, redeploy mid-run). Those rows stay
// status='running' forever: the founder sees a spinner that never resolves
// (the SSE stream route only times out client-side) and admin success-rate
// metrics silently drift. This cron flips any 'running' conversation older
// than STALE_AFTER_MINUTES to 'failed' and appends a human-readable stream
// line so the UI explains what happened instead of showing a dead spinner.
//
// Threshold rationale: the run route declares maxDuration = 300 (5 min) and
// continuations always create a NEW conversation row, so a 'running' row
// older than 15 minutes (3x margin) is definitionally dead.
//
// Same auth pattern as /api/cron/run-outreach: Bearer CRON_SECRET (timing-
// safe) or x-vercel-cron, the latter trusted only when running on Vercel.
import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STALE_AFTER_MINUTES = 15

function timingSafeStringCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isAuthorized(request: NextRequest): boolean {
  const vercelCronSecret = process.env.CRON_SECRET

  const auth = request.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ') && vercelCronSecret) {
    const token = auth.slice('Bearer '.length)
    if (timingSafeStringCompare(token, vercelCronSecret)) return true
  }

  // Only trust x-vercel-cron when actually running on Vercel — its edge strips
  // the header from inbound external requests; elsewhere it is spoofable.
  if (process.env.VERCEL && request.headers.get('x-vercel-cron')) return true

  return false
}

async function runOnce(): Promise<NextResponse> {
  const admin = createAdminClient()
  try {
    const cutoff = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000).toISOString()

    const { data, error } = await admin
      .from('conversations')
      .update({ status: 'failed' })
      .eq('status', 'running')
      .lt('created_at', cutoff)
      .select('id')

    if (error) throw new Error(error.message)
    const ids = (data ?? []).map((row) => row.id as string)

    // Best-effort explanation in the stream output. Uses the admin client's
    // RPC directly (NOT lib/queries appendStreamLine — that helper is cookie-
    // scoped and a cron has no session, so RLS would block it). A failure
    // here must never fail the sweep itself.
    for (const id of ids) {
      try {
        await admin.rpc('append_to_jsonb_array', {
          table_name: 'conversations',
          id_val: id,
          col_name: 'stream_output',
          new_value: '\n[Run interrupted — the server timed out or restarted before this run could finish. Please retry.]\n',
        })
      } catch {
        // best-effort only
      }
    }

    if (ids.length > 0) {
      console.warn(`[cron/sweep-stuck-runs] swept ${ids.length} stuck run(s): ${ids.join(', ')}`)
    }
    return NextResponse.json({ ok: true, sweptCount: ids.length, ids })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sweep failed'
    console.error('[cron/sweep-stuck-runs] error:', err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
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
