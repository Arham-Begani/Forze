import {
  InstagramPostMissingError,
  fetchInstagramPostInsights,
  generateAggregateValidationReport,
  type AggregatePostInput,
  type InstagramPostInsights,
} from '@/lib/instagram-insights'
import { marketingErrorResponse, requireMarketingVenture } from '@/lib/marketing-api'
import {
  deleteMarketingAsset,
  getSocialConnectionSecretByProvider,
  listMarketingAssetsByVenture,
  updateMarketingAsset,
} from '@/lib/marketing-queries'
import { NextResponse } from 'next/server'

// Aggregate validation across every published Instagram post for a venture.
// Refreshes per-post insights, then runs a single venture-level analysis. The
// social tab calls this on mount so the report is always fresh.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { session, venture } = await requireMarketingVenture(id)

    const allAssets = await listMarketingAssetsByVenture(id, session.userId)
    const publishedInstagram = allAssets.filter(
      (asset) => asset.provider === 'instagram' && asset.status === 'published' && asset.provider_asset_id
    )

    if (publishedInstagram.length === 0) {
      return NextResponse.json({
        ok: true,
        postsAnalyzed: 0,
        validation: null,
        reason: 'no_published_posts',
      })
    }

    const connection = await getSocialConnectionSecretByProvider(session.userId, 'instagram')
    if (!connection) {
      return NextResponse.json(
        { error: 'Reconnect Instagram to fetch insights' },
        { status: 400 }
      )
    }

    // Fetch insights for each post in parallel. Drop posts Instagram says are
    // gone (mirrors the per-post route's cleanup behavior).
    const results = await Promise.all(
      publishedInstagram.map(async (asset) => {
        try {
          const insights = await fetchInstagramPostInsights(asset.provider_asset_id!, connection)
          return { asset, insights, missing: false as const, error: null as string | null }
        } catch (error) {
          if (error instanceof InstagramPostMissingError) {
            return { asset, insights: null, missing: true as const, error: null }
          }
          const message = error instanceof Error ? error.message : 'Failed to fetch insights'
          return { asset, insights: null, missing: false as const, error: message }
        }
      })
    )

    // Clean up posts that are gone on Instagram so the monitor stops showing them.
    const removedAssetIds: string[] = []
    for (const result of results) {
      if (result.missing) {
        await deleteMarketingAsset(result.asset.id, session.userId)
        removedAssetIds.push(result.asset.id)
      }
    }

    // Persist refreshed insights into each surviving asset's payload.
    const liveResults = results.filter(
      (r): r is { asset: typeof r.asset; insights: InstagramPostInsights; missing: false; error: null } =>
        !r.missing && r.insights !== null
    )

    await Promise.all(
      liveResults.map((r) =>
        updateMarketingAsset(r.asset.id, session.userId, {
          payload: { ...r.asset.payload, insights: r.insights },
        }).catch(() => null)
      )
    )

    if (liveResults.length === 0) {
      return NextResponse.json({
        ok: true,
        postsAnalyzed: 0,
        removedAssetIds,
        validation: null,
        reason: 'no_live_posts',
      })
    }

    const aggregateInput: AggregatePostInput[] = liveResults.map((r) => ({
      assetId: r.asset.id,
      title: r.asset.title,
      caption: r.asset.body,
      insights: r.insights,
    }))

    let validation
    try {
      validation = await generateAggregateValidationReport({
        ventureName: venture.name,
        posts: aggregateInput,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Aggregate validation failed'
      return NextResponse.json(
        {
          error: message,
          postsAnalyzed: liveResults.length,
          removedAssetIds,
          posts: liveResults.map((r) => ({ assetId: r.asset.id, insights: r.insights })),
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      postsAnalyzed: liveResults.length,
      removedAssetIds,
      validation,
      posts: liveResults.map((r) => ({ assetId: r.asset.id, insights: r.insights })),
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
