import { NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { sendForzeAuthMail, type ForzeAuthMailEvent } from '@/lib/forze-mail'
import { enforceRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const bodySchema = z.object({
  event: z.enum(['login', 'email_confirmed', 'password_changed']) satisfies z.ZodType<ForzeAuthMailEvent>,
})

export async function POST(request: Request) {
  try {
    const session = await requireAuth()
    const body = bodySchema.parse(await request.json())

    // The sign-in alert used to fire on EVERY login — pure friction, and alert
    // fatigue means users stop reading it. Throttle to at most once per 24h per
    // user so it still flags unusual activity without spamming. Security-
    // meaningful one-time events (email_confirmed, password_changed) always send.
    if (body.event === 'login') {
      const rl = await enforceRateLimit(session.userId, 'login-alert', 86400, 1)
      if (!rl.allowed) {
        return NextResponse.json({ ok: true, sent: false, reason: 'throttled' })
      }
    }

    const result = await sendForzeAuthMail({
      event: body.event,
      email: session.email,
      name: session.name,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (isAuthError(error)) return error.toResponse()
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    console.error('[POST /api/auth/notify] error:', error)
    return NextResponse.json({ error: 'Could not send notification' }, { status: 500 })
  }
}
