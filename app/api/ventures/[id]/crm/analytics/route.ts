import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsForVenture, getLeadsForVenture } from '@/lib/queries'
import { getSession } from '@/lib/auth'
import { listMarketingAssetsByVenture, getSocialConnectionSecretByProvider } from '@/lib/marketing-queries'
import { fetchInstagramPostInsights } from '@/lib/instagram-insights'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ventureId = (await params).id
    const analytics = await getAnalyticsForVenture(ventureId)
    const leads = await getLeadsForVenture(ventureId)

    // Basic web aggregation
    const visitors = analytics.filter(e => e.event_type === 'pageview').length
    const totalLeads = leads.length
    const conversionRate = visitors > 0 ? ((totalLeads / visitors) * 100).toFixed(2) : '0.00'

    // Real Social Data Aggregation
    const marketingAssets = await listMarketingAssetsByVenture(ventureId, session.userId)
    const publishedInstagramAssets = marketingAssets.filter(
      a => a.provider === 'instagram' && a.status === 'published' && a.provider_asset_id
    )

    let socialBreakdown = [
      { platform: 'Twitter (X)', count: 0, leads: 0, icon: 'Twitter', color: 'text-sky-500' },
      { platform: 'LinkedIn', count: 0, leads: 0, icon: 'Linkedin', color: 'text-blue-600' },
      { platform: 'Instagram', count: 0, leads: 0, icon: 'Instagram', color: 'text-pink-600' }
    ]

    let allSocialComments: any[] = []

    if (publishedInstagramAssets.length > 0) {
      const igConnection = await getSocialConnectionSecretByProvider(session.userId, 'instagram')
      if (igConnection && igConnection.access_token_encrypted) {
        for (const asset of publishedInstagramAssets) {
          try {
            const insights = await fetchInstagramPostInsights(asset.provider_asset_id!, igConnection)
            const igIndex = socialBreakdown.findIndex(s => s.platform === 'Instagram')
            if (igIndex > -1) {
              socialBreakdown[igIndex].count += (insights.impressions || insights.reach || 0)
            }
            
            if (insights.comments && insights.comments.length > 0) {
               const mappedComments = insights.comments.map(c => ({
                  platform: 'Instagram',
                  id: c.id,
                  username: c.username,
                  text: c.text,
                  timestamp: c.timestamp,
                  assetTitle: asset.title
               }))
               allSocialComments = [...allSocialComments, ...mappedComments]
            }
          } catch (e) {
            console.error(`Failed to fetch IG insights for asset ${asset.id}:`, e)
          }
        }
      }
    }

    // You can repeat similar logic for LinkedIn/Twitter when their fetchers are available.

    // Calculate leads per source simply by checking the source field on leads
    leads.forEach(lead => {
       const source = (lead.source || '').toLowerCase()
       if (source.includes('twitter') || source.includes('x')) socialBreakdown[0].leads++
       if (source.includes('linkedin')) socialBreakdown[1].leads++
       if (source.includes('instagram') || source.includes('ig')) socialBreakdown[2].leads++
    })

    return NextResponse.json({ 
      success: true, 
      visitors,
      leads: totalLeads,
      conversionRate,
      rawAnalytics: analytics,
      socialBreakdown,
      socialComments: allSocialComments
    })
  } catch (error: any) {
    console.error('Error fetching CRM analytics:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

