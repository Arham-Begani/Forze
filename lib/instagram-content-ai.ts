import 'server-only'

import { extractJSON, getFlashModel } from '@/lib/gemini'
import type { CreateMarketingAssetSeed } from '@/lib/marketing.shared'
import { z } from 'zod'

const captionSchema = z.object({
  hook: z.string().min(2).max(140),
  body: z.string().min(20).max(1500),
  cta: z.string().min(2).max(140),
  hashtags: z.array(z.string()).default([]),
})

const responseSchema = z.object({
  posts: z.array(captionSchema).min(1).max(6),
})

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function buildContextSummary(marketing: Record<string, unknown> | null | undefined): string {
  if (!marketing) return 'No marketing brief yet — invent a credible early-stage launch angle.'

  const gtm = asObject(marketing.gtmStrategy) ?? {}
  const hashtagStrategy = asObject(marketing.hashtagStrategy) ?? {}
  const igHashtags = Array.isArray(hashtagStrategy.instagram) ? hashtagStrategy.instagram : []

  const lines = [
    asString(marketing.theme) && `Theme: ${asString(marketing.theme)}`,
    asString(gtm.overview) && `GTM overview: ${asString(gtm.overview)}`,
    asString(marketing.marketingPlan) && `Marketing plan: ${asString(marketing.marketingPlan)}`,
    asString(marketing.summary) && `Summary: ${asString(marketing.summary)}`,
    igHashtags.length > 0 && `Approved hashtags pool: ${igHashtags.slice(0, 30).join(', ')}`,
  ].filter(Boolean)

  return lines.length > 0 ? lines.join('\n') : 'Limited brief — keep posts focused on the venture name and value prop.'
}

function normalizeHashtag(tag: string): string {
  const cleaned = tag.trim().replace(/^#+/, '')
  if (!cleaned) return ''
  return `#${cleaned.replace(/[^a-zA-Z0-9_]/g, '')}`
}

function composeCaption(post: z.infer<typeof captionSchema>): { title: string; body: string; hashtags: string[] } {
  const hashtags = Array.from(
    new Set(
      post.hashtags
        .map(normalizeHashtag)
        .filter(Boolean)
    )
  ).slice(0, 30)

  const sections = [post.hook.trim(), post.body.trim(), post.cta.trim(), hashtags.join(' ')]
    .map((section) => section.trim())
    .filter(Boolean)

  return {
    title: post.hook.trim().slice(0, 90),
    body: sections.join('\n\n'),
    hashtags,
  }
}

/**
 * Generates fresh Instagram caption drafts each time it's called by asking Gemini
 * for new angles on the venture. Returns up to `count` seed objects ready for
 * `createMarketingAssets`.
 */
export async function generateFreshInstagramDrafts(
  ventureName: string,
  marketing: Record<string, unknown> | null | undefined,
  count: number,
  seed: number = Date.now()
): Promise<CreateMarketingAssetSeed[]> {
  if (count <= 0) return []

  const contextSummary = buildContextSummary(marketing)
  const angles = [
    'a contrarian observation that grabs attention',
    'a behind-the-scenes founder moment',
    'a customer pain point dramatized',
    'a tangible result/win written as a mini case study',
    'a forward-looking vision tied to the product',
    'a useful tip the audience can apply today',
  ]
  // Rotate angles deterministically per seed so consecutive clicks feel different.
  const startIdx = seed % angles.length
  const rotatedAngles = [...angles.slice(startIdx), ...angles.slice(0, startIdx)].slice(0, count + 2)

  const systemPrompt = [
    'You are a senior brand social strategist writing high-performing Instagram feed captions.',
    'You write punchy, voice-rich captions that feel human — not generic AI marketing speak.',
    'Each caption opens with a scroll-stopping hook, develops a tight idea, lands a specific CTA, and closes with relevant hashtags.',
    'Avoid: emoji spam, generic hustle clichés, "exciting news" filler, exclamation-heavy copy.',
    'Always return valid JSON conforming to the requested shape.',
  ].join('\n')

  const userPrompt = [
    `Venture: ${ventureName}`,
    '',
    'Brand context:',
    contextSummary,
    '',
    `Generate ${count} fresh, distinct Instagram feed posts. Each post should explore a DIFFERENT angle from this rotation:`,
    rotatedAngles.slice(0, count).map((angle, idx) => `${idx + 1}. ${angle}`).join('\n'),
    '',
    'Per post, return:',
    '- hook: 1 short scroll-stopper line (≤ 14 words)',
    '- body: 60–180 words, paragraph-broken, conversational',
    '- cta: 1 specific call-to-action line (link in bio, comment, share, etc.)',
    '- hashtags: 8–18 relevant tags (no spaces, no leading "#" required, will be normalized)',
    '',
    'Return ONLY a single JSON object with this exact shape:',
    '{ "posts": [ { "hook": "...", "body": "...", "cta": "...", "hashtags": ["a", "b"] } ] }',
  ].join('\n')

  const model = getFlashModel(8192)
  const result = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
    ],
  })

  const text = result.response.text()
  const parsed = responseSchema.safeParse(extractJSON(text))
  if (!parsed.success) {
    throw new Error('Caption generator returned invalid JSON')
  }

  return parsed.data.posts.slice(0, count).map((post, index) => {
    const composed = composeCaption(post)
    return {
      provider: 'instagram' as const,
      assetType: 'instagram_post' as const,
      title: composed.title || `${ventureName} Instagram post ${index + 1}`,
      body: composed.body,
      payload: {
        hashtags: composed.hashtags,
        ventureName,
      },
    }
  })
}
