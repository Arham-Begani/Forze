import { z } from 'zod'
import {
    getFlashModel,
    streamPrompt,
    extractJSON,
    withTimeout,
} from '@/lib/gemini'

// ── Investor Kit Output Schema ──────────────────────────────────────────────

export const InvestorKitSchema = z.object({
    executiveSummary: z.string(),
    pitchDeckOutline: z.array(z.object({
        slide: z.string(),
        content: z.string(),
        speakerNotes: z.string(),
    })),
    onePageMemo: z.string(),
    askDetails: z.object({
        suggestedRaise: z.string(),
        useOfFunds: z.array(z.string()),
        keyMilestones: z.array(z.string()),
    }),
    dataRoomSections: z.array(z.string()),
})

export type InvestorKitOutput = z.infer<typeof InvestorKitSchema>

// ── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
# Investor Kit Generator — Forge AI

You are a senior startup advisor and pitch deck strategist. You produce investor-ready materials from venture data. Your output must be polished, professional, and data-driven.

## What You Must Produce

### 1. Executive Summary (300-500 words)
A compelling, investor-ready summary covering:
- The problem and market opportunity (cite TAM/SAM/SOM numbers)
- The solution and unique value proposition
- Business model and unit economics
- Traction/validation (feasibility verdict, landing page deployment)
- The ask and use of funds

### 2. Pitch Deck Outline (10-12 slides)
Standard VC pitch deck structure:
- Problem, Solution, Market Size, Product, Business Model, Traction, Team (placeholder), Competition, Financials, The Ask
- Each slide: title, key content bullet points, speaker notes

### 3. One-Page Investment Memo (full markdown)
A professional memo an investor could forward internally:
- Opening hook / thesis
- Market opportunity with numbers
- Product-market fit evidence
- Financial projections summary
- Risk factors (top 3)
- Why now? (market timing)
- Investment terms / the ask

### 4. Ask Details
- Suggested raise amount based on financial model
- Use of funds breakdown (percentages)
- Key milestones the money achieves

### 5. Data Room Sections
List the sections available in the data room based on what venture data exists.

## Output Format

Output strict JSON matching:
{
  "executiveSummary": "300-500 word summary",
  "pitchDeckOutline": [
    { "slide": "Problem", "content": "bullet points", "speakerNotes": "what to say" }
  ],
  "onePageMemo": "Full markdown memo",
  "askDetails": {
    "suggestedRaise": "$500K pre-seed",
    "useOfFunds": ["40% Engineering", "30% Marketing", ...],
    "keyMilestones": ["Launch MVP by Q2", ...]
  },
  "dataRoomSections": ["Executive Summary", "Market Research", ...]
}

IMPORTANT: Reference actual numbers from the venture data. Do not use placeholders like "$X" — use the real figures. Every claim should be backed by venture context data.
Output ONLY the JSON. No conversational text outside of it.
`

// ── Agent Runner ────────────────────────────────────────────────────────────

interface VentureInput {
    ventureId: string
    name: string
    globalIdea?: string
    context: Record<string, unknown>
}

export async function runInvestorKitAgent(
    venture: VentureInput,
    onStream: (chunk: string) => Promise<void>,
    onComplete: (result: InvestorKitOutput) => Promise<void>,
): Promise<void> {
    const model = getFlashModel()

    // Build context block from all available venture data
    const contextParts: string[] = []

    if (venture.globalIdea) {
        contextParts.push(`Venture Vision: ${venture.globalIdea}`)
    }

    if (venture.context?.research) {
        contextParts.push(`Market Research Data:\n${JSON.stringify(venture.context.research, null, 2)}`)
    }
    if (venture.context?.branding) {
        contextParts.push(`Brand Identity:\n${JSON.stringify(venture.context.branding, null, 2)}`)
    }
    if (venture.context?.feasibility) {
        contextParts.push(`Feasibility Analysis:\n${JSON.stringify(venture.context.feasibility, null, 2)}`)
    }
    if (venture.context?.landing) {
        const l = venture.context.landing as Record<string, any>
        const landingSummary: Record<string, any> = {}
        if (l.deploymentUrl) landingSummary.deploymentUrl = l.deploymentUrl
        if (l.landingPageCopy?.hero) landingSummary.hero = l.landingPageCopy.hero
        if (l.landingPageCopy?.pricing) landingSummary.pricing = l.landingPageCopy.pricing
        contextParts.push(`Landing Page:\n${JSON.stringify(landingSummary, null, 2)}`)
    }

    const userMessage = `Generate an investor-ready kit for this venture.

Venture: ${venture.name}

${contextParts.join('\n\n')}

Produce the complete InvestorKitOutput JSON.`

    const run = async () => {
        const fullText = await streamPrompt(
            model,
            SYSTEM_PROMPT,
            userMessage,
            onStream,
        )

        const raw = extractJSON(fullText)
        const validated = InvestorKitSchema.parse(raw)
        await onComplete(validated)
    }

    await withTimeout(run(), 90_000)
}
