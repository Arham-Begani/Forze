import { z } from 'zod'

// ──────────────────────────────────────────────────────────────────────────────
// DesignTokens — the canonical shape every inspiration analysis distills.
//
// Gemini Vision returns these from a screenshot/og:image; multi-URL runs go
// through `mergeTokens` (see lib/inspiration/tokens.ts) before being persisted.
// The Pipeline agent reads this object from `venture.context.inspirationTokens`
// to recolor / restyle the generated landing-page component.
//
// Every leaf that the AI is encouraged to "guess" carries a confidence score
// so the UI can surface "this is solid" vs "review me" badges.
// ──────────────────────────────────────────────────────────────────────────────

const HexColorSchema = z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Invalid hex color')

const ConfidenceSchema = z.number().min(0).max(100)

const ColorWithConfidenceSchema = z.object({
    hex: HexColorSchema,
    confidence: ConfidenceSchema.default(70),
    source: z.string().optional(), // URL this color came from in multi-URL blends
})

const NeutralPaletteSchema = z.object({
    50: HexColorSchema.default('#fafaf9'),
    100: HexColorSchema.default('#f5f5f4'),
    200: HexColorSchema.default('#e7e5e4'),
    300: HexColorSchema.default('#d6d3d1'),
    400: HexColorSchema.default('#a8a29e'),
    500: HexColorSchema.default('#78716c'),
    600: HexColorSchema.default('#57534e'),
    700: HexColorSchema.default('#44403c'),
    800: HexColorSchema.default('#292524'),
    900: HexColorSchema.default('#1c1917'),
})

const TypographyScaleEntrySchema = z.object({
    base: z.string().default('1rem'),
    mobile: z.string().optional(),
    confidence: ConfidenceSchema.default(70),
})

const SimpleScaleEntrySchema = z.object({
    value: z.string(),
    confidence: ConfidenceSchema.default(70),
})

const TokenWithConfidenceSchema = z.object({
    value: z.string(),
    confidence: ConfidenceSchema.default(70),
})

export const BrandMoodSchema = z.enum([
    'modern-minimal',
    'corporate-formal',
    'playful-energetic',
    'luxury-premium',
    'startup-bold',
    'editorial-serif',
    'tech-dark',
])
export type BrandMood = z.infer<typeof BrandMoodSchema>

export const DesignTokensSchema = z.object({
    colors: z.object({
        primary: ColorWithConfidenceSchema,
        secondary: ColorWithConfidenceSchema.optional(),
        accent: ColorWithConfidenceSchema.optional(),
        background: HexColorSchema.default('#ffffff'),
        surface: HexColorSchema.default('#fafaf9'),
        text: HexColorSchema.default('#1c1917'),
        textSecondary: HexColorSchema.default('#57534e'),
        error: HexColorSchema.default('#dc2626'),
        success: HexColorSchema.default('#16a34a'),
        neutral: NeutralPaletteSchema.default({
            50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1',
            400: '#a8a29e', 500: '#78716c', 600: '#57534e', 700: '#44403c',
            800: '#292524', 900: '#1c1917',
        }),
    }),

    // Every nested object below carries `.default({})` so a partial Gemini
    // response (very common — the model frequently skips weights/lineHeights/
    // sectionPadding even when the prompt requests them) parses cleanly and
    // the leaf defaults kick in instead of throwing.
    typography: z.object({
        headingFamily: z.string().default('Inter, system-ui, sans-serif'),
        bodyFamily: z.string().default('Inter, system-ui, sans-serif'),
        sizes: z.object({
            h1: TypographyScaleEntrySchema.default({ base: '3rem', mobile: '2rem', confidence: 70 }),
            h2: TypographyScaleEntrySchema.default({ base: '2.25rem', mobile: '1.75rem', confidence: 70 }),
            h3: TypographyScaleEntrySchema.default({ base: '1.5rem', mobile: '1.25rem', confidence: 70 }),
            base: SimpleScaleEntrySchema.default({ value: '1rem', confidence: 80 }),
            sm: SimpleScaleEntrySchema.default({ value: '0.875rem', confidence: 80 }),
            lg: SimpleScaleEntrySchema.default({ value: '1.125rem', confidence: 80 }),
        }).default({}),
        weights: z.object({
            light: z.number().default(300),
            normal: z.number().default(400),
            semibold: z.number().default(600),
            bold: z.number().default(700),
        }).default({}),
        lineHeights: z.object({
            tight: z.string().default('1.2'),
            normal: z.string().default('1.5'),
            relaxed: z.string().default('1.75'),
        }).default({}),
    }).default({}),

    spacing: z.object({
        unit: z.string().default('1rem'),
        scale: z.object({
            xs: z.string().default('0.5rem'),
            sm: z.string().default('1rem'),
            md: z.string().default('1.5rem'),
            lg: z.string().default('2rem'),
            xl: z.string().default('3rem'),
            xxl: z.string().default('4rem'),
        }).default({}),
        sectionPadding: z.object({
            x: z.string().default('1.5rem'),
            y: z.string().default('4rem'),
        }).default({}),
        containerMaxWidth: z.string().default('80rem'),
        gridGap: z.string().default('1.5rem'),
    }).default({}),

    components: z.object({
        button: z.object({
            radius: TokenWithConfidenceSchema.default({ value: '0.5rem', confidence: 70 }),
            padding: TokenWithConfidenceSchema.default({ value: '0.75rem 1.5rem', confidence: 70 }),
            fontSize: z.string().default('1rem'),
            fontWeight: z.number().default(600),
            shadow: z.string().default('0 1px 2px rgba(0,0,0,0.05)'),
        }).default({}),
        card: z.object({
            radius: TokenWithConfidenceSchema.default({ value: '0.75rem', confidence: 70 }),
            padding: TokenWithConfidenceSchema.default({ value: '1.5rem', confidence: 70 }),
            shadow: z.object({
                sm: z.string().default('0 1px 2px rgba(0,0,0,0.05)'),
                md: z.string().default('0 4px 6px rgba(0,0,0,0.1)'),
                lg: z.string().default('0 10px 25px rgba(0,0,0,0.15)'),
            }).default({}),
            borderWidth: z.string().default('1px'),
            borderColor: HexColorSchema.default('#e7e5e4'),
        }).default({}),
        input: z.object({
            radius: TokenWithConfidenceSchema.default({ value: '0.5rem', confidence: 70 }),
            padding: z.string().default('0.625rem 0.875rem'),
            borderWidth: z.string().default('1px'),
            borderColor: HexColorSchema.default('#d6d3d1'),
            focusOutlineColor: HexColorSchema.default('#3b82f6'),
        }).default({}),
    }).default({}),

    responsive: z.object({
        breakpoints: z.object({
            mobile: z.string().default('640px'),
            tablet: z.string().default('1024px'),
            desktop: z.string().default('1280px'),
        }).default({}),
    }).default({}),

    brand: z.object({
        mood: BrandMoodSchema.default('modern-minimal'),
        personality: z.string().default(''),
    }).default({}),

    // designSignals — the qualitative side of the inspiration. Tokens alone
    // ("color is #635bff, radius is 8px") don't capture WHY Stripe feels like
    // Stripe. These free-form / enum fields give the pipeline agent concrete
    // directives about surface treatment, motion character, and density so
    // the generated component matches the inspiration's *feel*, not just its
    // palette. Every field defaults so a thin Gemini response still parses.
    designSignals: z.object({
        aesthetic: z.string().default(''), // 1-2 sentence overall description
        surface: z
            .enum(['flat', 'glassmorphism', 'gradient', 'noise-textured', 'depth-shadow', 'neumorphism'])
            .default('flat'),
        motion: z
            .enum(['none', 'subtle', 'elegant', 'energetic', 'glitchy', 'parallax-heavy'])
            .default('subtle'),
        density: z.enum(['compact', 'comfortable', 'spacious', 'editorial']).default('comfortable'),
        heroTreatment: z.string().default(''), // e.g. "split layout with product mockup right"
        notableInteractions: z.array(z.string()).default([]), // e.g. ["magnetic CTA", "scroll-triggered parallax"]
        gradientStyle: z
            .enum(['none', 'subtle-radial', 'bold-linear', 'mesh', 'iridescent', 'duotone'])
            .default('none'),
        cornerStyle: z.enum(['sharp', 'soft', 'rounded', 'pill']).default('soft'),
    }).default({}),

    confidenceByCategory: z.object({
        colors: ConfidenceSchema.default(70),
        typography: ConfidenceSchema.default(70),
        spacing: ConfidenceSchema.default(60),
        components: ConfidenceSchema.default(60),
        overall: ConfidenceSchema.default(65),
    }).default({}),

    sources: z.object({
        primaryUrl: z.string().default(''),
        secondaryUrls: z.array(z.string()).default([]),
        mergeStrategy: z.enum(['single', 'multi-url']).default('single'),
    }).default({}),
})

export type DesignTokens = z.infer<typeof DesignTokensSchema>
export type ColorWithConfidence = z.infer<typeof ColorWithConfidenceSchema>

// ── URL validation ─────────────────────────────────────────────────────────────
// HTTPS only, no localhost/internal IPs (basic SSRF guard). Validation is also
// re-checked server-side in the analyze route — never trust a single layer.

export const InspirationUrlSchema = z
    .string()
    .url('Must be a valid URL')
    .refine((url) => {
        try {
            const u = new URL(url)
            if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
            const host = u.hostname.toLowerCase()
            if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return false
            if (host.endsWith('.localhost') || host.endsWith('.local')) return false
            // Block RFC1918 internal ranges (loose check — full IPv6/CIDR validation
            // happens in `isSafeRemoteUrl` inside lib/inspiration/screenshot.ts).
            if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
            return true
        } catch {
            return false
        }
    }, 'URL must be a public https:// address')

// MergeWeights map: hostname → weight (0..1). Keys do not need to sum to 1;
// the merge logic re-normalises internally.
export const MergeWeightsSchema = z
    .record(z.string(), z.number().min(0).max(1))
    .refine(
        (w) => Object.keys(w).length <= 5,
        'At most 5 merge weights — one per analysed URL plus headroom.',
    )

export const InspirationAnalyzeInputSchema = z.object({
    urls: z.array(InspirationUrlSchema).min(1).max(3),
    uploadedImage: z
        .object({
            // base64 data URL — used only when the user manually uploads an image
            // because all five remote-capture tiers failed.
            dataUrl: z.string().startsWith('data:image/'),
            url: z.string().optional(),
        })
        .optional(),
    // Optional per-source merge weighting set up front. When omitted, equal
    // shares are used (current default behaviour preserved).
    mergeWeights: MergeWeightsSchema.optional(),
})

export const InspirationTokenPatchSchema = z.object({
    // Path → new value, e.g. { "colors.primary.hex": "#0055ff" }.
    // Patches are deep-merged into the saved tokens object.
    adjustments: z.record(z.string(), z.unknown()).default({}),
    lockedPaths: z.array(z.string()).default([]),
    // When provided, triggers a full re-merge of raw_vision per the new weights
    // and overwrites the persisted tokens / mood / confidence fields.
    mergeWeights: MergeWeightsSchema.optional(),
})

// Refinement request from the post-apply "this looks off" feedback loop.
// User describes the issue, optionally names the affected component, and the
// refine endpoint asks Gemini for a partial DesignTokens patch.
export const InspirationRefineInputSchema = z.object({
    issue: z.string().min(8).max(800),
    affectedComponent: z
        .enum(['button', 'card', 'text', 'spacing', 'hero', 'overall'])
        .optional(),
    suggestion: z.string().max(400).optional(),
})

export type InspirationRefineInput = z.infer<typeof InspirationRefineInputSchema>
export type MergeWeights = z.infer<typeof MergeWeightsSchema>

export type InspirationTokenPatch = z.infer<typeof InspirationTokenPatchSchema>
