import { z } from 'zod'
import { marketingErrorResponse, requireMarketingVenture } from '@/lib/marketing-api'
import {
  createOrReplaceQueuedPublishJob,
  deleteMarketingAsset,
  getMarketingAssetById,
  updateMarketingAsset,
} from '@/lib/marketing-queries'
import { NextRequest, NextResponse } from 'next/server'

const bodySchema = z.object({
  title: z.string().min(1).max(160).optional(),
  body: z.string().max(5000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const { id, assetId } = await params
    const { session } = await requireMarketingVenture(id)
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 })
    }

    const asset = await getMarketingAssetById(assetId, session.userId, id)
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    if (asset.status === 'published' || asset.status === 'publishing') {
      return NextResponse.json({ error: 'This asset can no longer be edited' }, { status: 409 })
    }

    const updated = await updateMarketingAsset(asset.id, session.userId, {
      title: parsed.data.title,
      body: parsed.data.body,
      payload: parsed.data.payload,
      scheduled_for: parsed.data.scheduledFor ?? undefined,
    })

    if (asset.status === 'scheduled' && parsed.data.scheduledFor) {
      await createOrReplaceQueuedPublishJob(updated, parsed.data.scheduledFor, session.userId)
    }

    return NextResponse.json({ asset: updated })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const { id, assetId } = await params
    const { session } = await requireMarketingVenture(id)

    const asset = await getMarketingAssetById(assetId, session.userId, id)
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    await deleteMarketingAsset(asset.id, session.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
