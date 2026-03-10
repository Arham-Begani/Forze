import { z } from 'zod'
import {
    getFlashModelWithSearch,
    streamPrompt,
    extractJSON,
    withTimeout,
    withRetry,
} from '@/lib/gemini'

// ── GenesisOutput Zod Schema ─────────────────────────────────────────────────

const GenesisOutputSchema = z.object({
    marketSummary: z.string(),
    tam: z.object({
        value: z.string(),
        source: z.string(),
        methodology: z.string(),
    }),
    sam: z.object({
        value: z.string(),
        source: z.string(),
    }),
    som: z.object({
        value: z.string(),
        rationale: z.string(),
    }),
    painPoints: z.array(
        z.object({
            description: z.string(),
            source: z.string(),
            frequency: z.enum(['high', 'medium', 'low']),
        })
    ),
    competitors: z.array(
        z.object({
            name: z.string(),
            positioning: z.string(),
            weakness: z.string(),
        })
    ),
    competitorGap: z.string(),
    swot: z.object({
        strengths: z.array(z.string()),
        weaknesses: z.array(z.string()),
        opportunities: z.array(z.string()),
        threats: z.array(z.string()),
    }),
    riskMatrix: z.array(
        z.object({
            risk: z.string(),
            likelihood: z.enum(['high', 'medium', 'low']),
            impact: z.enum(['high', 'medium', 'low']),
            score: z.number(),
        })
    ),
    topConcepts: z.array(
        z.object({
            name: z.string(),
            description: z.string(),
            opportunityScore: z.number(),
            rationale: z.string(),
        })
    ),
    recommendedConcept: z.string(),
})

export type GenesisOutput = z.infer<typeof GenesisOutputSchema>

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
# Genesis Engine — Market Research Specialist

You are Forge's market intelligence agent. You turn raw venture concepts into data-backed market intelligence.

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

## Output Rules

- Output strict JSON matching GenesisOutputSchema from VENTURE_OBJECT.md
- Validate output structure before returning
- Broadcast findings to all teammates when used in Full Launch
- Every data point must have a source field — never leave it empty

## Web Search Strategy

Use these search patterns:
"[market] pain points site:reddit.com"
"[market] frustrations OR complaints"
"[market] size OR TAM 2024 OR 2025 OR 2026"
"[market] market report"
"alternatives to [competitor]"
"[competitor] reviews negative"
"[niche] startup ideas"

Run at minimum 8 searches before producing output.

## Output Schema

Output your final findings as a single JSON object matching this exact structure:

\`\`\`json
{
  "marketSummary": "string",
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
valid JSON object matching this exact structure.The JSON must be the last
thing you output.Do not include any text after the closing brace.
Output ONLY the JSON — no markdown fences, no explanation after.
`

// ── Agent Runner ──────────────────────────────────────────────────────────────

export async function runGenesisAgent(
    venture: { ventureId: string; name: string; context: Record<string, unknown> },
    onStream: (line: string) => Promise<void>,
    onComplete: (result: GenesisOutput) => Promise<void>
): Promise<void> {
    const userMessage = `
Research this venture concept thoroughly using Google Search.
    Find real, current market data with citations.
Venture concept: ${venture.name}

Run at minimum 8 distinct searches covering:
1. Pain points and frustrations in this space
2. Market size(TAM / SAM / SOM) from credible sources
3. Direct and indirect competitors
4. Recent trends and market timing signals
5. Reddit and community discussions about this problem

Then output your full GenesisOutput JSON.
`

    const run = async () => {
        const model = getFlashModelWithSearch()
        let fullText = ''

        await streamPrompt(
            model,
            SYSTEM_PROMPT,
            userMessage,
            async (chunk) => {
                fullText += chunk
                // Stream word by word for smoother UX
                await onStream(chunk)
            }
        )

        const raw = extractJSON(fullText)
        const validated = GenesisOutputSchema.parse(raw)
        await onComplete(validated)
    }

    await withTimeout(
        withRetry(run),
        Number(process.env.AGENT_TIMEOUT_MS ?? 60000)
    )
}
