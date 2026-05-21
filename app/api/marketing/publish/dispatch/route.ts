import { dispatchDuePublishJobs } from '@/lib/marketing-dispatch'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.MARKETING_PUBLISH_CRON_SECRET
  if (!expected) return false
  const provided = request.headers.get('x-marketing-cron-secret') ?? ''
  // Constant-time compare so the secret length is not leaked by response
  // timing of the equality check.
  return timingSafeEqual(provided, expected)
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await dispatchDuePublishJobs()
    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    console.error('[marketing/publish/dispatch] error:', error)
    return NextResponse.json({ error: 'Dispatch failed' }, { status: 500 })
  }
}
