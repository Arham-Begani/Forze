// lib/inspiration/refine.ts
//
// Post-apply refinement assistant. The founder has applied tokens, looked at
// the generated landing page, and reports something like "the primary button
// is hard to read on the features section". This module asks Gemini to
// translate that complaint into a partial DesignTokens patch.
//
// We return a flat path → value map (same shape the PATCH /[analysisId]
// endpoint accepts) so the studio can preview the suggestion, let the user
// approve, then submit it as a normal token edit.

import { z } from 'zod'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { extractJSON, withRetry, withTimeout } from '@/lib/gemini'
import type { DesignTokens } from '@/lib/schemas/inspiration'
import { tokensToPromptDigest } from '@/lib/inspiration/tokens'
import type { AccessibilityReport } from '@/lib/inspiration/accessibility'

const REFINE_MODEL = process.env.INSPIRATION_REFINE_MODEL || 'gemini-2.5-flash'
const REFINE_TIMEOUT_MS = Number(process.env.INSPIRATION_REFINE_TIMEOUT_MS ?? 25_000)

export const RefineSuggestionSchema = z.object({
    // Dotted token paths → replacement values, matching the InspirationTokenPatchSchema
    // shape so the suggestion can be replayed through the existing PATCH route.
    adjustments: z.record(z.string(), z.unknown()).default({}),
    // Plain-English explanation of every change, so the studio can render a
    // "Why this fixes it" tooltip per suggestion.
    rationale: z.array(z.object({
        path: z.string(),
        before: z.string().default(''),
        after: z.string().default(''),
        why: z.string().default(''),
    })).default([]),
    // Short summary the studio can show as a one-line preview.
    summary: z.string().default(''),
})

export type RefineSuggestion = z.infer<typeof RefineSuggestionSchema>

const SYSTEM_PROMPT = `You are a design-system fixer. The founder applied a set of inspiration tokens to their landing page and reports a specific issue. Your job is to propose a MINIMAL, SURGICAL set of token changes that fix the issue without disrupting the rest of the design.

Hard rules:
1. Output a flat JSON object keyed by dotted token paths. Examples of valid paths:
     "colors.primary.hex", "components.button.shadow",
     "typography.sizes.base.value", "components.card.radius.value",
     "components.card.borderColor", "colors.textSecondary".
2. NEVER change more than 5 paths. Refinement should feel like a tweak, not a redesign.
3. Prefer increasing contrast / readability / consistency over chasing aesthetics.
4. If the issue is contrast-related, propose lightness adjustments that stay within ~20 points of the original hue.
5. NEVER touch \`brand.mood\` or \`designSignals.*\` — those drive the whole feel of the page. If the founder needs a mood change, that's a re-analysis, not a refinement.
6. Output JSON only — no markdown, no preamble, no commentary.

Output shape:
{
  "adjustments": { "colors.primary.hex": "#0048d6", ... },
  "rationale": [
    { "path": "colors.primary.hex", "before": "#3b82f6", "after": "#0048d6", "why": "Increases primary-on-white contrast from 3.1:1 to 4.7:1, clearing AA." }
  ],
  "summary": "Darkened the primary blue and added a heavier card shadow to make CTAs readable on the features section."
}`

function buildUserMessage(args: {
    tokens: DesignTokens
    issue: string
    affectedComponent?: string
    suggestion?: string
    accessibility?: AccessibilityReport | null
}): string {
    const lines: string[] = []
    lines.push('### Issue reported by the founder')
    lines.push(args.issue.trim())
    if (args.affectedComponent) lines.push(`\nAffected component (hint): ${args.affectedComponent}`)
    if (args.suggestion) lines.push(`Founder suggestion: ${args.suggestion}`)
    lines.push('\n### Current applied tokens')
    lines.push(tokensToPromptDigest(args.tokens))
    if (args.accessibility?.findings?.length) {
        const failing = args.accessibility.findings.filter((f) => f.severity !== 'pass').slice(0, 6)
        if (failing.length > 0) {
            lines.push('\n### Known accessibility findings (already flagged)')
            failing.forEach((f) => lines.push(`- [${f.severity}] ${f.label}: ${f.detail}`))
        }
    }
    lines.push(
        '\nPropose the smallest set of token path changes that fixes the issue. Output JSON only as described in the system prompt.',
    )
    return lines.join('\n')
}

function getClient(): GoogleGenerativeAI {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('GEMINI_API_KEY is not set')
    return new GoogleGenerativeAI(key)
}

export async function suggestRefinement(args: {
    tokens: DesignTokens
    issue: string
    affectedComponent?: string
    suggestion?: string
    accessibility?: AccessibilityReport | null
}): Promise<RefineSuggestion> {
    const client = getClient()
    const model = client.getGenerativeModel({
        model: REFINE_MODEL,
        systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
    })

    const userMessage = buildUserMessage(args)

    const run = async (): Promise<RefineSuggestion> => {
        const response = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        })
        const text = response.response.text() ?? ''
        const json = extractJSON(text) as Record<string, unknown>
        return RefineSuggestionSchema.parse(json)
    }

    try {
        return await withRetry(() => withTimeout(run(), REFINE_TIMEOUT_MS))
    } catch (e) {
        // Last resort: return an empty refinement with the failure noted in
        // the summary so the UI can surface "we couldn't suggest a fix here".
        return {
            adjustments: {},
            rationale: [],
            summary:
                e instanceof Error
                    ? `Could not generate a refinement (${e.message}). Try rephrasing the issue.`
                    : 'Could not generate a refinement. Try rephrasing the issue.',
        }
    }
}
