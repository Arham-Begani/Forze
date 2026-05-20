// lib/inspiration/tokens.ts
// Pure functions for working with DesignTokens. No I/O, no Gemini calls — these
// are merge / deep-set / coerce helpers shared by the analyze + token-edit
// routes and tested transitively via tsc.
//
// Multi-URL blending strategy:
//   • Colors: take the highest-confidence value per slot.
//   • Typography: use the first URL's font families (serif wins ties).
//   • Spacing: median across analyses for numerics, first non-empty otherwise.
//   • Components: take the most-confident value per token.
//   • Brand: choose the most common mood; concatenate personality strings.

import {
    DesignTokens,
    DesignTokensSchema,
    ColorWithConfidence,
} from '@/lib/schemas/inspiration'

// ── Defaults ──────────────────────────────────────────────────────────────────

const FALLBACK_PRIMARY: ColorWithConfidence = {
    hex: '#3b82f6',
    confidence: 40,
    source: 'fallback',
}

export function defaultTokens(): DesignTokens {
    // Round-trip through Zod so every defaulted field is populated.
    return DesignTokensSchema.parse({
        colors: { primary: FALLBACK_PRIMARY },
        typography: { sizes: {} },
        spacing: { scale: {} },
        components: {
            button: {},
            card: { shadow: {} },
            input: {},
        },
        responsive: { breakpoints: {} },
        brand: {},
        confidenceByCategory: {},
        sources: {},
    })
}

// ── Deep helpers ──────────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Deep-merge two plain-object trees. Arrays are replaced wholesale, not concat'd.
function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
    const out: Record<string, unknown> = { ...base }
    for (const [key, val] of Object.entries(patch)) {
        if (val === undefined) continue
        if (isPlainObject(val) && isPlainObject(out[key])) {
            out[key] = deepMerge(out[key] as Record<string, unknown>, val)
        } else {
            out[key] = val
        }
    }
    return out as T
}

// Set a value at a dotted path. Used by the token-editor PATCH endpoint to
// apply per-field user overrides without making the client send a full doc.
//   setAtPath(tokens, 'colors.primary.hex', '#0055ff')
//   setAtPath(tokens, 'typography.sizes.h1.base', '3.5rem')
export function setAtPath<T extends Record<string, unknown>>(
    target: T,
    path: string,
    value: unknown,
): T {
    if (!path) return target
    const parts = path.split('.').filter(Boolean)
    if (parts.length === 0) return target

    const next: Record<string, unknown> = { ...target }
    let cursor = next
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i]
        const existing = cursor[key]
        cursor[key] = isPlainObject(existing) ? { ...existing } : {}
        cursor = cursor[key] as Record<string, unknown>
    }
    cursor[parts[parts.length - 1]] = value
    return next as T
}

export function applyAdjustments(
    tokens: DesignTokens,
    adjustments: Record<string, unknown>,
    lockedPaths: string[],
): DesignTokens {
    const locked = new Set(lockedPaths)
    let next: Record<string, unknown> = tokens as unknown as Record<string, unknown>
    for (const [path, value] of Object.entries(adjustments)) {
        // Don't allow a locked path to be overwritten by client-sent edits.
        // (Locks are advisory in the UI — this is the server-side enforcement.)
        if (locked.has(path)) continue
        next = setAtPath(next as Record<string, unknown>, path, value)
    }
    // Re-validate so any type errors surface here instead of at render time.
    return DesignTokensSchema.parse(next)
}

// ── Multi-URL merge ───────────────────────────────────────────────────────────

// MergeWeights: { "stripe.com": 0.6, "vercel.com": 0.3, "linear.com": 0.1 }.
// Keys are hostnames (no protocol, no path). Weights should sum to ~1 but the
// merge logic re-normalises so partial maps still work. A missing weight
// defaults to the equal-share value (1 / numAnalyses).
export type MergeWeights = Record<string, number>

function hostnameOf(url: string | undefined): string {
    if (!url) return ''
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    } catch {
        return url.toLowerCase().replace(/^www\./, '')
    }
}

function resolveWeight(weights: MergeWeights | undefined, url: string, fallback: number): number {
    if (!weights) return fallback
    const host = hostnameOf(url)
    if (host && typeof weights[host] === 'number') return Math.max(0, weights[host])
    if (url && typeof weights[url] === 'number') return Math.max(0, weights[url])
    return fallback
}

function pickHighestConfidenceColor(
    candidates: Array<{ value: ColorWithConfidence | undefined; weight: number }>,
): ColorWithConfidence {
    const real = candidates.filter((c): c is { value: ColorWithConfidence; weight: number } => !!c.value?.hex)
    if (real.length === 0) return FALLBACK_PRIMARY
    real.sort((a, b) => (b.value.confidence ?? 0) * b.weight - (a.value.confidence ?? 0) * a.weight)
    return real[0].value
}

function weightedAverage(pairs: Array<{ value: number; weight: number }>): number {
    const valid = pairs.filter((p) => Number.isFinite(p.value) && p.weight > 0)
    if (valid.length === 0) return 0
    const totalWeight = valid.reduce((acc, p) => acc + p.weight, 0)
    if (totalWeight === 0) return valid[0].value
    return valid.reduce((acc, p) => acc + p.value * p.weight, 0) / totalWeight
}

function blendMoods(
    pairs: Array<{ mood: DesignTokens['brand']['mood']; weight: number }>,
): DesignTokens['brand']['mood'] {
    const totals = new Map<DesignTokens['brand']['mood'], number>()
    for (const { mood, weight } of pairs) {
        totals.set(mood, (totals.get(mood) ?? 0) + Math.max(0, weight))
    }
    let best: { mood: DesignTokens['brand']['mood']; total: number } | null = null
    for (const [mood, total] of totals) {
        if (!best || total > best.total) best = { mood, total }
    }
    return best?.mood ?? 'modern-minimal'
}

export function mergeTokens(analyses: DesignTokens[], weights?: MergeWeights): DesignTokens {
    if (analyses.length === 0) return defaultTokens()
    if (analyses.length === 1) {
        const only = analyses[0]
        return {
            ...only,
            sources: { ...only.sources, mergeStrategy: 'single' },
        }
    }

    // Build a normalised per-analysis weight. Equal-share default (1/N) means
    // omitting the weights map gives the same behaviour as before.
    const equalShare = 1 / analyses.length
    const weighted = analyses.map((a) => ({
        analysis: a,
        weight: resolveWeight(weights, a.sources.primaryUrl, equalShare),
    }))

    const primary = pickHighestConfidenceColor(
        weighted.map((w) => ({ value: w.analysis.colors.primary, weight: w.weight })),
    )
    const secondary = pickHighestConfidenceColor(
        weighted.map((w) => ({ value: w.analysis.colors.secondary, weight: w.weight })),
    )
    const accent = pickHighestConfidenceColor(
        weighted.map((w) => ({ value: w.analysis.colors.accent, weight: w.weight })),
    )

    const first = analyses[0]
    // Heading family: prefer serif if any weighted analysis is mostly-serif AND
    // its weight is meaningful (>= 0.2). Otherwise stay with the highest-weight
    // analysis's choice.
    const heaviest = [...weighted].sort((a, b) => b.weight - a.weight)[0]
    const meaningfulSerif = weighted.find(
        (w) =>
            w.weight >= 0.2 &&
            /serif/i.test(w.analysis.typography.headingFamily) &&
            !/sans-serif/i.test(w.analysis.typography.headingFamily),
    )
    const headingFamily =
        meaningfulSerif?.analysis.typography.headingFamily ?? heaviest.analysis.typography.headingFamily
    const bodyFamily = heaviest.analysis.typography.bodyFamily

    // Weighted-average section padding when expressed in rem; fall back to
    // heaviest analysis's value otherwise.
    const paddingPairs = weighted
        .map((w) => ({
            value: parseFloat(w.analysis.spacing.sectionPadding.x),
            weight: w.weight,
        }))
        .filter((p) => Number.isFinite(p.value))
    const sectionPaddingX = paddingPairs.length
        ? `${Number(weightedAverage(paddingPairs).toFixed(2))}rem`
        : heaviest.analysis.spacing.sectionPadding.x

    const merged: DesignTokens = {
        ...first,
        colors: {
            ...first.colors,
            primary,
            secondary: secondary === FALLBACK_PRIMARY ? undefined : secondary,
            accent: accent === FALLBACK_PRIMARY ? undefined : accent,
        },
        typography: {
            ...first.typography,
            headingFamily,
            bodyFamily,
        },
        spacing: {
            ...first.spacing,
            sectionPadding: { ...first.spacing.sectionPadding, x: sectionPaddingX },
        },
        brand: {
            ...first.brand,
            mood: blendMoods(weighted.map((w) => ({ mood: w.analysis.brand.mood, weight: w.weight }))),
            personality: weighted
                // Heaviest analyses lead the personality string so the LLM
                // weighting carries through to copy generation.
                .sort((a, b) => b.weight - a.weight)
                .map((w) => w.analysis.brand.personality)
                .filter(Boolean)
                .join(' / '),
        },
        sources: {
            primaryUrl: first.sources.primaryUrl,
            secondaryUrls: analyses.slice(1).map((a) => a.sources.primaryUrl).filter(Boolean),
            mergeStrategy: 'multi-url',
        },
        confidenceByCategory: averageConfidence(analyses),
    }

    return DesignTokensSchema.parse(merged)
}

function averageConfidence(analyses: DesignTokens[]): DesignTokens['confidenceByCategory'] {
    const keys = ['colors', 'typography', 'spacing', 'components', 'overall'] as const
    const out: Record<string, number> = {}
    for (const key of keys) {
        const vals = analyses.map((a) => a.confidenceByCategory[key]).filter((n) => Number.isFinite(n))
        out[key] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 65
    }
    return out as DesignTokens['confidenceByCategory']
}

// ── CSS-variable serializer ───────────────────────────────────────────────────
// Used by both the editor preview pane and the pipeline agent's prompt — keep
// both layers consuming the same canonical token-to-CSS mapping.

export function tokensToCssVars(tokens: DesignTokens): Record<string, string> {
    return {
        '--insp-color-primary': tokens.colors.primary.hex,
        '--insp-color-secondary': tokens.colors.secondary?.hex ?? tokens.colors.primary.hex,
        '--insp-color-accent': tokens.colors.accent?.hex ?? tokens.colors.primary.hex,
        '--insp-color-background': tokens.colors.background,
        '--insp-color-surface': tokens.colors.surface,
        '--insp-color-text': tokens.colors.text,
        '--insp-color-text-secondary': tokens.colors.textSecondary,
        '--insp-color-neutral-50': tokens.colors.neutral[50],
        '--insp-color-neutral-100': tokens.colors.neutral[100],
        '--insp-color-neutral-200': tokens.colors.neutral[200],
        '--insp-color-neutral-300': tokens.colors.neutral[300],
        '--insp-color-neutral-400': tokens.colors.neutral[400],
        '--insp-color-neutral-500': tokens.colors.neutral[500],
        '--insp-color-neutral-600': tokens.colors.neutral[600],
        '--insp-color-neutral-700': tokens.colors.neutral[700],
        '--insp-color-neutral-800': tokens.colors.neutral[800],
        '--insp-color-neutral-900': tokens.colors.neutral[900],
        '--insp-font-heading': tokens.typography.headingFamily,
        '--insp-font-body': tokens.typography.bodyFamily,
        '--insp-radius-button': tokens.components.button.radius.value,
        '--insp-radius-card': tokens.components.card.radius.value,
        '--insp-shadow-card-md': tokens.components.card.shadow.md,
        '--insp-section-padding-x': tokens.spacing.sectionPadding.x,
        '--insp-section-padding-y': tokens.spacing.sectionPadding.y,
        '--insp-container-max': tokens.spacing.containerMaxWidth,
    }
}

// Inline-style block the pipeline agent can drop into the generated <style> tag.
export function tokensToCssVarBlock(tokens: DesignTokens): string {
    const vars = tokensToCssVars(tokens)
    const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')
    return `:root {\n${lines}\n}`
}

// Compact prompt-ready text representation. Optimised for context window —
// drops nested confidence/source noise that the LLM doesn't need.
export function tokensToPromptDigest(tokens: DesignTokens): string {
    const lines: string[] = []
    lines.push(`Primary color: ${tokens.colors.primary.hex} (confidence ${tokens.colors.primary.confidence})`)
    if (tokens.colors.secondary) lines.push(`Secondary color: ${tokens.colors.secondary.hex}`)
    if (tokens.colors.accent) lines.push(`Accent color: ${tokens.colors.accent.hex}`)
    lines.push(`Background: ${tokens.colors.background} / Text: ${tokens.colors.text}`)
    lines.push(`Heading font: ${tokens.typography.headingFamily}`)
    lines.push(`Body font: ${tokens.typography.bodyFamily}`)
    lines.push(`H1: ${tokens.typography.sizes.h1.base} (mobile ${tokens.typography.sizes.h1.mobile ?? '?'})`)
    lines.push(`Section padding: ${tokens.spacing.sectionPadding.y} top/bottom, ${tokens.spacing.sectionPadding.x} sides`)
    lines.push(`Container max width: ${tokens.spacing.containerMaxWidth}`)
    lines.push(`Button radius: ${tokens.components.button.radius.value}`)
    lines.push(`Card radius: ${tokens.components.card.radius.value}, shadow: ${tokens.components.card.shadow.md}`)
    lines.push(`Brand mood: ${tokens.brand.mood}`)
    if (tokens.brand.personality) lines.push(`Brand personality: ${tokens.brand.personality}`)
    return lines.join('\n')
}

// ──────────────────────────────────────────────────────────────────────────────
// Design briefing — the "feel" layer
//
// Tokens alone don't teach the LLM why Stripe feels like Stripe. This function
// turns the abstract mood + designSignals into a concrete, opinionated set of
// implementation patterns the pipeline agent must follow: hero treatment, card
// surface, hover language, gradient strategy, density, type rhythm.
//
// Each mood gets a mini design system. The function then layers
// designSignals overrides on top so a "modern-minimal" mood with
// surface=glassmorphism gets minimalism *with* glass cards (rare combo but
// possible for crypto/fintech inspiration).
// ──────────────────────────────────────────────────────────────────────────────

type Briefing = {
    aesthetic: string
    hero: string
    cards: string
    buttons: string
    typography: string
    spacing: string
    transitions: string
    sectionTreatment: string
    motion: string
    antiPatterns: string[]
}

const MOOD_BRIEFINGS: Record<DesignTokens['brand']['mood'], Briefing> = {
    'modern-minimal': {
        aesthetic: 'Crystalline clarity. Whitespace as a feature. Function-first like Linear, Notion, or Stripe Docs. Every element must earn its place.',
        hero: 'Single column, generous whitespace. Headline left-aligned or centered. No gradients on background — use --insp-color-background flat. Sub-headline restrained, max-w-2xl. Small uppercase label above headline (tracking-widest, opacity-60, text-xs).',
        cards: 'Hairline 1px border (use --insp-color-neutral-200), no shadow at rest. On hover: border darkens to --insp-color-neutral-300, NO scale, NO glow. Rounded corners per --insp-radius-card.',
        buttons: 'Solid primary fill (var(--insp-color-primary)). Subtle 1px shadow. Hover: brightness-105 + translate-y-[-1px]. Secondary buttons: 1px border, transparent background.',
        typography: 'Sans-serif throughout (use --insp-font-heading and --insp-font-body). Headings font-semibold (not font-bold). tracking-tight on H1/H2. Body line-height 1.6.',
        spacing: 'py-20 to py-24 between sections (efficient, not cramped). Container max-w-5xl to max-w-6xl. Grid gap-6 to gap-8.',
        transitions: 'duration-200, ease-out. Subtle only.',
        sectionTreatment: 'Same background color throughout. Sections separated by whitespace alone, NOT by background changes.',
        motion: 'Fade-in on scroll (opacity 0→1 over 400ms). No parallax, no scroll-triggered scale.',
        antiPatterns: ['No gradients on backgrounds', 'No glassmorphism', 'No "bold" weights — semibold max', 'No emoji-heavy CTAs', 'No multi-color section bands'],
    },
    'corporate-formal': {
        aesthetic: 'Trustworthy, structured, restrained. Think IBM, McKinsey, professional services. Authority without flash.',
        hero: 'Structured grid. Headline + sub-head + CTA on the left, supporting visual (chart/diagram/team photo) on the right. Background: solid --insp-color-background or subtle linear gradient at 5% opacity.',
        cards: 'Solid background --insp-color-surface, 1px border --insp-color-neutral-200, soft shadow (shadow-sm). Hover: shadow-md. Conservative.',
        buttons: 'Primary: solid fill, sharper corners (radius 4-6px), font-semibold. Secondary: outlined. No animated gradients.',
        typography: 'Mix serif headlines (Georgia, Source Serif) with sans body OR all-sans with strong weight contrast. text-4xl md:text-5xl on H1. Letter-spacing normal, not tight.',
        spacing: 'py-24 to py-28. Container max-w-7xl. Generous but disciplined.',
        transitions: 'duration-300, ease-in-out. Professional.',
        sectionTreatment: 'Alternate --insp-color-background and --insp-color-surface every other section for visual rhythm.',
        motion: 'Slow staggered reveals. No bouncy easing.',
        antiPatterns: ['No neon colors', 'No oversized type', 'No glassmorphism', 'No emoji', 'No casual language tones in copy'],
    },
    'playful-energetic': {
        aesthetic: 'Bold, joyful, kinetic. Duolingo, Linear when feeling cheeky, kids-product brands. Confident color, friendly geometry.',
        hero: 'Big rounded blob shapes (absolute positioned, blurred 80px, opacity 30-50%) behind the headline. Multi-direction gradient possible. Headline can use animated bg-gradient-to-r from-[primary] via-[accent] to-[primary] bg-clip-text text-transparent animate-gradient.',
        cards: 'Rounded-2xl or rounded-3xl. Soft pastel surface or white. Drop shadow with a slight color tint (e.g. shadow-lg shadow-primary/20). Hover: scale-105 + slight rotate-1deg + brighter shadow.',
        buttons: 'Pill-shaped (rounded-full), solid color, weighty (font-bold). Hover: scale-110 + brightness-110 + slight wiggle (rotate animation 0deg → 2deg → -2deg → 0). Bouncy easing (cubic-bezier(.68,-0.55,.27,1.55)).',
        typography: 'Bold sans (font-extrabold or font-black on H1). text-5xl md:text-7xl. tracking-tight. Mix sizes within the hero for energy.',
        spacing: 'py-20 to py-28. Lots of negative space around playful elements.',
        transitions: 'duration-300 with bouncy easing. Energetic.',
        sectionTreatment: 'Vary section backgrounds — alternate between background, surface, and a tinted primary/20 wash.',
        motion: 'Floating animations on decorative shapes (translate-y up/down 10px over 4s, infinite). Hover wiggle on icons. Confetti or burst on CTA click (use a setTimeout fake).',
        antiPatterns: ['No sharp corners', 'No tiny text', 'No grayscale-only palettes', 'No "Submit" buttons — make CTAs fun'],
    },
    'luxury-premium': {
        aesthetic: 'Restrained, intentional, slow. Hermès, Loro Piana, Aesop. Every pixel earns its place. The page breathes.',
        hero: 'Full-bleed background: deep neutral (charcoal #1a1a1a or warm cream #f5f1ea) with optional grain texture overlay (SVG noise filter at opacity 0.04). Headline: large serif (use --insp-font-heading), kerned tight, possibly italic accents. CTA understated — text link with underline OR ghost button with 1px hairline border.',
        cards: 'No card chrome at all — borderless, shadowless. Content sits on whitespace. If a card border is needed, hairline 1px in --insp-color-neutral-300 only.',
        buttons: 'Ghost (transparent + 1px border) or text-only with underline. Hover: opacity 0.6 → 1 over 400ms. NEVER bouncy.',
        typography: 'Serif headlines (Cormorant Garamond, Playfair Display, Libre Caslon) at text-6xl md:text-8xl. font-light or font-normal — NOT bold. Generous letter-spacing on small caps labels (tracking-[0.3em]). Body sans, restrained.',
        spacing: 'py-32 to py-40 between sections. Container max-w-6xl. Generous gutters.',
        transitions: 'duration-500 to duration-700, ease-out. Slow and deliberate.',
        sectionTreatment: 'Same background. Section breaks are pure whitespace, sometimes a hairline divider.',
        motion: 'Slow fade-ins (800ms). Text-reveal animations (word by word). No scale on hover. No parallax beyond very subtle.',
        antiPatterns: ['No gradients on text or backgrounds', 'No glassmorphism', 'No bold weights', 'No emoji', 'No scale-on-hover effects', 'No bouncy easing'],
    },
    'startup-bold': {
        aesthetic: 'Stripe, Vercel, Linear during their bold phase. Confident gradients, dense information, modern weight. Premium-tech feel.',
        hero: 'Multi-stop linear gradient (135deg) from primary→accent→primary at darkened opacities — OR animated mesh gradient. Layer a subtle noise SVG over it (opacity 0.05). Headline: animated gradient text on key phrase using bg-clip-text. Floating blob accents (absolute, blur-3xl, opacity-30) behind headline. CTA: solid primary with slight glow (box-shadow with primary color at 30% opacity).',
        cards: 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl (when on dark sections). On light sections: bg-white border-neutral-200/60 shadow-xl shadow-neutral-900/5. Hover: border opacity doubles + soft glow.',
        buttons: 'Solid primary fill with embossed gradient (linear-gradient(to bottom right, primary, primary-darker)). Subtle inset highlight (box-shadow inset 0 1px 0 rgba(255,255,255,0.1)). Hover: brightness-110 + scale-[1.02].',
        typography: 'text-5xl md:text-7xl on H1, font-bold, tracking-tighter. Mix weights — bold for headlines, semibold for sub-heads, regular for body. Body text-base or text-lg, line-height 1.6.',
        spacing: 'py-24 to py-32. Container max-w-7xl. Comfortable but information-dense.',
        transitions: 'duration-200 to duration-300, ease-out. Snappy.',
        sectionTreatment: 'Hero is dark/gradient. Following sections alternate dark and bg-neutral-50 (or light surface). Each section gets distinct visual identity.',
        motion: 'Staggered fade-in + slide-up on scroll (each card 80ms after the previous). Subtle parallax on hero blobs (translate-y on scroll). Magnetic CTA optional (button follows cursor by 4-8px on hover).',
        antiPatterns: ['No flat blocky design', 'No system-default fonts in hero', 'No greys-only palette', 'No timid sub-1px borders on dark sections'],
    },
    'editorial-serif': {
        aesthetic: 'New York Times, Medium, The Atlantic. Long-form respect. Type is the hero.',
        hero: 'Asymmetric layout — large serif headline taking 60-70% of viewport, narrow column. Background flat. Drop-cap optional on opening paragraph.',
        cards: 'Borderless. Text-on-text. Featured items get a thin top border (1px --insp-color-neutral-400) above the title.',
        buttons: 'Underlined link styling preferred. If button needed: hairline border, no fill.',
        typography: 'Heavy serif (Source Serif Pro, Lora, Crimson Pro). H1 text-6xl md:text-8xl, font-bold or font-extrabold, tracking-tight, leading-tight. Body sans for legibility (system-ui or Inter), text-lg, leading-relaxed.',
        spacing: 'Narrow content column (max-w-3xl). Generous vertical rhythm (py-32).',
        transitions: 'duration-300, ease-out.',
        sectionTreatment: 'Pure background throughout. Section breaks: large negative space + optional thin horizontal rule.',
        motion: 'Minimal. Text reveals only.',
        antiPatterns: ['No sans-serif hero', 'No glassmorphism', 'No multi-column hero', 'No bold gradient accents'],
    },
    'tech-dark': {
        aesthetic: 'Cursor, Linear dark mode, Replit. Neon accent on near-black. Engineer-coded vibe.',
        hero: 'Background near-black (#0a0a0a or --insp-color-neutral-900). Subtle grid pattern overlay (1px lines at opacity 0.05). Headline white or slightly off-white (#f5f5f5). Accent color used for ONE highlight phrase (animated underline OR glow). Optional: terminal/code snippet preview as decoration.',
        cards: 'bg-neutral-900 border border-neutral-800 rounded-lg. Hover: border-color shifts to accent at 40% opacity, slight inner glow.',
        buttons: 'Primary: solid accent with subtle glow (shadow-[0_0_20px_var(--insp-color-accent)/30]). Secondary: bg-transparent border-neutral-700 text-neutral-200. Hover on secondary: border becomes accent.',
        typography: 'Sans-serif (Inter, Geist) for body. Optional monospace (JetBrains Mono, Geist Mono) for code-style accents (e.g. labels, version pills). H1 text-5xl md:text-7xl, font-semibold, tracking-tight, white. Important phrase in accent color.',
        spacing: 'py-24 to py-28. Container max-w-6xl. Information-dense.',
        transitions: 'duration-150 to duration-200. Crisp.',
        sectionTreatment: 'Dark throughout. Differentiate sections with subtle bg shifts (neutral-950 vs neutral-900) and accent dividers (1px gradient lines).',
        motion: 'Glowing accent on key phrases. Cursor-following accent dot optional. Smooth scroll on anchor links.',
        antiPatterns: ['No bright/light backgrounds', 'No serif fonts', 'No emoji', 'No pastel colors', 'No bouncy easing'],
    },
}

// Layered overrides — apply on top of mood briefing when designSignals diverge.
function applySignalOverrides(briefing: Briefing, signals: DesignTokens['designSignals']): string[] {
    const overrides: string[] = []

    if (signals.surface === 'glassmorphism' && !/glassmorphism/i.test(briefing.cards)) {
        overrides.push(
            'OVERRIDE: Force glassmorphism on cards regardless of mood — bg-white/8 backdrop-blur-xl border border-white/15 rounded-2xl.',
        )
    }
    if (signals.surface === 'noise-textured') {
        overrides.push(
            'OVERRIDE: Apply a subtle SVG noise texture overlay on hero and surface elements. Use inline base64 SVG noise at opacity 0.04–0.08.',
        )
    }
    if (signals.surface === 'depth-shadow') {
        overrides.push(
            'OVERRIDE: Lean into layered drop-shadows — cards get shadow-2xl with subtle color tint; hero elements have multiple shadow layers for depth.',
        )
    }
    if (signals.motion === 'energetic' || signals.motion === 'parallax-heavy') {
        overrides.push(
            'OVERRIDE: Add scroll-driven parallax on at least 2 decorative elements (translate-y on scroll position). Include staggered card reveals with 100ms+ delays.',
        )
    }
    if (signals.motion === 'glitchy') {
        overrides.push(
            'OVERRIDE: Add hover glitch effects on hero headline — CSS clip-path animation alternating between two offsets at 6Hz.',
        )
    }
    if (signals.density === 'compact') {
        overrides.push('OVERRIDE: Tighten section padding to py-16. Use smaller type scale. Pack more above the fold.')
    }
    if (signals.density === 'spacious' || signals.density === 'editorial') {
        overrides.push('OVERRIDE: Expand section padding to py-32+. Generous max-width constraints. One idea per scroll.')
    }
    if (signals.gradientStyle === 'mesh' || signals.gradientStyle === 'iridescent') {
        overrides.push(
            'OVERRIDE: Use multi-stop conic or radial gradients on hero — 3+ color stops, optionally animated via CSS @keyframes shifting gradient angle.',
        )
    }
    if (signals.gradientStyle === 'duotone') {
        overrides.push('OVERRIDE: Apply duotone treatment to imagery — CSS filter: grayscale() saturate() with primary+accent overlay.')
    }
    if (signals.cornerStyle === 'sharp') {
        overrides.push('OVERRIDE: Use rounded-none or rounded-sm everywhere — sharp corners on cards, buttons, inputs.')
    }
    if (signals.cornerStyle === 'pill') {
        overrides.push('OVERRIDE: Use rounded-full on all CTAs and primary buttons (pill shape). Cards stay at the mood-defined radius.')
    }
    if (signals.heroTreatment) {
        overrides.push(`HERO TREATMENT (extracted from inspiration): ${signals.heroTreatment}`)
    }
    if (signals.notableInteractions.length > 0) {
        overrides.push(
            `REQUIRED INTERACTIONS (extracted from inspiration — IMPLEMENT ALL):\n${signals.notableInteractions.map((i) => `  • ${i}`).join('\n')}`,
        )
    }

    return overrides
}

export function tokensToDesignBriefing(tokens: DesignTokens): string {
    const mood = tokens.brand.mood
    const briefing = MOOD_BRIEFINGS[mood] ?? MOOD_BRIEFINGS['modern-minimal']
    const overrides = applySignalOverrides(briefing, tokens.designSignals)

    const aestheticLine = tokens.designSignals.aesthetic || briefing.aesthetic

    return [
        `### Aesthetic North Star`,
        aestheticLine,
        ``,
        `### Mood: ${mood}`,
        ``,
        `**Hero section:** ${briefing.hero}`,
        ``,
        `**Cards / surfaces:** ${briefing.cards}`,
        ``,
        `**Buttons / CTAs:** ${briefing.buttons}`,
        ``,
        `**Typography rhythm:** ${briefing.typography}`,
        ``,
        `**Spacing & density:** ${briefing.spacing}`,
        ``,
        `**Transitions:** ${briefing.transitions}`,
        ``,
        `**Section treatment:** ${briefing.sectionTreatment}`,
        ``,
        `**Motion language:** ${briefing.motion}`,
        ``,
        `**Anti-patterns (DO NOT DO):**`,
        ...briefing.antiPatterns.map((p) => `  • ${p}`),
        overrides.length > 0 ? `\n### Signal-driven overrides\n${overrides.join('\n\n')}` : '',
    ]
        .filter(Boolean)
        .join('\n')
}
