// GET/POST /api/cron/weekly-digest
//
// Weekly founder retention email. Runs Mondays 09:00 UTC (vercel.json). Emails
// each founder with landing-page activity in the past 7 days a short "here's
// your week" summary. Per-user once-a-week dedup lives in runWeeklyDigest via
// the anon rate limiter, so a double cron fire never double-sends.
//
// Requests require the configured cron secret.
import { NextRequest, NextResponse } from 'next/server'

import { runWeeklyDigest, weekAgoIso } from '@/lib/weekly-digest'
import { logError } from '@/lib/log'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  return isCronAuthorized(request, ['CRON_SECRET'])
}

async function runOnce(): Promise<NextResponse> {
  try {
    // Date.now() is fine in a request handler (unlike workflow scripts).
    const summary = await runWeeklyDigest(weekAgoIso(Date.now()))
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'digest failed'
    logError('cron/weekly-digest', err)
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
