import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsForVenture, getLeadsForVenture, getVenture } from '@/lib/queries'
import { getSession } from '@/lib/auth'
import { listMarketingAssetsByVenture, getSocialConnectionSecretByProvider } from '@/lib/marketing-queries'
import { fetchInstagramPostInsights, type InstagramPostInsights } from '@/lib/instagram-insights'
import type { MarketingAsset } from '@/lib/marketing.shared'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { logError } from '@/lib/log'

type SocialPlatform = 'Twitter (X)' | 'LinkedIn' | 'Instagram'

type SocialBreakdown = {
  platform: SocialPlatform
  count: number
  leads: number
  engagement: number
  likes: number
  comments: number
  views: number
  posts: number
  icon: string
  color: string
}

function emptyBreakdown(): SocialBreakdown[] {
  return [
    { platform: 'Twitter (X)', count: 0, leads: 0, engagement: 0, likes: 0, comments: 0, views: 0, posts: 0, icon: 'Twitter', color: 'text-sky-500' },
    { platform: 'LinkedIn', count: 0, leads: 0, engagement: 0, likes: 0, comments: 0, views: 0, posts: 0, icon: 'Linkedin', color: 'text-blue-600' },
    { platform: 'Instagram', count: 0, leads: 0, engagement: 0, likes: 0, comments: 0, views: 0, posts: 0, icon: 'Instagram', color: 'text-pink-600' },
  ]
}

function numberFrom(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function storedInsights(asset: MarketingAsset): InstagramPostInsights | null {
  const insights = asset.payload?.insights
  return insights && typeof insights === 'object' ? insights as InstagramPostInsights : null
}

function insightReach(insights: InstagramPostInsights | null): number {
  if (!insights) return 0
  return insights.reach ?? insights.impressions ?? 0
}

function insightEngagement(insights: InstagramPostInsights | null): number {
  if (!insights) return 0
  return (insights.likeCount ?? 0) + (insights.commentsCount ?? 0) + (insights.saved ?? 0)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await gateFeatureForResponse(session.userId, 'crm')
    if (!gate.ok) return gate.response

    const ventureId = (await params).id
    const venture = await getVenture(ventureId, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    const [analytics, leads, marketingAssets] = await Promise.all([
      getAnalyticsForVenture(ventureId),
      getLeadsForVenture(ventureId),
      listMarketingAssetsByVenture(ventureId, session.userId),
    ])

    const socialBreakdown = emptyBreakdown()
    const instagramBreakdown = socialBreakdown.find((item) => item.platform === 'Instagram')!
    const linkedInBreakdown = socialBreakdown.find((item) => item.platform === 'LinkedIn')!
    const twitterBreakdown = socialBreakdown.find((item) => item.platform === 'Twitter (X)')!
    const allSocialComments: Array<{
      platform: string
      id: string
      username: string | null
      text: string
      timestamp: string | null
      assetTitle: string
    }> = []

    const publishedAssets = marketingAssets.filter((asset) => asset.status === 'published')
    const publishedInstagramAssets = publishedAssets.filter(
      (asset) => asset.provider === 'instagram' && asset.provider_asset_id
    )

    let instagramConnection = null
    if (publishedInstagramAssets.length > 0) {
      instagramConnection = await getSocialConnectionSecretByProvider(session.userId, 'instagram')
    }

    for (const asset of publishedAssets) {
      if (asset.provider === 'instagram') {
        let insights = storedInsights(asset)
        if (asset.provider_asset_id && instagramConnection?.access_token_encrypted) {
          try {
            insights = await fetchInstagramPostInsights(asset.provider_asset_id, instagramConnection)
          } catch (error) {
            console.error(`Failed to fetch IG insights for asset ${asset.id}:`, error)
          }
        }

        const reach = insightReach(insights)
        const likes = insights?.likeCount ?? 0
        const comments = insights?.commentsCount ?? 0
        instagramBreakdown.count += reach
        instagramBreakdown.engagement += insightEngagement(insights)
        instagramBreakdown.likes += likes
        instagramBreakdown.comments += comments
        instagramBreakdown.views += reach
        instagramBreakdown.posts += 1
        for (const comment of insights?.comments ?? []) {
          allSocialComments.push({
            platform: 'Instagram',
            id: comment.id,
            username: comment.username,
            text: comment.text,
            timestamp: comment.timestamp,
            assetTitle: asset.title,
          })
        }
      }

      if (asset.provider === 'linkedin') {
        const payload = asset.payload ?? {}
        const reach = numberFrom(payload.impressions) || numberFrom(payload.reach)
        const likes = numberFrom(payload.likes)
        const comments = numberFrom(payload.comments)
        const engagement =
          likes +
          comments +
          numberFrom(payload.shares) +
          numberFrom(payload.clicks)
        linkedInBreakdown.count += reach
        linkedInBreakdown.engagement += engagement
        linkedInBreakdown.likes += likes
        linkedInBreakdown.comments += comments
        linkedInBreakdown.views += reach
        linkedInBreakdown.posts += 1
      }

    }

    for (const lead of leads) {
      const source = (lead.source || '').toLowerCase()
      if (source.includes('twitter') || source.includes('x')) twitterBreakdown.leads++
      if (source.includes('linkedin')) linkedInBreakdown.leads++
      if (source.includes('instagram') || source.includes('ig')) instagramBreakdown.leads++
    }

    const totalSocialReach = socialBreakdown.reduce((sum, source) => sum + source.count, 0)
    const totalEngagement = socialBreakdown.reduce((sum, source) => sum + source.engagement, 0)
    const landingPageviews = analytics.filter((event) => event.event_type === 'pageview').length
    const totalVisitors = landingPageviews + totalSocialReach
    const totalLeads = leads.length
    const conversionRate = totalVisitors > 0
      ? ((totalLeads / totalVisitors) * 100).toFixed(2)
      : '0.00'

    return NextResponse.json({
      success: true,
      visitors: totalVisitors,
      landingPageviews,
      socialReach: totalSocialReach,
      leads: totalLeads,
      conversionRate,
      rawAnalytics: analytics,
      socialBreakdown,
      socialComments: allSocialComments,
      totalEngagement,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    logError('ventures/id/crm/analytics', error, { msg: 'Error fetching CRM analytics' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
