import 'server-only'

// ─── Brand kit + voice for outreach content generation ────────────────────────
//
// Companion to lib/outreach-brief.ts. Where the brief answers "what is this
// venture about", the brand kit answers "what does it LOOK and SOUND like":
//
//   • colors — the real extracted palette from `context.inspirationTokens`
//              (see lib/schemas/inspiration.ts). Before this existed,
//              lib/marketing-publish.ts read `payload.brandColors` but nothing
//              ever wrote it, so every generated social image silently fell
//              back to the generic "refined modern palette" prompt.
//   • mood    — the inspiration brand mood, reused as an art-direction hint.
//   • voice   — a founder-authored writing profile stored at
//              `context.brandVoice`, shared by the Instagram, LinkedIn, and
//              cold-email generators so one venture sounds like one venture.
//
// Every read is defensive: a venture that never ran Inspiration and never set
// a voice yields an empty kit, and all consumers treat that as "no opinion" —
// exactly the behaviour they had before this module existed.

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function clip(input: string, max: number): string {
  return input.replace(/[\u0000-\u0008\u000B-\u001F]/g, '').slice(0, max).trim()
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

function asHex(value: unknown): string | null {
  const raw = asString(value)
  return HEX_RE.test(raw) ? raw : null
}

// Inspiration colors are `{ hex, confidence, source? }`. A low-confidence
// extraction usually means the analyzer only had an icon or og:image to work
// with — those hexes are often wrong, so we'd rather send no palette at all
// than steer every post image toward a hallucinated brand color.
const MIN_COLOR_CONFIDENCE = 50

function colorFromToken(value: unknown): string | null {
  const token = asObject(value)
  const hex = asHex(token.hex)
  if (!hex) return null
  const confidence = typeof token.confidence === 'number' ? token.confidence : 70
  return confidence >= MIN_COLOR_CONFIDENCE ? hex : null
}

// Pre-pivot ventures stored a branding palette as an array of either bare hex
// strings or `{ hex }` / `{ value }` objects — agents/pipeline.ts reads the
// same shape. Kept readable forever; new ventures never populate it.
function colorsFromLegacyPalette(palette: unknown): string[] {
  if (!Array.isArray(palette)) return []
  return palette
    .map((entry) => {
      if (typeof entry === 'string') return asHex(entry)
      const obj = asObject(entry)
      return asHex(obj.hex) ?? asHex(obj.value) ?? asHex(obj.color)
    })
    .filter((hex): hex is string => Boolean(hex))
}

export interface BrandKit {
  /** Up to 4 hex colors, most brand-defining first. Empty is valid. */
  colors: string[]
  /** Inspiration brand mood, e.g. "tech-dark". Empty when unknown. */
  mood: string
  /** Free-text personality line from the inspiration analysis. */
  personality: string
}

export function buildBrandKit(context: Record<string, unknown>): BrandKit {
  const tokens = asObject(context.inspirationTokens)
  const tokenColors = asObject(tokens.colors)
  const brand = asObject(tokens.brand)

  const fromTokens = [
    colorFromToken(tokenColors.primary),
    colorFromToken(tokenColors.secondary),
    colorFromToken(tokenColors.accent),
  ].filter((hex): hex is string => Boolean(hex))

  const colors = fromTokens.length > 0
    ? fromTokens
    : colorsFromLegacyPalette(asObject(context.branding).colorPalette)

  return {
    // De-duplicate case-insensitively — the analyzer sometimes returns the
    // same hex for primary and accent when a page is near-monochrome.
    colors: Array.from(new Map(colors.map((hex) => [hex.toLowerCase(), hex])).values()).slice(0, 4),
    mood: asString(brand.mood),
    personality: clip(asString(brand.personality), 240),
  }
}

// ─── Brand voice ──────────────────────────────────────────────────────────────

export const EMOJI_POLICIES = ['none', 'sparing', 'liberal'] as const
export type EmojiPolicy = (typeof EMOJI_POLICIES)[number]

export const VOICE_POVS = ['first-person', 'we', 'neutral'] as const
export type VoicePov = (typeof VOICE_POVS)[number]

export interface BrandVoice {
  tone: string
  pov: VoicePov
  bannedWords: string[]
  favoredWords: string[]
  emojiPolicy: EmojiPolicy
  sample: string
}

export const DEFAULT_BRAND_VOICE: BrandVoice = {
  tone: '',
  pov: 'neutral',
  bannedWords: [],
  favoredWords: [],
  emojiPolicy: 'sparing',
  sample: '',
}

function wordList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((entry) => clip(asString(entry), 40))
        .filter(Boolean)
    )
  ).slice(0, max)
}

/**
 * Reads `context.brandVoice` into a fully-populated object. Any venture saved
 * before this feature — i.e. every existing one — yields DEFAULT_BRAND_VOICE,
 * which renders to an empty prompt block and changes nothing.
 */
export function readBrandVoice(context: Record<string, unknown>): BrandVoice {
  const raw = asObject(context.brandVoice)
  const pov = asString(raw.pov) as VoicePov
  const emojiPolicy = asString(raw.emojiPolicy) as EmojiPolicy

  return {
    tone: clip(asString(raw.tone), 240),
    pov: VOICE_POVS.includes(pov) ? pov : DEFAULT_BRAND_VOICE.pov,
    bannedWords: wordList(raw.bannedWords, 30),
    favoredWords: wordList(raw.favoredWords, 30),
    emojiPolicy: EMOJI_POLICIES.includes(emojiPolicy) ? emojiPolicy : DEFAULT_BRAND_VOICE.emojiPolicy,
    sample: clip(asString(raw.sample), 800),
  }
}

const POV_DIRECTIVES: Record<VoicePov, string> = {
  'first-person': 'Write in first person singular ("I", "my") — this is one founder speaking.',
  we: 'Write in first person plural ("we", "our") — this is a team speaking.',
  neutral: 'Write in whichever person reads most naturally for the format.',
}

const EMOJI_DIRECTIVES: Record<EmojiPolicy, string> = {
  none: 'Use NO emoji anywhere.',
  sparing: 'At most one emoji, and only where it genuinely adds meaning.',
  liberal: 'Emoji are welcome where they add warmth, but never as bullet points.',
}

/**
 * Renders a brand voice into a prompt fragment. Returns '' when the founder
 * hasn't configured a voice, so callers can append it unconditionally without
 * changing their prompt for ventures that have no profile.
 *
 * The output is DATA about how to write — but `tone`/`sample`/word lists are
 * founder-supplied free text, so callers must keep it inside whatever
 * untrusted-input fencing they already use.
 */
export function renderBrandVoiceBlock(voice: BrandVoice): string {
  const lines: string[] = []

  if (voice.tone) lines.push(`Tone: ${voice.tone}`)
  if (voice.pov !== 'neutral') lines.push(POV_DIRECTIVES[voice.pov])
  if (voice.emojiPolicy !== 'sparing') lines.push(EMOJI_DIRECTIVES[voice.emojiPolicy])
  if (voice.favoredWords.length > 0) {
    lines.push(`Language that fits this brand: ${voice.favoredWords.join(', ')}`)
  }
  if (voice.bannedWords.length > 0) {
    lines.push(`NEVER use these words or phrases: ${voice.bannedWords.join(', ')}`)
  }
  if (voice.sample) {
    lines.push(`Sample of the founder's actual writing — match this rhythm and register:\n"""\n${voice.sample}\n"""`)
  }

  if (lines.length === 0) return ''
  return ['Brand voice (follow strictly):', ...lines].join('\n')
}

/** Convenience: read + render in one call from a raw venture context. */
export function buildBrandVoiceBlock(context: Record<string, unknown>): string {
  return renderBrandVoiceBlock(readBrandVoice(context))
}
