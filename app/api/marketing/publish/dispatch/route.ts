// POST/GET /api/marketing/publish/dispatch
//
// Cron entrypoint that drains due publish jobs (scheduled social posts).
// Mirrors the auth pattern of /api/cron/run-routines: Vercel Cron invokes
// with GET + `Authorization: Bearer <CRON_SECRET>` + `x-vercel-cron`, while
// manual curl/tests can use the legacy `x-marketing-cron-secret` header or a
// Bearer token. Handling only POST + the custom header (the previous shape)
// meant every scheduled invocation 401'd and scheduled posts never published.
import { dispatchDuePublishJobs } from '@/lib/marketing-dispatch'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isAuthorized(request: NextRequest): boolean {
  // Accepted shapes:
  //   1. `x-marketing-cron-secret: <MARKETING_PUBLISH_CRON_SECRET>` — manual curl + tests.
  //   2. `Authorization: Bearer <MARKETING_PUBLISH_CRON_SECRET>` — manual curl.
  //   3. `Authorization: Bearer <CRON_SECRET>` — Vercel Cron auto-injects this.
  //   4. `x-vercel-cron` header present — Vercel sets this internally on every
  //      cron invocation and strips it from inbound external requests at the
  //      edge, so its presence proves the request came from Vercel's scheduler.
  const marketingSecret = process.env.MARKETING_PUBLISH_CRON_SECRET
  const vercelCronSecret = process.env.CRON_SECRET

  const headerSecret = request.headers.get('x-marketing-cron-secret') ?? ''
  if (marketingSecret && headerSecret && timingSafeEqual(headerSecret, marketingSecret)) return true

  const auth = request.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length)
    if (marketingSecret && timingSafeEqual(token, marketingSecret)) return true
    if (vercelCronSecret && timingSafeEqual(token, vercelCronSecret)) return true
  }

  // Only trust x-vercel-cron when actually running on Vercel — its edge strips
  // the header from inbound external requests; elsewhere it is spoofable.
  if (process.env.VERCEL && request.headers.get('x-vercel-cron')) return true

  return false
}

async function runOnce(): Promise<NextResponse> {
  try {
    const summary = await dispatchDuePublishJobs()
    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    console.error('[marketing/publish/dispatch] error:', error)
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
