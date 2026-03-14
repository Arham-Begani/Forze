import { z } from 'zod'
import {
    getProModelWithThinking,
    streamPrompt,
    extractJSON,
    withTimeout,
    withRetry,
} from '@/lib/gemini'

// ── ShadowBoard Zod Schema ───────────────────────────────────────────────────

const ShadowBoardSchema = z.object({
    survivalScore: z.number().min(1).max(100).default(50),
    verdictLabel: z.string().default('Market Ready'), // e.g. "High Risk", "Hidden Gem", "Market Ready"
    boardDialogue: z.array(
        z.object({
            role: z.string().default('The Skeptic'), // "The Skeptic", "The Evangelist", "The Alchemist"
            thought: z.string().default('Thought pending.'),
            brutalHonesty: z.string().default('Honesty pending.'),
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

## Output Structure

You must output a single JSON object with the following:
- **survivalScore**: A conservative 1-100 score on likelihood of reaching $1M ARR in 2 years.
- **verdictLabel**: A punchy 2-3 word summary.
- **boardDialogue**: Three specific "takes" from the board members.
- **strategicPivots**: 3 ways the venture *should* change to survive.
- **syntheticFeedback**: 5 quotes from hypothetical users in the target niche.

## Rules

- NEVER use corporate jargon like "deliverables" or "synergy".
- Speak like high-level Silicon Valley operators.
- The tone should be intense, intellectual, and slightly aggressive.
- Output ONLY the JSON at the very end.
- Use <think> tags for your internal persona debate before the final JSON.
`

// ── Agent Runner ──────────────────────────────────────────────────────────────

export async function runShadowBoard(
    venture: { ventureId: string; name: string; globalIdea?: string; context: Record<string, unknown> },
    onStream: (line: string) => Promise<void>,
    onComplete: (result: ShadowBoardOutput) => Promise<void>
): Promise<void> {
    const researchContext = venture.context.research ? JSON.stringify(venture.context.research, null, 2) : 'No research data available — analyze based on the venture concept.'
    const brandingContext = venture.context.branding ? JSON.stringify(venture.context.branding, null, 2) : 'No branding data available.'
    const feasibilityContext = venture.context.feasibility ? JSON.stringify(venture.context.feasibility, null, 2) : 'No feasibility data available.'

    const userMessage = `Convene the Shadow Board for the venture: "${venture.name}".

Project Vision: ${venture.globalIdea || 'N/A'}

Full Context:
Research:
${researchContext}

Branding:
${brandingContext}

Feasibility:
${feasibilityContext}

Provide the final verdict and the board dialogue. Be brutal.`

    const runAgentAction = async () => {
        const model = getProModelWithThinking(10000)
        let fullText = ''

        await streamPrompt(
            model,
            SYSTEM_PROMPT,
            userMessage,
            async (chunk) => {
                fullText += chunk
                await onStream(chunk)
            }
        )

        try {
            const raw = extractJSON(fullText)
            const validated = ShadowBoardSchema.parse(raw)
            await onComplete(validated)
        } catch (e) {
            console.error('ShadowBoard JSON Parse Error:', e)
            throw new Error('Failed to generate valid board verdict. Please try again.')
        }
    }

    await withTimeout(
        withRetry(runAgentAction),
        Number(process.env.AGENT_TIMEOUT_MS ?? 120000)
    )
}
