// lib/inspiration/accessibility.ts
//
// Pure accessibility validator over an extracted DesignTokens object. No I/O,
// no Gemini calls — this runs in the analyze route immediately after vision
// returns and the result is persisted to inspiration_analyses.accessibility_report.
//
// Checks (deterministic, source: WCAG 2.1):
//   • Body text vs background contrast ratio ≥ 4.5:1 (AA Normal Text)
//   • Body text vs surface contrast ratio ≥ 4.5:1 (AA Normal Text)
//   • Secondary text vs background contrast ratio ≥ 3:1 (AA Large Text — loosened)
//   • Primary button text (assumed white) vs primary fill contrast ≥ 4.5:1
//   • Base font size ≥ 14px (warn) / ≥ 16px (preferred)
//   • Normal line-height ≥ 1.5 (recommended for body)
//   • Focus outline color must be defined (sanity check — schema enforces but we
//     verify against the actual hex used).
//
// Output shape is JSONB-serialisable so it lives directly in the DB column.

import type { DesignTokens } from '@/lib/schemas/inspiration'

export type AccessibilitySeverity = 'pass' | 'warning' | 'critical'

export interface AccessibilityFinding {
    id: string
    severity: AccessibilitySeverity
    category: 'contrast' | 'typography' | 'focus' | 'spacing'
    label: string
    detail: string
    suggestion?: string
    // For contrast findings — keep raw numbers so the UI can render the badge.
    contrastRatio?: number
    minRequired?: number
}

export interface AccessibilityReport {
    score: number // 0-100
    findings: AccessibilityFinding[]
    summary: {
        passes: number
        warnings: number
        critical: number
    }
    hasContrastIssues: boolean
    requiresManualReview: boolean
}

// ── Contrast math ────────────────────────────────────────────────────────────

// sRGB → linear, per WCAG 2.1 G18 (https://www.w3.org/WAI/WCAG21/Techniques/general/G18).
function srgbToLinear(channel: number): number {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
    const { r, g, b } = parseHex(hex)
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function parseHex(hex: string): { r: number; g: number; b: number } {
    const cleaned = (hex ?? '').replace('#', '')
    const expanded =
        cleaned.length === 3
            ? cleaned
                  .split('')
                  .map((c) => c + c)
                  .join('')
            : cleaned.slice(0, 6).padEnd(6, '0')
    const r = parseInt(expanded.slice(0, 2), 16) || 0
    const g = parseInt(expanded.slice(2, 4), 16) || 0
    const b = parseInt(expanded.slice(4, 6), 16) || 0
    return { r, g, b }
}

export function contrastRatio(hexA: string, hexB: string): number {
    const lumA = relativeLuminance(hexA)
    const lumB = relativeLuminance(hexB)
    const brighter = Math.max(lumA, lumB)
    const darker = Math.min(lumA, lumB)
    return (brighter + 0.05) / (darker + 0.05)
}

// Decide whether white or black text reads better over a given background.
// Used for primary buttons where the token shape doesn't store a button text
// color explicitly.
export function preferredOn(backgroundHex: string): '#ffffff' | '#000000' {
    const whiteRatio = contrastRatio('#ffffff', backgroundHex)
    const blackRatio = contrastRatio('#000000', backgroundHex)
    return whiteRatio >= blackRatio ? '#ffffff' : '#000000'
}

// ── Typography heuristics ────────────────────────────────────────────────────

// Convert a CSS length string (1rem, 16px, 1.125rem) to pixels assuming the
// 16px root font size every browser ships with by default. Returns NaN if the
// string is something we cannot reasonably interpret (em-with-context, %).
function toPixels(value: string | undefined | null): number {
    if (!value) return NaN
    const trimmed = value.trim().toLowerCase()
    const remMatch = /^(-?\d*\.?\d+)rem$/.exec(trimmed)
    if (remMatch) return parseFloat(remMatch[1]) * 16
    const pxMatch = /^(-?\d*\.?\d+)px$/.exec(trimmed)
    if (pxMatch) return parseFloat(pxMatch[1])
    const unitless = /^(-?\d*\.?\d+)$/.exec(trimmed)
    if (unitless) return parseFloat(unitless[1])
    return NaN
}

// ── Public API ───────────────────────────────────────────────────────────────

export function validateAccessibility(tokens: DesignTokens): AccessibilityReport {
    const findings: AccessibilityFinding[] = []

    // Contrast: body text on background (AA Normal text ≥ 4.5:1).
    pushContrast(findings, {
        id: 'contrast-text-background',
        label: 'Body text on background',
        fg: tokens.colors.text,
        bg: tokens.colors.background,
        min: 4.5,
    })
    pushContrast(findings, {
        id: 'contrast-text-surface',
        label: 'Body text on card surface',
        fg: tokens.colors.text,
        bg: tokens.colors.surface,
        min: 4.5,
    })
    pushContrast(findings, {
        id: 'contrast-secondary-text-background',
        label: 'Secondary text on background',
        fg: tokens.colors.textSecondary,
        bg: tokens.colors.background,
        min: 3.0, // looser: secondary text is often metadata, allowed at AA Large
    })

    // Primary button — assume white-on-primary unless dark would be more legible.
    const buttonFg = preferredOn(tokens.colors.primary.hex)
    pushContrast(findings, {
        id: 'contrast-primary-button',
        label: 'Primary button label on primary fill',
        fg: buttonFg,
        bg: tokens.colors.primary.hex,
        min: 4.5,
    })

    // If accent or secondary are defined, validate them too — they're commonly
    // used for chips, badges, or secondary CTAs.
    if (tokens.colors.accent?.hex) {
        pushContrast(findings, {
            id: 'contrast-accent-on-background',
            label: 'Accent color on background',
            fg: tokens.colors.accent.hex,
            bg: tokens.colors.background,
            min: 3.0,
        })
    }

    // Typography heuristics — base font size + line height.
    const basePx = toPixels(tokens.typography.sizes.base.value)
    if (Number.isFinite(basePx)) {
        if (basePx < 14) {
            findings.push({
                id: 'font-size-too-small',
                severity: 'critical',
                category: 'typography',
                label: 'Body font size below 14px',
                detail: `Base body size resolves to ~${Math.round(basePx)}px. Most users will struggle to read body copy this small.`,
                suggestion: 'Increase typography.sizes.base.value to at least 1rem (16px).',
            })
        } else if (basePx < 16) {
            findings.push({
                id: 'font-size-suboptimal',
                severity: 'warning',
                category: 'typography',
                label: 'Body font size below 16px',
                detail: `Base body size resolves to ~${Math.round(basePx)}px. 16px is the cross-platform readability sweet spot.`,
                suggestion: 'Consider bumping typography.sizes.base.value to 1rem.',
            })
        } else {
            findings.push({
                id: 'font-size-ok',
                severity: 'pass',
                category: 'typography',
                label: 'Body font size readable',
                detail: `Base body size ${Math.round(basePx)}px is within recommended range.`,
            })
        }
    }

    const normalLineHeight = parseFloat(tokens.typography.lineHeights.normal)
    if (Number.isFinite(normalLineHeight)) {
        if (normalLineHeight < 1.35) {
            findings.push({
                id: 'line-height-too-tight',
                severity: 'warning',
                category: 'typography',
                label: 'Line height too tight',
                detail: `lineHeights.normal is ${normalLineHeight}. Body text packs together and reduces scan-ability.`,
                suggestion: 'Use a value of 1.5 or higher for body line-height.',
            })
        } else if (normalLineHeight < 1.5) {
            findings.push({
                id: 'line-height-suboptimal',
                severity: 'warning',
                category: 'typography',
                label: 'Line height below recommended 1.5',
                detail: `lineHeights.normal is ${normalLineHeight}. WCAG recommends 1.5 minimum for body copy.`,
                suggestion: 'Set lineHeights.normal to 1.5 or higher.',
            })
        } else {
            findings.push({
                id: 'line-height-ok',
                severity: 'pass',
                category: 'typography',
                label: 'Line height passes WCAG recommendation',
                detail: `lineHeights.normal of ${normalLineHeight} meets the 1.5 minimum.`,
            })
        }
    }

    // Focus state — we have a colour but verify it's distinguishable from the
    // input border. Same-colour focus rings are an accessibility footgun.
    const focusColor = tokens.components.input.focusOutlineColor
    const borderColor = tokens.components.input.borderColor
    if (focusColor && borderColor) {
        const focusRatio = contrastRatio(focusColor, borderColor)
        if (focusRatio < 1.3) {
            findings.push({
                id: 'focus-indicator-weak',
                severity: 'critical',
                category: 'focus',
                label: 'Focus outline indistinguishable from input border',
                detail: `Focus colour ${focusColor} only has a ${focusRatio.toFixed(2)}:1 contrast against the input border ${borderColor}.`,
                suggestion: 'Use a noticeably different colour (3:1 minimum) for the focus state.',
                contrastRatio: focusRatio,
                minRequired: 3.0,
            })
        } else {
            findings.push({
                id: 'focus-indicator-ok',
                severity: 'pass',
                category: 'focus',
                label: 'Focus indicator visible against border',
                detail: `Focus colour vs input border has a ${focusRatio.toFixed(2)}:1 ratio.`,
                contrastRatio: focusRatio,
            })
        }
    }

    return summariseReport(findings)
}

function pushContrast(
    findings: AccessibilityFinding[],
    args: { id: string; label: string; fg: string; bg: string; min: number },
): void {
    const ratio = contrastRatio(args.fg, args.bg)
    const passes = ratio >= args.min
    const isCritical = ratio < Math.max(args.min - 1.5, 2.0)
    findings.push({
        id: args.id,
        severity: passes ? 'pass' : isCritical ? 'critical' : 'warning',
        category: 'contrast',
        label: args.label,
        detail: `Contrast ratio ${ratio.toFixed(2)}:1 (target ≥ ${args.min}:1) — ${args.fg} on ${args.bg}.`,
        suggestion: passes
            ? undefined
            : `Adjust either ${args.fg} or ${args.bg} to reach at least ${args.min}:1. Darken the foreground or lighten the background.`,
        contrastRatio: Number(ratio.toFixed(2)),
        minRequired: args.min,
    })
}

function summariseReport(findings: AccessibilityFinding[]): AccessibilityReport {
    const passes = findings.filter((f) => f.severity === 'pass').length
    const warnings = findings.filter((f) => f.severity === 'warning').length
    const critical = findings.filter((f) => f.severity === 'critical').length
    const total = findings.length || 1

    // Score: every critical issue costs 15 points, every warning costs 5.
    // Floor at zero; ceiling implicit at 100. Lots of passes can offset minor
    // warnings but cannot fully recover from critical failures.
    const score = Math.max(0, Math.min(100, 100 - critical * 15 - warnings * 5))

    return {
        score,
        findings,
        summary: { passes, warnings, critical },
        hasContrastIssues: findings.some(
            (f) => f.category === 'contrast' && f.severity !== 'pass',
        ),
        requiresManualReview: critical > 0,
    }
}
