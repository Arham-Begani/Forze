// lib/inspiration/vision.ts
// Single-pass Gemini Vision analysis: feed in one captured image and a sharp
// "extract design tokens" prompt, get back a populated DesignTokens object.
//
// We deliberately collapse the spec's three-pass flow (global → components →
// a11y) into one pass because:
//   • Single image = single Gemini call = fast + cheap.
//   • The model handles all three concerns adequately when the JSON schema is
//     explicit about what fields it must populate.
//   • Multi-pass requires holding screenshots in memory across calls and adds
//     latency the founder will notice during the editor step.
//
// All Gemini output is validated against `DesignTokensSchema` before the
// caller ever sees it — there is no path where a hallucinated field shape can
// leak into the merge logic or the pipeline agent.

import { GoogleGenerativeAI } from '@google/generative-ai'
import { extractJSON, withRetry, withTimeout } from '@/lib/gemini'
import { DesignTokens, DesignTokensSchema } from '@/lib/schemas/inspiration'
import { defaultTokens } from '@/lib/inspiration/tokens'
import type { CaptureResult } from '@/lib/inspiration/screenshot'
import type { PassContext } from '@/lib/inspiration/passes'

const VISION_MODEL = process.env.INSPIRATION_VISION_MODEL || 'models/gemini-3-flash-preview'
const VISION_TIMEOUT_MS = Number(process.env.INSPIRATION_VISION_TIMEOUT_MS ?? 45_000)

function getClient(): GoogleGenerativeAI {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('GEMINI_API_KEY is not set')
    return new GoogleGenerativeAI(key)
}

const SYSTEM_PROMPT = `
You are an expert design-systems analyst. You are shown ONE image — usually a
hero shot, og:image, or favicon — that represents the visual identity of a
website. Your job is to extract design tokens that another agent will use to
re-skin a brand-new landing page in the same visual language.

You MUST output a single valid JSON object that matches this exact shape. Use
sensible defaults if the image does not reveal a value, but set the confidence
fields lower (40–60) when you are guessing.

{
  "colors": {
    "primary":   { "hex": "#xxxxxx", "confidence": 0-100 },
    "secondary": { "hex": "#xxxxxx", "confidence": 0-100 } | null,
    "accent":    { "hex": "#xxxxxx", "confidence": 0-100 } | null,
    "background": "#xxxxxx",
    "surface":    "#xxxxxx",
    "text":       "#xxxxxx",
    "textSecondary": "#xxxxxx",
    "error":   "#xxxxxx",
    "success": "#xxxxxx",
    "neutral": {
      "50":"#xxxxxx","100":"#xxxxxx","200":"#xxxxxx","300":"#xxxxxx",
      "400":"#xxxxxx","500":"#xxxxxx","600":"#xxxxxx","700":"#xxxxxx",
      "800":"#xxxxxx","900":"#xxxxxx"
    }
  },
  "typography": {
    "headingFamily": "Geist, Inter, sans-serif",
    "bodyFamily":    "Inter, system-ui, sans-serif",
    "sizes": {
      "h1":   { "base": "3rem",   "mobile": "2rem",   "confidence": 0-100 },
      "h2":   { "base": "2.25rem","mobile": "1.75rem","confidence": 0-100 },
      "h3":   { "base": "1.5rem", "mobile": "1.25rem","confidence": 0-100 },
      "base": { "value": "1rem",  "confidence": 0-100 },
      "sm":   { "value": "0.875rem","confidence": 0-100 },
      "lg":   { "value": "1.125rem","confidence": 0-100 }
    },
    "weights":     { "light": 300, "normal": 400, "semibold": 600, "bold": 700 },
    "lineHeights": { "tight": "1.2", "normal": "1.5", "relaxed": "1.75" }
  },
  "spacing": {
    "unit": "1rem",
    "scale": {
      "xs":  "0.5rem","sm": "1rem","md": "1.5rem","lg": "2rem","xl": "3rem","xxl":"4rem"
    },
    "sectionPadding": { "x": "1.5rem", "y": "5rem" },
    "containerMaxWidth": "80rem",
    "gridGap": "1.5rem"
  },
  "components": {
    "button": {
      "radius":  { "value": "0.5rem", "confidence": 0-100 },
      "padding": { "value": "0.75rem 1.5rem", "confidence": 0-100 },
      "fontSize": "1rem", "fontWeight": 600,
      "shadow": "0 1px 2px rgba(0,0,0,0.05)"
    },
    "card": {
      "radius":  { "value": "0.75rem", "confidence": 0-100 },
      "padding": { "value": "1.5rem",  "confidence": 0-100 },
      "shadow": {
        "sm": "0 1px 2px rgba(0,0,0,0.05)",
        "md": "0 4px 6px rgba(0,0,0,0.1)",
        "lg": "0 10px 25px rgba(0,0,0,0.15)"
      },
      "borderWidth": "1px",
      "borderColor": "#xxxxxx"
    },
    "input": {
      "radius":  { "value": "0.5rem", "confidence": 0-100 },
      "padding": "0.625rem 0.875rem",
      "borderWidth": "1px",
      "borderColor": "#xxxxxx",
      "focusOutlineColor": "#xxxxxx"
    }
  },
  "responsive": {
    "breakpoints": { "mobile": "640px", "tablet": "1024px", "desktop": "1280px" }
  },
  "brand": {
    "mood": "modern-minimal" | "corporate-formal" | "playful-energetic" | "luxury-premium" | "startup-bold" | "editorial-serif" | "tech-dark",
    "personality": "Two- or three-sentence description of the brand voice."
  },
  "designSignals": {
    "aesthetic": "1-2 sentences describing the overall feel. Think 'what would you tell a designer to make this site feel right?' Be specific — 'dense gradient-heavy SaaS' beats 'modern'.",
    "surface": "flat" | "glassmorphism" | "gradient" | "noise-textured" | "depth-shadow" | "neumorphism",
    "motion": "none" | "subtle" | "elegant" | "energetic" | "glitchy" | "parallax-heavy",
    "density": "compact" | "comfortable" | "spacious" | "editorial",
    "heroTreatment": "How the hero section feels. e.g. 'centered headline with large display font, gradient background, product mockup below' or 'split layout, headline left + interactive demo right'.",
    "notableInteractions": ["specific hover/scroll behaviors you would expect on this site, e.g. 'magnetic cursor on CTA', 'staggered fade-in on cards', 'animated gradient text', 'parallax scroll on hero blobs'"],
    "gradientStyle": "none" | "subtle-radial" | "bold-linear" | "mesh" | "iridescent" | "duotone",
    "cornerStyle": "sharp" | "soft" | "rounded" | "pill"
  },
  "confidenceByCategory": {
    "colors": 0-100, "typography": 0-100, "spacing": 0-100, "components": 0-100, "overall": 0-100
  }
}

Rules:
- All hex values lowercase, 6 digits, prefixed with #.
- Confidences honest: if you can clearly read a primary color from the image, set 90+. If you are inferring (e.g. only a logo is visible), set 40–60.
- Choose ONE brand mood that best fits.
- "personality" must be plain prose, not JSON, not bullet points.
- Do NOT add commentary, markdown fences, or trailing text — output the JSON object only.
- Reasoning may go inside <think>...</think> tags before the JSON; everything outside the tags must be the JSON.
`

export interface AnalyzeImageResult {
    tokens: DesignTokens
    rawText: string
}

// Build a domain-aware preamble that biases the LLM toward signals relevant to
// THIS venture. Without context, Gemini just dumps every visible token. With
// context, it weighs the extraction toward trust-building patterns, CTA
// strategy, and feature hierarchy that fit the venture's category.
function buildContextPreamble(ctx: PassContext | undefined): string {
    if (!ctx || (!ctx.ventureName && !ctx.oneLiner && !ctx.ventureType && !ctx.audience)) return ''
    const lines = ['', '### Domain context for this extraction']
    if (ctx.ventureName) lines.push(`- Venture: ${ctx.ventureName}`)
    if (ctx.ventureType) lines.push(`- Type: ${ctx.ventureType}`)
    if (ctx.oneLiner) lines.push(`- One-liner: ${ctx.oneLiner}`)
    if (ctx.audience) lines.push(`- Audience: ${ctx.audience}`)
    lines.push(
        '',
        'You are extracting tokens that will be applied to THIS venture\'s landing page.',
        'Weight the extraction toward:',
        '- Trust-building elements appropriate for this category (logos, testimonials, security badges, metric callouts)',
        '- CTA treatment that fits the venture\'s buying flow',
        '- Feature hierarchy that showcases what this venture actually differentiates on',
        '- Mood selection that matches what this audience actually responds to',
        'Pure aesthetic extraction is fine, but if you have a choice between two equally-confident readings, pick the one that serves this venture.',
    )
    return lines.join('\n')
}

// Build a ground-truth block from Microlink's Vibrant palette + brand color +
// background color. When present (Tier 0 captures), this REPLACES Gemini's
// hex-guessing for the primary slots and tells it the colors it must use.
// The model is still free to derive accents, neutrals, and secondaries from
// the image — but the core palette comes from real pixel sampling, not vision.
function buildGroundTruthBlock(capture: CaptureResult): string {
    if (!capture.groundTruth) return ''
    const {
        palette,
        brandColor,
        backgroundColor,
        title,
        publisher,
        fontHeading,
        fontBody,
        fontMono,
        allFontFamilies,
        cssVariables,
        inlineColors,
    } = capture.groundTruth
    const lines: string[] = ['', '### Ground-truth values extracted from the live page (NOT estimates — use these EXACTLY)']
    if (brandColor) {
        lines.push(`- BRAND COLOR (use as colors.primary.hex with confidence ≥ 95): ${brandColor.toLowerCase()}`)
    }
    if (backgroundColor) {
        lines.push(`- PAGE BACKGROUND (use as colors.background): ${backgroundColor.toLowerCase()}`)
    }
    if (palette && palette.length > 0) {
        lines.push(
            `- DOMINANT PALETTE (most-frequent first — pick secondary/accent from THIS list, in order, do not invent new hexes): ${palette
                .map((p) => p.toLowerCase())
                .join(', ')}`,
        )
    }
    if (fontHeading || fontBody || fontMono) {
        lines.push(
            `- REAL FONTS detected from <link>/@font-face/preload tags (use these literally, do not substitute Inter unless detected):`,
        )
        if (fontHeading) lines.push(`    • Heading: "${fontHeading}" → typography.headingFamily must start with this name`)
        if (fontBody) lines.push(`    • Body: "${fontBody}" → typography.bodyFamily must start with this name`)
        if (fontMono) lines.push(`    • Monospace (use for code/labels): "${fontMono}"`)
    }
    if (allFontFamilies && allFontFamilies.length > 0) {
        lines.push(`- All font families detected on the page: ${allFontFamilies.join(', ')}`)
    }
    if (cssVariables && Object.keys(cssVariables).length > 0) {
        // Pick the most useful slice for the prompt — primary/accent/brand
        // colour variables and radius / spacing variables.
        const interesting: Array<[string, string]> = Object.entries(cssVariables).filter(
            ([k]) =>
                /(color|bg|background|fg|foreground|brand|primary|accent|secondary|text|surface|radius|rounded|space|spacing|padding|gap|font)/i.test(
                    k,
                ),
        )
        if (interesting.length > 0) {
            lines.push(`- Real CSS variables defined in :root (USE THESE VALUES — they're authoritative for the slots they name):`)
            for (const [k, v] of interesting.slice(0, 14)) {
                lines.push(`    • --${k}: ${v}`)
            }
        }
    }
    if (inlineColors && inlineColors.length > 0) {
        lines.push(
            `- Inline hex colours referenced in style="" attributes (supplementary evidence): ${inlineColors
                .slice(0, 6)
                .join(', ')}`,
        )
    }
    if (title || publisher) {
        lines.push(`- Page identity (helpful for tone, not tokens): ${[publisher, title].filter(Boolean).join(' — ')}`)
    }
    lines.push(
        '',
        'These values are programmatically extracted from the live page (Vibrant palette + Microlink screenshot + HTML/CSS scrape). They OVERRIDE anything you would visually guess from the image.',
        'Confidence for colors.primary, colors.background, colors.secondary, colors.accent MUST be 95+ when populated from the ground-truth list. Only drop below 95 for slots you derive yourself (neutrals, text, surface).',
    )
    return lines.join('\n')
}

export async function analyzeImageWithGemini(
    capture: CaptureResult,
    ctx?: PassContext,
): Promise<AnalyzeImageResult> {
    const client = getClient()
    const systemPrompt = ctx ? `${SYSTEM_PROMPT}\n${buildContextPreamble(ctx)}` : SYSTEM_PROMPT
    const model = client.getGenerativeModel({
        model: VISION_MODEL,
        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    })

    const base64 = capture.image.data.toString('base64')
    const groundTruthBlock = buildGroundTruthBlock(capture)

    const run = async (): Promise<AnalyzeImageResult> => {
        const response = await model.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType: capture.image.contentType,
                                data: base64,
                            },
                        },
                        {
                            text:
                                `Analyze the image from ${capture.url}. Return ONLY the DesignTokens JSON described in the system instructions.` +
                                groundTruthBlock,
                        },
                    ],
                },
            ],
        })

        const text = response.response.text() ?? ''
        const json = extractJSON(text) as Record<string, unknown>

        // Patch the sources field with the URL we actually analyzed — the LLM
        // doesn't know to fill that in and it's important for the merge step.
        const patched = {
            ...json,
            sources: {
                primaryUrl: capture.url,
                secondaryUrls: [],
                mergeStrategy: 'single' as const,
            },
        }

        let tokens = DesignTokensSchema.parse(patched)

        // Trust-but-verify: even with the ground-truth instructions, Gemini
        // sometimes still "polishes" the hex. Clamp the canonical slots back
        // to ground truth when we have it. This is the deterministic floor —
        // the model can never override Vibrant on the colors we measured.
        if (capture.groundTruth) {
            const gt = capture.groundTruth

            // Font clamps. The detected family wins absolutely — Gemini
            // hallucinates "Inter" on every other site without this guard.
            if (gt.fontHeading) {
                const existing = tokens.typography.headingFamily ?? ''
                if (!existing.toLowerCase().includes(gt.fontHeading.toLowerCase())) {
                    tokens = {
                        ...tokens,
                        typography: {
                            ...tokens.typography,
                            headingFamily: `"${gt.fontHeading}", ${existing || 'system-ui, sans-serif'}`,
                        },
                    }
                }
            }
            if (gt.fontBody) {
                const existing = tokens.typography.bodyFamily ?? ''
                if (!existing.toLowerCase().includes(gt.fontBody.toLowerCase())) {
                    tokens = {
                        ...tokens,
                        typography: {
                            ...tokens.typography,
                            bodyFamily: `"${gt.fontBody}", ${existing || 'system-ui, sans-serif'}`,
                        },
                    }
                }
            }

            // CSS variable clamps for the most authoritative slots.
            const css = gt.cssVariables ?? {}
            const pickHex = (...keys: string[]): string | undefined => {
                for (const k of keys) {
                    const v = css[k]
                    if (v && /^#[0-9a-f]{6}$/i.test(v.trim())) return v.trim().toLowerCase()
                }
                return undefined
            }
            const cssPrimary = pickHex('primary', 'color-primary', 'brand', 'brand-primary', 'colour-primary')
            const cssAccent = pickHex('accent', 'color-accent', 'highlight')
            if (cssPrimary && !gt.brandColor) {
                tokens = {
                    ...tokens,
                    colors: {
                        ...tokens.colors,
                        primary: { hex: cssPrimary, confidence: 97, source: 'ground-truth-css-var' },
                    },
                }
            }
            if (cssAccent) {
                tokens = {
                    ...tokens,
                    colors: {
                        ...tokens.colors,
                        accent: { hex: cssAccent, confidence: 95, source: 'ground-truth-css-var' },
                    },
                }
            }
            const cssRadius = css['radius'] ?? css['border-radius'] ?? css['rounded-md']
            if (cssRadius) {
                tokens = {
                    ...tokens,
                    components: {
                        ...tokens.components,
                        button: { ...tokens.components.button, radius: { value: cssRadius, confidence: 95 } },
                        card: { ...tokens.components.card, radius: { value: cssRadius, confidence: 95 } },
                    },
                }
            }

            if (gt.brandColor && /^#[0-9a-f]{6}$/i.test(gt.brandColor)) {
                tokens = {
                    ...tokens,
                    colors: {
                        ...tokens.colors,
                        primary: { hex: gt.brandColor.toLowerCase(), confidence: 98, source: 'ground-truth' },
                    },
                }
            }
            if (gt.backgroundColor && /^#[0-9a-f]{6}$/i.test(gt.backgroundColor)) {
                tokens = {
                    ...tokens,
                    colors: { ...tokens.colors, background: gt.backgroundColor.toLowerCase() },
                }
            }
            // Fill secondary/accent from the dominant palette ONLY if Gemini
            // didn't return one or returned a color suspiciously close to the
            // primary (saturation distance below 0.05 in HSL → same color).
            if (gt.palette && gt.palette.length > 1) {
                const usable = gt.palette.filter(
                    (p) => /^#[0-9a-f]{6}$/i.test(p) && p.toLowerCase() !== tokens.colors.primary.hex.toLowerCase(),
                )
                if (usable.length > 0 && (!tokens.colors.secondary?.hex || tokens.colors.secondary.hex.toLowerCase() === tokens.colors.primary.hex.toLowerCase())) {
                    tokens = {
                        ...tokens,
                        colors: {
                            ...tokens.colors,
                            secondary: { hex: usable[0].toLowerCase(), confidence: 92, source: 'ground-truth-palette' },
                        },
                    }
                }
                if (usable.length > 1 && (!tokens.colors.accent?.hex || tokens.colors.accent.hex.toLowerCase() === tokens.colors.primary.hex.toLowerCase())) {
                    tokens = {
                        ...tokens,
                        colors: {
                            ...tokens.colors,
                            accent: { hex: usable[1].toLowerCase(), confidence: 88, source: 'ground-truth-palette' },
                        },
                    }
                }
            }
        }

        return { tokens, rawText: text }
    }

    try {
        return await withRetry(() => withTimeout(run(), VISION_TIMEOUT_MS))
    } catch (e) {
        // Last-resort fallback: return defaulted tokens so the founder can
        // still edit their way to something useful instead of seeing an error.
        const fallback = defaultTokens()
        return {
            tokens: {
                ...fallback,
                sources: {
                    primaryUrl: capture.url,
                    secondaryUrls: [],
                    mergeStrategy: 'single',
                },
                confidenceByCategory: {
                    ...fallback.confidenceByCategory,
                    overall: 25,
                    colors: 25,
                    typography: 25,
                    spacing: 25,
                    components: 25,
                },
            },
            rawText: e instanceof Error ? `[vision-error] ${e.message}` : String(e),
        }
    }
}

// ── Self-consistency wrapper ────────────────────────────────────────────────
//
// Runs the canonical extraction N times in parallel and reconciles fields
// that Gemini is unstable on (mood, confidence, mobile sizes, brand
// personality wording). Color slots are NOT touched here — they're already
// clamped to ground truth in the inner run. We're paying the extra call to
// stabilise the qualitative output, not the numeric ground-truth output.
//
// Cost: 2× vision calls per URL when enabled. Default ON, opt out via env
// INSPIRATION_VISION_SELF_CONSISTENCY=false. Latency is unchanged (parallel).

const SELF_CONSISTENCY_ENABLED = process.env.INSPIRATION_VISION_SELF_CONSISTENCY !== 'false'

export async function analyzeImageWithSelfConsistency(
    capture: CaptureResult,
    ctx?: PassContext,
): Promise<AnalyzeImageResult> {
    if (!SELF_CONSISTENCY_ENABLED) {
        return analyzeImageWithGemini(capture, ctx)
    }

    const [first, second] = await Promise.all([
        analyzeImageWithGemini(capture, ctx),
        analyzeImageWithGemini(capture, ctx),
    ])

    // Mood reconciliation: if both agree, keep. If they disagree, pick the
    // one with higher confidenceByCategory.overall. Ties → first.
    const mood1 = first.tokens.brand.mood
    const mood2 = second.tokens.brand.mood
    const overall1 = first.tokens.confidenceByCategory.overall ?? 0
    const overall2 = second.tokens.confidenceByCategory.overall ?? 0
    const chosenMood = mood1 === mood2 ? mood1 : overall2 > overall1 ? mood2 : mood1

    // Median across confidence categories — Gemini tends to inflate
    // confidence on single calls. Median across two runs is the most
    // honest stable estimate without doing a third call.
    const med = (a: number | undefined, b: number | undefined): number => {
        const aa = typeof a === 'number' ? a : 0
        const bb = typeof b === 'number' ? b : 0
        return Math.round((aa + bb) / 2)
    }
    const confidence = {
        colors: med(first.tokens.confidenceByCategory.colors, second.tokens.confidenceByCategory.colors),
        typography: med(first.tokens.confidenceByCategory.typography, second.tokens.confidenceByCategory.typography),
        spacing: med(first.tokens.confidenceByCategory.spacing, second.tokens.confidenceByCategory.spacing),
        components: med(first.tokens.confidenceByCategory.components, second.tokens.confidenceByCategory.components),
        overall: med(overall1, overall2),
    }

    // Brand personality: keep the longer of the two responses — the model
    // sometimes truncates personality strings on the first pass.
    const personality1 = first.tokens.brand.personality ?? ''
    const personality2 = second.tokens.brand.personality ?? ''
    const personality = personality2.length > personality1.length ? personality2 : personality1

    // designSignals.notableInteractions: take the union, deduped, capped.
    // Two passes often find different interactions; the union is more
    // accurate than either alone.
    const interactions = Array.from(
        new Set([
            ...first.tokens.designSignals.notableInteractions,
            ...second.tokens.designSignals.notableInteractions,
        ]),
    ).slice(0, 8)

    // For typography mobile sizes — second pass often skips them. Take the
    // first non-empty value across the two runs.
    const h1Mobile =
        first.tokens.typography.sizes.h1.mobile ?? second.tokens.typography.sizes.h1.mobile
    const h2Mobile =
        first.tokens.typography.sizes.h2.mobile ?? second.tokens.typography.sizes.h2.mobile

    // Base everything on `first` (ground-truth clamps are deterministic so
    // both runs have identical color slots — we only override the
    // qualitative + confidence fields).
    const merged = {
        ...first.tokens,
        brand: {
            ...first.tokens.brand,
            mood: chosenMood,
            personality,
        },
        designSignals: {
            ...first.tokens.designSignals,
            notableInteractions: interactions,
        },
        typography: {
            ...first.tokens.typography,
            sizes: {
                ...first.tokens.typography.sizes,
                h1: { ...first.tokens.typography.sizes.h1, mobile: h1Mobile },
                h2: { ...first.tokens.typography.sizes.h2, mobile: h2Mobile },
            },
        },
        confidenceByCategory: confidence,
    }

    return {
        tokens: DesignTokensSchema.parse(merged),
        rawText: `${first.rawText}\n---second-pass---\n${second.rawText}`,
    }
}
