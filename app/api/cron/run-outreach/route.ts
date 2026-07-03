// POST/GET /api/cron/run-outreach
//
// Outreach engine tick — starts due scheduled campaigns, sends drip batches,
// sends follow-up touches, and syncs replies/bounces from Gmail. Runs every
// 10 minutes (vercel.json). Same auth pattern as /api/cron/run-routines so it
// works under Vercel Cron (GET + Bearer CRON_SECRET / x-vercel-cron) and via
// manual curl for local testing.
import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { runOutreachTick } from '@/lib/outreach-executor'

export const maxDuration = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function timingSafeStringCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isAuthorized(request: NextRequest): boolean {
  const outreachSecret = process.env.OUTREACH_CRON_SECRET ?? process.env.ROUTINES_CRON_SECRET
  const vercelCronSecret = process.env.CRON_SECRET

  const headerSecret = request.headers.get('x-outreach-cron-secret') ?? ''
  if (outreachSecret && headerSecret && timingSafeStringCompare(headerSecret, outreachSecret)) return true

  const auth = request.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length)
    if (outreachSecret && timingSafeStringCompare(token, outreachSecret)) return true
    if (vercelCronSecret && timingSafeStringCompare(token, vercelCronSecret)) return true
  }

  if (request.headers.get('x-vercel-cron')) return true

  return false
}

async function runOnce(): Promise<NextResponse> {
  const adminDb = createAdminClient()
  try {
    const summary = await runOutreachTick(adminDb)
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'tick failed'
    console.error('[cron/run-outreach] error:', err)
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
