// POST/GET /api/cron/run-outreach
//
// Outreach engine tick — starts due scheduled campaigns, sends drip batches,
// sends follow-up touches, and syncs replies/bounces from Gmail. Runs every
// 10 minutes (vercel.json). Requests require a configured cron secret.
import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { runOutreachTick } from '@/lib/outreach-executor'
import { logError } from '@/lib/log'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  return isCronAuthorized(request, ['OUTREACH_CRON_SECRET', 'ROUTINES_CRON_SECRET', 'CRON_SECRET'])
}

async function runOnce(): Promise<NextResponse> {
  const adminDb = createAdminClient()
  try {
    const summary = await runOutreachTick(adminDb)
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'tick failed'
    logError('cron/run-outreach', err, { msg: '[cron/run-outreach] error' })
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
