// app/api/ventures/[id]/pin/route.ts
import { requireAuth, isAuthError } from '@/lib/auth'
import { getVenture, getConversation, updateVentureContext } from '@/lib/queries'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const bodySchema = z.object({
    conversationId: z.string().uuid(),
    moduleId: z.enum(['landing']),
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params

        const body = await request.json()
        const result = bodySchema.safeParse(body)
        if (!result.success) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
        }

        const { conversationId, moduleId } = result.data

        // Verify venture ownership
        const venture = await getVenture(id, session.userId)
        if (!venture) {
            return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
        }

        // Verify conversation belongs to this venture and is complete
        const conversation = await getConversation(conversationId)
        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }
        if (conversation.venture_id !== id) {
            return NextResponse.json({ error: 'Conversation does not belong to this venture' }, { status: 403 })
        }
        if (conversation.status !== 'complete') {
            return NextResponse.json({ error: 'Can only pin completed conversations' }, { status: 400 })
        }
        if (!conversation.result || Object.keys(conversation.result).length === 0) {
            return NextResponse.json({ error: 'Conversation has no result to pin' }, { status: 400 })
        }

        // Pin: write conversation result to venture context
        await updateVentureContext(id, moduleId, conversation.result)

        return NextResponse.json({ success: true, pinnedConversationId: conversationId })
    } catch (e) {
        if (isAuthError(e)) return (e as any).toResponse()
        console.error('Pin error:', e)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
