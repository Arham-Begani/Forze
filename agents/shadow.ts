import { z } from 'zod'
import {
    getFlashModel,
    getProModelWithThinking,
    streamPrompt,
    extractJSON,
    withTimeout,
    withRetry,
    Content,
} from '@/lib/gemini'
import { sanitize, sanitizeLabel } from '@/lib/sanitize'

// ── ShadowBoard Zod Schema ───────────────────────────────────────────────────

const ShadowBoardSchema = z.object({
    survivalScore: z.number().min(1).max(100).default(50),
    verdictLabel: z.string().default('Market Ready'), // e.g. "High Risk", "Hidden Gem", "Market Ready"
    boardDialogue: z.array(
        z.object({
            role: z.string().default('The Skeptic'), // "The Skeptic", "The Evangelist", "The Alchemist"
            thought: z.string().default('Thought pending.'),
            brutalHonesty: z.string().default('Honesty pending.'),
            moduleEvidence: z.string().default('Evidence pending.'),
            concreteFix: z.string().default('Fix pending.'),
            fixThisThisWeek: z.string().default('Weekly action pending.'),
        })
    ).default([]),
    strategicPivots: z.array(
        z.object({
            currentPath: z.string().default('Current path'),
            betterPath: z.string().default('Better path'),
            rationale: z.string().default('Rationale pending'),
        })
    ).default([]),
    syntheticFeedback: z.array(
        z.object({
            persona: z.string().default('Target User'),
            quote: z.string().default('Feedback pending.'),
            sentiment: z.enum(['positive', 'neutral', 'negative']).default('neutral'),
            criticalFlaw: z.string().default('Critical flaw pending.'),
        })
    ).default([]),
})

export type ShadowBoardOutput = z.infer<typeof ShadowBoardSchema>

// ── Edit Patch Schema (all fields optional — for surgical updates) ───────────

const ShadowBoardEditPatchSchema = z.object({
    survivalScore: z.number().min(1).max(100).optional(),
    verdictLabel: z.string().optional(),
    boardDialogue: z.array(z.object({
        role: z.string().default('The Skeptic'),
        thought: z.string().default('Thought pending.'),
        brutalHonesty: z.string().default('Honesty pending.'),
        moduleEvidence: z.string().default('Evidence pending.'),
        concreteFix: z.string().default('Fix pending.'),
        fixThisThisWeek: z.string().default('Weekly action pending.'),
    })).optional(),
    strategicPivots: z.array(z.object({
        currentPath: z.string().default('Current path'),
        betterPath: z.string().default('Better path'),
        rationale: z.string().default('Rationale pending'),
    })).optional(),
    syntheticFeedback: z.array(z.object({
        persona: z.string().default('Target User'),
        quote: z.string().default('Feedback pending.'),
        sentiment: z.enum(['positive', 'neutral', 'negative']).default('neutral'),
        criticalFlaw: z.string().default('Critical flaw pending.'),
    })).optional(),
})

type ShadowBoardEditPatch = z.infer<typeof ShadowBoardEditPatchSchema>

// ── Merge patch into existing result ─────────────────────────────────────────

function mergePatch(existing: ShadowBoardOutput, patch: ShadowBoardEditPatch): ShadowBoardOutput {
    const merged = { ...existing }

    if (patch.survivalScore !== undefined) merged.survivalScore = patch.survivalScore
    if (patch.verdictLabel !== undefined) merged.verdictLabel = patch.verdictLabel

    // Arrays replace entirely
    if (patch.boardDialogue) merged.boardDialogue = patch.boardDialogue
    if (patch.strategicPivots) merged.strategicPivots = patch.strategicPivots
    if (patch.syntheticFeedback) merged.syntheticFeedback = patch.syntheticFeedback

    return merged
}

// ── Edit System Prompt ───────────────────────────────────────────────────────

const EDIT_SYSTEM_PROMPT = `
# Shadow Board — Surgical Edit Mode

You are editing an EXISTING Shadow Board verdict. The user wants a specific change — do NOT regenerate the entire board meeting.

## Rules
1. Read the existing board data carefully
2. Identify ONLY the fields that need to change based on the user's request
3. Output a JSON patch containing ONLY the changed fields
4. Unchanged fields must be OMITTED (not copied)
5. For arrays (boardDialogue, strategicPivots, syntheticFeedback), if ANY item changes, include the entire array
6. Maintain the brutal, honest Silicon Valley tone

## Output Format
Output ONLY a JSON object with the changed fields. No markdown fences, no explanation.
Example: if the user asks to reconsider the survival score, output:
{"survivalScore": 72, "verdictLabel": "Cautious Optimism"}
`

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
# The Shadow Board — Silicon Valley Defense Team

You are the "Shadow Board" for a new venture. Your job is not to be nice. Your job is to be the brutal, honest, and hyper-intelligent council that most founders never have.

## The Board Members

1. **The Silicon Skeptic (The "No" Man)**:
   - Deeply cynical about unit economics.
   - Thinks every idea is a "feature, not a company".
   - Identifies where money will be wasted.
   
2. **The UX Evangelist (The "Why" Woman)**:
   - Obsessed with user friction and cognitive load.
   - Thinks founders over-complicate things.
   - Identifies why a user will quit within 30 seconds.

3. **The Growth Alchemist (The "Scale" Agent)**:
   - Only cares about CAC/LTV and distribution channels.
   - Thinks if you're not viral, you're dead.
   - Identifies the "dirty tricks" needed to actually acquire users.

## Your Task

1. Read the Research, Branding, and Feasibility data of the venture.
2. Simulate a high-stakes board meeting where these three personas debate the idea.
3. Be brutally honest. If the idea is bad, say it. If it's a hidden gem, tell them exactly how to polish it.
4. Generate 5 synthetic user interviews from the target demographic identified in the research.

## Output Requirements

You must output a single JSON object with EXACTLY this structure:
{
  "survivalScore": number (1-100),
  "verdictLabel": "string",
  "boardDialogue": [
    { "role": "The Skeptic" | "The Evangelist" | "The Alchemist", "thought": "string", "brutalHonesty": "string", "moduleEvidence": "string (cite exact data from research/feasibility/branding)", "concreteFix": "string (one specific, actionable fix)", "fixThisThisWeek": "string (what to do THIS WEEK to address this)" }
  ],
  "strategicPivots": [
    { "currentPath": "string", "betterPath": "string", "rationale": "string" }
  ],
  "syntheticFeedback": [
    { "persona": "string", "quote": "string", "sentiment": "positive" | "neutral" | "negative", "criticalFlaw": "string" }
  ]
}

## Rules

- NEVER use corporate jargon like "deliverables" or "synergy".
- Speak like high-level Silicon Valley operators.
- The tone should be intense, intellectual, and slightly aggressive.
- Each board member MUST cite exact evidence from the research, branding, or feasibility data — not generic opinions.
- Each board member MUST provide one concrete, actionable fix — not "improve marketing" but "switch CTA from 'Learn More' to 'Start Free Trial' because feasibility shows 3% conversion assumption".
- Each board member MUST end with fixThisThisWeek — the single highest-leverage thing the founder should change THIS WEEK.
- Output ONLY the raw JSON at the very end. No Markdown fences around the JSON.
- Use <think> tags for your internal persona debate before the final JSON.
- Ensure sentiments are exactly "positive", "neutral", or "negative" (lowercase).
`

// ── Agent Runner ──────────────────────────────────────────────────────────────

export async function runShadowBoard(
    venture: { ventureId: string; name: string; globalIdea?: string; context: Record<string, unknown> },
    onStream: (line: string) => Promise<void>,
    onComplete: (result: ShadowBoardOutput) => Promise<void>,
    history: Content[] = []
): Promise<void> {
    // ── Edit mode detection ──
    const existingShadow = venture.context.shadowBoard as ShadowBoardOutput | null | undefined
    const isEditMode = !history.length && !!existingShadow?.verdictLabel && existingShadow.verdictLabel.length > 2

    if (isEditMode) {
        await onStream('[Edit mode] Applying surgical changes to existing Shadow Board verdict...\n')

        const existingForContext = {
            survivalScore: existingShadow!.survivalScore,
            verdictLabel: existingShadow!.verdictLabel,
            boardDialogue: existingShadow!.boardDialogue,
            strategicPivots: existingShadow!.strategicPivots,
            syntheticFeedback: existingShadow!.syntheticFeedback,
        }

        const editUserMessage = `## Edit Request\n${sanitizeLabel(venture.name)}\n\n## Current Shadow Board Data\n\`\`\`json\n${JSON.stringify(existingForContext, null, 2)}\n\`\`\`\n\nApply the requested change. Output ONLY the fields that need to change as a JSON patch.`

        const editRun = async () => {
            const model = getFlashModel()
            const fullText = await streamPrompt(model, EDIT_SYSTEM_PROMPT, editUserMessage, onStream)
            const rawPatch = extractJSON(fullText) as ShadowBoardEditPatch
            const validatedPatch = ShadowBoardEditPatchSchema.parse(rawPatch)
            const merged = mergePatch(existingShadow!, validatedPatch)
            const validated = ShadowBoardSchema.parse(merged)
            await onComplete(validated)
        }

        await withTimeout(withRetry(editRun), 180000)
        return
    }

    // ── Research: extract only strategic data the board needs ──
    let researchContext = 'No research data available — analyze based on the venture concept.'
    if (venture.context.research) {
        const r = venture.context.research as Record<string, any>
        const lines: string[] = []
        if (r.marketSummary) lines.push(`Market Summary: ${r.marketSummary}`)
        const tam = r.tam?.value || (typeof r.tam === 'string' ? r.tam : '')
        if (tam) lines.push(`TAM: ${tam}`)
        const sam = r.sam?.value || (typeof r.sam === 'string' ? r.sam : '')
        if (sam) lines.push(`SAM: ${sam}`)
        const som = r.som?.value || (typeof r.som === 'string' ? r.som : '')
        if (som) lines.push(`SOM: ${som}`)
        if (Array.isArray(r.painPoints) && r.painPoints.length > 0) {
            const pains = r.painPoints.slice(0, 5).map((p: any, i: number) => {
                const desc = typeof p === 'object' ? (p.description || p.name || String(p)) : String(p)
                return `  ${i + 1}. ${desc}`
            })
            lines.push(`Key Pain Points:\n${pains.join('\n')}`)
        }
        if (Array.isArray(r.competitors) && r.competitors.length > 0) {
            const comps = r.competitors.slice(0, 3).map((c: any) => {
                const name = typeof c === 'object' ? (c.name || String(c)) : String(c)
                const weakness = typeof c === 'object' ? (c.weakness || c.gap || '') : ''
                return `  - ${name}${weakness ? ` (weakness: ${weakness})` : ''}`
            })
            lines.push(`Top Competitors:\n${comps.join('\n')}`)
        }
        if (r.competitorGap) lines.push(`Competitor Gap: ${r.competitorGap}`)
        if (r.recommendedConcept) {
            const rc = typeof r.recommendedConcept === 'object'
                ? (r.recommendedConcept.name || r.recommendedConcept.concept || String(r.recommendedConcept))
                : String(r.recommendedConcept)
            lines.push(`Recommended Concept: ${rc}`)
        }
        researchContext = lines.length > 0 ? lines.join('\n') : 'Research data present but no key fields found.'
    }

    // ── Branding: extract identity essentials only ──
    let brandingContext = 'No branding data available.'
    if (venture.context.branding) {
        const b = venture.context.branding as Record<string, any>
        const lines: string[] = []
        if (b.brandName) lines.push(`Brand Name: ${b.brandName}`)
        if (b.tagline) lines.push(`Tagline: "${b.tagline}"`)
        if (b.brandArchetype) lines.push(`Brand Archetype: ${b.brandArchetype}`)
        if (b.toneOfVoice) {
            const tone = typeof b.toneOfVoice === 'object' ? (b.toneOfVoice.description || b.toneOfVoice.name || String(b.toneOfVoice)) : String(b.toneOfVoice)
            lines.push(`Tone of Voice: ${tone}`)
        }
        brandingContext = lines.length > 0 ? lines.join('\n') : 'Branding data present but no key fields found.'
    }

    // ── Feasibility: extract verdict, financials, and top risks ──
    let feasibilityContext = 'No feasibility data available.'
    if (venture.context.feasibility) {
        const f = venture.context.feasibility as Record<string, any>
        const lines: string[] = []
        if (f.verdict) lines.push(`Verdict: ${f.verdict}`)
        if (f.verdictRationale) lines.push(`Rationale: ${f.verdictRationale}`)
        if (f.marketTimingScore != null) lines.push(`Market Timing Score: ${f.marketTimingScore}`)
        if (f.marketTimingRationale) lines.push(`Market Timing: ${f.marketTimingRationale}`)
        const fm = f.financialModel
        if (fm) {
            const y1 = fm.yearOne
            if (y1) {
                const rev = y1.revenue ?? y1.projectedRevenue ?? 'N/A'
                const costs = y1.costs ?? y1.totalCosts ?? 'N/A'
                const net = y1.netIncome ?? y1.profit ?? 'N/A'
                lines.push(`Year 1 Financials: Revenue=${rev}, Costs=${costs}, Net Income=${net}`)
            }
            if (fm.breakEvenMonth != null) lines.push(`Break-Even Month: ${fm.breakEvenMonth}`)
            if (fm.ltvCacRatio != null) lines.push(`LTV/CAC Ratio: ${fm.ltvCacRatio}`)
        }
        if (Array.isArray(f.risks) && f.risks.length > 0) {
            const topRisks = f.risks.slice(0, 3).map((rk: any, i: number) => {
                const risk = typeof rk === 'object' ? (rk.risk || rk.name || String(rk)) : String(rk)
                const likelihood = typeof rk === 'object' ? (rk.likelihood || '') : ''
                const impact = typeof rk === 'object' ? (rk.impact || '') : ''
                const mitigation = typeof rk === 'object' ? (rk.mitigation || '') : ''
                return `  ${i + 1}. ${risk}${likelihood ? ` | Likelihood: ${likelihood}` : ''}${impact ? ` | Impact: ${impact}` : ''}${mitigation ? ` | Mitigation: ${mitigation}` : ''}`
            })
            lines.push(`Top Risks:\n${topRisks.join('\n')}`)
        }
        if (f.competitiveMoat) lines.push(`Competitive Moat: ${f.competitiveMoat}`)
        feasibilityContext = lines.length > 0 ? lines.join('\n') : 'Feasibility data present but no key fields found.'
    }

    const userMessage = `Convene the Shadow Board for the venture: "${sanitizeLabel(venture.name)}".

Project Vision: ${venture.globalIdea ? sanitize(venture.globalIdea, 6000) : 'N/A'}

Full Context:
Research:
${researchContext}

Branding:
${brandingContext}

Feasibility:
${feasibilityContext}

Provide the final verdict and the board dialogue. Be brutal.`

    const isContinuation = history.length > 0
    const finalUserMessage = isContinuation
        ? "Continue from where you left off. Do not repeat anything already outputted. Complete the ShadowBoard output JSON strictly."
        : userMessage

    const runAgentAction = async () => {
        const model = getProModelWithThinking(10000)
        const responseText = await streamPrompt(
            model,
            SYSTEM_PROMPT,
            finalUserMessage,
            onStream,
            history
        )

        try {
            // Combine previous partial output with new response if continuing
            const partialOutput = (history.find(h => h.role === 'model')?.parts[0] as any)?.text || ''
            const combinedText = isContinuation ? partialOutput + responseText : responseText
            
            const raw = extractJSON(combinedText)
            const validated = ShadowBoardSchema.parse(raw || {})
            await onComplete(validated)
        } catch (e) {
            console.error('ShadowBoard JSON Parse Error:', e)
            throw new Error(`Failed to generate valid board verdict: ${e instanceof Error ? e.message : String(e)}`)
        }
    }

    // Wrap withRetry around withTimeout so each attempt has its own timeout window
    await withRetry(
        () => withTimeout(
            runAgentAction(),
            180000 // 180s timeout specifically for Shadow Board
        ),
        1 // 1 retry = 2 attempts total
    )
}
