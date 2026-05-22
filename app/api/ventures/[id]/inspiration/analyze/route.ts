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
import { scrapeHtmlTokens } from '@/lib/inspiration/html-scrape'
import { analyzeImageWithSelfConsistency } from '@/lib/inspiration/vision'
import { mergeTokens } from '@/lib/inspiration/tokens'
import { validateAccessibility } from '@/lib/inspiration/accessibility'
import { scoreTokens } from '@/lib/inspiration/scoring'
import {
    detectSections,
    analyzeComponentPatterns,
    analyzeAntiPatterns,
    type PassContext,
} from '@/lib/inspiration/passes'
import {
    checkInspirationRateLimit,
    createInspirationAnalysis,
    incrementInspirationRateLimit,
    updateInspirationAnalysis,
} from '@/lib/queries/inspiration-queries'
import { gateActionForResponse } from '@/lib/billing-http'

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

        // Plan-gate + per-week ceiling combined. Throws 403 'feature_not_in_plan'
        // for free/starter; throws 429 'weekly_action_limit_reached' for builder+
        // who've used their weekly inspiration analyses allotment.
        const actionGate = await gateActionForResponse(session.userId, 'inspiration_analyze')
        if (!actionGate.ok) return actionGate.response

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
        const { urls, uploadedImage, mergeWeights } = parsed.data

        // Build a PassContext from venture.context.research so every Gemini
        // call (token extraction + enrichment passes) can lean on what the
        // founder is actually building, not just generic "extract tokens".
        const research = (venture.context.research ?? {}) as Record<string, unknown>
        const passContext: PassContext = {
            ventureName: venture.name,
            oneLiner: typeof research.oneLiner === 'string'
                ? research.oneLiner
                : typeof research.summary === 'string'
                    ? research.summary
                    : typeof research.description === 'string'
                        ? research.description
                        : undefined,
            audience: typeof research.targetAudience === 'string'
                ? research.targetAudience
                : typeof research.audience === 'string'
                    ? research.audience
                    : undefined,
            ventureType: typeof research.category === 'string'
                ? research.category
                : typeof research.industry === 'string'
                    ? research.industry
                    : undefined,
        }

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
            // wall-clock improvement is significant. We also scrape the live
            // HTML of each URL in parallel so vision gets real font names +
            // CSS variables as ground truth alongside the screenshot.
            const [captures, scrapes] = await Promise.all([
                Promise.all(urls.map((url) => captureInspirationImage(url, { uploadedImage }))),
                Promise.all(urls.map((url) => scrapeHtmlTokens(url).catch(() => null))),
            ])

            // Fold each URL's scrape result into its capture so the vision
            // pass sees fonts/css-vars/inline colours as part of groundTruth.
            // Tier 0 captures already carry Microlink palette + brand/bg —
            // the scrape is purely additive: never overwrites Tier 0 values.
            for (let i = 0; i < captures.length; i++) {
                const cap = captures[i]
                if (!isCaptureSuccess(cap)) continue
                const sc = scrapes[i]
                if (!sc) continue
                cap.groundTruth = {
                    ...(cap.groundTruth ?? {}),
                    fontHeading: cap.groundTruth?.fontHeading ?? sc.fonts.heading,
                    fontBody: cap.groundTruth?.fontBody ?? sc.fonts.body,
                    fontMono: cap.groundTruth?.fontMono ?? sc.fonts.mono,
                    allFontFamilies: cap.groundTruth?.allFontFamilies ?? sc.fonts.allFamilies,
                    cssVariables: cap.groundTruth?.cssVariables ?? sc.cssVariables,
                    inlineColors: cap.groundTruth?.inlineColors ?? sc.inlineColors,
                    title: cap.groundTruth?.title ?? sc.title,
                    description: cap.groundTruth?.description ?? sc.description,
                }
            }

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

            // Vision analysis per successful capture + enrichment passes on
            // the primary capture, ALL in parallel. The enrichment passes
            // (sections / components / antipatterns) only run on the first
            // successful capture because they're describing the inspiration's
            // design language as a whole — we don't need three parallel reads
            // of the same conclusion.
            const primaryCapture = successes[0]
            const [
                tokenResults,
                detectedSections,
                componentPatterns,
                antiPatterns,
            ] = await Promise.all([
                Promise.all(successes.map((capture) => analyzeImageWithSelfConsistency(capture, passContext))),
                detectSections(primaryCapture, passContext),
                analyzeComponentPatterns(primaryCapture, passContext),
                analyzeAntiPatterns(primaryCapture, passContext),
            ])

            const tokens = mergeTokens(
                tokenResults.map((t) => t.tokens),
                mergeWeights,
            )

            // Deterministic post-processing — no extra Gemini calls.
            const accessibility = validateAccessibility(tokens)
            const scoring = scoreTokens(tokens, accessibility)

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
                // ── Migration 028 fields ────────────────────────────────────
                detected_sections: detectedSections as unknown as Record<string, unknown> | null,
                pass2_components: componentPatterns as unknown as Record<string, unknown> | null,
                interaction_states: componentPatterns as unknown as Record<string, unknown> | null,
                pass3_antipatterns: antiPatterns as unknown as Record<string, unknown> | null,
                context_relevance: antiPatterns?.contextRelevance as unknown as Record<string, unknown> | null,
                accessibility_report: accessibility as unknown as Record<string, unknown>,
                has_contrast_issues: accessibility.hasContrastIssues,
                requires_manual_review: accessibility.requiresManualReview,
                quality_score: scoring.score as unknown as Record<string, unknown>,
                recommendations: scoring.recommendations,
                merge_weights: mergeWeights ?? null,
                extracted_at: new Date().toISOString(),
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
                accessibility,
                qualityScore: scoring.score,
                recommendations: scoring.recommendations,
                detectedSections,
                componentPatterns,
                antiPatterns,
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
