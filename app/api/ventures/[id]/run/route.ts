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
import { after } from 'next/server'
import { z } from 'zod'
import { Content } from '@google/generative-ai'
import { runGenesisAgent } from '@/agents/genesis'
import { runIdentityAgent } from '@/agents/identity'
import { runContentAgent } from '@/agents/content'
import { runPipelineAgent } from '@/agents/pipeline'
import { runFeasibilityAgent } from '@/agents/feasibility'
import { runFullLaunch } from '@/agents/orchestrator'
import { runGeneralAgent } from '@/agents/general'
import { runShadowBoard } from '@/agents/shadow'
import { runInvestorKitAgent } from '@/agents/investor-kit'
import { runLaunchAutopilotAgent } from '@/agents/launch-autopilot'
import { runMVPScalpelAgent } from '@/agents/mvp-scalpel'

const DecisionSchema = z.object({
    questionId: z.string(),
    category: z.string(),
    question: z.string(),
    selectedLabel: z.string(),
    selectedDescription: z.string(),
    customAnswer: z.string().optional(),
})

const bodySchema = z.object({
    moduleId: z.enum(['research', 'branding', 'marketing', 'landing', 'feasibility', 'full-launch', 'general', 'shadow-board', 'investor-kit', 'launch-autopilot', 'mvp-scalpel']),
    prompt: z.string().min(1).max(2000),
    depth: z.enum(['brief', 'medium', 'detailed']).optional(),
    decisions: z.array(DecisionSchema).optional(),
    isContinuation: z.boolean().optional(),
    partialOutput: z.string().optional(),
})

interface Decision {
    questionId: string
    category: string
    question: string
    selectedLabel: string
    selectedDescription: string
    customAnswer?: string
}

function formatDecisionsForPrompt(decisions: Decision[]): string {
    if (!decisions || decisions.length === 0) return ''
    const lines = decisions.map(d => {
        const answer = d.customAnswer
            ? `${d.selectedLabel} — ${d.customAnswer}`
            : `${d.selectedLabel} (${d.selectedDescription})`
        return `- ${d.category}: ${d.question}\n  → User chose: ${answer}`
    })
    return `\n\n--- FOUNDER DECISIONS ---\nThe founder answered these strategic questions before this run. Incorporate their preferences:\n${lines.join('\n')}\n--- END DECISIONS ---\n`
}

async function runAgent(
    ventureId: string,
    conversationId: string,
    moduleId: string,
    prompt: string,
    userId: string,
    depth: 'brief' | 'medium' | 'detailed' = 'medium',
    decisions: Decision[] = [],
    isContinuation: boolean = false,
    partialOutput?: string
) {
    const venture = await getVenture(ventureId, userId)
    if (!venture) throw new Error('Venture not found')

    const project = venture.project_id ? await getProject(venture.project_id, userId) : null

    const decisionsContext = formatDecisionsForPrompt(decisions)

    let finalPrompt = prompt
    let history: Content[] = []

    if (isContinuation && partialOutput) {
        history = [
            { role: 'user', parts: [{ text: `${prompt}${decisionsContext}` }] },
            { role: 'model', parts: [{ text: partialOutput }] }
        ]
        finalPrompt = "Continue from where you left off. Do not repeat anything already outputted. Complete the JSON object strictly."
    }

    const ventureInput = {
        ventureId: venture.id,
        name: isContinuation ? `${venture.name} (Continuing...)` : `${venture.name}: ${prompt}${decisionsContext}`,
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
                }, depth, history)
                break

            case 'branding':
                await runIdentityAgent(ventureInput, onStream, async (result) => {
                    await updateVentureContext(ventureId, 'branding', result)
                    await setConversationResult(conversationId, result)
                }, history)
                break

            case 'marketing':
                await runContentAgent(ventureInput, onStream, async (result) => {
                    await updateVentureContext(ventureId, 'marketing', result)
                    await setConversationResult(conversationId, result)
                }, history)
                break

            case 'landing':
                await runPipelineAgent(ventureInput, onStream, async (result) => {
                    await updateVentureContext(ventureId, 'landing', result)
                    await setConversationResult(conversationId, result)
                }, history)
                break

            case 'feasibility':
                await runFeasibilityAgent(ventureInput, onStream, async (result) => {
                    await updateVentureContext(ventureId, 'feasibility', result)
                    await setConversationResult(conversationId, result)
                }, depth, history)
                break

            case 'full-launch':
                await runFullLaunch(ventureInput, onStream, onAgentStatus, async (result) => {
                    if (result.research) await updateVentureContext(ventureId, 'research', result.research)
                    if (result.branding) await updateVentureContext(ventureId, 'branding', result.branding)
                    if (result.marketing) await updateVentureContext(ventureId, 'marketing', result.marketing)
                    if (result.landing) await updateVentureContext(ventureId, 'landing', result.landing)
                    if (result.feasibility) await updateVentureContext(ventureId, 'feasibility', result.feasibility)
                    await setConversationResult(conversationId, result as unknown as Record<string, unknown>)
                }, depth, history)
                break

            case 'general':
                await runGeneralAgent(ventureInput, onStream, async (result) => {
                    // General chat does NOT write to venture context — it's conversational only
                    await setConversationResult(conversationId, result)
                }, history)
                break

            case 'shadow-board':
                await runShadowBoard(ventureInput, onStream, async (result) => {
                    // Shadow board results are stored in the conversation result but not venture context
                    // unless we want to add a shadowBoard field to VentureContext later.
                    // For now, let's keep it in the conversation.
                    await setConversationResult(conversationId, result as unknown as Record<string, unknown>)
                }, history)
                break

            case 'investor-kit':
                await runInvestorKitAgent(ventureInput, onStream, async (result) => {
                    await setConversationResult(conversationId, result as unknown as Record<string, unknown>)
                }, history)
                break

            case 'launch-autopilot':
                await runLaunchAutopilotAgent(ventureInput, onStream, async (result) => {
                    await setConversationResult(conversationId, result as unknown as Record<string, unknown>)
                })
                break

            case 'mvp-scalpel':
                await runMVPScalpelAgent(ventureInput, onStream, async (result) => {
                    await setConversationResult(conversationId, result as unknown as Record<string, unknown>)
                }, history)
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
        const stack = error instanceof Error ? error.stack : ''
        console.error(`Agent run failed [${moduleId}]:`, message, stack)
        try {
            await appendStreamLine(conversationId, `\n[Error: ${message}]`)
            await updateConversationStatus(conversationId, 'failed')
        } catch (dbError) {
            console.error('Failed to write error to DB:', dbError)
        }
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

        const { moduleId, prompt, depth, decisions, isContinuation, partialOutput } = result.data

        const venture = await getVenture(id, session.userId)
        if (!venture) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const conversation = await createConversation(id, moduleId, prompt)

        // Use after() to keep the serverless function alive while agent runs
        after(
            runAgent(id, conversation.id, moduleId, prompt, session.userId, depth, decisions, isContinuation, partialOutput).catch(
                err => console.error('Agent error:', err)
            )
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
