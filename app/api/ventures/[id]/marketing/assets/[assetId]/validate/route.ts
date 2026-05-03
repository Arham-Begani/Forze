import {
  InstagramPostMissingError,
  fetchInstagramPostInsights,
  generateValidationReport,
} from '@/lib/instagram-insights'
import { marketingErrorResponse, requireMarketingVenture } from '@/lib/marketing-api'
import {
  deleteMarketingAsset,
  getMarketingAssetById,
  getSocialConnectionSecretByProvider,
  updateMarketingAsset,
} from '@/lib/marketing-queries'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const { id, assetId } = await params
    const { session, venture } = await requireMarketingVenture(id)
    const asset = await getMarketingAssetById(assetId, session.userId, id)
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }
    if (asset.provider !== 'instagram') {
      return NextResponse.json(
        { error: 'Validation is only supported for Instagram posts right now' },
        { status: 400 }
      )
    }
    if (asset.status !== 'published' || !asset.provider_asset_id) {
      return NextResponse.json(
        { error: 'Publish this post before requesting validation' },
        { status: 400 }
      )
    }

    const connection = await getSocialConnectionSecretByProvider(session.userId, 'instagram')
    if (!connection) {
      return NextResponse.json(
        { error: 'Reconnect Instagram to fetch insights' },
        { status: 400 }
      )
    }

    let insights
    try {
      insights = await fetchInstagramPostInsights(asset.provider_asset_id, connection)
    } catch (fetchError) {
      if (fetchError instanceof InstagramPostMissingError) {
        // The post is gone on Instagram (deleted, archived, or the provider id
        // drifted) — clear it from the monitor so it stops appearing as a live post.
        await deleteMarketingAsset(asset.id, session.userId)
        return NextResponse.json(
          { ok: true, deleted: true, reason: 'instagram_post_missing' },
          { status: 200 }
        )
      }
      throw fetchError
    }

    let validation
    try {
      validation = await generateValidationReport({
        ventureName: venture.name,
        caption: asset.body,
        insights,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation analyzer failed'
      // Persist the insights we did fetch so the UI isn't empty even if Gemini fails.
      const nextPayload = { ...asset.payload, insights, validationError: message }
      const updated = await updateMarketingAsset(asset.id, session.userId, { payload: nextPayload })
      return NextResponse.json(
        { error: message, asset: updated, insights },
        { status: 502 }
      )
    }

    const nextPayload = {
      ...asset.payload,
      insights,
      validation,
      validationError: null,
    }
    const updated = await updateMarketingAsset(asset.id, session.userId, { payload: nextPayload })
    return NextResponse.json({ asset: updated, insights, validation })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
