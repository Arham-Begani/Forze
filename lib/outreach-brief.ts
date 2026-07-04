import 'server-only'

// ─── Venture brief for outreach + social content generation ───────────────────
//
// After the pivot removed the research/branding/marketing agents, all content
// generators were still reading venture.context.research/branding/marketing —
// permanently null for new ventures — and silently degrading to "invent from
// the venture name". This builds an equivalent brief from the context that
// DOES exist post-pivot:
//
//   • landing        — hero headline/subheadline, features, SEO description
//                      (the venture's actual positioning, written by Pipeline)
//   • shadowBoard    — verdict + top strategic concerns (sharpens the angle)
//   • project idea   — the founder's own words (globalIdea, passed in)
//   • legacy keys    — research/branding/marketing are still consumed when an
//                      older venture has them; they're additive, not required.
//
// Consumers: routine executor, Instagram/LinkedIn draft generators, campaign
// email generation. Output is plain text, clipped, and framed as untrusted
// DATA by the callers' prompts.

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

export function buildOutreachBrief(
  ventureName: string,
  context: Record<string, unknown>,
  opts: { globalIdea?: string | null } = {}
): string {
  const landing = asObject(context.landing)
  const copy = asObject(landing.landingPageCopy ?? landing.copy)
  const hero = asObject(copy.hero)
  const seo = asObject(landing.seoMetadata)
  const shadow = asObject(context.shadowBoard)

  // Legacy context (pre-pivot ventures only) — used when present.
  const branding = asObject(context.branding)
  const research = asObject(context.research)
  const marketing = asObject(context.marketing)
  const tone = asObject(branding.toneOfVoice)
  const gtm = asObject(marketing.gtmStrategy)

  const features = Array.isArray(copy.features)
    ? copy.features
        .slice(0, 4)
        .map((f) => {
          const feature = asObject(f)
          return asString(feature.title ?? feature.name ?? feature.headline) || asString(f)
        })
        .filter(Boolean)
    : []

  const concerns = Array.isArray(shadow.headlineWeaknesses)
    ? shadow.headlineWeaknesses.slice(0, 2).map((w) => asString(w)).filter(Boolean)
    : []

  const legacyPains = Array.isArray(research.painPoints)
    ? research.painPoints
        .slice(0, 3)
        .map((p) => asString(asObject(p).description))
        .filter(Boolean)
    : []

  const lines = [
    `Venture: ${clip(ventureName, 120)}`,
    opts.globalIdea && `Founder's idea, in their words: ${clip(opts.globalIdea, 400)}`,
    asString(hero.headline) && `Positioning (live page headline): ${clip(asString(hero.headline), 200)}`,
    asString(hero.subheadline) && `Value proposition: ${clip(asString(hero.subheadline), 300)}`,
    features.length > 0 && `Key features: ${clip(features.join(' • '), 400)}`,
    asString(seo.description) && `One-liner: ${clip(asString(seo.description), 240)}`,
    asString(shadow.verdictLabel) && `Board verdict: ${clip(asString(shadow.verdictLabel), 80)}`,
    concerns.length > 0 && `Known objections to pre-empt: ${clip(concerns.join(' • '), 300)}`,
    // Legacy enrichment
    asString(branding.brandName) && `Brand: ${clip(asString(branding.brandName), 80)}`,
    asString(branding.tagline) && `Tagline: ${clip(asString(branding.tagline), 200)}`,
    asString(tone.description) && `Voice: ${clip(asString(tone.description), 240)}`,
    asString(research.marketSummary) && `Market: ${clip(asString(research.marketSummary), 320)}`,
    legacyPains.length > 0 && `Audience pain points: ${clip(legacyPains.join(' • '), 480)}`,
    asString(gtm.overview) && `GTM angle: ${clip(asString(gtm.overview), 240)}`,
  ].filter(Boolean) as string[]

  return lines.join('\n')
}

// True when the brief carries real positioning beyond the bare venture name —
// callers can use this to decide whether to tell the model to invent an angle.
export function briefHasSubstance(brief: string): boolean {
  return brief.split('\n').length > 1
}
