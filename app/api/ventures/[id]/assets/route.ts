// app/api/ventures/[id]/assets/route.ts
//
// User-supplied landing-page images.
//
// GET   — list every asset uploaded to this venture (oldest first so the
//         agent's prompt slot ordering stays stable across regenerations).
// POST  — multipart upload. Form fields: `file` (image), optional `label`,
//         `altText`, `kind`. Stores the binary in the public
//         landing-assets Supabase Storage bucket and writes a row that
//         carries the public URL + founder metadata.

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireAuth, AuthError, isAuthError } from '@/lib/auth'
import { getVentureAccess } from '@/lib/queries'
import {
    insertLandingAsset,
    listLandingAssets,
} from '@/lib/queries/landing-asset-queries'
import {
    LANDING_ASSETS_ALLOWED_MIME,
    LANDING_ASSETS_MAX_BYTES,
    isAllowedLandingAssetMime,
    uploadLandingAssetToStorage,
} from '@/lib/storage/landing-assets-storage'
import {
    LandingAssetKindSchema,
    LandingAssetUploadMetaSchema,
} from '@/lib/schemas/landing-assets'
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
        const role = await getVentureAccess(ventureId, session.userId)
        if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const assets = await listLandingAssets(ventureId)
        return NextResponse.json({
            assets,
            limits: {
                maxBytes: LANDING_ASSETS_MAX_BYTES,
                allowedMime: LANDING_ASSETS_ALLOWED_MIME,
            },
        })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        logError('ventures/id/assets', e, { msg: '[GET assets] unexpected' })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await requireAuth()
        const ventureId = (await params).id
        if (!UUID_RE.test(ventureId)) {
            return NextResponse.json({ error: 'Invalid ventureId' }, { status: 400 })
        }
        const role = await getVentureAccess(ventureId, session.userId)
        if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        if (role === 'viewer') {
            return NextResponse.json({ error: 'Viewers cannot upload assets.' }, { status: 403 })
        }

        const form = await request.formData()
        const file = form.get('file')
        if (!file || typeof file === 'string') {
            return NextResponse.json({ error: 'Attach an image under "file".' }, { status: 400 })
        }
        const blob = file as File
        const mime = (blob.type || '').toLowerCase()
        if (!isAllowedLandingAssetMime(mime)) {
            return NextResponse.json(
                { error: `Unsupported file type. Allowed: ${LANDING_ASSETS_ALLOWED_MIME.join(', ')}.` },
                { status: 415 },
            )
        }
        if (blob.size > LANDING_ASSETS_MAX_BYTES) {
            return NextResponse.json(
                { error: `Image must be ${Math.floor(LANDING_ASSETS_MAX_BYTES / 1024 / 1024)} MB or smaller.` },
                { status: 413 },
            )
        }

        // Parse + validate optional metadata fields.
        const metaParsed = LandingAssetUploadMetaSchema.safeParse({
            label: typeof form.get('label') === 'string' ? form.get('label') : '',
            altText: typeof form.get('altText') === 'string' ? form.get('altText') : '',
            kind: typeof form.get('kind') === 'string' ? form.get('kind') : 'image',
        })
        if (!metaParsed.success) {
            return NextResponse.json(
                { error: 'Invalid metadata', issues: metaParsed.error.flatten() },
                { status: 400 },
            )
        }
        const meta = metaParsed.data
        // Defence in depth — refuse rogue kinds even if Zod somehow accepts.
        const kind = LandingAssetKindSchema.parse(meta.kind)

        const buffer = Buffer.from(await blob.arrayBuffer())
        const uploadId = randomUUID().slice(0, 8)

        const { storagePath, publicUrl } = await uploadLandingAssetToStorage({
            ventureId,
            uploadId,
            originalName: blob.name || 'upload',
            buffer,
            mime,
        })

        const asset = await insertLandingAsset({
            ventureId,
            userId: session.userId,
            storagePath,
            publicUrl,
            label: meta.label || '',
            altText: meta.altText || '',
            kind,
            mimeType: mime,
            byteSize: blob.size,
        })

        return NextResponse.json({ asset })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        logError('ventures/id/assets', e, { msg: '[POST assets] unexpected' })
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Internal error' },
            { status: 500 },
        )
    }
}
