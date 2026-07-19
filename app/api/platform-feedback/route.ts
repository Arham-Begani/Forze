import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createPlatformFeedback, type PlatformFeedbackCategory } from '@/lib/queries'
import { logError } from '@/lib/log'

const ALLOWED: PlatformFeedbackCategory[] = ['bug', 'feature', 'praise', 'other']

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = (await req.json().catch(() => ({}))) as {
      category?: unknown
      message?: unknown
      pageUrl?: unknown
    }

    const category = typeof body.category === 'string' ? body.category : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl.slice(0, 500) : null

    if (!ALLOWED.includes(category as PlatformFeedbackCategory)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    if (message.length < 5) return NextResponse.json({ error: 'Message is too short' }, { status: 400 })
    if (message.length > 4000) return NextResponse.json({ error: 'Message is too long' }, { status: 400 })

    const entry = await createPlatformFeedback(
      session.userId,
      session.email ?? 'unknown@local',
      { category: category as PlatformFeedbackCategory, message, pageUrl }
    )

    return NextResponse.json({ success: true, feedback: entry })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const msg = error instanceof Error ? error.message : 'Failed to submit feedback'
    logError('platform-feedback', error, { msg: '[POST /api/platform-feedback] error' })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
