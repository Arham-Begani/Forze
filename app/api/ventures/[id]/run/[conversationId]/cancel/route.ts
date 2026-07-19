// app/api/ventures/[id]/run/[conversationId]/cancel/route.ts
import { requireAuth, isAuthError } from '@/lib/auth'
import { getVenture, getConversation, updateConversationStatus } from '@/lib/queries'
import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/log'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
    try {
        const session = await requireAuth()
        const { id, conversationId } = await params

        const venture = await getVenture(id, session.userId)
        if (!venture) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const conversation = await getConversation(conversationId)
        if (!conversation || conversation.venture_id !== id) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        if (conversation.status !== 'running') {
            return NextResponse.json({ error: 'Not running' }, { status: 400 })
        }

        await updateConversationStatus(conversationId, 'failed')

        return NextResponse.json({ success: true })
    } catch (e) {
        if (isAuthError(e)) return (e as any).toResponse()
        logError('ventures/id/run/conversationId/cancel', e, { msg: 'Cancel failed' })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
