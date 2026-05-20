// app/api/ventures/[id]/inspiration/analyze/route.ts
//
// Single synchronous endpoint that runs the full inspiration pipeline for a
// venture: validate URLs → capture image (5-tier fallback) → Gemini vision →
// merge tokens (if 2-3 URLs) → persist analysis row. The spec describes this
// as an async job with polling, but the captures are network-bound on the
// order of ~3-10s per URL and we already use Next.js's 300s function budget
// for agent runs. Founders get the editor immediately instead of polling.
//
// The route does not mutate venture.context.inspirationTokens — that hand-off
// is explicit via POST /apply once the founder is satisfied with the edits.

// 90 seconds is generous for 3 URLs × (HTML fetch + image download + vision).
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError, isAuthError } from '@/lib/auth'
import { getVentureAccess, getVenture } from '@/lib/queries'
import { InspirationAnalyzeInputSchema } from '@/lib/schemas/inspiration'
import { captureInspirationImage, isCaptureSuccess } from '@/lib/inspiration/screenshot'
import { analyzeImageWithGemini } from '@/lib/inspiration/vision'
import { mergeTokens } from '@/lib/inspiration/tokens'
import {
    checkInspirationRateLimit,
    createInspirationAnalysis,
    incrementInspirationRateLimit,
    updateInspirationAnalysis,
} from '@/lib/queries/inspiration-queries'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await requireAuth()
        const ventureId = (await params).id
        if (!UUID_RE.test(ventureId)) {
            return NextResponse.json({ error: 'Invalid ventureId' }, { status: 400 })
        }

        // Editors and above can run inspiration analyses; viewers cannot.
        const role = await getVentureAccess(ventureId, session.userId)
        if (!role || role === 'viewer') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Ensure venture exists (and is reachable through any membership path).
        const venture = await getVenture(ventureId, session.userId)
        if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

        const body = await req.json().catch(() => null)
        const parsed = InspirationAnalyzeInputSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.flatten() },
                { status: 400 },
            )
        }
        const { urls, uploadedImage } = parsed.data

        // Rate-limit check before doing any expensive work.
        const limit = await checkInspirationRateLimit(session.userId, ventureId)
        if (!limit.allowed) {
            return NextResponse.json(
                {
                    error: 'Daily inspiration limit reached',
                    rateLimit: limit,
                },
                { status: 429 },
            )
        }

        const analysis = await createInspirationAnalysis({
            venture_id: ventureId,
            user_id: session.userId,
            urls,
            status: 'analyzing',
        })

        try {
            // Capture all URLs in parallel — most are fetch-bound and the
            // wall-clock improvement is significant.
            const captures = await Promise.all(
                urls.map((url) => captureInspirationImage(url, { uploadedImage })),
            )

            const successes = captures.filter(isCaptureSuccess)
            if (successes.length === 0) {
                const failureReasons = captures.map((c) => ({
                    url: c.url,
                    error: 'error' in c ? c.error : 'unknown',
                }))
                await updateInspirationAnalysis(analysis.id, session.userId, {
                    status: 'failed',
                    error_message: `All URL captures failed: ${failureReasons.map((f) => `${f.url} (${f.error})`).join('; ')}`,
                    capture_metadata: { perUrl: failureReasons },
                })
                return NextResponse.json(
                    {
                        analysisId: analysis.id,
                        status: 'failed',
                        error: 'Could not capture any of the provided URLs. Try uploading a screenshot manually.',
                        failures: failureReasons,
                    },
                    { status: 422 },
                )
            }

            // Vision analysis per successful capture, run in parallel. Each
            // call is internally retried + timeboxed in analyzeImageWithGemini.
            const tokenResults = await Promise.all(
                successes.map((capture) => analyzeImageWithGemini(capture)),
            )

            const tokens = mergeTokens(tokenResults.map((t) => t.tokens))

            await incrementInspirationRateLimit(session.userId, ventureId)

            const updated = await updateInspirationAnalysis(analysis.id, session.userId, {
                status: 'complete',
                tokens,
                raw_vision: { perUrl: tokenResults.map((t, idx) => ({
                    url: successes[idx].url,
                    tier: successes[idx].tier,
                    tokens: t.tokens,
                })) },
                confidence: tokens.confidenceByCategory as unknown as Record<string, number>,
                mood: tokens.brand.mood,
                capture_tier: Math.max(...successes.map((c) => c.tier)),
                capture_metadata: {
                    perUrl: successes.map((c) => ({
                        url: c.url,
                        tier: c.tier,
                        contentType: c.image.contentType,
                        bytes: c.image.bytes,
                        sourceUrl: c.sourceUrl,
                    })),
                },
            })

            const refreshedLimit = await checkInspirationRateLimit(session.userId, ventureId)

            return NextResponse.json({
                analysisId: analysis.id,
                status: 'complete',
                tokens: updated?.tokens ?? tokens,
                confidence: tokens.confidenceByCategory,
                mood: tokens.brand.mood,
                captureSummary: successes.map((c) => ({
                    url: c.url,
                    tier: c.tier,
                    sourceUrl: c.sourceUrl,
                })),
                rateLimit: refreshedLimit,
            })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Vision analysis failed'
            console.error('[POST inspiration/analyze] internal error', err)
            await updateInspirationAnalysis(analysis.id, session.userId, {
                status: 'failed',
                error_message: message,
            }).catch(() => undefined)
            return NextResponse.json(
                { analysisId: analysis.id, status: 'failed', error: message },
                { status: 500 },
            )
        }
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        console.error('[POST inspiration/analyze] unexpected', e)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
