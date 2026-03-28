import { z } from 'zod'
import {
    getFlashModel,
    getProModelWithSearchAndThinking,
    streamPrompt,
    extractJSON,
    withTimeout,
    Content,
} from '@/lib/gemini'
import { DOCUMENT_STYLE_GUIDE } from '@/lib/agent-document-style'

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
    // ── Decision Layer ──
    realBlockers: z.array(z.string()).default([]),
    manageableRisks: z.array(z.string()).default([]),
    mostDangerousAssumption: z.string().default('Most dangerous assumption pending.'),
    evidenceNeededToFlipVerdict: z.string().default('Evidence needed pending.'),
    recommendedGoForwardMotion: z.string().default('Go-forward motion pending.'),
})

export type FeasibilityOutput = z.infer<typeof FeasibilityOutputSchema>

// ── Edit Patch Schema (all fields optional — for surgical updates) ───────────

const FeasibilityEditPatchSchema = z.object({
    verdict: z.enum(['GO', 'NO-GO', 'CONDITIONAL GO']).optional(),
    verdictRationale: z.string().optional(),
    feasibilityReport: z.string().optional(),
    marketTimingScore: z.number().min(1).max(10).optional(),
    marketTimingRationale: z.string().optional(),
    financialModel: z.object({
        assumptions: z.record(z.string(), z.string()).optional(),
        yearOne: z.object({
            revenue: z.string().optional(),
            costs: z.string().optional(),
            netIncome: z.string().optional(),
            customers: z.string().optional(),
        }).optional(),
        yearTwo: z.object({
            revenue: z.string().optional(),
            costs: z.string().optional(),
            netIncome: z.string().optional(),
            customers: z.string().optional(),
        }).optional(),
        yearThree: z.object({
            revenue: z.string().optional(),
            costs: z.string().optional(),
            netIncome: z.string().optional(),
            customers: z.string().optional(),
        }).optional(),
        breakEvenMonth: z.number().optional(),
        cac: z.string().optional(),
        ltv: z.string().optional(),
        ltvCacRatio: z.string().optional(),
    }).optional(),
    risks: z.array(z.object({
        category: z.string().default('General'),
        risk: z.string(),
        likelihood: z.enum(['high', 'medium', 'low']).default('medium'),
        impact: z.enum(['high', 'medium', 'low']).default('medium'),
        mitigation: z.string().default('Mitigation strategy pending.'),
    })).optional(),
    competitiveMoat: z.string().optional(),
    regulatoryLandscape: z.string().optional(),
    keyAssumptions: z.array(z.string()).optional(),
    keyRisksToMonitor: z.array(z.string()).optional(),
    reportSections: z.array(z.string()).optional(),
    // ── Decision Layer ──
    realBlockers: z.array(z.string()).optional(),
    manageableRisks: z.array(z.string()).optional(),
    mostDangerousAssumption: z.string().optional(),
    evidenceNeededToFlipVerdict: z.string().optional(),
    recommendedGoForwardMotion: z.string().optional(),
})

type FeasibilityEditPatch = z.infer<typeof FeasibilityEditPatchSchema>

// ── Merge patch into existing result ─────────────────────────────────────────

function mergePatch(existing: FeasibilityOutput, patch: FeasibilityEditPatch): FeasibilityOutput {
    const merged = { ...existing }

    if (patch.verdict !== undefined) merged.verdict = patch.verdict
    if (patch.verdictRationale !== undefined) merged.verdictRationale = patch.verdictRationale
    if (patch.feasibilityReport !== undefined) merged.feasibilityReport = patch.feasibilityReport
    if (patch.marketTimingScore !== undefined) merged.marketTimingScore = patch.marketTimingScore
    if (patch.marketTimingRationale !== undefined) merged.marketTimingRationale = patch.marketTimingRationale
    if (patch.competitiveMoat !== undefined) merged.competitiveMoat = patch.competitiveMoat
    if (patch.regulatoryLandscape !== undefined) merged.regulatoryLandscape = patch.regulatoryLandscape

    if (patch.financialModel) {
        merged.financialModel = { ...existing.financialModel }
        if (patch.financialModel.assumptions) merged.financialModel.assumptions = { ...existing.financialModel.assumptions, ...patch.financialModel.assumptions }
        if (patch.financialModel.yearOne) merged.financialModel.yearOne = { ...existing.financialModel.yearOne, ...patch.financialModel.yearOne }
        if (patch.financialModel.yearTwo) merged.financialModel.yearTwo = { ...existing.financialModel.yearTwo, ...patch.financialModel.yearTwo }
        if (patch.financialModel.yearThree) merged.financialModel.yearThree = { ...existing.financialModel.yearThree, ...patch.financialModel.yearThree }
        if (patch.financialModel.breakEvenMonth !== undefined) merged.financialModel.breakEvenMonth = patch.financialModel.breakEvenMonth
        if (patch.financialModel.cac !== undefined) merged.financialModel.cac = patch.financialModel.cac
        if (patch.financialModel.ltv !== undefined) merged.financialModel.ltv = patch.financialModel.ltv
        if (patch.financialModel.ltvCacRatio !== undefined) merged.financialModel.ltvCacRatio = patch.financialModel.ltvCacRatio
    }

    // Arrays replace entirely
    if (patch.risks) merged.risks = patch.risks
    if (patch.keyAssumptions) merged.keyAssumptions = patch.keyAssumptions
    if (patch.keyRisksToMonitor) merged.keyRisksToMonitor = patch.keyRisksToMonitor
    if (patch.reportSections) merged.reportSections = patch.reportSections

    // Decision layer
    if (patch.realBlockers) merged.realBlockers = patch.realBlockers
    if (patch.manageableRisks) merged.manageableRisks = patch.manageableRisks
    if (patch.mostDangerousAssumption !== undefined) merged.mostDangerousAssumption = patch.mostDangerousAssumption
    if (patch.evidenceNeededToFlipVerdict !== undefined) merged.evidenceNeededToFlipVerdict = patch.evidenceNeededToFlipVerdict
    if (patch.recommendedGoForwardMotion !== undefined) merged.recommendedGoForwardMotion = patch.recommendedGoForwardMotion

    return merged
}

// ── Edit System Prompt ───────────────────────────────────────────────────────

const EDIT_SYSTEM_PROMPT = `
# Deep Validation — Surgical Edit Mode

You are editing an EXISTING feasibility study. The user wants a specific change — do NOT regenerate everything.

## Rules
1. Read the existing feasibility data carefully
2. Identify ONLY the fields that need to change based on the user's request
3. Output a JSON patch containing ONLY the changed fields
4. Unchanged fields must be OMITTED (not copied)
5. For financialModel, include only changed sub-objects (yearOne, yearTwo, etc.) and within those only changed fields
6. For arrays (risks, keyAssumptions, keyRisksToMonitor), if ANY item changes, include the entire array
7. If changing unit economics (CAC, LTV, etc.), ensure internal consistency

## Output Format
Output ONLY a JSON object with the changed fields. No markdown fences, no explanation.
Example: if the user asks to update unit economics, output:
{"financialModel": {"cac": "$45", "ltv": "$540", "ltvCacRatio": "12:1"}}
`

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

You are Forze's senior financial and strategic analyst. You produce investor-grade feasibility assessments. You issue verdicts backed by real data, not opinions.

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

### 7.5. Decision Layer (REQUIRED)
Produce these sharp, founder-actionable fields:
- **realBlockers**: True blockers that would stop this venture dead — regulatory barriers, capital requirements, technical impossibilities. Not "competition exists" but "requires FDA approval, 18-month minimum timeline".
- **manageableRisks**: Risks that sound scary but are manageable with the right approach. For each, name the specific mitigation.
- **mostDangerousAssumption**: The single assumption that, if wrong, collapses the entire thesis. Be specific — "assumes 3% conversion rate, but industry average is 0.8% for this category".
- **evidenceNeededToFlipVerdict**: If the verdict is CONDITIONAL GO or NO-GO, what specific evidence would change it? If GO, what evidence would downgrade it?
- **recommendedGoForwardMotion**: The exact next move — not "validate the market" but "run a $200 Google Ads campaign targeting [keyword] in [geo] for 14 days to test conversion at $X CAC".

### 8. Comprehensive Feasibility Report
Write a professional "Investment Feasibility & Strategic Assessment" document.
- Target length: ${cfg.reportLength}
- Format: Professional Markdown with headers, tables, bullet points
- Include financial tables formatted as Markdown tables
- Include specific data points and sources from your web research
- Sections:${cfg.sections}

## Document Formatting Standard

Follow this Markdown formatting guide exactly for the feasibilityReport field:

${DOCUMENT_STYLE_GUIDE}

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
  "reportSections": ["section titles used in the report"],
  "realBlockers": ["string (true show-stoppers only)"],
  "manageableRisks": ["string (scary but manageable)"],
  "mostDangerousAssumption": "string (the one assumption that breaks everything)",
  "evidenceNeededToFlipVerdict": "string (what data would change the verdict)",
  "recommendedGoForwardMotion": "string (exact next move, be specific)"
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

    // ── Edit mode detection ──
    const existingFeasibility = venture.context.feasibility as FeasibilityOutput | null | undefined
    const isEditMode = !history.length && !!existingFeasibility?.verdict && existingFeasibility.verdictRationale.length > 20

    if (isEditMode) {
        await onStream('[Edit mode] Applying surgical changes to existing feasibility study...\n')

        const existingForContext = {
            verdict: existingFeasibility!.verdict,
            verdictRationale: existingFeasibility!.verdictRationale,
            marketTimingScore: existingFeasibility!.marketTimingScore,
            marketTimingRationale: existingFeasibility!.marketTimingRationale,
            financialModel: existingFeasibility!.financialModel,
            competitiveMoat: existingFeasibility!.competitiveMoat,
            regulatoryLandscape: existingFeasibility!.regulatoryLandscape,
            keyAssumptions: existingFeasibility!.keyAssumptions,
            risks: existingFeasibility!.risks?.slice(0, 8),
            feasibilityReport: existingFeasibility!.feasibilityReport?.length > 500
                ? existingFeasibility!.feasibilityReport.slice(0, 250) + '\n... [truncated] ...\n' + existingFeasibility!.feasibilityReport.slice(-250)
                : existingFeasibility!.feasibilityReport,
        }

        const editUserMessage = `## Edit Request\n${venture.name}\n\n## Current Feasibility Data\n\`\`\`json\n${JSON.stringify(existingForContext, null, 2)}\n\`\`\`\n\nApply the requested change. Output ONLY the fields that need to change as a JSON patch.`

        const editRun = async () => {
            const model = getFlashModel()
            const fullText = await streamPrompt(model, EDIT_SYSTEM_PROMPT, editUserMessage, onStream)
            const rawPatch = extractJSON(fullText) as FeasibilityEditPatch
            const validatedPatch = FeasibilityEditPatchSchema.parse(rawPatch)
            const merged = mergePatch(existingFeasibility!, validatedPatch)
            const validated = FeasibilityOutputSchema.parse(merged)
            await onComplete(validated)
        }

        await withTimeout(editRun(), Number(process.env.FEASIBILITY_TIMEOUT_MS ?? 120000))
        return
    }

    // Build context block — research is ideal but not required anymore (web search fills gaps)
    const contextParts: string[] = []

    if (venture.context?.architectPlan) {
        contextParts.push(`Architect's Plan:\n${venture.context.architectPlan}`)
    }
    if (venture.globalIdea) {
        contextParts.push(`Global Startup Vision: ${venture.globalIdea}`)
    }
    if (venture.context?.research) {
        const r = venture.context.research as Record<string, any>
        const lines: string[] = []
        if (r.marketSummary) lines.push(`Market summary: ${r.marketSummary}`)
        // TAM / SAM / SOM with source and methodology
        if (r.tam) {
            const tamVal = r.tam?.value || (typeof r.tam === 'string' ? r.tam : '')
            const tamSrc = r.tam?.source ? ` (source: ${r.tam.source})` : ''
            const tamMethod = r.tam?.methodology ? ` [${r.tam.methodology}]` : ''
            if (tamVal) lines.push(`TAM: ${tamVal}${tamSrc}${tamMethod}`)
        }
        if (r.sam) {
            const samVal = r.sam?.value || (typeof r.sam === 'string' ? r.sam : '')
            const samSrc = r.sam?.source ? ` (source: ${r.sam.source})` : ''
            if (samVal) lines.push(`SAM: ${samVal}${samSrc}`)
        }
        if (r.som) {
            const somVal = r.som?.value || (typeof r.som === 'string' ? r.som : '')
            const somRat = r.som?.rationale ? ` — ${r.som.rationale}` : ''
            if (somVal) lines.push(`SOM: ${somVal}${somRat}`)
        }
        if (r.targetAudience || r.targetCustomer) lines.push(`Target customer: ${r.targetAudience || r.targetCustomer}`)
        if (r.competitorGap) lines.push(`Competitor gap: ${r.competitorGap}`)
        if (r.recommendedConcept) {
            const concept = typeof r.recommendedConcept === 'object'
                ? (r.recommendedConcept.name || r.recommendedConcept.title || JSON.stringify(r.recommendedConcept))
                : String(r.recommendedConcept)
            lines.push(`Recommended concept: ${concept}`)
        }
        if (Array.isArray(r.painPoints) && r.painPoints.length > 0) {
            const pains = r.painPoints.slice(0, 5).map((p: any, i: number) => {
                const desc = typeof p === 'object' ? (p.description || p.name || JSON.stringify(p)) : String(p)
                const freq = typeof p === 'object' && p.frequency ? ` (frequency: ${p.frequency})` : ''
                return `  ${i + 1}. ${desc}${freq}`
            })
            lines.push(`Pain points:\n${pains.join('\n')}`)
        }
        if (Array.isArray(r.competitors) && r.competitors.length > 0) {
            const comps = r.competitors.slice(0, 5).map((c: any) => {
                const name = typeof c === 'object' ? (c.name || JSON.stringify(c)) : String(c)
                const pos = typeof c === 'object' && c.positioning ? ` | positioning: "${c.positioning}"` : ''
                const weakness = typeof c === 'object' && (c.weakness || c.gap) ? ` | weakness: "${c.weakness || c.gap}"` : ''
                return `  - ${name}${pos}${weakness}`
            })
            lines.push(`Competitors:\n${comps.join('\n')}`)
        }
        // SWOT and riskMatrix kept as-is — feasibility needs full detail
        if (r.swot) lines.push(`SWOT:\n${JSON.stringify(r.swot, null, 2)}`)
        if (r.riskMatrix) lines.push(`Risk Matrix:\n${JSON.stringify(r.riskMatrix, null, 2)}`)
        contextParts.push(`Market Research Data (from Genesis agent):\n${lines.join('\n')}`)
    }
    if (venture.context?.branding) {
        const b = venture.context.branding as Record<string, any>
        const brandLines: string[] = []
        if (b.brandName) brandLines.push(`Brand name: ${b.brandName}`)
        if (b.tagline) brandLines.push(`Tagline: "${b.tagline}"`)
        if (brandLines.length > 0) contextParts.push(`Brand Context:\n${brandLines.join('\n')}`)
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
        const responseText = await streamPrompt(
            model,
            buildSystemPrompt(depth),
            finalUserMessage,
            onStream,
            history
        )

        const partialOutput = (history.find(h => h.role === 'model')?.parts[0] as any)?.text || ''
        const combinedText = isContinuation ? partialOutput + responseText : responseText

        const raw = extractJSON(combinedText)
        const validated = FeasibilityOutputSchema.parse(raw)
        await onComplete(validated)
    }

    // Each attempt gets its own timeout window (no retry on Pro model — expensive)
    const timeoutMs = depth === 'detailed' ? 300000 : depth === 'medium' ? 240000 : 180000
    await withTimeout(
        run(),
        Number(process.env.FEASIBILITY_TIMEOUT_MS ?? timeoutMs)
    )
}
