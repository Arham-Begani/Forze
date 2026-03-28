import { z } from 'zod'
import { marketingErrorResponse, requireMarketingVenture } from '@/lib/marketing-api'
import {
  createOrReplaceQueuedPublishJob,
  getMarketingAssetById,
  getSocialConnectionByProvider,
  updateMarketingAssetStatus,
  updateMarketingAsset,
} from '@/lib/marketing-queries'
import { NextResponse } from 'next/server'

const bodySchema = z.object({
  scheduledFor: z.string().datetime(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const { id, assetId } = await params
    const { session } = await requireMarketingVenture(id)
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid schedule payload' }, { status: 400 })
    }

    const scheduledFor = new Date(parsed.data.scheduledFor)
    if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Schedule time must be in the future' }, { status: 400 })
    }

    const asset = await getMarketingAssetById(assetId, session.userId, id)
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const connection = await getSocialConnectionByProvider(session.userId, asset.provider)
    if (!connection) {
      return NextResponse.json({ error: 'Connect this provider before scheduling a publish' }, { status: 400 })
    }

    await updateMarketingAsset(asset.id, session.userId, {
      scheduled_for: scheduledFor.toISOString(),
    })
    await updateMarketingAssetStatus(asset.id, session.userId, 'approved')
    const approvedAsset = await updateMarketingAssetStatus(asset.id, session.userId, 'scheduled')
    const job = await createOrReplaceQueuedPublishJob(approvedAsset, scheduledFor.toISOString(), session.userId)

    return NextResponse.json({ asset: approvedAsset, job })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
