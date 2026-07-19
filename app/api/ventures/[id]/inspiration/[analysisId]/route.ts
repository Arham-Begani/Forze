// app/api/ventures/[id]/inspiration/[analysisId]/route.ts
//
// GET    — fetch one analysis (full tokens + raw vision output).
// PATCH  — apply the user's per-token adjustments / lock changes.
// DELETE — remove an analysis from history.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError, isAuthError } from '@/lib/auth'
import { getVentureAccess } from '@/lib/queries'
import { createDb } from '@/lib/db'
import {
    DesignTokensSchema,
    InspirationTokenPatchSchema,
} from '@/lib/schemas/inspiration'
import { applyAdjustments, defaultTokens, mergeTokens } from '@/lib/inspiration/tokens'
import { validateAccessibility } from '@/lib/inspiration/accessibility'
import { scoreTokens } from '@/lib/inspiration/scoring'
import {
    getInspirationAnalysis,
    updateInspirationAnalysis,
} from '@/lib/queries/inspiration-queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { logError } from '@/lib/log'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function authorizeVentureAccess(ventureId: string, userId: string, requireEditor: boolean) {
    const role = await getVentureAccess(ventureId, userId)
    if (!role) return { ok: false as const, status: 403 }
    if (requireEditor && role === 'viewer') return { ok: false as const, status: 403 }
    return { ok: true as const, role }
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; analysisId: string }> },
) {
    try {
        const session = await requireAuth()
        const { id: ventureId, analysisId } = await params
        if (!UUID_RE.test(ventureId) || !UUID_RE.test(analysisId)) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
        }

        const gate = await gateFeatureForResponse(session.userId, 'inspiration')
        if (!gate.ok) return gate.response

        const access = await authorizeVentureAccess(ventureId, session.userId, false)
        if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })

        const row = await getInspirationAnalysis(analysisId, session.userId)
        if (!row || row.venture_id !== ventureId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        return NextResponse.json({
            analysis: {
                id: row.id,
                urls: row.urls,
                status: row.status,
                tokens: row.tokens,
                mood: row.mood,
                confidence: row.confidence,
                userAdjustments: row.user_adjustments,
                lockedPaths: row.locked_paths,
                captureTier: row.capture_tier,
                captureMetadata: row.capture_metadata,
                createdAt: row.created_at,
                appliedAt: row.applied_at,
                errorMessage: row.error_message,
                // ── Migration 028 evidence (may be null on older rows) ──
                accessibilityReport: row.accessibility_report ?? null,
                hasContrastIssues: row.has_contrast_issues ?? null,
                requiresManualReview: row.requires_manual_review ?? null,
                qualityScore: row.quality_score ?? null,
                recommendations: row.recommendations ?? [],
                detectedSections: row.detected_sections ?? null,
                interactionStates: row.interaction_states ?? null,
                contextRelevance: row.context_relevance ?? null,
                pass2Components: row.pass2_components ?? null,
                pass3Antipatterns: row.pass3_antipatterns ?? null,
                mergeWeights: row.merge_weights ?? null,
                extractedAt: row.extracted_at ?? null,
            },
        })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        logError('ventures/id/inspiration/analysisId', e, { msg: '[GET inspiration/[analysisId]] unexpected' })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; analysisId: string }> },
) {
    try {
        const session = await requireAuth()
        const { id: ventureId, analysisId } = await params
        if (!UUID_RE.test(ventureId) || !UUID_RE.test(analysisId)) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
        }

        const gate = await gateFeatureForResponse(session.userId, 'inspiration')
        if (!gate.ok) return gate.response

        const access = await authorizeVentureAccess(ventureId, session.userId, true)
        if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })

        const body = await req.json().catch(() => null)
        const parsed = InspirationTokenPatchSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.flatten() },
                { status: 400 },
            )
        }
        const { adjustments, lockedPaths, mergeWeights } = parsed.data

        const existing = await getInspirationAnalysis(analysisId, session.userId)
        if (!existing || existing.venture_id !== ventureId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        if (existing.status !== 'complete' || !existing.tokens) {
            return NextResponse.json(
                { error: 'Analysis is not complete; cannot edit tokens yet.' },
                { status: 409 },
            )
        }

        // If mergeWeights changed, replay the merge from raw_vision so the
        // per-color "highest weighted confidence wins" logic gets a fresh
        // shot. Otherwise start from the previously-saved tokens.
        let baseTokens
        try {
            if (mergeWeights && existing.raw_vision && typeof existing.raw_vision === 'object') {
                const perUrl = (existing.raw_vision as { perUrl?: Array<{ tokens?: unknown }> }).perUrl ?? []
                const parsedPerUrl = perUrl
                    .map((entry) => {
                        try { return DesignTokensSchema.parse(entry.tokens) } catch { return null }
                    })
                    .filter((t): t is ReturnType<typeof DesignTokensSchema.parse> => t !== null)
                if (parsedPerUrl.length > 0) {
                    baseTokens = mergeTokens(parsedPerUrl, mergeWeights)
                } else {
                    baseTokens = DesignTokensSchema.parse(existing.tokens ?? defaultTokens())
                }
            } else {
                baseTokens = DesignTokensSchema.parse(existing.tokens ?? defaultTokens())
            }
        } catch (parseErr) {
            const msg = parseErr instanceof Error ? parseErr.message : 'Invalid token shape'
            return NextResponse.json({ error: `Token validation failed: ${msg}` }, { status: 400 })
        }

        let updatedTokens
        try {
            updatedTokens = applyAdjustments(baseTokens, adjustments, lockedPaths)
        } catch (parseErr) {
            const msg = parseErr instanceof Error ? parseErr.message : 'Invalid token shape'
            return NextResponse.json({ error: `Token validation failed: ${msg}` }, { status: 400 })
        }

        // Persist the merged adjustments alongside the new token snapshot so
        // the founder can reset individual paths back to "AI's pick" later.
        const mergedAdjustments = {
            ...existing.user_adjustments,
            ...adjustments,
        }

        // Recompute accessibility + score every time tokens change so the UI
        // never shows stale evidence for a token configuration that doesn't
        // exist anymore.
        const accessibility = validateAccessibility(updatedTokens)
        const scoring = scoreTokens(updatedTokens, accessibility)

        const row = await updateInspirationAnalysis(analysisId, session.userId, {
            tokens: updatedTokens,
            user_adjustments: mergedAdjustments,
            locked_paths: lockedPaths,
            confidence: updatedTokens.confidenceByCategory as unknown as Record<string, number>,
            mood: updatedTokens.brand.mood,
            accessibility_report: accessibility as unknown as Record<string, unknown>,
            has_contrast_issues: accessibility.hasContrastIssues,
            requires_manual_review: accessibility.requiresManualReview,
            quality_score: scoring.score as unknown as Record<string, unknown>,
            recommendations: scoring.recommendations,
            ...(mergeWeights ? { merge_weights: mergeWeights } : {}),
        })

        return NextResponse.json({
            analysis: {
                id: row?.id ?? analysisId,
                tokens: row?.tokens ?? updatedTokens,
                userAdjustments: row?.user_adjustments ?? mergedAdjustments,
                lockedPaths: row?.locked_paths ?? lockedPaths,
                accessibilityReport: accessibility,
                qualityScore: scoring.score,
                recommendations: scoring.recommendations,
                mergeWeights: mergeWeights ?? row?.merge_weights ?? null,
            },
        })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        logError('ventures/id/inspiration/analysisId', e, { msg: '[PATCH inspiration/[analysisId]] unexpected' })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; analysisId: string }> },
) {
    try {
        const session = await requireAuth()
        const { id: ventureId, analysisId } = await params
        if (!UUID_RE.test(ventureId) || !UUID_RE.test(analysisId)) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
        }

        const gate = await gateFeatureForResponse(session.userId, 'inspiration')
        if (!gate.ok) return gate.response

        const access = await authorizeVentureAccess(ventureId, session.userId, true)
        if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })

        const existing = await getInspirationAnalysis(analysisId, session.userId)
        if (!existing || existing.venture_id !== ventureId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const db = await createDb()
        const { error } = await db
            .from('inspiration_analyses')
            .delete()
            .eq('id', analysisId)
            .eq('user_id', session.userId)
        if (error) throw new Error(`Delete failed: ${error.message}`)

        return NextResponse.json({ ok: true })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        logError('ventures/id/inspiration/analysisId', e, { msg: '[DELETE inspiration/[analysisId]] unexpected' })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
