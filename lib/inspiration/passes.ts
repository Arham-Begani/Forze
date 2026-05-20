// lib/inspiration/passes.ts
//
// Enrichment Gemini Vision passes that run alongside the canonical token
// extraction in vision.ts. Each pass is best-effort: a failure returns null
// instead of throwing, so the analyze route can still persist the primary
// token output even if one of the auxiliary passes times out.
//
// Pass 0.5 — detectSections        → which sections does the screenshot show?
// Pass 2   — analyzeComponentPatterns → button / card / input + interaction states
// Pass 3   — analyzeAntiPatterns   → what NOT to copy + accessibility intent
//
// We deliberately keep these as small structured-JSON outputs (no nested
// confidence scores) — the canonical DesignTokens object already carries the
// fine-grained data the editor cares about. These passes feed the studio's
// "evidence" sections and the recommendation engine.

import { z } from 'zod'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { extractJSON, withRetry, withTimeout } from '@/lib/gemini'
import type { CaptureResult } from '@/lib/inspiration/screenshot'

const PASS_MODEL = process.env.INSPIRATION_VISION_MODEL || 'models/gemini-3-flash-preview'
const PASS_TIMEOUT_MS = Number(process.env.INSPIRATION_VISION_TIMEOUT_MS ?? 45_000)

export interface PassContext {
    ventureName?: string
    oneLiner?: string
    audience?: string
    ventureType?: string
}

function getClient(): GoogleGenerativeAI {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('GEMINI_API_KEY is not set')
    return new GoogleGenerativeAI(key)
}

function contextPreamble(ctx: PassContext | undefined): string {
    if (!ctx || (!ctx.ventureName && !ctx.oneLiner && !ctx.ventureType && !ctx.audience)) return ''
    const parts: string[] = ['### Domain context']
    if (ctx.ventureName) parts.push(`- Venture name: ${ctx.ventureName}`)
    if (ctx.ventureType) parts.push(`- Venture type: ${ctx.ventureType}`)
    if (ctx.oneLiner) parts.push(`- One-liner: ${ctx.oneLiner}`)
    if (ctx.audience) parts.push(`- Audience: ${ctx.audience}`)
    parts.push(
        '\nThese tokens will be applied to the above venture\'s landing page. Where relevant, weight your analysis toward signals that build credibility for THIS specific business (trust signals, CTA strategy, feature hierarchy) instead of generic "extract everything" output.',
    )
    return parts.join('\n')
}

// ── Section detection (Pass 0.5) ─────────────────────────────────────────────

const DetectedSectionSchema = z.object({
    name: z.enum(['hero', 'features', 'social_proof', 'pricing', 'faq', 'cta', 'footer', 'logos', 'other']),
    confidence: z.number().min(0).max(100),
    bbox: z
        .object({
            xPercent: z.number().min(0).max(100),
            yPercent: z.number().min(0).max(100),
            widthPercent: z.number().min(0).max(100),
            heightPercent: z.number().min(0).max(100),
        })
        .optional(),
    dominantColors: z.array(z.string()).default([]),
    layoutPattern: z.enum(['single-column', 'grid', 'list', 'split', 'carousel', 'unknown']).default('unknown'),
    notes: z.string().default(''),
})

export const DetectedSectionsSchema = z.object({
    sections: z.array(DetectedSectionSchema).default([]),
})

export type DetectedSections = z.infer<typeof DetectedSectionsSchema>

const SECTIONS_PROMPT = `You are a layout analyst. Given a single image of a landing page, identify which sections are visible and label them.

Sections to detect (use these exact slugs as the "name" field):
  hero, features, social_proof, pricing, faq, cta, footer, logos, other

For each detected section, return:
  - name: one of the slugs above
  - confidence: 0-100
  - bbox: { xPercent, yPercent, widthPercent, heightPercent } — bounding box as % of image
  - dominantColors: 1-3 hex codes ("#xxxxxx") that drive the section's visual identity
  - layoutPattern: one of single-column, grid, list, split, carousel, unknown
  - notes: 1 sentence describing what makes this section distinctive

If a section is NOT visible in the image (very common — og:images are usually hero-only), DO NOT invent it. Only return sections you can actually point to.

Output JSON ONLY in this shape:
{ "sections": [...] }`

export async function detectSections(
    capture: CaptureResult,
    ctx?: PassContext,
): Promise<DetectedSections | null> {
    return runVisionPass({
        capture,
        systemPrompt: [SECTIONS_PROMPT, contextPreamble(ctx)].filter(Boolean).join('\n\n'),
        userText: `Identify visible sections in the image from ${capture.url}. JSON only.`,
        schema: DetectedSectionsSchema,
    })
}

// ── Component patterns + interaction states (Pass 2) ─────────────────────────

const ComponentStateSchema = z.object({
    bg: z.string().default(''),
    text: z.string().default(''),
    border: z.string().default(''),
    shadow: z.string().default(''),
    transform: z.string().default(''),
    notes: z.string().default(''),
})

export const ComponentPatternsSchema = z.object({
    button: z
        .object({
            default: ComponentStateSchema.default({}),
            hover: ComponentStateSchema.default({}),
            focus: ComponentStateSchema.default({}),
            active: ComponentStateSchema.default({}),
            disabled: ComponentStateSchema.default({}),
        })
        .default({}),
    card: z
        .object({
            default: ComponentStateSchema.default({}),
            hover: ComponentStateSchema.default({}),
            notes: z.string().default(''),
        })
        .default({}),
    input: z
        .object({
            default: ComponentStateSchema.default({}),
            focus: ComponentStateSchema.default({}),
            error: ComponentStateSchema.default({}),
        })
        .default({}),
    link: z
        .object({
            default: ComponentStateSchema.default({}),
            hover: ComponentStateSchema.default({}),
        })
        .default({}),
})

export type ComponentPatterns = z.infer<typeof ComponentPatternsSchema>

const COMPONENTS_PROMPT = `You are a component-system analyst. Given a single image of a landing page, infer how the design treats interactive elements across states.

For each component (button, card, input, link) describe its DEFAULT state from what's visible, then INFER hover/focus/active/disabled states based on the design language. Be honest: if the design has a flat solid button, infer that hover would be a brightness shift, not a gradient morph. If the design has glassmorphism cards, infer hover would intensify the blur and border.

Each state field is a short string ("solid #635bff", "translucent white 10% with blur", "scale(0.98) + brightness 0.9"). Use plain English where CSS would be ambiguous.

Output JSON ONLY matching this shape:
{
  "button": { "default": {bg, text, border, shadow, transform, notes}, "hover": {...}, "focus": {...}, "active": {...}, "disabled": {...} },
  "card":   { "default": {...}, "hover": {...}, "notes": "..." },
  "input":  { "default": {...}, "focus": {...}, "error": {...} },
  "link":   { "default": {...}, "hover": {...} }
}

If a component is not visible, leave its fields empty strings. Do NOT hallucinate interaction states for components you cannot see.`

export async function analyzeComponentPatterns(
    capture: CaptureResult,
    ctx?: PassContext,
): Promise<ComponentPatterns | null> {
    return runVisionPass({
        capture,
        systemPrompt: [COMPONENTS_PROMPT, contextPreamble(ctx)].filter(Boolean).join('\n\n'),
        userText: `Analyze interactive component patterns in the image from ${capture.url}. JSON only.`,
        schema: ComponentPatternsSchema,
    })
}

// ── Anti-patterns + intent (Pass 3) ──────────────────────────────────────────

export const AntiPatternsSchema = z.object({
    doNotCopy: z.array(z.string()).default([]),
    accessibilityWins: z.array(z.string()).default([]),
    intentSignals: z.array(z.string()).default([]),
    responsiveRules: z.array(z.string()).default([]),
    contextRelevance: z
        .object({
            trustSignals: z.array(z.string()).default([]),
            differentiator: z.string().default(''),
            ctaStrategy: z.string().default(''),
            responsivePattern: z.string().default(''),
        })
        .default({}),
})

export type AntiPatterns = z.infer<typeof AntiPatternsSchema>

const ANTIPATTERNS_PROMPT = `You are a senior product designer reviewing one image of a landing page for a junior designer who's about to clone its style.

Return a JSON object with these keys:
  - doNotCopy: 3-6 specific things in this design that would FAIL if copied blindly (e.g. "Don't use the 11px navigation labels — they're below readability threshold" or "Don't copy the gray-on-white CTA — that's a contrast issue you'd inherit").
  - accessibilityWins: 2-4 things this design does well for accessibility (e.g. "Generous 1.6 line-height", "16px+ body text", "high-contrast hero CTA").
  - intentSignals: 3-5 specific decisions that elevate this from generic to intentional (e.g. "Headline kerning is tight on display weight only", "Card hover changes shadow color, not just size").
  - responsiveRules: 2-4 inferred rules about how this design behaves across viewports (e.g. "Hero stacks under 768px", "Feature grid becomes carousel below 640px"). If you cannot infer responsive behavior from a single image, return an empty array — DO NOT invent.
  - contextRelevance: { trustSignals: [...], differentiator: "...", ctaStrategy: "...", responsivePattern: "..." }
    - trustSignals: which design patterns build credibility for the kind of business this looks like (e.g. "logo grid below hero", "team photo in about section", "case-study testimonials").
    - differentiator: one sentence on how the design showcases the core differentiator.
    - ctaStrategy: one sentence on how the design makes the primary CTA unmissable.
    - responsivePattern: one sentence on how the design likely degrades on mobile.

Be concrete. "Don't use gradients" is worthless. "Don't copy the orange→pink hero gradient on light backgrounds — the contrast on white text drops to 2.1:1" is useful.

Output JSON only — no preamble, no markdown fences.`

export async function analyzeAntiPatterns(
    capture: CaptureResult,
    ctx?: PassContext,
): Promise<AntiPatterns | null> {
    return runVisionPass({
        capture,
        systemPrompt: [ANTIPATTERNS_PROMPT, contextPreamble(ctx)].filter(Boolean).join('\n\n'),
        userText: `Analyze anti-patterns and accessibility intent in the image from ${capture.url}. JSON only.`,
        schema: AntiPatternsSchema,
    })
}

// ── Shared runner ────────────────────────────────────────────────────────────

interface PassArgs<T extends z.ZodTypeAny> {
    capture: CaptureResult
    systemPrompt: string
    userText: string
    schema: T
}

async function runVisionPass<T extends z.ZodTypeAny>(args: PassArgs<T>): Promise<z.infer<T> | null> {
    const client = getClient()
    const model = client.getGenerativeModel({
        model: PASS_MODEL,
        systemInstruction: { role: 'system', parts: [{ text: args.systemPrompt }] },
    })

    const base64 = args.capture.image.data.toString('base64')

    const run = async (): Promise<z.infer<T>> => {
        const response = await model.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType: args.capture.image.contentType,
                                data: base64,
                            },
                        },
                        { text: args.userText },
                    ],
                },
            ],
        })
        const text = response.response.text() ?? ''
        const json = extractJSON(text) as Record<string, unknown>
        return args.schema.parse(json) as z.infer<T>
    }

    try {
        return await withRetry(() => withTimeout(run(), PASS_TIMEOUT_MS))
    } catch (e) {
        // Best-effort: a failure here should never block the canonical token
        // extraction. The analyze route persists null and the studio falls
        // back to the legacy single-pass view.
        console.warn('[inspiration pass] failed —', e instanceof Error ? e.message : e)
        return null
    }
}
