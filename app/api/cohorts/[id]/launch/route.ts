import { requireAuth, isAuthError } from '@/lib/auth'
import {
    getCohortById,
    getVenture,
    updateCohortStatus,
    updateCohortComparison,
    updateVentureContext,
} from '@/lib/queries'
import { runFullLaunch } from '@/agents/orchestrator'
import { runCohortComparator } from '@/agents/cohort-comparator'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const launchBodySchema = z.object({
    strategy: z.enum(['sequential', 'parallel']).default('sequential'),
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params

        const cohort = await getCohortById(id)
        if (!cohort || cohort.user_id !== session.userId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        if (cohort.variant_ids.length < 2) {
            return NextResponse.json({ error: 'Cohort needs at least 2 variants' }, { status: 400 })
        }

        const body = await request.json().catch(() => ({}))
        const parsed = launchBodySchema.safeParse(body)
        const strategy = parsed.success ? parsed.data.strategy : 'sequential'

        // Fetch all variant ventures
        const variantVentures = await Promise.all(
            cohort.variant_ids.map(vid => getVenture(vid, session.userId))
        )
        const validVentures = variantVentures.filter(Boolean) as NonNullable<typeof variantVentures[0]>[]

        if (validVentures.length < 2) {
            return NextResponse.json({ error: 'Could not find variant ventures' }, { status: 400 })
        }

        const encoder = new TextEncoder()
        const stream = new ReadableStream({
            async start(controller) {
                function send(event: string, data: unknown) {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
                }

                try {
                    await updateCohortStatus(id, 'running')

                    const launchVariant = async (venture: typeof validVentures[0]) => {
                        send('variant-status', { variantId: venture.id, variantName: venture.name, status: 'running' })

                        const ventureInput = {
                            ventureId: venture.id,
                            name: venture.name,
                            context: venture.context as unknown as Record<string, unknown>,
                        }

                        await runFullLaunch(
                            ventureInput,
                            async (chunk) => {
                                send('stream', { variantId: venture.id, content: chunk })
                            },
                            async (agentId, status) => {
                                send('variant-agent-status', { variantId: venture.id, agentId, status })
                            },
                            async (result) => {
                                // Save results to venture context
                                if (result.research) await updateVentureContext(venture.id, 'research', result.research)
                                if (result.branding) await updateVentureContext(venture.id, 'branding', result.branding)
                                if (result.marketing) await updateVentureContext(venture.id, 'marketing', result.marketing)
                                if (result.landing) await updateVentureContext(venture.id, 'landing', result.landing)
                                if (result.feasibility) await updateVentureContext(venture.id, 'feasibility', result.feasibility)
                            }
                        )

                        send('variant-status', { variantId: venture.id, variantName: venture.name, status: 'complete' })
                    }

                    // Run variants based on strategy
                    if (strategy === 'parallel') {
                        await Promise.all(validVentures.map(launchVariant))
                    } else {
                        for (const venture of validVentures) {
                            await launchVariant(venture)
                        }
                    }

                    // Comparison phase
                    await updateCohortStatus(id, 'comparing')
                    send('comparison-start', {})

                    // Re-fetch ventures to get updated context
                    const updatedVentures = await Promise.all(
                        cohort.variant_ids.map(vid => getVenture(vid, session.userId))
                    )
                    const validUpdated = updatedVentures.filter(Boolean) as NonNullable<typeof updatedVentures[0]>[]

                    const comparatorInput = validUpdated.map(v => ({
                        name: v.name,
                        context: v.context as unknown as Record<string, unknown>,
                    }))

                    await runCohortComparator(
                        comparatorInput,
                        async (chunk) => {
                            send('stream', { phase: 'comparison', content: chunk })
                        },
                        async (comparisonResult) => {
                            await updateCohortComparison(id, comparisonResult as unknown as Record<string, unknown>)
                            await updateCohortStatus(id, 'complete')
                            send('comparison-complete', { result: comparisonResult })
                        }
                    )

                    send('cohort-complete', {})
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error'
                    send('error', { message })
                    try {
                        await updateCohortStatus(id, 'draft')
                    } catch {}
                } finally {
                    controller.close()
                }
            },
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        })
    } catch (e) {
        if (isAuthError(e)) return (e as any).toResponse()
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
