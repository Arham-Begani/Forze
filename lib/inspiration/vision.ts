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
                            text: `Analyze the image from ${capture.url}. Return ONLY the DesignTokens JSON described in the system instructions.`,
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

        const tokens = DesignTokensSchema.parse(patched)
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
