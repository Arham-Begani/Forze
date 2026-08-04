import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import {
  getCalendarAuthUrl,
  getCalendarStatus,
  disconnectCalendar,
  signOAuthState,
} from '@/lib/google-calendar'
import { logError } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const status = await getCalendarStatus(session.userId)
    return NextResponse.json(status)
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('integrations/google-calendar', e, { msg: 'calendar status failed' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const body = (await req.json().catch(() => ({}))) as {
      action?: string
      returnTo?: string
    }

    if (body.action === 'disconnect') {
      await disconnectCalendar(session.userId)
      return NextResponse.json({ status: 'disconnected' })
    }

    const state = signOAuthState(session.userId, body.returnTo)
    const authUrl = getCalendarAuthUrl(state)
    return NextResponse.json({ authUrl })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('integrations/google-calendar', e, { msg: 'calendar connect failed' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
