import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { marketingErrorResponse, requireMarketingVenture } from '@/lib/marketing-api'
import { updateVentureContext } from '@/lib/queries'
import {
  DEFAULT_BRAND_VOICE,
  EMOJI_POLICIES,
  VOICE_POVS,
  readBrandVoice,
} from '@/lib/brand-kit'

// The founder-authored writing profile stored at `venture.context.brandVoice`.
// Every generator (Instagram captions, LinkedIn posts, cold email) reads it
// through lib/brand-kit.ts, so one edit here changes the voice everywhere.
//
// Every field is optional: an empty profile renders to an empty prompt block
// and leaves generation behaving exactly as it did before this existed.
const brandVoiceSchema = z.object({
  tone: z.string().max(240).optional(),
  pov: z.enum(VOICE_POVS).optional(),
  bannedWords: z.array(z.string().max(40)).max(30).optional(),
  favoredWords: z.array(z.string().max(40)).max(30).optional(),
  emojiPolicy: z.enum(EMOJI_POLICIES).optional(),
  sample: z.string().max(800).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { venture } = await requireMarketingVenture(id)
    const context = (venture.context ?? {}) as unknown as Record<string, unknown>
    return NextResponse.json({ voice: readBrandVoice(context) })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { venture } = await requireMarketingVenture(id)

    const parsed = brandVoiceSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid brand voice payload' }, { status: 400 })
    }

    // Merge onto the stored voice so a partial PUT (e.g. only `tone`) never
    // silently wipes the fields it omitted.
    const context = (venture.context ?? {}) as unknown as Record<string, unknown>
    const merged = { ...DEFAULT_BRAND_VOICE, ...readBrandVoice(context), ...parsed.data }

    await updateVentureContext(id, 'brandVoice', merged)

    // Round-trip through the reader so the client gets the same normalized
    // shape the generators will see (deduped word lists, clipped strings).
    return NextResponse.json({ voice: readBrandVoice({ brandVoice: merged }) })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
