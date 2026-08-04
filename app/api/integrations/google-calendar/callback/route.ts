import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  handleCalendarCallback,
  verifyOAuthState,
  getReturnToFromState,
} from '@/lib/google-calendar'
import { logError } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
    .trim()
    .replace(/\/+$/, '')

  if (error || !code) {
    logError('integrations/google-calendar/callback', new Error(error ?? 'no_code'), {
      msg: 'google returned an error',
    })
    return NextResponse.redirect(`${appUrl}/dashboard?calendar_error=${error ?? 'no_code'}`)
  }

  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.redirect(`${appUrl}/signin`)
    }

    if (!state || !verifyOAuthState(state, session.userId)) {
      logError('integrations/google-calendar/callback', new Error('invalid_state'), {
        msg: 'state did not match session',
      })
      return NextResponse.redirect(`${appUrl}/dashboard?calendar_error=invalid_state`)
    }

    const result = await handleCalendarCallback(session.userId, code)
    const returnTo = getReturnToFromState(state) ?? '/dashboard'
    const sep = returnTo.includes('?') ? '&' : '?'
    const emailParam = result.emailAddress
      ? `&email=${encodeURIComponent(result.emailAddress)}`
      : ''
    const reauthParam = result.needsReauth ? '&calendar_reauth=1' : ''

    return NextResponse.redirect(
      `${appUrl}${returnTo}${sep}calendar_connected=1${emailParam}${reauthParam}`
    )
  } catch (err) {
    logError('integrations/google-calendar/callback', err, { msg: 'callback failed' })
    return NextResponse.redirect(`${appUrl}/dashboard?calendar_error=callback_failed`)
  }
}
