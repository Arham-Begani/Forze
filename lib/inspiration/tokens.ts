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

function pickHighestConfidenceColor(
    candidates: Array<ColorWithConfidence | undefined>,
): ColorWithConfidence {
    const real = candidates.filter((c): c is ColorWithConfidence => !!c && !!c.hex)
    if (real.length === 0) return FALLBACK_PRIMARY
    real.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    return real[0]
}

function median(values: number[]): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function blendMoods(moods: DesignTokens['brand']['mood'][]): DesignTokens['brand']['mood'] {
    const counts = new Map<DesignTokens['brand']['mood'], number>()
    for (const m of moods) counts.set(m, (counts.get(m) ?? 0) + 1)
    let best: { mood: DesignTokens['brand']['mood']; count: number } | null = null
    for (const [mood, count] of counts) {
        if (!best || count > best.count) best = { mood, count }
    }
    return best?.mood ?? 'modern-minimal'
}

export function mergeTokens(analyses: DesignTokens[]): DesignTokens {
    if (analyses.length === 0) return defaultTokens()
    if (analyses.length === 1) {
        const only = analyses[0]
        return {
            ...only,
            sources: { ...only.sources, mergeStrategy: 'single' },
        }
    }

    const primary = pickHighestConfidenceColor(analyses.map((a) => a.colors.primary))
    const secondary = pickHighestConfidenceColor(analyses.map((a) => a.colors.secondary))
    const accent = pickHighestConfidenceColor(analyses.map((a) => a.colors.accent))

    const first = analyses[0]
    const headingSerif = analyses.find((a) => /serif/i.test(a.typography.headingFamily) && !/sans-serif/i.test(a.typography.headingFamily))
    const headingFamily = headingSerif?.typography.headingFamily ?? first.typography.headingFamily
    const bodyFamily = first.typography.bodyFamily

    // Use median of horizontal section padding when expressed in rem; fall back
    // to first non-empty value otherwise.
    const remValues = analyses
        .map((a) => parseFloat(a.spacing.sectionPadding.x))
        .filter((n) => Number.isFinite(n))
    const sectionPaddingX = remValues.length > 0 ? `${median(remValues)}rem` : first.spacing.sectionPadding.x

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
            mood: blendMoods(analyses.map((a) => a.brand.mood)),
            personality: analyses
                .map((a) => a.brand.personality)
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
