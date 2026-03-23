import { z } from 'zod'
import {
    getFlashModelWithSearch,
    streamPrompt,
    extractJSON,
    withTimeout,
    withRetry,
    Content,
} from '@/lib/gemini'
import { DOCUMENT_STYLE_GUIDE } from '@/lib/agent-document-style'

// ── GenesisOutput Zod Schema ─────────────────────────────────────────────────

const GenesisOutputSchema = z.object({
    marketSummary: z.string().default('Market summary pending.'),
    researchPaper: z.string().default('# Market Research\n\nFull research documentation pending.'),
    tam: z.object({
        value: z.string().default('$0'),
        source: z.string().default('Source pending'),
        methodology: z.string().default('Top-down estimation'),
    }).default({
        value: '$0',
        source: 'Source pending',
        methodology: 'Top-down estimation'
    }),
    sam: z.object({
        value: z.string().default('$0'),
        source: z.string().default('Source pending'),
    }).default({
        value: '$0',
        source: 'Source pending'
    }),
    som: z.object({
        value: z.string().default('$0'),
        rationale: z.string().default('Rationale pending'),
    }).default({
        value: '$0',
        rationale: 'Rationale pending'
    }),
    painPoints: z.array(
        z.object({
            description: z.string(),
            source: z.string(),
            frequency: z.enum(['high', 'medium', 'low']).default('medium'),
        })
    ).default([]),
    competitors: z.array(
        z.object({
            name: z.string(),
            positioning: z.string(),
            weakness: z.string(),
        })
    ).default([]),
    competitorGap: z.string().default('Gap analysis pending.'),
    swot: z.object({
        strengths: z.array(z.string()).default([]),
        weaknesses: z.array(z.string()).default([]),
        opportunities: z.array(z.string()).default([]),
        threats: z.array(z.string()).default([]),
    }).default({
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: []
    }),
    riskMatrix: z.array(
        z.object({
            risk: z.string(),
            likelihood: z.enum(['high', 'medium', 'low']).default('medium'),
            impact: z.enum(['high', 'medium', 'low']).default('medium'),
            score: z.number().default(5),
        })
    ).default([]),
    topConcepts: z.array(
        z.object({
            name: z.string(),
            description: z.string(),
            opportunityScore: z.number().default(5),
            rationale: z.string().default('No rationale provided.'),
        })
    ).default([]),
    recommendedConcept: z.string().default('Concept candidate pending.'),
})

export type GenesisOutput = z.infer<typeof GenesisOutputSchema>

// ── Edit Patch Schema (all fields optional — for surgical updates) ───────────

const GenesisEditPatchSchema = z.object({
    marketSummary: z.string().optional(),
    researchPaper: z.string().optional(),
    tam: z.object({
        value: z.string().optional(),
        source: z.string().optional(),
        methodology: z.string().optional(),
    }).optional(),
    sam: z.object({
        value: z.string().optional(),
        source: z.string().optional(),
    }).optional(),
    som: z.object({
        value: z.string().optional(),
        rationale: z.string().optional(),
    }).optional(),
    painPoints: z.array(z.object({
        description: z.string(),
        source: z.string(),
        frequency: z.enum(['high', 'medium', 'low']).default('medium'),
    })).optional(),
    competitors: z.array(z.object({
        name: z.string(),
        positioning: z.string(),
        weakness: z.string(),
    })).optional(),
    competitorGap: z.string().optional(),
    swot: z.object({
        strengths: z.array(z.string()).optional(),
        weaknesses: z.array(z.string()).optional(),
        opportunities: z.array(z.string()).optional(),
        threats: z.array(z.string()).optional(),
    }).optional(),
    riskMatrix: z.array(z.object({
        risk: z.string(),
        likelihood: z.enum(['high', 'medium', 'low']).default('medium'),
        impact: z.enum(['high', 'medium', 'low']).default('medium'),
        score: z.number().default(5),
    })).optional(),
    topConcepts: z.array(z.object({
        name: z.string(),
        description: z.string(),
        opportunityScore: z.number().default(5),
        rationale: z.string().default('No rationale provided.'),
    })).optional(),
    recommendedConcept: z.string().optional(),
})

type GenesisEditPatch = z.infer<typeof GenesisEditPatchSchema>

// ── Merge patch into existing result ─────────────────────────────────────────

function mergePatch(existing: GenesisOutput, patch: GenesisEditPatch): GenesisOutput {
    const merged = { ...existing }

    if (patch.marketSummary !== undefined) merged.marketSummary = patch.marketSummary
    if (patch.researchPaper !== undefined) merged.researchPaper = patch.researchPaper
    if (patch.competitorGap !== undefined) merged.competitorGap = patch.competitorGap
    if (patch.recommendedConcept !== undefined) merged.recommendedConcept = patch.recommendedConcept

    if (patch.tam) merged.tam = { ...existing.tam, ...patch.tam }
    if (patch.sam) merged.sam = { ...existing.sam, ...patch.sam }
    if (patch.som) merged.som = { ...existing.som, ...patch.som }

    if (patch.swot) {
        merged.swot = { ...existing.swot }
        if (patch.swot.strengths) merged.swot.strengths = patch.swot.strengths
        if (patch.swot.weaknesses) merged.swot.weaknesses = patch.swot.weaknesses
        if (patch.swot.opportunities) merged.swot.opportunities = patch.swot.opportunities
        if (patch.swot.threats) merged.swot.threats = patch.swot.threats
    }

    // Arrays replace entirely
    if (patch.painPoints) merged.painPoints = patch.painPoints
    if (patch.competitors) merged.competitors = patch.competitors
    if (patch.riskMatrix) merged.riskMatrix = patch.riskMatrix
    if (patch.topConcepts) merged.topConcepts = patch.topConcepts

    return merged
}

// ── Edit System Prompt ───────────────────────────────────────────────────────

const EDIT_SYSTEM_PROMPT = `
# Genesis Engine — Surgical Edit Mode

You are editing an EXISTING market research output. The user wants a specific change — do NOT regenerate everything.

## Rules
1. Read the existing research data carefully
2. Identify ONLY the fields that need to change based on the user's request
3. Output a JSON patch containing ONLY the changed fields
4. Unchanged fields must be OMITTED (not copied)
5. For nested objects (tam, sam, som, swot), include only changed sub-fields
6. For arrays (painPoints, competitors, riskMatrix, topConcepts), if ANY item changes, include the entire array

## Output Format
Output ONLY a JSON object with the changed fields. No markdown fences, no explanation.
Example: if the user asks to change the recommended concept, output:
{"recommendedConcept": "New concept name"}
`

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
# Genesis Engine — Market Research Specialist

You are Forze's market intelligence agent. You turn raw venture concepts into data-backed market intelligence.

## Your Job

1. Use web_search aggressively to find real, current market data
2. Search Reddit, Product Hunt, Hacker News, Twitter/X for pain points
3. Search market reports, news, competitor sites for sizing data
4. Never hallucinate numbers — only use data you can cite
5. If you cannot find data, say so explicitly rather than estimating

## Research Process

### Step 1 — Pain Point Discovery
Search Reddit (r/entrepreneur, r/startups, r/smallbusiness, relevant niche subreddits), Product Hunt reviews, and App Store reviews for complaints, frustrations, and unmet needs in the target space.

### Step 2 — Market Sizing
Search for TAM (Total Addressable Market), SAM (Serviceable Addressable Market), and SOM (Serviceable Obtainable Market) from credible sources. Always cite the source. Use the bottom-up methodology when top-down data is unavailable.

### Step 3 — Competitor Mapping
Search for direct and indirect competitors. Document their positioning, pricing, key weaknesses, and what users complain about. Identify the biggest gap in the market.

### Step 4 — SWOT Analysis
Build a SWOT matrix based on what you actually found — not generic advice.

### Step 5 — Risk Matrix
Identify 12 specific risks. Score each by likelihood (high/medium/low) and impact (high/medium/low). This is not a generic list — it must be specific to this venture.

### Step 6 — Concept Generation
Produce 10 ranked business concepts that could fill the identified gap. Score each by opportunity (1–10) with clear rationale.

### Step 7 — Detailed Research Paper
Write a comprehensive, professional "Market Research & Venture Opportunity Paper". 
- Target length: 1500+ words.
- Format: Professional Markdown with headers, lists, and tables.
- Sections required:
  - Executive Summary
  - Market Dynamics & Trends (cite specific data)
  - Deep-Dive: Target Audience & Pain Points (cite community discussions)
  - Competitive Landscape: Direct & Indirect Competition
  - Gap Analysis: The Unmet Need
  - Strategic SWOT Analysis
  - Venture Feasibility & Market Sizing
  - Proposed Business Model & Concept Rank
  - Conclusion & Strategic Recommendation

## Document Formatting Standard

Follow this Markdown formatting guide exactly for the researchPaper field:

${DOCUMENT_STYLE_GUIDE}

## Output Rules

- Output strict JSON matching GenesisOutputSchema from VENTURE_OBJECT.md
- Validate output structure before returning
- Broadcast findings to all teammates when used in Full Launch
- Every data point must have a source field — never leave it empty
- The researchPaper field must be a long-form, professional Markdown document.

## Web Search Strategy

Use these search patterns:
"[market] pain points site:reddit.com"
"[market] frustrations OR complaints"
"[market] size OR TAM 2024 OR 2025 OR 2026"
"[market] market report"
"alternatives to [competitor]"
"[competitor] reviews negative"
"[niche] startup ideas"

## Research Intensity Guidelines

Based on the requested depth, adjust your thoroughness:

### Brief:
- Run 4-6 searches.
- Focus on top-level TAM and major competitors.
- Produce 8 ranked concepts.
- The 'researchPaper' should be a concise summary (~500 words).

### Medium:
- Run 10-12 searches.
- Deep dive into Sam/Som and community pain points.
- Produce 10 ranked concepts.
- The 'researchPaper' should be a detailed analysis (~1500 words).

### Detailed:
- Run 18-24 searches (Exhaustive search).
- Explore niche sub-markets, obscure competitor weaknesses, and long-tail timing signals.
- Produce 15 ranked concepts.
- The 'researchPaper' should be an exhaustive, white-paper style document (~3000 words) with deep analysis of every section.

## Output Schema

Output your final findings as a single JSON object matching this exact structure:

\`\`\`json
{
  "marketSummary": "string",
  "researchPaper": "Detailed Markdown content...",
  "tam": { "value": "string", "source": "string", "methodology": "string" },
  "sam": { "value": "string", "source": "string" },
  "som": { "value": "string", "rationale": "string" },
  "painPoints": [
    { "description": "string", "source": "string", "frequency": "high|medium|low" }
  ],
  "competitors": [
    { "name": "string", "positioning": "string", "weakness": "string" }
  ],
  "competitorGap": "string",
                "swot": {
        "strengths": ["string"],
            "weaknesses": ["string"],
                "opportunities": ["string"],
                    "threats": ["string"]
    },
    "riskMatrix": [
        { "risk": "string", "likelihood": "high|medium|low", "impact": "high|medium|low", "score": 1 - 9 }
    ],
        "topConcepts": [
            { "name": "string", "description": "string", "opportunityScore": 1 - 10, "rationale": "string" }
        ],
            "recommendedConcept": "string"
}
\`\`\`

CRITICAL OUTPUT INSTRUCTION:
After all your research and analysis, output your final findings as a single
valid JSON object matching this exact structure. The JSON must be the last
thing you output. Do not include any text after the closing brace.
Output ONLY the JSON — no markdown fences, no explanation after.

IMPORTANT: Do not output any conversational text or "Thought Process" headers. Any step-by-step reasoning or thought process MUST be strictly wrapped inside <think> and </think> tags. Only the final valid JSON should be outside the <think> tags.
`

// ── Agent Runner ──────────────────────────────────────────────────────────────

export async function runGenesisAgent(
    venture: { ventureId: string; name: string; globalIdea?: string; context: Record<string, unknown> },
    onStream: (line: string) => Promise<void>,
    onComplete: (result: GenesisOutput) => Promise<void>,
    depth: 'brief' | 'medium' | 'detailed' = 'medium',
    history: Content[] = []
): Promise<void> {
    const searchCountMap = {
        brief: 5,
        medium: 12,
        detailed: 22
    }

    // ── Edit mode detection ──
    const existingResearch = venture.context.research as GenesisOutput | null | undefined
    const isEditMode = !history.length && !!existingResearch?.marketSummary && existingResearch.marketSummary.length > 20

    if (isEditMode) {
        await onStream('[Edit mode] Applying surgical changes to existing research...\n')

        const existingForContext = {
            marketSummary: existingResearch!.marketSummary,
            tam: existingResearch!.tam,
            sam: existingResearch!.sam,
            som: existingResearch!.som,
            competitorGap: existingResearch!.competitorGap,
            recommendedConcept: existingResearch!.recommendedConcept,
            painPoints: existingResearch!.painPoints?.slice(0, 5),
            competitors: existingResearch!.competitors?.slice(0, 5),
            swot: existingResearch!.swot,
            riskMatrix: existingResearch!.riskMatrix?.slice(0, 5),
            topConcepts: existingResearch!.topConcepts?.slice(0, 5),
            researchPaper: existingResearch!.researchPaper?.length > 500
                ? existingResearch!.researchPaper.slice(0, 250) + '\n... [truncated] ...\n' + existingResearch!.researchPaper.slice(-250)
                : existingResearch!.researchPaper,
        }

        const editUserMessage = `## Edit Request\n${venture.name}\n\n## Current Research Data\n\`\`\`json\n${JSON.stringify(existingForContext, null, 2)}\n\`\`\`\n\nApply the requested change. Output ONLY the fields that need to change as a JSON patch.`

        const editRun = async () => {
            const model = getFlashModelWithSearch()
            const fullText = await streamPrompt(model, EDIT_SYSTEM_PROMPT, editUserMessage, onStream)
            const rawPatch = extractJSON(fullText) as GenesisEditPatch
            const validatedPatch = GenesisEditPatchSchema.parse(rawPatch)
            const merged = mergePatch(existingResearch!, validatedPatch)
            const validated = GenesisOutputSchema.parse(merged)
            await onComplete(validated)
        }

        await withTimeout(withRetry(editRun), Number(process.env.AGENT_TIMEOUT_MS ?? 120000))
        return
    }

    const isContinuation = history.length > 0
    const userMessage = isContinuation
        ? "Continue from where you left off. Do not repeat anything already outputted. Complete the GenesisOutput JSON object strictly."
        : `Research this venture concept thoroughly using Google Search.
    Find real, current market data with citations.
    
    RESEARCH DEPTH REQUESTED: ${depth} (Intensity: ${searchCountMap[depth]} searches)

${venture.context?.architectPlan ? `Architect's Plan:\n${venture.context.architectPlan}\n\n` : ''}${venture.globalIdea ? `Global Startup Vision: ${venture.globalIdea}\n` : ''}Specific Venture Focus: ${venture.name}

Run at minimum ${searchCountMap[depth]} distinct searches covering:
1. Pain points and frustrations in this space
2. Market size(TAM / SAM / SOM) from credible sources
3. Direct and indirect competitors
4. Recent trends and market timing signals
5. Reddit and community discussions about this problem

Then output your full GenesisOutput JSON.`

    const finalUserMessage = isContinuation
        ? "Continue from where you left off. Do not repeat anything already outputted. Complete the GenesisOutput JSON strictly."
        : userMessage

    const run = async () => {
        const model = getFlashModelWithSearch()
        const responseText = await streamPrompt(
            model,
            SYSTEM_PROMPT,
            finalUserMessage,
            onStream,
            history
        )

        const partialOutput = (history.find(h => h.role === 'model')?.parts[0] as any)?.text || ''
        const combinedText = isContinuation ? partialOutput + responseText : responseText

        const raw = extractJSON(combinedText)
        const validated = GenesisOutputSchema.parse(raw)
        await onComplete(validated)
    }

    await withTimeout(
        withRetry(run),
        Number(process.env.AGENT_TIMEOUT_MS ?? 120000)
    )
}
