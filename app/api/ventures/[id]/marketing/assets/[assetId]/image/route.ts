import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { marketingErrorResponse, requireMarketingVenture } from '@/lib/marketing-api'
import { getMarketingAssetById, updateMarketingAsset } from '@/lib/marketing-queries'
import {
  DEFAULT_IMAGE_ASPECT,
  DEFAULT_IMAGE_STYLE,
  IMAGE_ASPECTS,
  IMAGE_STYLES,
  MAX_IMAGE_CANDIDATES,
  generatePostImageCandidates,
  isImageAspect,
  isImageStyle,
} from '@/lib/marketing-image-gen'
import { buildBrandKit } from '@/lib/brand-kit'
import { AI_RUN_LIMIT, AI_RUN_WINDOW_SEC, enforceRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log'

// Generates post images at DRAFT time so the founder sees what will publish.
// Previously the only image generation happened inside lib/marketing-publish.ts
// at publish time, meaning an unseen AI image went straight onto a real brand
// account.

const generateSchema = z.object({
  style: z.enum(IMAGE_STYLES).optional(),
  artDirection: z.string().max(400).optional(),
  count: z.number().int().min(1).max(MAX_IMAGE_CANDIDATES).optional(),
  aspect: z.enum(IMAGE_ASPECTS).optional(),
})

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const { id, assetId } = await params
    const { session, venture } = await requireMarketingVenture(id)

    // Image generation is the most expensive call in this feature and was
    // previously unmetered. Fails open on limiter infra errors by contract.
    const rl = await enforceRateLimit(session.userId, 'ai:post-image', AI_RUN_WINDOW_SEC, AI_RUN_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded — 10 AI runs per hour' },
        { status: 429 }
      )
    }

    const parsed = generateSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid image options' }, { status: 400 })
    }

    const asset = await getMarketingAssetById(assetId, session.userId)
    if (!asset || asset.venture_id !== id) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const payload = asObject(asset.payload)
    const context = (venture.context ?? {}) as unknown as Record<string, unknown>

    // Prefer the palette already stamped on the asset (so an old draft keeps
    // whatever it was created with), else derive it from the venture.
    const existingColors = Array.isArray(payload.brandColors)
      ? (payload.brandColors as unknown[]).filter((c): c is string => typeof c === 'string')
      : []
    const brandColors = existingColors.length > 0 ? existingColors : buildBrandKit(context).colors

    // Fall back to whatever the asset was last generated with, then the
    // defaults. The guards keep a hand-edited payload from reaching the model.
    const style = parsed.data.style
      ?? (isImageStyle(payload.imageStyle) ? payload.imageStyle : DEFAULT_IMAGE_STYLE)
    const aspect = parsed.data.aspect
      ?? (isImageAspect(payload.aspect) ? payload.aspect : DEFAULT_IMAGE_ASPECT)
    const artDirection = parsed.data.artDirection
      ?? (typeof payload.artDirection === 'string' ? payload.artDirection : '')

    let candidates: string[]
    try {
      candidates = await generatePostImageCandidates(
        {
          caption: asset.body.trim() || asset.title,
          ventureName: venture.name,
          brandColors,
          style,
          artDirection,
          aspect,
        },
        parsed.data.count ?? MAX_IMAGE_CANDIDATES
      )
    } catch (genError) {
      logError('marketing/assets/image', genError, { assetId, ventureId: id })
      return NextResponse.json(
        { error: 'Image generation failed — try again in a moment.' },
        { status: 502 }
      )
    }

    // updateMarketingAsset replaces `payload` wholesale, so merge here rather
    // than trusting the client to round-trip every key it doesn't know about.
    const updated = await updateMarketingAsset(assetId, session.userId, {
      payload: {
        ...payload,
        imageCandidates: candidates,
        selectedImageIndex: 0,
        imageStyle: style,
        artDirection,
        aspect,
        brandColors,
      },
    })

    return NextResponse.json({ asset: updated, candidates })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}

// Clears generated candidates without touching a user-uploaded imageUrl.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const { id, assetId } = await params
    const { session } = await requireMarketingVenture(id)

    const asset = await getMarketingAssetById(assetId, session.userId)
    if (!asset || asset.venture_id !== id) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const payload = asObject(asset.payload)
    delete payload.imageCandidates
    delete payload.selectedImageIndex

    const updated = await updateMarketingAsset(assetId, session.userId, { payload })
    return NextResponse.json({ asset: updated })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
