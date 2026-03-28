import { marketingErrorResponse, requireMarketingVenture } from '@/lib/marketing-api'
import { getMarketingAssetById, updateMarketingAssetStatus } from '@/lib/marketing-queries'
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

    if (asset.status === 'published') {
      return NextResponse.json({ error: 'Published assets cannot be approved again' }, { status: 409 })
    }

    const updated = await updateMarketingAssetStatus(asset.id, session.userId, 'approved')
    return NextResponse.json({ asset: updated })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
