// GET/POST /api/cron/weekly-digest
//
// Weekly founder retention email. Runs Mondays 09:00 UTC (vercel.json). Emails
// each founder with landing-page activity in the past 7 days a short "here's
// your week" summary. Per-user once-a-week dedup lives in runWeeklyDigest via
// the anon rate limiter, so a double cron fire never double-sends.
//
// Same auth pattern as the other crons: timing-safe Bearer CRON_SECRET, with
// x-vercel-cron trusted only when actually running on Vercel.
import { NextRequest, NextResponse } from 'next/server'

import { runWeeklyDigest, weekAgoIso } from '@/lib/weekly-digest'
import { logError } from '@/lib/log'

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
  const vercelCronSecret = process.env.CRON_SECRET

  const auth = request.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ') && vercelCronSecret) {
    const token = auth.slice('Bearer '.length)
    if (timingSafeStringCompare(token, vercelCronSecret)) return true
  }

  if (process.env.VERCEL && request.headers.get('x-vercel-cron')) return true

  return false
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
