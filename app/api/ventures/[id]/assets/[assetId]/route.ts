// app/api/ventures/[id]/assets/[assetId]/route.ts
//
// PATCH  — edit founder metadata (label / altText / kind). Useful when the
//          uploader forgot to label the image up front.
// DELETE — remove the row AND the storage object. The storage delete is
//          soft-fail because the row is the source of truth for the agent.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError, isAuthError } from '@/lib/auth'
import { getVentureAccess } from '@/lib/queries'
import {
    deleteLandingAssetRow,
    updateLandingAsset,
} from '@/lib/queries/landing-asset-queries'
import { deleteLandingAssetFromStorage } from '@/lib/storage/landing-assets-storage'
import { LandingAssetPatchSchema } from '@/lib/schemas/landing-assets'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; assetId: string }> },
) {
    try {
        const session = await requireAuth()
        const { id: ventureId, assetId } = await params
        if (!UUID_RE.test(ventureId) || !UUID_RE.test(assetId)) {
            return NextResponse.json({ error: 'Invalid ventureId or assetId' }, { status: 400 })
        }
        const role = await getVentureAccess(ventureId, session.userId)
        if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        if (role === 'viewer') {
            return NextResponse.json({ error: 'Viewers cannot edit assets.' }, { status: 403 })
        }

        const body = await request.json().catch(() => null)
        const parsed = LandingAssetPatchSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid patch', issues: parsed.error.flatten() },
                { status: 400 },
            )
        }
        const updated = await updateLandingAsset(ventureId, assetId, parsed.data)
        if (!updated) {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
        }
        return NextResponse.json({ asset: updated })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        console.error('[PATCH asset] unexpected', e)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; assetId: string }> },
) {
    try {
        const session = await requireAuth()
        const { id: ventureId, assetId } = await params
        if (!UUID_RE.test(ventureId) || !UUID_RE.test(assetId)) {
            return NextResponse.json({ error: 'Invalid ventureId or assetId' }, { status: 400 })
        }
        const role = await getVentureAccess(ventureId, session.userId)
        if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        if (role === 'viewer') {
            return NextResponse.json({ error: 'Viewers cannot delete assets.' }, { status: 403 })
        }

        const removed = await deleteLandingAssetRow(ventureId, assetId)
        if (!removed) {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
        }
        // Best-effort storage cleanup. Row deletion is the canonical action.
        try {
            await deleteLandingAssetFromStorage(removed.storagePath)
        } catch (cleanupErr) {
            console.warn('[DELETE asset] storage cleanup failed', cleanupErr)
        }
        return NextResponse.json({ ok: true })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        console.error('[DELETE asset] unexpected', e)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
