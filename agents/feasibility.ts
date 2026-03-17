import { z } from 'zod'
import {
    getProModelWithSearchAndThinking,
    streamPrompt,
    extractJSON,
    withTimeout,
    Content,
} from '@/lib/gemini'

// NOTE: Do NOT import withRetry for this agent.
// Pro thinking runs are expensive — single attempt only.

// ── FeasibilityOutput Zod Schema ─────────────────────────────────────────────

const FeasibilityOutputSchema = z.object({
    verdict: z.enum(['GO', 'NO-GO', 'CONDITIONAL GO']).default('CONDITIONAL GO'),
    verdictRationale: z.string().default('Final verdict pending deeper analysis.'),
    feasibilityReport: z.string().default('# Feasibility Study\n\nFull study documentation pending.'),
    marketTimingScore: z.number().min(1).max(10).default(5),
    marketTimingRationale: z.string().default('Timing signals are mixed.'),
    financialModel: z.object({
        assumptions: z.record(z.string(), z.string()).default({}),
        yearOne: z.object({
            revenue: z.string().default('$0'),
            costs: z.string().default('$0'),
            netIncome: z.string().default('$0'),
            customers: z.string().default('0'),
        }).default({
            revenue: '$0',
            costs: '$0',
            netIncome: '$0',
            customers: '0'
        }),
        yearTwo: z.object({
            revenue: z.string().default('$0'),
            costs: z.string().default('$0'),
            netIncome: z.string().default('$0'),
            customers: z.string().default('0'),
        }).default({
            revenue: '$0',
            costs: '$0',
            netIncome: '$0',
            customers: '0'
        }),
        yearThree: z.object({
            revenue: z.string().default('$0'),
            costs: z.string().default('$0'),
            netIncome: z.string().default('$0'),
            customers: z.string().default('0'),
        }).default({
            revenue: '$0',
            costs: '$0',
            netIncome: '$0',
            customers: '0'
        }),
        breakEvenMonth: z.number().default(0),
        cac: z.string().default('$0'),
        ltv: z.string().default('$0'),
        ltvCacRatio: z.string().default('0:1'),
    }).default({
        assumptions: {},
        yearOne: { revenue: '$0', costs: '$0', netIncome: '$0', customers: '0' },
        yearTwo: { revenue: '$0', costs: '$0', netIncome: '$0', customers: '0' },
        yearThree: { revenue: '$0', costs: '$0', netIncome: '$0', customers: '0' },
        breakEvenMonth: 0,
        cac: '$0',
        ltv: '$0',
        ltvCacRatio: '0:1'
    }),
    risks: z.array(
        z.object({
            category: z.string().default('General'),
            risk: z.string(),
            likelihood: z.enum(['high', 'medium', 'low']).default('medium'),
            impact: z.enum(['high', 'medium', 'low']).default('medium'),
            mitigation: z.string().default('Mitigation strategy pending.'),
        })
    ).min(0).default([]),
    competitiveMoat: z.string().default('Moat analysis pending.'),
    regulatoryLandscape: z.string().default('Regulatory review pending.'),
    keyAssumptions: z.array(z.string()).default([]),
    keyRisksToMonitor: z.array(z.string()).default([]),
    reportSections: z.array(z.string()).default([]),
})

export type FeasibilityOutput = z.infer<typeof FeasibilityOutputSchema>

// ── Depth-specific prompt sections ───────────────────────────────────────────

const DEPTH_CONFIG = {
    brief: {
        thinkingBudget: 6000,
        reportLength: '800-1200 words',
        riskCount: '6-8',
        financialDetail: 'Summary-level projections with key unit economics.',
        sections: `
  - Executive Summary & Verdict (2 paragraphs)
  - Financial Snapshot: Key metrics table
  - Top Risks & Mitigations (6-8 risks)
  - Recommendation & Next Steps`,
    },
    medium: {
        thinkingBudget: 10000,
        reportLength: '2000-3500 words',
        riskCount: '10-14',
        financialDetail: 'Detailed 3-year projections with monthly Year 1 breakdown, unit economics with arithmetic shown.',
        sections: `
  - Executive Summary & Final Verdict
  - Strategic Thesis: Why this venture, why now?
  - Market Validation: Real data from web search
  - Financial Modeling: Assumptions, 3-Year Projections, Unit Economics
  - Risk Assessment: Full matrix with mitigation plans
  - Competitive Moat Analysis
  - Regulatory & Compliance Overview
  - Key Assumptions to Validate
  - Recommendation & Action Plan`,
    },
    detailed: {
        thinkingBudget: 12000,
        reportLength: '4000-6000 words',
        riskCount: '15-20',
        financialDetail: 'Exhaustive 3-year model with monthly Year 1, quarterly Year 2-3, sensitivity analysis, best/worst/base cases, detailed cost breakdown by category.',
        sections: `
  - Executive Summary & Final Verdict (with confidence level)
  - Strategic Thesis: Market timing, competitive window, founder-market fit
  - Market Validation Deep-Dive: Real pricing data, competitor financials, industry benchmarks
  - Detailed Financial Modeling:
    - Assumptions table with sources
    - Monthly Year 1 P&L
    - Quarterly Year 2-3 projections
    - Unit Economics breakdown (CAC by channel, LTV by segment, payback period)
    - Sensitivity analysis: Best / Base / Worst case scenarios
    - Burn rate and runway analysis
  - Operational Roadmap: Year 1-3 milestones, team scaling, key hires
  - Risk Assessment: 15-20 risks across 6 categories, scored and ranked
  - Competitive Advantage & Moat Development Strategy
  - Regulatory & Compliance Roadmap (jurisdiction-specific)
  - Funding Strategy: How much to raise, when, from whom
  - Critical Success Factors & Kill Criteria
  - Exit Scenarios: Acquisition targets, IPO timeline, strategic alternatives`,
    },
}

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(depth: 'brief' | 'medium' | 'detailed'): string {
    const cfg = DEPTH_CONFIG[depth]
    return `
# Deep Validation — Feasibility Specialist

You are Forge's senior financial and strategic analyst. You produce investor-grade feasibility assessments. You issue verdicts backed by real data, not opinions.

## CRITICAL: Use Web Search

You MUST use Google Search (web_search tool) to find:
- **Real pricing data** for similar products/services in this market
- **Industry benchmarks** — average CAC, LTV, churn rates, conversion rates for this vertical
- **Competitor revenue/funding data** — Crunchbase, TechCrunch, industry reports
- **Market size validation** — cross-reference TAM/SAM from research with independent sources
- **Regulatory requirements** — actual laws, licenses, compliance requirements
- **Recent news** — market shifts, funding rounds, acquisitions in this space

Search at least 5-8 different queries to ground your analysis in reality. Every financial assumption should reference a real benchmark.

## Context

1. Read venture.context.research (Genesis output) — required minimum
2. Read venture.context.branding (Identity output) — if available
3. Cross-reference Genesis findings with your own web research
4. If research context is missing, produce analysis based on web search and the venture description

## Extended Thinking

Use your full thinking budget (${cfg.thinkingBudget} tokens). Think through:
- Financial model arithmetic step by step
- Each risk from multiple angles (bull case, bear case, black swan)
- The verdict from investor, founder, and customer perspectives

## What You Must Produce

### 1. GO / NO-GO Verdict
One of three outcomes:
- **GO** — proceed, fundamentals are sound
- **CONDITIONAL GO** — proceed with named conditions (list each condition)
- **NO-GO** — do not proceed, with specific blockers named

Verdict rationale must be 5+ sentences. Reference specific data points — market sizes, competitor metrics, financial projections. No vague language.

### 2. Market Timing Score (1–10)
- 10: Window is open NOW, urgency to move
- 7–9: Good timing, favorable conditions
- 4–6: Neutral timing, no urgency
- 1–3: Too early, too late, or fundamentally wrong moment

Rationale must cite specific market signals found via web search.

### 3. 3-Year Financial Model

${cfg.financialDetail}

**Assumptions** — be explicit about each with source:
- Monthly churn rate (cite industry benchmark)
- Average Revenue Per User (ARPU)
- Customer Acquisition Cost (CAC) by channel (cite comparable companies)
- Conversion rates at each funnel stage
- Sales cycle length
- Team headcount and salary costs per year
- Infrastructure/hosting costs
- Marketing spend as % of revenue

**Year 1, Year 2, Year 3 projections:**
- Revenue
- Total costs (broken down)
- Net income / loss
- Customer count
- Break-even month

**Unit Economics:**
- CAC (with channel breakdown)
- LTV (show calculation: ARPU × avg lifespan)
- LTV:CAC ratio
- Payback period in months

ALL numbers must be internally consistent. Show your arithmetic.

### 4. Risk Matrix (${cfg.riskCount} risks)

Categories to cover:
- Market risk (demand, timing, size)
- Competitive risk (incumbents, new entrants, pricing wars)
- Technical risk (build complexity, scalability, dependencies)
- Regulatory risk (compliance, legal exposure, data privacy)
- Financial risk (runway, funding, unit economics, pricing pressure)
- Execution risk (team, operations, speed-to-market)

For each risk provide:
- Specific risk description (not generic)
- Likelihood: high / medium / low
- Impact: high / medium / low
- Concrete mitigation plan (specific actions, not platitudes)

### 5. Competitive Moat Analysis
What makes this venture defensible after 12+ months?
Evaluate: network effects, switching costs, data moat, brand loyalty, proprietary technology, regulatory barriers, distribution advantages.
Be brutally honest — if there is no moat, say so and describe exactly how to build one.

### 6. Regulatory Landscape
Search for actual regulations, licenses, and compliance requirements.
What jurisdictions matter? What are the costs of compliance?
What could change in the next 2 years?

### 7. Key Assumptions to Validate
Top 5-8 assumptions the entire model depends on.
For each: what would invalidate it and how to test it within 30 days.

### 8. Comprehensive Feasibility Report
Write a professional "Investment Feasibility & Strategic Assessment" document.
- Target length: ${cfg.reportLength}
- Format: Professional Markdown with headers, tables, bullet points
- Include financial tables formatted as Markdown tables
- Include specific data points and sources from your web research
- Sections:${cfg.sections}

## Output Format

Output strict JSON matching this schema:

{
  "verdict": "GO|NO-GO|CONDITIONAL GO",
  "verdictRationale": "5+ sentences with specific data references",
  "feasibilityReport": "Full Markdown document (${cfg.reportLength})",
  "marketTimingScore": 1-10,
  "marketTimingRationale": "With specific market signals",
  "financialModel": {
    "assumptions": { "key": "value with source" },
    "yearOne": { "revenue": "$X", "costs": "$X", "netIncome": "$X", "customers": "X" },
    "yearTwo": { "revenue": "$X", "costs": "$X", "netIncome": "$X", "customers": "X" },
    "yearThree": { "revenue": "$X", "costs": "$X", "netIncome": "$X", "customers": "X" },
    "breakEvenMonth": 0,
    "cac": "$X",
    "ltv": "$X",
    "ltvCacRatio": "X:1"
  },
  "risks": [
    { "category": "string", "risk": "string", "likelihood": "high|medium|low", "impact": "high|medium|low", "mitigation": "string" }
  ],
  "competitiveMoat": "string",
  "regulatoryLandscape": "string",
  "keyAssumptions": ["string"],
  "keyRisksToMonitor": ["string"],
  "reportSections": ["section titles used in the report"]
}

Use your full thinking budget before producing numbers.
Every financial projection must be internally consistent — show your math.
The verdict must be GO, NO-GO, or CONDITIONAL GO — never vague.
Output the JSON as the final thing you write.

IMPORTANT: Do not output conversational text or "Thought Process" headers. Any reasoning MUST be strictly wrapped inside <think> and </think> tags. Only the final valid JSON should be outside the <think> tags.
`
}

// ── Agent Runner ──────────────────────────────────────────────────────────────

export async function runFeasibilityAgent(
    venture: { ventureId: string; name: string; globalIdea?: string; context: Record<string, unknown> },
    onStream: (line: string) => Promise<void>,
    onComplete: (result: FeasibilityOutput) => Promise<void>,
    depth: 'brief' | 'medium' | 'detailed' = 'medium',
    history: Content[] = []
): Promise<void> {
    const cfg = DEPTH_CONFIG[depth]

    // Build context block — research is ideal but not required anymore (web search fills gaps)
    const contextParts: string[] = []

    if (venture.context?.architectPlan) {
        contextParts.push(`Architect's Plan:\n${venture.context.architectPlan}`)
    }
    if (venture.globalIdea) {
        contextParts.push(`Global Startup Vision: ${venture.globalIdea}`)
    }
    if (venture.context?.research) {
        contextParts.push(`Market Research Data (from Genesis agent):\n${JSON.stringify(venture.context.research, null, 2)}`)
    }
    if (venture.context?.branding) {
        contextParts.push(`Brand Context:\n${JSON.stringify(venture.context.branding, null, 2)}`)
    }

    const userMessage = `Produce a ${depth} feasibility study with GO/NO-GO verdict for this venture.

Venture: ${venture.name}

${contextParts.join('\n\n')}

${!venture.context?.research ? 'NOTE: No prior market research available. Use web search extensively to gather market data, competitor info, and industry benchmarks before building your financial model.' : 'Cross-reference the Genesis research data above with your own web searches. Validate the TAM/SAM figures, find real competitor pricing, and ground every assumption in actual data.'}

Depth level: ${depth.toUpperCase()}
- Report length target: ${cfg.reportLength}
- Risk count: ${cfg.riskCount} risks minimum
- ${cfg.financialDetail}

Search the web for real pricing, competitor data, industry benchmarks, and regulatory requirements before building your model. Every assumption should have a data source.

Output the full FeasibilityOutput JSON at the end.`

    const isContinuation = history.length > 0
    const finalUserMessage = isContinuation
        ? "Continue from where you left off. Do not repeat anything already outputted. Complete the FeasibilityOutput JSON object strictly."
        : userMessage

    const run = async () => {
        const model = getProModelWithSearchAndThinking(cfg.thinkingBudget)
        let fullText = (history.find(h => h.role === 'model')?.parts[0] as any)?.text || ''

        await streamPrompt(
            model,
            buildSystemPrompt(depth),
            finalUserMessage,
            async (chunk) => {
                fullText += chunk
                await onStream(chunk)
            },
            history
        )

        const raw = extractJSON(fullText)
        const validated = FeasibilityOutputSchema.parse(raw)
        await onComplete(validated)
    }

    // Longer timeout for detailed depth
    const timeoutMs = depth === 'detailed' ? 300000 : depth === 'medium' ? 240000 : 180000
    await withTimeout(
        run(),
        Number(process.env.FEASIBILITY_TIMEOUT_MS ?? timeoutMs)
    )
}
