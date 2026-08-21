// GET/POST /api/cron/poll-crm-replies
//
// Background sweep: persists + AI-classifies new Gmail replies to CRM
// outreach sends across every venture, so the CRM Replies panel doesn't
// depend solely on a user manually clicking "Check for replies". Requests
// require the configured cron secret.
import { NextRequest, NextResponse } from 'next/server'
import { runCrmRepliesSync } from '@/lib/crm-replies-cron'
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
    const summary = await runCrmRepliesSync()
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'tick failed'
    logError('cron/poll-crm-replies', err, { msg: '[cron/poll-crm-replies] error' })
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
