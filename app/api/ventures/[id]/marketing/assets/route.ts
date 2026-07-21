import { z } from 'zod'
import { buildInstagramDraftSeeds, buildLinkedInDraftSeeds, buildYouTubeDraftSeed } from '@/lib/marketing-drafts'
import { generateFreshInstagramDrafts } from '@/lib/instagram-content-ai'
import { generateFreshLinkedInDrafts } from '@/lib/linkedin-content-ai'
import { buildOutreachBrief } from '@/lib/outreach-brief'
import { buildBrandKit, buildBrandVoiceBlock } from '@/lib/brand-kit'
import { DEFAULT_IMAGE_STYLE } from '@/lib/marketing-image-gen'
import { requireMarketingVenture, marketingErrorResponse } from '@/lib/marketing-api'
import {
  createMarketingAssets,
  getMarketingAssetById,
  listMarketingAssetsByVenture,
} from '@/lib/marketing-queries'
import type { CreateMarketingAssetSeed } from '@/lib/marketing.shared'
import { NextRequest, NextResponse } from 'next/server'

const INSTAGRAM_DRAFT_QUEUE_CAP = 2
const DRAFT_LIKE_STATUSES = new Set(['draft', 'approved', 'scheduled'])

const createDraftSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('generate_from_marketing'),
    provider: z.enum(['youtube', 'linkedin', 'instagram']),
  }),
  // Take one approved idea and re-cut it for another channel, instead of
  // generating each channel from scratch and getting unrelated angles.
  z.object({
    mode: z.literal('repurpose'),
    sourceAssetId: z.string().uuid(),
    targetProvider: z.enum(['linkedin', 'instagram']),
  }),
  z.object({
    mode: z.literal('manual'),
    provider: z.enum(['youtube', 'linkedin', 'instagram']),
    assetType: z.enum(['youtube_video', 'linkedin_post', 'instagram_post']),
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
      const research = venture.context?.research as Record<string, unknown> | null | undefined
      // Post-pivot brand context: built from landing copy + shadow board (the
      // marketing/research agents no longer exist, so their context keys are
      // null for every new venture).
      const context = (venture.context ?? {}) as unknown as Record<string, unknown>
      const brief = buildOutreachBrief(venture.name, context)
      // Brand kit + voice (lib/brand-kit.ts). `brandColors` is stamped onto
      // every seed payload so the image generator finally receives the
      // venture's real palette — lib/marketing-publish.ts has always read
      // this key, but nothing wrote it until now.
      const brandKit = buildBrandKit(context)
      const voiceBlock = buildBrandVoiceBlock(context)
      const brandPayload = {
        brandColors: brandKit.colors,
        imageStyle: DEFAULT_IMAGE_STYLE,
      }
      let seeds: CreateMarketingAssetSeed[]
      if (parsed.data.provider === 'linkedin') {
        // Try the LinkedInRocket AI generator first (varied hook+tone per
        // draft, no em-dashes, founder voice). Fall back to the deterministic
        // socialCalendar reader if Gemini fails or the venture has no
        // marketing brief yet — same defence-in-depth pattern as Instagram.
        const LINKEDIN_DRAFT_COUNT = 3
        try {
          seeds = await generateFreshLinkedInDrafts(
            venture.name,
            marketing,
            research,
            LINKEDIN_DRAFT_COUNT,
            Date.now(),
            brief,
            voiceBlock
          )
          if (seeds.length === 0) {
            seeds = buildLinkedInDraftSeeds(venture.name, marketing, LINKEDIN_DRAFT_COUNT)
          }
        } catch {
          seeds = buildLinkedInDraftSeeds(venture.name, marketing, LINKEDIN_DRAFT_COUNT)
        }
      } else if (parsed.data.provider === 'instagram') {
        // Instagram drafts are capped at INSTAGRAM_DRAFT_QUEUE_CAP across the
        // venture so the queue never grows unboundedly. Each click generates
        // FRESH posts via Gemini — even when the marketing brief hasn't
        // changed — so consecutive clicks feel different.
        const existing = await listMarketingAssetsByVenture(id, session.userId)
        const existingDraftCount = existing.filter(
          (asset) => asset.provider === 'instagram' && DRAFT_LIKE_STATUSES.has(asset.status)
        ).length
        const slots = INSTAGRAM_DRAFT_QUEUE_CAP - existingDraftCount
        if (slots <= 0) {
          return NextResponse.json(
            {
              error: `Instagram draft queue is full (max ${INSTAGRAM_DRAFT_QUEUE_CAP}). Publish or delete a draft before generating more.`,
            },
            { status: 409 }
          )
        }

        try {
          seeds = await generateFreshInstagramDrafts(venture.name, marketing, slots, Date.now(), brief, voiceBlock)
        } catch {
          // Gemini failure — fall back to deterministic seeds so the user still gets drafts.
          seeds = buildInstagramDraftSeeds(venture.name, marketing, slots).slice(0, slots)
        }
      } else {
        seeds = [buildYouTubeDraftSeed(venture.name, marketing)].filter((seed): seed is CreateMarketingAssetSeed => Boolean(seed))
      }

      if (seeds.length === 0) {
        // Post-pivot there is no marketing module to run — this now only
        // happens when Gemini failed AND the deterministic fallback had no
        // legacy marketing context to read.
        return NextResponse.json(
          { error: 'Draft generation failed — try again in a moment. Publishing a landing page first gives drafts much better context.' },
          { status: 502 }
        )
      }

      assets = await createMarketingAssets(
        seeds.map((seed) => ({
          provider: seed.provider,
          assetType: seed.assetType,
          title: seed.title,
          body: seed.body,
          // brandPayload first so a seed that already set imageStyle wins.
          payload: { ...brandPayload, ...seed.payload },
          ventureId: id,
          userId: session.userId,
          status: 'draft',
        }))
      )
    } else if (parsed.data.mode === 'repurpose') {
      const context = (venture.context ?? {}) as unknown as Record<string, unknown>
      const brandKit = buildBrandKit(context)
      const voiceBlock = buildBrandVoiceBlock(context)

      const source = await getMarketingAssetById(parsed.data.sourceAssetId, session.userId, id)
      if (!source) {
        return NextResponse.json({ error: 'Source post not found' }, { status: 404 })
      }

      const target = parsed.data.targetProvider

      // Same queue cap as fresh generation — repurposing must not be a way to
      // sidestep it.
      if (target === 'instagram') {
        const existing = await listMarketingAssetsByVenture(id, session.userId)
        const draftCount = existing.filter(
          (asset) => asset.provider === 'instagram' && DRAFT_LIKE_STATUSES.has(asset.status)
        ).length
        if (draftCount >= INSTAGRAM_DRAFT_QUEUE_CAP) {
          return NextResponse.json(
            { error: `Instagram draft queue is full (max ${INSTAGRAM_DRAFT_QUEUE_CAP}). Publish or delete a draft first.` },
            { status: 409 }
          )
        }
      }

      // Feed the source post in as the angle so the re-cut argues the same
      // point rather than inventing an unrelated one.
      const sourceBrief = [
        buildOutreachBrief(venture.name, context),
        '',
        'Re-cut this existing post for a different platform. Keep its core idea, claim, and specifics — change only the format, length, and rhythm to suit the new platform:',
        `"""\n${source.body.slice(0, 1500)}\n"""`,
      ].join('\n')

      let seeds: CreateMarketingAssetSeed[]
      try {
        seeds = target === 'instagram'
          ? await generateFreshInstagramDrafts(venture.name, null, 1, Date.now(), sourceBrief, voiceBlock)
          : await generateFreshLinkedInDrafts(venture.name, null, null, 1, Date.now(), sourceBrief, voiceBlock)
      } catch {
        return NextResponse.json(
          { error: 'Repurpose failed — try again in a moment.' },
          { status: 502 }
        )
      }

      if (seeds.length === 0) {
        return NextResponse.json({ error: 'Repurpose returned no drafts' }, { status: 502 })
      }

      assets = await createMarketingAssets(
        seeds.map((seed) => ({
          provider: seed.provider,
          assetType: seed.assetType,
          title: seed.title,
          body: seed.body,
          payload: {
            brandColors: brandKit.colors,
            imageStyle: DEFAULT_IMAGE_STYLE,
            ...seed.payload,
            repurposedFrom: source.id,
          },
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
