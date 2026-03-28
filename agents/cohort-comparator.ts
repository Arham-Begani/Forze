import { z } from 'zod'
import {
    getProModelWithThinking,
    streamPrompt,
    extractJSON,
    withTimeout,
    withRetry,
    Content,
} from '@/lib/gemini'

// ── CohortComparison Zod Schema ─────────────────────────────────────────────

const VariantScoreSchema = z.object({
    variantName: z.string(),
    value: z.string(),
    score: z.number().min(1).max(10),
})

const DimensionSchema = z.object({
    dimension: z.string(),
    variants: z.array(VariantScoreSchema),
    winner: z.string(),
})

const OverallScoreSchema = z.object({
    variantName: z.string(),
    score: z.number().min(1).max(100),
    rank: z.number(),
})

const RecommendedWinnerSchema = z.object({
    variantName: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
    rationale: z.string(),
    primaryAdvantage: z.string(),
    biggestRisk: z.string(),
})

const RunnerUpCaseSchema = z.object({
    variantName: z.string(),
    whenToChooseInstead: z.string(),
})

const HybridPossibilitySchema = z.object({
    possible: z.boolean(),
    description: z.string(),
})

const CohortComparisonSchema = z.object({
    matrix: z.array(DimensionSchema).min(6).max(8),
    overallScores: z.array(OverallScoreSchema),
    recommendedWinner: RecommendedWinnerSchema,
    runnerUpCase: RunnerUpCaseSchema,
    hybridPossibility: HybridPossibilitySchema,
    analysisNotes: z.string(),
    // ── Decision Layer ──
    winnerBecause: z.string().default('Winner rationale pending.'),
    loserStrengthsToMerge: z.array(z.string()).default([]),
    dimensionScores: z.object({
        clarity: z.number().min(1).max(10).default(5),
        distributionEase: z.number().min(1).max(10).default(5),
        monetizationSpeed: z.number().min(1).max(10).default(5),
        founderAdvantage: z.number().min(1).max(10).default(5),
    }).default({ clarity: 5, distributionEase: 5, monetizationSpeed: 5, founderAdvantage: 5 }),
})

export type CohortComparisonOutput = z.infer<typeof CohortComparisonSchema>

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
# Venture Portfolio Analyst & Strategic Comparator

You are a venture portfolio analyst. Your job is to compare 2-3 venture variants across 6-8 dimensions, score them, and pick a winner with a clear rationale.

## Comparison Dimensions (pick 6-8 from these)

- Market Size (TAM)
- Feasibility Score
- Time to Revenue
- Competitive Intensity
- Brand Clarity
- Risk Level
- Founder-Market Fit
- Distribution Difficulty
- Unit Economics
- Defensibility / Moat

## Rules

1. Score conservatively — do not inflate scores.
2. Cite actual data from each variant's research and feasibility context.
3. Always highlight the runner-up case: when would you choose the second-best variant?
4. Assess hybrid possibility: can you start with one variant and pivot to another later?
5. Be honest if all variants are weak — say so.
6. The analysisNotes field should be a 500-800 word strategic analysis.
7. Overall scores are composite (1-100), ranks are 1=best.

## Output

Output strict JSON matching this structure:
{
  "matrix": [
    {
      "dimension": "Market Size (TAM)",
      "variants": [
        { "variantName": "B2C Subscription", "value": "$4.2B", "score": 8 }
      ],
      "winner": "B2C Subscription"
    }
  ],
  "overallScores": [
    { "variantName": "B2C Subscription", "score": 78, "rank": 1 }
  ],
  "recommendedWinner": {
    "variantName": "B2C Subscription",
    "confidence": "high",
    "rationale": "3-5 sentences",
    "primaryAdvantage": "string",
    "biggestRisk": "string"
  },
  "runnerUpCase": {
    "variantName": "B2B SaaS",
    "whenToChooseInstead": "string"
  },
  "hybridPossibility": {
    "possible": true,
    "description": "string"
  },
  "analysisNotes": "500-800 word strategic analysis",
  "winnerBecause": "string (one-paragraph founder-readable explanation of why this variant wins — cite specific data)",
  "loserStrengthsToMerge": ["string (specific strengths from losing variants that the winner should adopt)"],
  "dimensionScores": {
    "clarity": 1-10,
    "distributionEase": 1-10,
    "monetizationSpeed": 1-10,
    "founderAdvantage": 1-10
  }
}

IMPORTANT: Use <think> tags for your internal reasoning. Output ONLY the JSON after your thinking. No markdown fences.
`

// ── Agent Runner ──────────────────────────────────────────────────────────────

interface VariantInput {
    name: string
    context: Record<string, unknown>
}

export async function runCohortComparator(
    variants: VariantInput[],
    onStream: (chunk: string) => Promise<void>,
    onComplete: (result: CohortComparisonOutput) => Promise<void>
): Promise<void> {
    const model = getProModelWithThinking(8000)

    const variantBlocks = variants.map((v, i) => {
        const ctx = v.context || {}
        return `=== VARIANT ${i + 1}: ${v.name} ===
Research: ${ctx.research ? JSON.stringify(ctx.research, null, 2) : 'No research data'}
Branding: ${ctx.branding ? JSON.stringify(ctx.branding, null, 2) : 'No branding data'}
Feasibility: ${ctx.feasibility ? JSON.stringify(ctx.feasibility, null, 2) : 'No feasibility data'}
Landing: ${ctx.landing ? JSON.stringify(ctx.landing, null, 2) : 'No landing data'}
`
    }).join('\n\n')

    const userMessage = `Compare these ${variants.length} venture variants and determine a winner.

${variantBlocks}

Analyze across 6-8 dimensions. Score conservatively. Pick a winner with clear rationale. Output the CohortComparison JSON.`

    const run = async () => {
        const responseText = await streamPrompt(
            model,
            SYSTEM_PROMPT,
            userMessage,
            onStream
        )

        const raw = extractJSON(responseText)
        const validated = CohortComparisonSchema.parse(raw)
        await onComplete(validated)
    }

    await withTimeout(withRetry(run), 180_000)
}
