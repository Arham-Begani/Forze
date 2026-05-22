// app/api/ventures/[id]/inspiration/[analysisId]/refine/route.ts
//
// POST — accept a founder's issue description against an applied analysis,
//        ask Gemini for a partial token patch that fixes it, and return the
//        patch shape that the existing PATCH /[analysisId] route can apply.
//
// The route does NOT auto-apply the suggestion. The studio shows it as a
// preview the user must explicitly approve, which prevents single-text-prompt
// "refinements" from silently corrupting an already-good token set.

export const maxDuration = 45

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError, isAuthError } from '@/lib/auth'
import { getVentureAccess } from '@/lib/queries'
import {
    DesignTokensSchema,
    InspirationRefineInputSchema,
} from '@/lib/schemas/inspiration'
import { validateAccessibility } from '@/lib/inspiration/accessibility'
import { suggestRefinement } from '@/lib/inspiration/refine'
import { getInspirationAnalysis } from '@/lib/queries/inspiration-queries'
import { gateFeatureForResponse } from '@/lib/billing-http'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
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

        const role = await getVentureAccess(ventureId, session.userId)
        if (!role || role === 'viewer') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json().catch(() => null)
        const parsed = InspirationRefineInputSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.flatten() },
                { status: 400 },
            )
        }

        const row = await getInspirationAnalysis(analysisId, session.userId)
        if (!row || row.venture_id !== ventureId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        if (row.status !== 'complete' || !row.tokens) {
            return NextResponse.json(
                { error: 'Analysis must be complete before refining.' },
                { status: 409 },
            )
        }

        let tokens
        try {
            tokens = DesignTokensSchema.parse(row.tokens)
        } catch (parseErr) {
            const msg = parseErr instanceof Error ? parseErr.message : 'Invalid token shape'
            return NextResponse.json({ error: `Stored tokens are not parseable: ${msg}` }, { status: 422 })
        }

        // Re-validate accessibility from CURRENT tokens — the stored report
        // may have been stale if /apply was called after edits. We pass the
        // fresh findings into the refiner so it knows what's already broken.
        const accessibility = validateAccessibility(tokens)

        const suggestion = await suggestRefinement({
            tokens,
            issue: parsed.data.issue,
            affectedComponent: parsed.data.affectedComponent,
            suggestion: parsed.data.suggestion,
            accessibility,
        })

        return NextResponse.json({
            analysisId,
            suggestion,
            // Echo back the inputs so the studio can render "you asked X, here's
            // what we'd change" without needing local state.
            request: parsed.data,
        })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        console.error('[POST inspiration/refine] unexpected', e)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
