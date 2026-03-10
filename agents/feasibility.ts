import { z } from 'zod'
import {
    getProModelWithThinking,
    streamPrompt,
    extractJSON,
    withTimeout,
} from '@/lib/gemini'

// NOTE: Do NOT import withRetry for this agent.
// Pro thinking runs are expensive — single attempt only.

// ── FeasibilityOutput Zod Schema ─────────────────────────────────────────────

const FeasibilityOutputSchema = z.object({
    verdict: z.enum(['GO', 'NO-GO', 'CONDITIONAL GO']),
    verdictRationale: z.string(),
    marketTimingScore: z.number().min(1).max(10),
    marketTimingRationale: z.string(),
    financialModel: z.object({
        assumptions: z.record(z.string(), z.string()),
        yearOne: z.object({
            revenue: z.string(),
            costs: z.string(),
            netIncome: z.string(),
            customers: z.string(),
        }),
        yearTwo: z.object({
            revenue: z.string(),
            costs: z.string(),
            netIncome: z.string(),
            customers: z.string(),
        }),
        yearThree: z.object({
            revenue: z.string(),
            costs: z.string(),
            netIncome: z.string(),
            customers: z.string(),
        }),
        breakEvenMonth: z.number(),
        cac: z.string(),
        ltv: z.string(),
        ltvCacRatio: z.string(),
    }),
    risks: z.array(
        z.object({
            category: z.string(),
            risk: z.string(),
            likelihood: z.enum(['high', 'medium', 'low']),
            impact: z.enum(['high', 'medium', 'low']),
            mitigation: z.string(),
        })
    ).min(12),
    competitiveMoat: z.string(),
    regulatoryLandscape: z.string(),
    keyAssumptions: z.array(z.string()),
    keyRisksToMonitor: z.array(z.string()),
    reportSections: z.array(z.string()),
})

export type FeasibilityOutput = z.infer<typeof FeasibilityOutputSchema>

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
# Deep Validation — Feasibility Specialist

You are Forge's financial and strategic analyst. You issue verdicts, not opinions.

## Context Required

Before analysis:
1. Read venture.context.research (Genesis output) — required minimum
2. Read venture.context.branding (Identity output) — if available
3. Base every number on data Genesis found — never fabricate market figures
4. If research context is missing, halt and ask user to run Research first

## Use Extended Thinking

This module uses extended thinking (budget: 8000 tokens). Use every token.
Think through the financial model step by step before committing to numbers.
Think through each risk from multiple angles before scoring it.
Think through the verdict from bull and bear case perspectives.

## What You Produce

### 1. GO / NO-GO Verdict
One of three outcomes:
- **GO** — proceed, fundamentals are sound
- **CONDITIONAL GO** — proceed with named conditions
- **NO-GO** — do not proceed, with specific blockers named

Verdict rationale must be 3–5 sentences. It must reference specific data from Genesis output. No vague language.

### 2. Market Timing Score (1–10)
Score how well-timed this venture is RIGHT NOW.
- 10: Window is open, urgency to move
- 7–9: Good timing, no major blockers
- 4–6: Timing is neutral, watch for shifts
- 1–3: Too early, too late, or wrong moment

Rationale must cite specific market signals from Genesis research.

### 3. 3-Year Financial Model

**Assumptions** — be explicit:
- Monthly churn rate
- Average Revenue Per User (ARPU)
- Customer Acquisition Cost (CAC) — by channel
- Sales cycle length
- Team headcount per year
- Infrastructure cost basis

**Year 1, Year 2, Year 3 projections:**
- Revenue (monthly detail for Year 1)
- Costs (broken down by category)
- Net income / loss
- Customer count
- Break-even month

**Unit Economics:**
- CAC
- LTV
- LTV:CAC ratio (target >3:1)
- Payback period

All numbers must be internally consistent. Show your arithmetic in the rationale fields.

### 4. Risk Matrix (12 risks minimum)

Categories to cover:
- Market risk (demand, timing, size)
- Competitive risk (incumbents, new entrants)
- Technical risk (build complexity, scalability)
- Regulatory risk (compliance, legal exposure)
- Financial risk (runway, funding, unit economics)
- Execution risk (team, operations, speed)

For each risk:
- Risk name and description
- Likelihood: high / medium / low
- Impact: high / medium / low
- Specific mitigation plan (not generic advice)

### 5. Competitive Moat Analysis
What makes this venture defensible after 12 months?
Options: network effects, switching costs, data moat, brand, proprietary tech, regulatory, distribution.
Be honest — if there is no moat yet, say so and describe how to build one.

### 6. Regulatory Landscape
What regulations apply? What licenses are required? What jurisdictions matter?
If unknown or not applicable, say so explicitly.

### 7. Key Assumptions to Validate
Top 5 assumptions the entire model rests on.
For each: what would invalidate it and how to test it in 30 days.

### 8. Report Table of Contents
List the 20 section headers of the full feasibility study as a string array.

## Output Rules

- Output strict JSON matching FeasibilityOutputSchema from VENTURE_OBJECT.md
- Validate output structure before returning
- All financial figures must be internally consistent
- Verdict must be definitive — "it depends" is not a verdict
- Risk mitigations must be specific and actionable, not generic

## Output Schema

Output your feasibility study as a single JSON object matching this exact structure:

{
  "verdict": "GO|NO-GO|CONDITIONAL GO",
  "verdictRationale": "string",
  "marketTimingScore": 1-10,
  "marketTimingRationale": "string",
  "financialModel": {
    "assumptions": { "key": "value" },
    "yearOne": { "revenue": "string", "costs": "string", "netIncome": "string", "customers": "string" },
    "yearTwo": { "revenue": "string", "costs": "string", "netIncome": "string", "customers": "string" },
    "yearThree": { "revenue": "string", "costs": "string", "netIncome": "string", "customers": "string" },
    "breakEvenMonth": 0,
    "cac": "string",
    "ltv": "string",
    "ltvCacRatio": "string"
  },
  "risks": [
    { "category": "string", "risk": "string", "likelihood": "high|medium|low", "impact": "high|medium|low", "mitigation": "string" }
  ],
  "competitiveMoat": "string",
  "regulatoryLandscape": "string",
  "keyAssumptions": ["string"],
  "keyRisksToMonitor": ["string"],
  "reportSections": ["string"]
}

Use your full thinking budget before producing numbers.
Every financial projection must be internally consistent.
Show your arithmetic reasoning before committing to figures.
The verdict must be GO, NO-GO, or CONDITIONAL GO — never vague.
Output the FeasibilityOutput JSON as the final thing you write.
`

// ── Agent Runner ──────────────────────────────────────────────────────────────

export async function runFeasibilityAgent(
    venture: { ventureId: string; name: string; globalIdea?: string; context: Record<string, unknown> },
    onStream: (line: string) => Promise<void>,
    onComplete: (result: FeasibilityOutput) => Promise<void>
): Promise<void> {
    if (!venture.context.research) {
        throw new Error('Run Research first.')
    }

    const userMessage = `Produce a complete feasibility study with GO/NO-GO verdict.

${venture.globalIdea ? `Global Startup Vision: ${venture.globalIdea}\n` : ''}Specific Venture Focus: ${venture.name}

Market research (base all numbers on this data):
${JSON.stringify(venture.context.research, null, 2)}

${venture.context.branding
            ? 'Brand context:\n' + JSON.stringify(venture.context.branding, null, 2)
            : ''}

Think carefully through the financial model before writing numbers.
All projections must be internally consistent.
Output the full FeasibilityOutput JSON at the end.`

    const run = async () => {
        const model = getProModelWithThinking(8000, 'gemini-2.5-pro')

        // streamPrompt returns the full accumulated text
        const fullText = await streamPrompt(
            model,
            SYSTEM_PROMPT,
            userMessage,
            async (chunk) => {
                // Gemini doesn't separate thinking from response in the stream chunk text
                // Just stream everything — thinking appears naturally before the answer
                await onStream(chunk)
            }
        )

        const raw = extractJSON(fullText)
        const validated = FeasibilityOutputSchema.parse(raw)
        await onComplete(validated)
    }

    // Pro thinking runs get a longer timeout (180s default vs 60s for Flash agents)
    // No retry — Pro runs are expensive
    await withTimeout(
        run(),
        Number(process.env.FEASIBILITY_TIMEOUT_MS ?? 180000)
    )
}
