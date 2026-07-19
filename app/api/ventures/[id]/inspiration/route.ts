// app/api/ventures/[id]/inspiration/route.ts
//
// GET — list all inspiration analyses for this venture (history view).
//       Returns the most recent first; capped at 25 to keep payloads small.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError, isAuthError } from '@/lib/auth'
import { getVentureAccess } from '@/lib/queries'
import {
    checkInspirationRateLimit,
    listInspirationAnalysesForVenture,
} from '@/lib/queries/inspiration-queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { logError } from '@/lib/log'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await requireAuth()
        const ventureId = (await params).id
        if (!UUID_RE.test(ventureId)) {
            return NextResponse.json({ error: 'Invalid ventureId' }, { status: 400 })
        }

        const gate = await gateFeatureForResponse(session.userId, 'inspiration')
        if (!gate.ok) return gate.response

        const role = await getVentureAccess(ventureId, session.userId)
        if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const [analyses, rateLimit] = await Promise.all([
            listInspirationAnalysesForVenture(ventureId, session.userId),
            checkInspirationRateLimit(session.userId, ventureId),
        ])

        return NextResponse.json({
            analyses: analyses.map((row) => ({
                id: row.id,
                urls: row.urls,
                status: row.status,
                mood: row.mood,
                confidence: row.confidence,
                createdAt: row.created_at,
                appliedAt: row.applied_at,
                captureTier: row.capture_tier,
                hasTokens: !!row.tokens,
                errorMessage: row.error_message,
            })),
            rateLimit,
        })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        logError('ventures/id/inspiration', e, { msg: '[GET inspiration] unexpected' })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
