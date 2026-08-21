// POST/GET /api/marketing/publish/dispatch
//
// Cron entrypoint that drains due publish jobs (scheduled social posts).
// Vercel Cron invokes this route with a configured Bearer secret; manual
// requests may use the route-specific secret header or the same Bearer token.
import { dispatchDuePublishJobs } from '@/lib/marketing-dispatch'
import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/log'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  return isCronAuthorized(request, ['MARKETING_PUBLISH_CRON_SECRET', 'CRON_SECRET'])
}

async function runOnce(): Promise<NextResponse> {
  try {
    const summary = await dispatchDuePublishJobs()
    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    logError('marketing/publish/dispatch', error, { msg: '[marketing/publish/dispatch] error' })
    return NextResponse.json({ error: 'Dispatch failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runOnce()
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runOnce()
}
