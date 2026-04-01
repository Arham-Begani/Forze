import { z } from 'zod'
import {
    getFlashModel,
    streamPrompt,
    extractJSON,
    withTimeout,
    withRetry,
    Content,
} from '@/lib/gemini'
import { DOCUMENT_STYLE_GUIDE } from '@/lib/agent-document-style'
import { sanitize, sanitizeLabel } from '@/lib/sanitize'

// ── Investor Kit Output Schema ──────────────────────────────────────────────

export const InvestorKitSchema = z.object({
    executiveSummary: z.string().default('Executive summary pending.'),
    pitchDeckOutline: z.array(z.object({
        slide: z.string().default('Slide Title'),
        content: z.string().default('Slide contents pending.'),
        speakerNotes: z.string().default('Speaker notes pending.'),
    })).default([]),
    onePageMemo: z.string().default('# Investment Memo\n\nFull memo documentation pending.'),
    askDetails: z.object({
        suggestedRaise: z.string().default('$0'),
        useOfFunds: z.array(z.string()).default([]),
        keyMilestones: z.array(z.string()).default([]),
    }).default({
        suggestedRaise: '$0',
        useOfFunds: [],
        keyMilestones: []
    }),
    dataRoomSections: z.array(z.string()).default([]),
})

export type InvestorKitOutput = z.infer<typeof InvestorKitSchema>

// ── Edit Patch Schema (all fields optional — for surgical updates) ───────────

const InvestorKitEditPatchSchema = z.object({
    executiveSummary: z.string().optional(),
    pitchDeckOutline: z.array(z.object({
        slide: z.string().default('Slide Title'),
        content: z.string().default('Slide contents pending.'),
        speakerNotes: z.string().default('Speaker notes pending.'),
    })).optional(),
    onePageMemo: z.string().optional(),
    askDetails: z.object({
        suggestedRaise: z.string().optional(),
        useOfFunds: z.array(z.string()).optional(),
        keyMilestones: z.array(z.string()).optional(),
    }).optional(),
    dataRoomSections: z.array(z.string()).optional(),
})

type InvestorKitEditPatch = z.infer<typeof InvestorKitEditPatchSchema>

// ── Merge patch into existing result ─────────────────────────────────────────

function mergePatch(existing: InvestorKitOutput, patch: InvestorKitEditPatch): InvestorKitOutput {
    const merged = { ...existing }

    if (patch.executiveSummary !== undefined) merged.executiveSummary = patch.executiveSummary
    if (patch.onePageMemo !== undefined) merged.onePageMemo = patch.onePageMemo

    // Arrays replace entirely
    if (patch.pitchDeckOutline) merged.pitchDeckOutline = patch.pitchDeckOutline
    if (patch.dataRoomSections) merged.dataRoomSections = patch.dataRoomSections

    if (patch.askDetails) {
        merged.askDetails = { ...existing.askDetails }
        if (patch.askDetails.suggestedRaise !== undefined) merged.askDetails.suggestedRaise = patch.askDetails.suggestedRaise
        if (patch.askDetails.useOfFunds) merged.askDetails.useOfFunds = patch.askDetails.useOfFunds
        if (patch.askDetails.keyMilestones) merged.askDetails.keyMilestones = patch.askDetails.keyMilestones
    }

    return merged
}

// ── Edit System Prompt ───────────────────────────────────────────────────────

const EDIT_SYSTEM_PROMPT = `
# Investor Kit — Surgical Edit Mode

You are editing an EXISTING investor kit. The user wants a specific change — do NOT regenerate everything.

## Rules
1. Read the existing investor kit data carefully
2. Identify ONLY the fields that need to change based on the user's request
3. Output a JSON patch containing ONLY the changed fields
4. Unchanged fields must be OMITTED (not copied)
5. For askDetails, include only changed sub-fields
6. For arrays (pitchDeckOutline, dataRoomSections), if ANY item changes, include the entire array

## Output Format
Output ONLY a JSON object with the changed fields. No markdown fences, no explanation.
Example: if the user asks to change the suggested raise amount, output:
{"askDetails": {"suggestedRaise": "$750K pre-seed"}}
`

// ── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
# Investor Kit Generator — Forze AI

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

## Document Formatting Standard

Follow this Markdown formatting guide exactly for the onePageMemo field:

${DOCUMENT_STYLE_GUIDE}

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
    history: Content[] = []
): Promise<void> {
    const model = getFlashModel()

    // ── Edit mode detection ──
    const existingKit = venture.context.investorKit as InvestorKitOutput | null | undefined
    const isEditMode = !history.length && !!existingKit?.executiveSummary && existingKit.executiveSummary.length > 50

    if (isEditMode) {
        await onStream('[Edit mode] Applying surgical changes to existing investor kit...\n')

        const existingForContext = {
            executiveSummary: existingKit!.executiveSummary?.length > 500
                ? existingKit!.executiveSummary.slice(0, 250) + '\n... [truncated] ...\n' + existingKit!.executiveSummary.slice(-250)
                : existingKit!.executiveSummary,
            pitchDeckOutline: existingKit!.pitchDeckOutline,
            askDetails: existingKit!.askDetails,
            dataRoomSections: existingKit!.dataRoomSections,
            onePageMemo: existingKit!.onePageMemo?.length > 500
                ? existingKit!.onePageMemo.slice(0, 250) + '\n... [truncated] ...\n' + existingKit!.onePageMemo.slice(-250)
                : existingKit!.onePageMemo,
        }

        const editUserMessage = `## Edit Request\n${sanitizeLabel(venture.name)}\n\n## Current Investor Kit\n\`\`\`json\n${JSON.stringify(existingForContext, null, 2)}\n\`\`\`\n\nApply the requested change. Output ONLY the fields that need to change as a JSON patch.`

        const editRun = async () => {
            const fullText = await streamPrompt(model, EDIT_SYSTEM_PROMPT, editUserMessage, onStream)
            const rawPatch = extractJSON(fullText) as InvestorKitEditPatch
            const validatedPatch = InvestorKitEditPatchSchema.parse(rawPatch)
            const merged = mergePatch(existingKit!, validatedPatch)
            const validated = InvestorKitSchema.parse(merged)
            await onComplete(validated)
        }

        await withTimeout(withRetry(editRun), 180_000)
        return
    }

    // Build context block from all available venture data
    const contextParts: string[] = []

    if (venture.globalIdea) {
        contextParts.push(`Venture Vision: ${sanitize(venture.globalIdea, 1000)}`)
    }

    // Research — extract only investor-relevant metrics
    if (venture.context?.research) {
        const r = venture.context.research as Record<string, any>
        const lines: string[] = []
        if (r.marketSummary) lines.push(`Market: ${r.marketSummary}`)
        const tamValue = r.tam?.value || (typeof r.tam === 'string' ? r.tam : '')
        const tamSource = r.tam?.source ? ` (source: ${r.tam.source})` : ''
        if (tamValue) lines.push(`TAM: ${tamValue}${tamSource}`)
        if (r.sam?.value) lines.push(`SAM: ${r.sam.value}`)
        if (r.som?.value) lines.push(`SOM: ${r.som.value}`)
        if (r.targetAudience || r.targetCustomer) lines.push(`Target customer: ${r.targetAudience || r.targetCustomer}`)
        if (r.competitorGap) lines.push(`Market gap: ${r.competitorGap}`)
        if (r.recommendedConcept) lines.push(`Recommended concept: ${typeof r.recommendedConcept === 'object' ? (r.recommendedConcept.name || JSON.stringify(r.recommendedConcept)) : String(r.recommendedConcept)}`)
        if (Array.isArray(r.painPoints) && r.painPoints.length > 0) {
            const pains = r.painPoints.slice(0, 3).map((p: any, i: number) => {
                const desc = typeof p === 'object' ? (p.description || p.name || JSON.stringify(p)) : String(p)
                return `  ${i + 1}. ${desc}`
            })
            lines.push(`Key pain points:\n${pains.join('\n')}`)
        }
        if (Array.isArray(r.competitors) && r.competitors.length > 0) {
            const comps = r.competitors.slice(0, 3).map((c: any) => {
                const name = typeof c === 'object' ? (c.name || JSON.stringify(c)) : String(c)
                const positioning = typeof c === 'object' && c.positioning ? ` | positioning: "${c.positioning}"` : ''
                const weakness = typeof c === 'object' ? (c.weakness || c.gap || '') : ''
                return `  - ${name}${positioning}${weakness ? ` | weakness: "${weakness}"` : ''}`
            })
            lines.push(`Competitors:\n${comps.join('\n')}`)
        }
        if (lines.length > 0) contextParts.push(`## Market Research\n${lines.join('\n')}`)
    }

    // Branding — extract core identity only (no palette, typography, logos)
    if (venture.context?.branding) {
        const b = venture.context.branding as Record<string, any>
        const lines: string[] = []
        if (b.brandName) lines.push(`Brand name: ${b.brandName}`)
        if (b.tagline) lines.push(`Tagline: "${b.tagline}"`)
        if (b.missionStatement) lines.push(`Mission: ${b.missionStatement}`)
        if (b.brandArchetype) lines.push(`Archetype: ${b.brandArchetype}`)
        if (lines.length > 0) contextParts.push(`## Brand Identity\n${lines.join('\n')}`)
    }

    // Feasibility — extract verdict, financials, risks, moat
    if (venture.context?.feasibility) {
        const f = venture.context.feasibility as Record<string, any>
        const lines: string[] = []
        if (f.verdict) lines.push(`Verdict: ${f.verdict}`)
        if (f.verdictRationale) lines.push(`Rationale: ${f.verdictRationale}`)
        if (f.marketTimingScore != null) lines.push(`Market timing score: ${f.marketTimingScore}`)
        if (f.competitiveMoat) lines.push(`Competitive moat: ${f.competitiveMoat}`)
        if (Array.isArray(f.keyAssumptions) && f.keyAssumptions.length > 0) {
            lines.push(`Key assumptions: ${f.keyAssumptions.join('; ')}`)
        }
        if (f.financialModel) {
            lines.push(`Financial model:\n${JSON.stringify(f.financialModel, null, 2)}`)
        }
        if (Array.isArray(f.risks) && f.risks.length > 0) {
            const topRisks = f.risks.slice(0, 5).map((rk: any, i: number) => {
                const risk = typeof rk === 'object' ? (rk.risk || rk.name || JSON.stringify(rk)) : String(rk)
                const likelihood = typeof rk === 'object' && rk.likelihood ? ` | likelihood: ${rk.likelihood}` : ''
                const impact = typeof rk === 'object' && rk.impact ? ` | impact: ${rk.impact}` : ''
                const mitigation = typeof rk === 'object' && rk.mitigation ? ` | mitigation: ${rk.mitigation}` : ''
                return `  ${i + 1}. ${risk}${likelihood}${impact}${mitigation}`
            })
            lines.push(`Top risks:\n${topRisks.join('\n')}`)
        }
        if (lines.length > 0) contextParts.push(`## Feasibility Analysis\n${lines.join('\n')}`)
    }

    // Landing — deployment URL only
    if (venture.context?.landing) {
        const l = venture.context.landing as Record<string, any>
        if (l.deploymentUrl) {
            contextParts.push(`## Landing Page\nLive URL: ${l.deploymentUrl}`)
        }
    }

    const isContinuation = history.length > 0
    const finalUserMessage = isContinuation
        ? "Continue from where you left off. Do not repeat anything already outputted. Complete the InvestorKitOutput JSON object strictly."
        : `Generate an investor-ready kit for this venture.

Venture: ${sanitizeLabel(venture.name)}

${contextParts.join('\n\n')}

Produce the complete InvestorKitOutput JSON.`

    const run = async () => {
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
        const validated = InvestorKitSchema.parse(raw)
        await onComplete(validated)
    }

    await withTimeout(withRetry(run), 180_000)
}
