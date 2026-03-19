import { requireAuth, isAuthError } from '@/lib/auth'
import { getCohortById, createVenture, updateCohortVariants } from '@/lib/queries'
import { runVariantGenerator } from '@/agents/variant-generator'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params

        const cohort = await getCohortById(id)
        if (!cohort || cohort.user_id !== session.userId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const encoder = new TextEncoder()
        const stream = new ReadableStream({
            async start(controller) {
                function send(event: string, data: unknown) {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
                }

                try {
                    let result: any = null

                    await runVariantGenerator(
                        cohort.core_idea,
                        cohort.name,
                        async (chunk) => {
                            send('stream', { content: chunk })
                        },
                        async (output) => {
                            result = output
                        }
                    )

                    if (!result || !result.variants) {
                        send('error', { message: 'Variant generation failed' })
                        controller.close()
                        return
                    }

                    // Create a venture for each variant
                    const ventureIds: string[] = []
                    for (const variant of result.variants) {
                        const venture = await createVenture(
                            session.userId,
                            `${cohort.name}: ${variant.name}`,
                            cohort.project_id ?? undefined
                        )
                        ventureIds.push(venture.id)
                    }

                    // Update cohort with variant IDs
                    await updateCohortVariants(id, ventureIds)

                    send('complete', {
                        variants: result.variants.map((v: any, i: number) => ({
                            ...v,
                            ventureId: ventureIds[i],
                        })),
                    })
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error'
                    send('error', { message })
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
