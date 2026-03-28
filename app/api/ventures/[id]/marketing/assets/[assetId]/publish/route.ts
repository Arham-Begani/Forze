import { marketingErrorResponse, requireMarketingVenture } from '@/lib/marketing-api'
import {
  createOrReplaceQueuedPublishJob,
  getMarketingAssetById,
  getSocialConnectionByProvider,
  updateMarketingAssetStatus,
} from '@/lib/marketing-queries'
import { dispatchDuePublishJobs } from '@/lib/marketing-dispatch'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const { id, assetId } = await params
    const { session } = await requireMarketingVenture(id)
    const asset = await getMarketingAssetById(assetId, session.userId, id)
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const connection = await getSocialConnectionByProvider(session.userId, asset.provider)
    if (!connection) {
      return NextResponse.json({ error: 'Connect this provider before publishing' }, { status: 400 })
    }

    await updateMarketingAssetStatus(asset.id, session.userId, 'approved')
    const approvedAsset = await updateMarketingAssetStatus(asset.id, session.userId, 'scheduled')
    const job = await createOrReplaceQueuedPublishJob(approvedAsset, new Date().toISOString(), session.userId)
    const summary = await dispatchDuePublishJobs({ jobIds: [job.id] })

    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
