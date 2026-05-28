import 'server-only'

import { extractJSON, getFlashModel } from '@/lib/gemini'
import type { CreateMarketingAssetSeed } from '@/lib/marketing.shared'
import { z } from 'zod'

// 6 hook patterns × 7 tone modes = 42 combinations. The generator is told to
// pick a different (hook, tone) pair per draft so consecutive drafts feel like
// genuinely different posts rather than reworded variants of the same idea.
const HOOK_PATTERNS = [
  'contrarian',
  'story-drop',
  'surprising-stat',
  'relatable-struggle',
  'bold-claim',
  'pointed-question',
] as const

const TONE_MODES = [
  'story-driven',
  'bold-contrarian',
  'vulnerable-authentic',
  'data-analytical',
  'mentor-voice',
  'founder-executive',
  'witty-light',
] as const

const postSchema = z.object({
  hook: z.string().min(2).max(360),
  body: z.string().min(40).max(3500),
  cta: z.string().min(2).max(280),
  hashtags: z.array(z.string()).default([]),
  angle: z.string().optional().default(''),
  tone: z.string().optional().default(''),
})

const responseSchema = z.object({
  posts: z.array(postSchema).min(1).max(6),
})

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// LinkedIn ranks down hashtag spam and treats 3-5 specific tags as the sweet
// spot. Strip leading #, drop punctuation, collapse to PascalCase-safe shape.
function normalizeHashtag(tag: string): string {
  const cleaned = tag.trim().replace(/^#+/, '')
  if (!cleaned) return ''
  return `#${cleaned.replace(/[^a-zA-Z0-9_]/g, '')}`
}

// Post-process the model's body: kill any em-dash the model snuck through
// (the single loudest AI-tell on LinkedIn), normalise paragraph breaks, strip
// the "Like and share if this resonated" flavour of beggy CTAs.
function sanitiseLinkedInBody(value: string): string {
  return value
    .replace(/—/g, ', ') // em-dash → comma
    .replace(/–/g, ', ') // en-dash → comma
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*(like|share)\s+(and|or)?\s*(share|like|comment).*$/gim, '')
    .trim()
}

function composeLinkedInPost(post: z.infer<typeof postSchema>): {
  title: string
  body: string
  hashtags: string[]
} {
  const hashtags = Array.from(
    new Set(post.hashtags.map(normalizeHashtag).filter(Boolean))
  ).slice(0, 5)

  const hook = sanitiseLinkedInBody(post.hook)
  const body = sanitiseLinkedInBody(post.body)
  const cta = sanitiseLinkedInBody(post.cta)

  const sections = [hook, body, cta, hashtags.join(' ')]
    .map((section) => section.trim())
    .filter(Boolean)

  return {
    title: hook.split('\n')[0]?.slice(0, 90) || 'LinkedIn post',
    body: sections.join('\n\n'),
    hashtags,
  }
}

function buildContextSummary(
  ventureName: string,
  marketing: Record<string, unknown> | null | undefined,
  research: Record<string, unknown> | null | undefined
): string {
  const gtm = asObject(marketing?.gtmStrategy) ?? {}
  const hashtagStrategy = asObject(marketing?.hashtagStrategy) ?? {}
  const liHashtags = Array.isArray(hashtagStrategy.linkedin)
    ? hashtagStrategy.linkedin
    : []

  const audience =
    asString(research?.audience) ||
    asString(research?.targetAudience) ||
    asString((asObject(research?.audience) ?? {})?.summary) ||
    ''
  const oneLiner =
    asString(research?.oneLiner) ||
    asString(research?.summary) ||
    asString(research?.description) ||
    ''
  const category = asString(research?.category) || asString(research?.industry) || ''

  const lines: string[] = [
    `Venture: ${ventureName}`,
    oneLiner && `One-liner: ${oneLiner}`,
    audience && `Audience: ${audience}`,
    category && `Category: ${category}`,
    asString(marketing?.theme) && `Theme: ${asString(marketing?.theme)}`,
    asString(gtm.overview) && `GTM overview: ${asString(gtm.overview)}`,
    asString(marketing?.marketingPlan) && `Marketing plan: ${asString(marketing?.marketingPlan)}`,
    asString(marketing?.summary) && `Summary: ${asString(marketing?.summary)}`,
    liHashtags.length > 0 &&
      `Approved LinkedIn hashtags pool: ${liHashtags.slice(0, 20).join(', ')}`,
  ].filter(Boolean) as string[]

  if (lines.length <= 1) {
    lines.push(
      'No marketing brief yet, invent a credible founder voice that focuses on the venture name, an early-stage launch angle, and the product promise.'
    )
  }

  return lines.join('\n')
}

const SYSTEM_PROMPT = [
  'You are a world-class LinkedIn ghostwriter for founders and operators.',
  'You write feed posts that build authority, earn comments, and attract real opportunities — without sounding like AI or a press release.',
  '',
  '# Voice and craft',
  '- Conversational, grounded, a real person talking. Short paragraphs (1-2 sentences), line-broken for scannability.',
  '- Strong opinion when warranted. Vulnerability when it earns trust. Specific numbers when available; never invent metrics.',
  '- Max 4 to 7 emojis per post, only where they add punch (not decoration).',
  '- 3 to 5 hashtags total, specific over generic. LinkedIn penalises hashtag spam.',
  '- No buzzwords (synergy, leverage, disrupt, circle back, bandwidth, pivot).',
  '- No all-caps for emphasis. No fake humblebrags ("almost did not apply, now I am a Director").',
  '- NEVER open with "I am excited to...", "Humbled and grateful...", "It has been a journey...", "Thrilled to announce...". These are dead on arrival.',
  '- NO EM DASHES. Replace with comma, period, semicolon, or rewrite as two short sentences. Em dashes are the single loudest AI-tell on LinkedIn.',
  '',
  '# The hook (first 1-3 lines)',
  'LinkedIn truncates after ~2 lines on mobile. The hook must earn the "see more" click. Pick ONE hook pattern per post:',
  '- contrarian: "Most people get [thing] completely wrong."',
  '- story-drop: "[N] months ago I [low point]. Today I [contrast]."',
  '- surprising-stat: "[N]% of [audience] cannot [thing]."',
  '- relatable-struggle: "I used to [pain]. Then I [shift]."',
  '- bold-claim: "[Common practice] is broken. Here is what actually works."',
  '- pointed-question: "What is the real reason [audience] [behaviour]?"',
  '',
  '# Structure',
  'Hook → Context (1-2 sentences) → Insight or story → Lesson → Soft CTA + open question.',
  'End with a question that invites a reply. Never "Like and share if this resonated."',
  '',
  '# Length',
  'Default to medium (200-400 words). Milestones or hot takes can go shorter (80-150). Only go long (500+) if the topic genuinely needs it.',
  '',
  '# Tone modes (pick one per post)',
  'story-driven, bold-contrarian, vulnerable-authentic, data-analytical, mentor-voice, founder-executive, witty-light.',
  '',
  '# Per-draft variety',
  'When asked for N drafts, EACH draft must pick a different combination of (hook pattern, tone mode). No two drafts share both.',
  '',
  '# Output',
  'Return ONLY a single JSON object, no prose, no markdown fences:',
  '{',
  '  "posts": [',
  '    {',
  '      "hook": "first 1-3 lines (the see-more line)",',
  '      "body": "rest of the post; 1-2 sentence paragraphs separated by blank lines",',
  '      "cta": "closing question or soft CTA (1-2 lines)",',
  '      "hashtags": ["specific", "to", "the", "venture"],',
  '      "angle": "hook pattern used, e.g. contrarian",',
  '      "tone": "tone mode used, e.g. bold-contrarian"',
  '    }',
  '  ]',
  '}',
].join('\n')

/**
 * Generates fresh LinkedIn feed-post drafts using Gemini, following the
 * LinkedInRocket playbook (strong hooks, no em-dashes, varied tone+hook per
 * draft, conversational founder voice). Returns up to `count` seed objects
 * ready for `createMarketingAssets`.
 *
 * Throws on Gemini failure or schema mismatch so the caller can fall back to
 * the deterministic `buildLinkedInDraftSeeds` — same defence-in-depth pattern
 * as the Instagram generator.
 */
export async function generateFreshLinkedInDrafts(
  ventureName: string,
  marketing: Record<string, unknown> | null | undefined,
  research: Record<string, unknown> | null | undefined,
  count: number,
  seed: number = Date.now()
): Promise<CreateMarketingAssetSeed[]> {
  if (count <= 0) return []

  const contextSummary = buildContextSummary(ventureName, marketing, research)

  // Deterministic rotation so consecutive clicks feel different. Pair the
  // i-th hook with the i-th tone offset so no draft accidentally reuses a
  // combination across a single batch.
  const hookStart = seed % HOOK_PATTERNS.length
  const toneStart = Math.floor(seed / HOOK_PATTERNS.length) % TONE_MODES.length
  const assignments = Array.from({ length: count }, (_, i) => ({
    angle: HOOK_PATTERNS[(hookStart + i) % HOOK_PATTERNS.length],
    tone: TONE_MODES[(toneStart + i) % TONE_MODES.length],
  }))

  const userPrompt = [
    'Brand context:',
    contextSummary,
    '',
    `Generate ${count} fresh, distinct LinkedIn feed posts for this venture.`,
    'For each post use the assigned (angle, tone) pair below. Each pair MUST be different from the others.',
    '',
    ...assignments.map(
      (a, i) => `Post ${i + 1}: angle="${a.angle}", tone="${a.tone}"`
    ),
    '',
    'Return ONLY the JSON object described in the system prompt. No prose, no markdown.',
  ].join('\n')

  const model = getFlashModel(8192)
  const result = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }] },
    ],
  })

  const text = result.response.text()
  const parsed = responseSchema.safeParse(extractJSON(text))
  if (!parsed.success) {
    throw new Error('LinkedIn draft generator returned invalid JSON')
  }

  return parsed.data.posts.slice(0, count).map((post, index) => {
    const composed = composeLinkedInPost(post)
    return {
      provider: 'linkedin' as const,
      assetType: 'linkedin_post' as const,
      title: composed.title || `${ventureName} LinkedIn post ${index + 1}`,
      body: composed.body,
      payload: {
        linkUrl: null,
        visibility: 'PUBLIC',
        hashtags: composed.hashtags,
        angle: post.angle || assignments[index]?.angle || '',
        tone: post.tone || assignments[index]?.tone || '',
      },
    }
  })
}
