// GET  /api/integrations/gmail — connection status
// POST /api/integrations/gmail — initiate OAuth (default) or { action: 'disconnect' }
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { getGmailAuthUrl, getGmailStatus, disconnectGmail, signOAuthState } from '@/lib/gmail-oauth'

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const status = await getGmailStatus(session.userId)
    return NextResponse.json(status)
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const body = await req.json().catch(() => ({})) as { action?: string }

    if (body.action === 'disconnect') {
      await disconnectGmail(session.userId)
      return NextResponse.json({ status: 'disconnected' })
    }

    // Signed state ties the callback to this specific user/session and expires
    // in 10 minutes — prevents OAuth CSRF where an attacker's consent code gets
    // exchanged for the victim's stored token.
    const state = signOAuthState(session.userId)
    const authUrl = getGmailAuthUrl(state)
    return NextResponse.json({ authUrl })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
