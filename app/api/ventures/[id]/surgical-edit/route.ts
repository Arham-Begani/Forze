import { requireAuth, isAuthError } from '@/lib/auth'
import { getVenture, getConversation, patchConversationResult } from '@/lib/queries'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const SurgicalEditSchema = z.object({
  conversationId: z.string().min(1).max(100),
  path: z.array(z.string().min(1).max(100)).min(1).max(10),
  oldText: z.string().min(1).max(5000),
  newText: z.string().min(1).max(5000),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const venture = await getVenture(id, session.userId)
    if (!venture) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = SurgicalEditSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { conversationId, path, oldText, newText } = parsed.data

    // Verify conversation belongs to this venture
    const conversation = await getConversation(conversationId)
    if (!conversation || conversation.venture_id !== id) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const updatedResult = await patchConversationResult(conversationId, path, oldText, newText)

    return NextResponse.json({ result: updatedResult })
  } catch (e) {
    if (isAuthError(e)) return (e as any).toResponse()
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
