import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { fetchCrmGmailReplies } from '@/lib/gmail-replies'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const venture = await getVenture(id, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    const replies = await fetchCrmGmailReplies(session.userId, id)
    return NextResponse.json({ success: true, replies })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    const needsReauth = /reconnect|expired|not connected/i.test(message)
    console.error('[crm/replies] GET error:', error)
    return NextResponse.json(
      { error: message, code: needsReauth ? 'gmail_reauth_required' : 'crm_replies_failed' },
      { status: needsReauth ? 401 : 500 }
    )
  }
}
