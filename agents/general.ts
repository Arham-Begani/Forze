import {
    getFlashModel,
    streamPrompt,
    withTimeout,
    withRetry,
    Content,
} from '@/lib/gemini'

// ── General Chat Agent ──────────────────────────────────────────────────────
// A conversational agent for general venture questions — name suggestions,
// feature ideas, quick feedback, etc. Output is NOT written to venture context.

interface VentureInput {
    ventureId: string
    name: string
    globalIdea?: string
    context: Record<string, unknown>
}

const SYSTEM_PROMPT = `
# Forze AI — Founder Co-pilot

You are the founder's personal co-pilot inside Forze — their second brain. You remember every conversation in this session. You have deep knowledge of their venture through the context provided — actual data points, numbers, competitor names, financial projections, brand details. You are a sharp, opinionated co-founder who references specifics.

## Memory & Continuity
You have full memory of this conversation. When the founder asks follow-up questions, reference what you said earlier. When they say "those risks you mentioned" or "expand on that", you know exactly what they mean. You are a stateful collaborator, not a stateless chatbot.

Example: If you said "CAC is $45" in a previous turn and they ask "how do we lower that?", you say "To get your $45 CAC down, here's what I'd try first..." — never ask them to repeat context you already know.

## Your Role
- Answer questions using actual venture data (cite numbers, names, specifics)
- Brainstorm ideas grounded in the venture's real market position and history of your conversation
- Help founders think through strategy with their actual competitive landscape
- Recommend specific Forze module re-runs when relevant ("Your feasibility risks mention X — consider re-running research focused on...")
- Build on previous answers in the conversation — do not repeat yourself, extend and deepen

## How to Use Context
- Cite specific competitor names and their weaknesses from research
- Reference actual TAM/SAM/SOM figures, not vague "your market is large"
- Reference year projections, CAC, LTV, break-even month from feasibility
- Use the actual brand name, voice, and archetype from branding
- Always say "Your TAM is $4.2B" not "your market is large"
- If you don't have data on something, say so clearly — don't hallucinate numbers

## Module Awareness
You know which modules have been completed and which haven't. Proactively suggest running modules that would help:
- No research yet? Suggest running Research first
- Research done but no feasibility? Recommend a feasibility study
- Missing branding? Note that brand context would strengthen marketing decisions
- If all modules are complete, point them to Investor Kit or Launch Autopilot

## Tone
- Direct, sharp, opinionated — like a co-founder who has read every document and remembers every meeting
- No fluff or corporate speak
- Use bullet points and clear structure when listing things
- Be opinionated — founders need clear direction, not wishy-washy hedging
- Reference specific data to back up opinions, not generic advice

## Important Rules
- You do NOT generate structured JSON output
- You do NOT run formal analyses — that's what the specialized modules are for
- If a question needs deep analysis, suggest the relevant specialized module
- Keep responses focused and under 1200 words unless the user explicitly asks for more detail
- Never say "I don't have access to your previous conversations" — you DO have the full conversation history
`

// ── Deep Context Builder ──────────────────────────────────────────────────
// Extracts rich, structured data from all available venture context modules.
// Keeps total injected context under ~3000 tokens for Flash model quality.

function buildDeepContext(globalIdea: string | undefined, ctx: Record<string, unknown>): string {
    const sections: string[] = []

    if (globalIdea) {
        sections.push(`## Venture Idea\n${globalIdea}`)
    }

    // Module availability status
    const modules = ['research', 'branding', 'marketing', 'landing', 'feasibility'] as const
    const status = modules.map(m => `${m.charAt(0).toUpperCase() + m.slice(1)}: ${ctx[m] ? 'Available' : 'Not run'}`).join(' | ')
    sections.push(`## Module Status\n${status}`)

    // Research — deep extraction
    if (ctx.research) {
        const r = ctx.research as Record<string, any>
        const parts: string[] = []
        if (r.marketSummary) parts.push(`Market: ${r.marketSummary}`)
        const tam = r.tam?.value || (typeof r.tam === 'string' ? r.tam : '')
        const sam = r.sam?.value || (typeof r.sam === 'string' ? r.sam : '')
        const som = r.som?.value || (typeof r.som === 'string' ? r.som : '')
        if (tam) parts.push(`TAM: ${tam}`)
        if (sam) parts.push(`SAM: ${sam}`)
        if (som) parts.push(`SOM: ${som}`)
        if (Array.isArray(r.competitors) && r.competitors.length > 0) {
            const compList = r.competitors.slice(0, 5).map((c: any) => {
                const name = typeof c === 'object' ? (c.name || JSON.stringify(c)) : String(c)
                const weakness = typeof c === 'object' ? (c.weakness || c.threat || '') : ''
                return weakness ? `${name} (weakness: ${weakness})` : name
            }).join('; ')
            parts.push(`Top competitors: ${compList}`)
        }
        if (Array.isArray(r.painPoints) && r.painPoints.length > 0) {
            parts.push(`Pain points: ${r.painPoints.slice(0, 5).map((p: any) => typeof p === 'object' ? (p.description || p.name || JSON.stringify(p)) : String(p)).join('; ')}`)
        }
        if (r.competitorGap) parts.push(`Market gap: ${r.competitorGap}`)
        if (r.recommendedConcept) {
            const rc = typeof r.recommendedConcept === 'object' ? (r.recommendedConcept.name || JSON.stringify(r.recommendedConcept)) : r.recommendedConcept
            parts.push(`Recommended concept: ${rc}`)
        }
        sections.push(`## Research Data\n${parts.join('\n')}`)
    }

    // Branding — deep extraction
    if (ctx.branding) {
        const b = ctx.branding as Record<string, any>
        const parts: string[] = []
        if (b.brandName) parts.push(`Brand name: ${b.brandName}`)
        if (b.tagline) parts.push(`Tagline: ${b.tagline}`)
        if (b.brandArchetype) parts.push(`Archetype: ${b.brandArchetype}`)
        if (b.brandPersonality) parts.push(`Personality: ${b.brandPersonality}`)
        if (b.toneOfVoice || b.brandVoice) parts.push(`Tone: ${b.toneOfVoice || b.brandVoice}`)
        if (b.missionStatement) parts.push(`Mission: ${b.missionStatement}`)
        if (Array.isArray(b.colorPalette) && b.colorPalette.length > 0) {
            const colors = b.colorPalette.slice(0, 5).map((c: any) => {
                if (typeof c === 'string') return c
                return c.hex || c.code || c.name || JSON.stringify(c)
            }).join(', ')
            parts.push(`Colors: ${colors}`)
        }
        sections.push(`## Brand Identity\n${parts.join('\n')}`)
    }

    // Marketing — summary extraction
    if (ctx.marketing) {
        const m = ctx.marketing as Record<string, any>
        const parts: string[] = []
        const gtm = m.gtmStrategy || m
        if (gtm.overview) parts.push(`GTM overview: ${gtm.overview}`)
        if (Array.isArray(m.socialCalendar)) parts.push(`Social posts: ${m.socialCalendar.length} posts planned`)
        if (Array.isArray(m.seoOutlines)) {
            const titles = m.seoOutlines.slice(0, 3).map((o: any) => typeof o === 'object' ? (o.title || o.topic) : String(o)).join(', ')
            parts.push(`SEO articles: ${titles}`)
        }
        if (Array.isArray(m.emailSequence)) {
            const subjects = m.emailSequence.slice(0, 3).map((e: any) => typeof e === 'object' ? (e.subject || e.title) : String(e)).join(', ')
            parts.push(`Email sequence: ${subjects}`)
        }
        const channels = gtm.channels || m.channels
        if (Array.isArray(channels)) {
            parts.push(`Channels: ${channels.slice(0, 5).map((c: any) => typeof c === 'object' ? (c.name || JSON.stringify(c)) : String(c)).join(', ')}`)
        }
        sections.push(`## Marketing Strategy\n${parts.join('\n')}`)
    }

    // Feasibility — deep extraction
    if (ctx.feasibility) {
        const f = ctx.feasibility as Record<string, any>
        const parts: string[] = []
        if (f.verdict) parts.push(`Verdict: ${f.verdict}`)
        if (f.verdictRationale) parts.push(`Rationale: ${f.verdictRationale}`)
        if (f.marketTimingScore) parts.push(`Market timing: ${f.marketTimingScore}/10`)
        if (f.financialModel) {
            const fm = f.financialModel
            if (fm.yearOne) parts.push(`Year 1: Revenue ${fm.yearOne.revenue}, Costs ${fm.yearOne.costs}, Net ${fm.yearOne.netIncome}, Customers ${fm.yearOne.customers}`)
            if (fm.yearTwo) parts.push(`Year 2: Revenue ${fm.yearTwo.revenue}, Net ${fm.yearTwo.netIncome}`)
            if (fm.yearThree) parts.push(`Year 3: Revenue ${fm.yearThree.revenue}, Net ${fm.yearThree.netIncome}`)
            if (fm.cac) parts.push(`CAC: ${fm.cac}`)
            if (fm.ltv) parts.push(`LTV: ${fm.ltv}`)
            if (fm.ltvCacRatio) parts.push(`LTV:CAC: ${fm.ltvCacRatio}`)
            if (fm.breakEvenMonth) parts.push(`Break-even: Month ${fm.breakEvenMonth}`)
        }
        if (Array.isArray(f.risks) && f.risks.length > 0) {
            const topRisks = f.risks.slice(0, 5).map((r: any) => `${r.risk} (${r.likelihood}/${r.impact}, mitigation: ${r.mitigation})`).join('; ')
            parts.push(`Top risks: ${topRisks}`)
        }
        if (f.competitiveMoat) parts.push(`Moat: ${f.competitiveMoat}`)
        if (Array.isArray(f.keyAssumptions) && f.keyAssumptions.length > 0) {
            parts.push(`Key assumptions: ${f.keyAssumptions.slice(0, 5).join('; ')}`)
        }
        sections.push(`## Feasibility Analysis\n${parts.join('\n')}`)
    }

    // Landing — brief extraction
    if (ctx.landing) {
        const l = ctx.landing as Record<string, any>
        const parts: string[] = []
        if (l.deploymentUrl) parts.push(`Live URL: ${l.deploymentUrl}`)
        const copy = l.landingPageCopy || l.copy || {}
        if (copy.hero?.headline) parts.push(`Hero: ${copy.hero.headline}`)
        if (Array.isArray(copy.pricing) && copy.pricing.length > 0) {
            const tiers = copy.pricing.map((p: any) => typeof p === 'object' ? (p.name || p.tier || '') : String(p)).join(', ')
            parts.push(`Pricing tiers: ${tiers}`)
        }
        sections.push(`## Landing Page\n${parts.join('\n')}`)
    }

    if (sections.length === 0) return ''
    return `\n\n${sections.join('\n\n')}`
}

export async function runGeneralAgent(
    venture: VentureInput,
    onStream: (chunk: string) => Promise<void>,
    onComplete: (result: Record<string, unknown>) => Promise<void>,
    history: Content[] = [],
    isResumeContinuation: boolean = false
): Promise<void> {
    const model = getFlashModel()

    const ctx = venture.context || {}
    const contextBlock = buildDeepContext(venture.globalIdea, ctx)

    let finalUserMessage: string

    if (isResumeContinuation) {
        // User clicked "Continue" to resume a truncated response
        finalUserMessage = 'Continue from where you left off. Do not repeat anything already said. Complete your response naturally.'
    } else if (history.length > 0) {
        // Multi-turn conversation — context was already injected in the first turn
        // Just send the current question/prompt (venture.name contains "Venture: prompt")
        finalUserMessage = venture.name
    } else {
        // First message in this conversation — inject full venture context
        finalUserMessage = `${venture.name}${contextBlock}`
    }

    const run = async () => {
        return await streamPrompt(model, SYSTEM_PROMPT, finalUserMessage, onStream, history)
    }

    const fullText = await withRetry(() => withTimeout(run(), 120_000))

    // General chat stores the response as plain text — no structured JSON
    await onComplete({
        type: 'general-chat',
        response: fullText,
    })
}
