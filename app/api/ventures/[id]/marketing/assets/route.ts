import { z } from 'zod'
import { buildLinkedInDraftSeeds, buildYouTubeDraftSeed } from '@/lib/marketing-drafts'
import { requireMarketingVenture, marketingErrorResponse } from '@/lib/marketing-api'
import {
  createMarketingAssets,
  listMarketingAssetsByVenture,
} from '@/lib/marketing-queries'
import type { CreateMarketingAssetSeed } from '@/lib/marketing.shared'
import { NextRequest, NextResponse } from 'next/server'

const createDraftSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('generate_from_marketing'),
    provider: z.enum(['youtube', 'linkedin']),
  }),
  z.object({
    mode: z.literal('manual'),
    provider: z.enum(['youtube', 'linkedin']),
    assetType: z.enum(['youtube_video', 'linkedin_post']),
    title: z.string().min(1).max(160),
    body: z.string().max(5000).default(''),
    payload: z.record(z.string(), z.unknown()).optional(),
    conversationId: z.string().uuid().nullable().optional(),
  }),
])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { session } = await requireMarketingVenture(id)
    const assets = await listMarketingAssetsByVenture(id, session.userId)
    return NextResponse.json({ assets })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { session, venture } = await requireMarketingVenture(id)
    const parsed = createDraftSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid asset payload' }, { status: 400 })
    }

    let assets
    if (parsed.data.mode === 'generate_from_marketing') {
      const marketing = venture.context?.marketing as Record<string, unknown> | null | undefined
      const seeds: CreateMarketingAssetSeed[] = parsed.data.provider === 'linkedin'
        ? buildLinkedInDraftSeeds(venture.name, marketing)
        : [buildYouTubeDraftSeed(venture.name, marketing)].filter((seed): seed is CreateMarketingAssetSeed => Boolean(seed))

      if (seeds.length === 0) {
        return NextResponse.json({ error: 'Run the marketing module first to generate channel drafts' }, { status: 400 })
      }

      assets = await createMarketingAssets(
        seeds.map((seed) => ({
          provider: seed.provider,
          assetType: seed.assetType,
          title: seed.title,
          body: seed.body,
          payload: seed.payload,
          ventureId: id,
          userId: session.userId,
          status: 'draft',
        }))
      )
    } else {
      assets = await createMarketingAssets([{
        ventureId: id,
        userId: session.userId,
        conversationId: parsed.data.conversationId ?? null,
        provider: parsed.data.provider,
        assetType: parsed.data.assetType,
        title: parsed.data.title,
        body: parsed.data.body,
        payload: parsed.data.payload ?? {},
        status: 'draft',
      }])
    }

    return NextResponse.json({ assets }, { status: 201 })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
