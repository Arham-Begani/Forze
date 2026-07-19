import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getVenture, getOutreachRepliesForVenture } from '@/lib/queries'
import { syncCrmReplies } from '@/lib/gmail-replies'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { logError } from '@/lib/log'

// Manual "Check for replies" trigger: syncs new Gmail replies into
// outreach_replies (deduped, AI-classified via analyzeReply()) for this
// venture, then returns the full persisted+classified list. The background
// poll-crm-replies cron covers ventures the user hasn't manually checked;
// this route gives an immediate result for the one you're looking at.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await gateFeatureForResponse(session.userId, 'crm')
    if (!gate.ok) return gate.response

    const { id } = await params
    const venture = await getVenture(id, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    await syncCrmReplies(session.userId, id).catch((err) => {
      // Gmail disconnected/expired shouldn't 500 the whole request — fall
      // back to whatever was already persisted (e.g. from the cron sweep).
      console.warn('[crm/replies] syncCrmReplies failed, serving persisted replies only:', err)
    })

    const replies = await getOutreachRepliesForVenture(id)
    return NextResponse.json({ success: true, replies })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    const needsReauth = /reconnect|expired|not connected/i.test(message)
    logError('ventures/id/crm/replies', error, { msg: '[crm/replies] GET error' })
    return NextResponse.json(
      { error: message, code: needsReauth ? 'gmail_reauth_required' : 'crm_replies_failed' },
      { status: needsReauth ? 401 : 500 }
    )
  }
}
