// GET/POST /api/cron/poll-crm-replies
//
// Background sweep: persists + AI-classifies new Gmail replies to CRM
// outreach sends across every venture, so the CRM Replies panel doesn't
// depend solely on a user manually clicking "Check for replies". Same auth
// pattern as /api/cron/run-outreach (Bearer CRON_SECRET / x-vercel-cron).
import { NextRequest, NextResponse } from 'next/server'
import { runCrmRepliesSync } from '@/lib/crm-replies-cron'

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

  if (request.headers.get('x-vercel-cron')) return true

  return false
}

async function runOnce(): Promise<NextResponse> {
  try {
    const summary = await runCrmRepliesSync()
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'tick failed'
    console.error('[cron/poll-crm-replies] error:', err)
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
