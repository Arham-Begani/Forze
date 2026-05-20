// lib/inspiration/scoring.ts
//
// Pure quality scoring of an extracted DesignTokens object. No I/O — runs
// alongside accessibility validation immediately after vision returns.
//
// Five dimensions, each 0-100:
//   • colorConsistency   — how disciplined the palette is (high if neutrals
//                          progress linearly; low if too many one-off greys)
//   • readability        — derived from accessibility report (high if no
//                          critical contrast failures; reused so we don't
//                          double-count)
//   • responsiveness     — does the typography scale ship a mobile size for
//                          H1/H2 and is the breakpoint set well-formed
//   • componentCohesion  — do button radius / card radius / input radius read
//                          as a system (low if they diverge wildly)
//   • trustSignals       — does the design briefing surface
//                          luxury/corporate/startup-bold patterns that read
//                          as B2B-trustworthy (heuristic, not exhaustive)
//
// Output also includes a flat `recommendations` string array so the UI can
// render an actionable to-do list under the score.

import type { DesignTokens } from '@/lib/schemas/inspiration'
import type { AccessibilityReport } from '@/lib/inspiration/accessibility'

export interface QualityScore {
    overallScore: number
    colorConsistency: number
    readability: number
    responsiveness: number
    componentCohesion: number
    trustSignals: number
}

export interface ScoringResult {
    score: QualityScore
    recommendations: string[]
}

// Heuristic helpers ----------------------------------------------------------

function parseRemLike(value: string | undefined): number {
    if (!value) return NaN
    const trimmed = value.trim().toLowerCase()
    const rem = /^(-?\d*\.?\d+)rem$/.exec(trimmed)
    if (rem) return parseFloat(rem[1])
    const px = /^(-?\d*\.?\d+)px$/.exec(trimmed)
    if (px) return parseFloat(px[1]) / 16
    const n = /^(-?\d*\.?\d+)$/.exec(trimmed)
    if (n) return parseFloat(n[1])
    return NaN
}

// Distance between adjacent neutrals on the perceptual lightness scale. We use
// HSL lightness as a fast proxy — anything below 0.04 between two stops reads
// as visually identical, which means the palette has redundant greys.
function hexLightness(hex: string): number {
    const cleaned = (hex || '').replace('#', '').padEnd(6, '0').slice(0, 6)
    const r = parseInt(cleaned.slice(0, 2), 16) / 255
    const g = parseInt(cleaned.slice(2, 4), 16) / 255
    const b = parseInt(cleaned.slice(4, 6), 16) / 255
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
}

function scoreColorConsistency(tokens: DesignTokens): { score: number; notes: string[] } {
    const notes: string[] = []
    const stops: Array<keyof DesignTokens['colors']['neutral']> = [
        50, 100, 200, 300, 400, 500, 600, 700, 800, 900,
    ] as never
    const lightnesses = stops.map((s) => hexLightness(tokens.colors.neutral[s] ?? '#888888'))

    // Score by checking monotonicity (lightnesses should descend) AND spread.
    let monotonicViolations = 0
    let tooCloseSteps = 0
    for (let i = 1; i < lightnesses.length; i++) {
        if (lightnesses[i] >= lightnesses[i - 1]) monotonicViolations += 1
        if (Math.abs(lightnesses[i] - lightnesses[i - 1]) < 0.04) tooCloseSteps += 1
    }

    let score = 100
    score -= monotonicViolations * 12 // ascending greys = redundant pairs
    score -= tooCloseSteps * 6

    if (monotonicViolations > 0) {
        notes.push(
            `Neutral palette has ${monotonicViolations} non-monotonic step(s) — adjacent greys aren't strictly progressing.`,
        )
    }
    if (tooCloseSteps > 2) {
        notes.push(
            `Neutral palette has ${tooCloseSteps} near-identical step pair(s). Consider trimming to 6-7 distinct stops.`,
        )
    }

    return { score: Math.max(0, Math.min(100, score)), notes }
}

function scoreReadability(report: AccessibilityReport): { score: number; notes: string[] } {
    const notes: string[] = []
    // Reuse the accessibility score but cap it differently — readability is a
    // narrower lens than the full a11y report (we don't penalise focus issues
    // here, only contrast + type scale).
    const contrastFindings = report.findings.filter((f) => f.category === 'contrast')
    const typographyFindings = report.findings.filter((f) => f.category === 'typography')

    const contrastCritical = contrastFindings.filter((f) => f.severity === 'critical').length
    const contrastWarn = contrastFindings.filter((f) => f.severity === 'warning').length
    const typeWarn = typographyFindings.filter((f) => f.severity !== 'pass').length

    let score = 100 - contrastCritical * 18 - contrastWarn * 6 - typeWarn * 5
    score = Math.max(0, Math.min(100, score))

    if (contrastCritical > 0) {
        notes.push(`${contrastCritical} critical contrast failure(s) — see Accessibility tab for fixes.`)
    }
    if (typeWarn > 0) {
        notes.push(
            `Body type setup needs adjustment (size and/or line-height fall below recommended values).`,
        )
    }
    return { score, notes }
}

function scoreResponsiveness(tokens: DesignTokens): { score: number; notes: string[] } {
    const notes: string[] = []
    let score = 100

    const h1Mobile = tokens.typography.sizes.h1.mobile
    const h2Mobile = tokens.typography.sizes.h2.mobile
    if (!h1Mobile) {
        notes.push('No explicit mobile H1 size — page risks blowing past viewport on small screens.')
        score -= 20
    }
    if (!h2Mobile) {
        notes.push('No explicit mobile H2 size — secondary headings may not scale down gracefully.')
        score -= 10
    }

    const mobileBp = tokens.responsive.breakpoints.mobile
    const tabletBp = tokens.responsive.breakpoints.tablet
    const desktopBp = tokens.responsive.breakpoints.desktop
    const mobilePx = parseRemLike(mobileBp?.replace('px', ''))
    const tabletPx = parseRemLike(tabletBp?.replace('px', ''))
    const desktopPx = parseRemLike(desktopBp?.replace('px', ''))
    if (Number.isFinite(mobilePx) && Number.isFinite(tabletPx) && mobilePx >= tabletPx) {
        notes.push('Mobile breakpoint is at or above tablet — breakpoints look misordered.')
        score -= 15
    }
    if (Number.isFinite(tabletPx) && Number.isFinite(desktopPx) && tabletPx >= desktopPx) {
        notes.push('Tablet breakpoint is at or above desktop — breakpoints look misordered.')
        score -= 15
    }

    return { score: Math.max(0, Math.min(100, score)), notes }
}

function scoreComponentCohesion(tokens: DesignTokens): { score: number; notes: string[] } {
    const notes: string[] = []
    const buttonRadius = parseRemLike(tokens.components.button.radius.value)
    const cardRadius = parseRemLike(tokens.components.card.radius.value)
    const inputRadius = parseRemLike(tokens.components.input.radius.value)

    const radii = [buttonRadius, cardRadius, inputRadius].filter((n) => Number.isFinite(n))
    if (radii.length < 2) return { score: 80, notes }

    const max = Math.max(...radii)
    const min = Math.min(...radii)
    const spread = max - min

    let score = 100
    // A spread of more than ~0.75rem (12px) between button/card/input radii
    // tends to read as "designed by committee" instead of a cohesive system.
    if (spread > 1) {
        score -= 30
        notes.push(
            `Button/card/input radii diverge widely (${min}-${max}rem). Unify to a single rounding family for visual coherence.`,
        )
    } else if (spread > 0.5) {
        score -= 12
        notes.push(
            `Mild radius drift between components (${min}-${max}rem) — consider aligning button and input radii at minimum.`,
        )
    }

    return { score: Math.max(0, Math.min(100, score)), notes }
}

function scoreTrustSignals(tokens: DesignTokens): { score: number; notes: string[] } {
    const notes: string[] = []
    // Trust signals are inherently contextual, so this is a directional
    // heuristic: certain moods are more credibility-coded than others.
    const moodScores: Record<DesignTokens['brand']['mood'], number> = {
        'corporate-formal': 95,
        'editorial-serif': 88,
        'luxury-premium': 92,
        'modern-minimal': 84,
        'startup-bold': 80,
        'tech-dark': 76,
        'playful-energetic': 62,
    }
    const moodScore = moodScores[tokens.brand.mood] ?? 70

    // Bonus if the personality string is well-developed.
    const personalityLen = (tokens.brand.personality ?? '').trim().length
    const personalityBonus = personalityLen > 80 ? 5 : 0
    if (personalityLen < 30) {
        notes.push('Brand personality is short — extend it so the landing-page agent can weave it into copy.')
    }

    const score = Math.max(0, Math.min(100, moodScore + personalityBonus))
    return { score, notes }
}

// Public ---------------------------------------------------------------------

export function scoreTokens(
    tokens: DesignTokens,
    accessibility: AccessibilityReport,
): ScoringResult {
    const cc = scoreColorConsistency(tokens)
    const rd = scoreReadability(accessibility)
    const rs = scoreResponsiveness(tokens)
    const co = scoreComponentCohesion(tokens)
    const ts = scoreTrustSignals(tokens)

    const overall = Math.round((cc.score + rd.score + rs.score + co.score + ts.score) / 5)

    const recommendations = [
        ...cc.notes,
        ...rd.notes,
        ...rs.notes,
        ...co.notes,
        ...ts.notes,
    ].slice(0, 12) // hard cap so the UI list stays readable

    return {
        score: {
            overallScore: overall,
            colorConsistency: cc.score,
            readability: rd.score,
            responsiveness: rs.score,
            componentCohesion: co.score,
            trustSignals: ts.score,
        },
        recommendations,
    }
}
