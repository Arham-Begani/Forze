// app/api/ventures/[id]/timeline/route.ts
import { requireAuth, isAuthError } from '@/lib/auth'
import { getVenture, getConversationsByVenture } from '@/lib/queries'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params

        const venture = await getVenture(id, session.userId)
        if (!venture) {
            return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
        }

        const conversations = await getConversationsByVenture(id)

        // Determine which conversation is the "active" one for each module
        // by comparing conversation result with current venture context
        const activeVersions: Record<string, string | null> = {}
        const moduleIds = ['landing'] as const

        for (const moduleId of moduleIds) {
            const currentContext = (venture.context as any)?.[moduleId]
            if (!currentContext) {
                activeVersions[moduleId] = null
                continue
            }

            // Find the conversation whose result matches current context
            const moduleConversations = conversations.filter(c => c.module_id === moduleId && c.status === 'complete')
            const currentContextStr = JSON.stringify(currentContext)

            let matched = false
            for (const conv of moduleConversations) {
                if (JSON.stringify(conv.result) === currentContextStr) {
                    activeVersions[moduleId] = conv.id
                    matched = true
                    break
                }
            }
            if (!matched) {
                // Default to most recent complete conversation
                activeVersions[moduleId] = moduleConversations[0]?.id ?? null
            }
        }

        return NextResponse.json({
            timeline: conversations,
            activeVersions,
        })
    } catch (e) {
        if (isAuthError(e)) return (e as any).toResponse()
        console.error('Timeline error:', e)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
