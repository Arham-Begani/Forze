// app/api/ventures/[id]/inspiration/[analysisId]/apply/route.ts
//
// POST — push the analysis's current tokens into ventures.context.inspirationTokens.
//        The next landing-page run will read them. Idempotent; an analysis can
//        be re-applied or unapplied (DELETE) without re-running vision.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError, isAuthError } from '@/lib/auth'
import { getVentureAccess } from '@/lib/queries'
import {
    getInspirationAnalysis,
    setVentureInspirationTokens,
    updateInspirationAnalysis,
} from '@/lib/queries/inspiration-queries'

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

        // clearLanding=true forces the next /run landing call into a fresh
        // generation that actually consumes the inspiration briefing instead
        // of running surgical edit mode against the previous component.
        await setVentureInspirationTokens(ventureId, session.userId, row.tokens, { clearLanding: true })
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
        // context object.
        await setVentureInspirationTokens(ventureId, session.userId, null)
        await updateInspirationAnalysis(analysisId, session.userId, { applied_at: null })

        return NextResponse.json({ ok: true })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        console.error('[DELETE inspiration/apply] unexpected', e)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
