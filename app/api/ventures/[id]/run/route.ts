// app/api/ventures/[id]/run/route.ts
import { requireAuth, AuthError, isAuthError } from '@/lib/auth'
import {
    getVenture,
    createConversation,
    appendStreamLine,
    updateConversationStatus,
    setConversationResult,
    updateVentureContext,
    getProject,
} from '@/lib/queries'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runGenesisAgent } from '@/agents/genesis'
import { runIdentityAgent } from '@/agents/identity'
import { runContentAgent } from '@/agents/content'
import { runPipelineAgent } from '@/agents/pipeline'
import { runFeasibilityAgent } from '@/agents/feasibility'
import { runFullLaunch } from '@/agents/orchestrator'
import { runGeneralAgent } from '@/agents/general'
import { runShadowBoard } from '@/agents/shadow'

const bodySchema = z.object({
    moduleId: z.enum(['research', 'branding', 'marketing', 'landing', 'feasibility', 'full-launch', 'general', 'shadow-board']),
    prompt: z.string().min(1).max(2000),
    depth: z.enum(['brief', 'medium', 'detailed']).optional(),
})

async function runAgent(
    ventureId: string,
    conversationId: string,
    moduleId: string,
    prompt: string,
    userId: string,
    depth: 'brief' | 'medium' | 'detailed' = 'medium'
) {
    const venture = await getVenture(ventureId, userId)
    if (!venture) throw new Error('Venture not found')

    const project = venture.project_id ? await getProject(venture.project_id, userId) : null

    const ventureInput = {
        ventureId: venture.id,
        name: `${venture.name}: ${prompt}`,
        globalIdea: project?.global_idea ?? undefined,
        context: venture.context as unknown as Record<string, unknown>,
    }

    let buffer = ''
    const onStream = async (chunk: string) => {
        buffer += chunk
        const lines = buffer.split('\n')
        // Keep the last partial line in the buffer
        buffer = lines.pop() ?? ''
        
        for (const line of lines) {
            if (line.trim()) await appendStreamLine(conversationId, line)
        }
    }

    const onAgentStatus = async (agentId: string, status: string) => {
        await appendStreamLine(conversationId, `__STATUS__${agentId}:${status}`)
    }

    try {
        switch (moduleId) {
            case 'research':
                await runGenesisAgent(ventureInput, onStream, async (result) => {
                    await updateVentureContext(ventureId, 'research', result)
                    await setConversationResult(conversationId, result)
                }, depth)
                break

            case 'branding':
                await runIdentityAgent(ventureInput, onStream, async (result) => {
                    await updateVentureContext(ventureId, 'branding', result)
                    await setConversationResult(conversationId, result)
                })
                break

            case 'marketing':
                await runContentAgent(ventureInput, onStream, async (result) => {
                    await updateVentureContext(ventureId, 'marketing', result)
                    await setConversationResult(conversationId, result)
                })
                break

            case 'landing':
                await runPipelineAgent(ventureInput, onStream, async (result) => {
                    await updateVentureContext(ventureId, 'landing', result)
                    await setConversationResult(conversationId, result)
                })
                break

            case 'feasibility':
                await runFeasibilityAgent(ventureInput, onStream, async (result) => {
                    await updateVentureContext(ventureId, 'feasibility', result)
                    await setConversationResult(conversationId, result)
                }, depth)
                break

            case 'full-launch':
                await runFullLaunch(ventureInput, onStream, onAgentStatus, async (result) => {
                    if (result.research) await updateVentureContext(ventureId, 'research', result.research)
                    if (result.branding) await updateVentureContext(ventureId, 'branding', result.branding)
                    if (result.marketing) await updateVentureContext(ventureId, 'marketing', result.marketing)
                    if (result.landing) await updateVentureContext(ventureId, 'landing', result.landing)
                    if (result.feasibility) await updateVentureContext(ventureId, 'feasibility', result.feasibility)
                    await setConversationResult(conversationId, result as unknown as Record<string, unknown>)
                }, depth)
                break

            case 'general':
                await runGeneralAgent(ventureInput, onStream, async (result) => {
                    // General chat does NOT write to venture context — it's conversational only
                    await setConversationResult(conversationId, result)
                })
                break

            case 'shadow-board':
                await runShadowBoard(ventureInput, onStream, async (result) => {
                    // Shadow board results are stored in the conversation result but not venture context
                    // unless we want to add a shadowBoard field to VentureContext later.
                    // For now, let's keep it in the conversation.
                    await setConversationResult(conversationId, result as unknown as Record<string, unknown>)
                })
                break

            default:
                throw new Error(`Unknown moduleId: ${moduleId}`)
        }

        // Flush remaining buffer
        if (buffer.trim()) {
            await appendStreamLine(conversationId, buffer.trim())
        }

        await updateConversationStatus(conversationId, 'complete')

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await appendStreamLine(conversationId, `\n[Error: ${message}]`)
        await updateConversationStatus(conversationId, 'failed')
    }
}

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
            return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
        }

        const { moduleId, prompt, depth } = result.data

        const venture = await getVenture(id, session.userId)
        if (!venture) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const conversation = await createConversation(id, moduleId, prompt)

        // Fire and forget — agent runs async
        runAgent(id, conversation.id, moduleId, prompt, session.userId, depth).catch(
            err => console.error('Agent error:', err)
        )

        return NextResponse.json(
            { conversationId: conversation.id, status: 'running' },
            { status: 202 }
        )
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
