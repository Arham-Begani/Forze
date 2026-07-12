// app/api/ventures/[id]/inspiration/[analysisId]/apply/route.ts
//
// POST — push the analysis's current tokens into ventures.context.inspirationTokens.
//        The next landing-page run will read them. Idempotent; an analysis can
//        be re-applied or unapplied (DELETE) without re-running vision.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError, isAuthError } from '@/lib/auth'
import { getVentureAccess } from '@/lib/queries'
import { isSafeRemoteUrl } from '@/lib/inspiration/screenshot'
import {
    getInspirationAnalysis,
    setVentureInspirationTokens,
    updateInspirationAnalysis,
    type InspirationReferenceImage,
} from '@/lib/queries/inspiration-queries'
import { gateFeatureForResponse } from '@/lib/billing-http'

// Download the inspiration screenshot CDN URLs the analyze route captured,
// base64-encode the first two (we don't need every URL — the pipeline agent
// is most accurate with one reference image, two for multi-source ventures),
// and return them ready to persist on venture.context. Best-effort: any
// download failure silently drops that image rather than blocking apply.
const MAX_PERSIST_IMAGES = 2
const MAX_IMAGE_BYTES = 600_000 // ~600 KB per image — JSONB-friendly

async function downloadReferenceImages(
    sourceUrls: string[],
): Promise<InspirationReferenceImage[]> {
    const results: InspirationReferenceImage[] = []
    for (const url of sourceUrls.slice(0, MAX_PERSIST_IMAGES)) {
        if (!url || !isSafeRemoteUrl(url)) continue
        try {
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 10_000)
            const res = await fetch(url, { signal: controller.signal })
            clearTimeout(timer)
            if (!res.ok) continue
            const contentType = res.headers.get('content-type') ?? ''
            if (!contentType.startsWith('image/')) continue
            const buf = Buffer.from(await res.arrayBuffer())
            if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) continue
            results.push({
                base64: buf.toString('base64'),
                mimeType: contentType,
                sourceUrl: url,
            })
        } catch {
            // Best-effort — a failure here doesn't block the apply, the
            // pipeline just runs text-only briefing instead of multimodal.
        }
    }
    return results
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
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

        const role = await getVentureAccess(ventureId, session.userId)
        if (!role || role === 'viewer') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const row = await getInspirationAnalysis(analysisId, session.userId)
        if (!row || row.venture_id !== ventureId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        if (row.status !== 'complete' || !row.tokens) {
            return NextResponse.json(
                { error: 'Analysis must be complete before applying tokens.' },
                { status: 409 },
            )
        }

        // Pull the captured screenshot URLs out of the analysis row's
        // capture_metadata and download the first 1-2. Persisting the bytes
        // alongside the tokens means the landing-page pipeline can attach the
        // actual page render as multimodal input to its Gemini call, not just
        // a text briefing. This is the biggest accuracy upgrade — the React
        // generator can target the actual visual, not its category.
        const captureMeta = (row.capture_metadata ?? {}) as { perUrl?: Array<{ sourceUrl?: string }> }
        const sourceUrls = (captureMeta.perUrl ?? [])
            .map((entry) => entry?.sourceUrl)
            .filter((u): u is string => typeof u === 'string' && u.length > 0)
        const referenceImages = await downloadReferenceImages(sourceUrls)

        // Compact evidence digest from the enrichment passes (sections,
        // component states, anti-patterns, context relevance). These were
        // previously analyze-only — persisting them alongside the tokens lets
        // the pipeline agent generate from measured evidence, not just hexes.
        // Every field is best-effort: missing pass output just omits the key.
        const antiPatterns = (row.pass3_antipatterns ?? null) as {
            doNotCopy?: unknown
            intentSignals?: unknown
        } | null
        const detected = (row.detected_sections ?? null) as { sections?: unknown } | null
        const detectedSections = Array.isArray(detected?.sections)
            ? (detected.sections as Array<Record<string, unknown> | null>).slice(0, 8).map((s) => ({
                name: s?.name ?? null,
                layoutPattern: s?.layoutPattern ?? null,
                notes: s?.notes ?? null,
            }))
            : []
        const profile: Record<string, unknown> = {
            componentPatterns: row.pass2_components ?? null,
            doNotCopy: Array.isArray(antiPatterns?.doNotCopy) ? antiPatterns.doNotCopy : [],
            intentSignals: Array.isArray(antiPatterns?.intentSignals) ? antiPatterns.intentSignals : [],
            sections: detectedSections,
            contextRelevance: row.context_relevance ?? null,
        }

        // clearLanding=true forces the next /run landing call into a fresh
        // generation that actually consumes the inspiration briefing instead
        // of running surgical edit mode against the previous component.
        await setVentureInspirationTokens(ventureId, session.userId, row.tokens, {
            clearLanding: true,
            referenceImages,
            profile,
        })
        await updateInspirationAnalysis(analysisId, session.userId, {
            applied_at: new Date().toISOString(),
        })

        return NextResponse.json({ ok: true, appliedAt: new Date().toISOString() })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        console.error('[POST inspiration/apply] unexpected', e)
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

        const role = await getVentureAccess(ventureId, session.userId)
        if (!role || role === 'viewer') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const row = await getInspirationAnalysis(analysisId, session.userId)
        if (!row || row.venture_id !== ventureId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        // Clearing inspirationTokens is what "unapply" means — the pipeline
        // agent's tokens-aware branch checks for presence on the venture
        // context object. Also drop the reference images and evidence profile
        // so the next landing run doesn't consume stale inspiration data.
        await setVentureInspirationTokens(ventureId, session.userId, null, { referenceImages: null, profile: null })
        await updateInspirationAnalysis(analysisId, session.userId, { applied_at: null })

        return NextResponse.json({ ok: true })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        console.error('[DELETE inspiration/apply] unexpected', e)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
