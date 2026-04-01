import { z } from 'zod'
import {
    getFlashModel,
    streamPrompt,
    extractJSON,
    withTimeout,
    withRetry,
    Content,
} from '@/lib/gemini'
import { sanitize, sanitizeLabel } from '@/lib/sanitize'

// ── MVP Scalpel Output Schema ───────────────────────────────────────────────

export const MVPScalpelSchema = z.object({
    killList: z.array(z.object({
        feature: z.string().default('Feature name'),
        whyItFeelsEssential: z.string().default('Seems important because...'),
        whyItKills: z.string().default('Wastes time because...'),
        whenToBuild: z.string().default('After first 50 paying customers'),
        effort: z.enum(['days', 'weeks', 'months']).default('weeks'),
    })).default([]),

    skeletonMVP: z.object({
        oneLiner: z.string().default('A minimal product that tests one core assumption.'),
        coreHypothesis: z.string().default('Users will pay for X because Y.'),
        features: z.array(z.object({
            name: z.string().default('Core Feature'),
            description: z.string().default('Description pending.'),
            whyIncluded: z.string().default('Directly tests the core hypothesis.'),
        })).default([]),
        explicitlyExcluded: z.array(z.string()).default([]),
        successCriteria: z.string().default('10 paying customers in 14 days.'),
    }).default({
        oneLiner: 'A minimal product that tests one core assumption.',
        coreHypothesis: 'Users will pay for X because Y.',
        features: [],
        explicitlyExcluded: [],
        successCriteria: '10 paying customers in 14 days.',
    }),

    weekendSpec: z.object({
        totalHours: z.number().default(16),
        techStack: z.array(z.string()).default([]),
        pages: z.array(z.object({
            name: z.string().default('Page'),
            purpose: z.string().default('Purpose pending.'),
            components: z.array(z.string()).default([]),
        })).default([]),
        endpoints: z.array(z.object({
            method: z.string().default('GET'),
            path: z.string().default('/api/endpoint'),
            purpose: z.string().default('Purpose pending.'),
        })).default([]),
        thirdPartyServices: z.array(z.object({
            name: z.string().default('Service'),
            purpose: z.string().default('Purpose pending.'),
            cost: z.string().default('Free tier'),
        })).default([]),
        hourByHourPlan: z.array(z.object({
            hour: z.string().default('Hour 1'),
            task: z.string().default('Task pending.'),
            deliverable: z.string().default('Deliverable pending.'),
        })).default([]),
        deployTarget: z.string().default('Vercel'),
        launchReady: z.string().default('Live URL with working core flow.'),
    }).default({
        totalHours: 16,
        techStack: [],
        pages: [],
        endpoints: [],
        thirdPartyServices: [],
        hourByHourPlan: [],
        deployTarget: 'Vercel',
        launchReady: 'Live URL with working core flow.',
    }),

    timeToFirstDollar: z.object({
        estimatedDays: z.number().default(14),
        breakdown: z.array(z.object({
            phase: z.string().default('Phase'),
            days: z.number().default(1),
            description: z.string().default('Description pending.'),
        })).default([]),
        assumptions: z.array(z.string()).default([]),
        fastestPath: z.string().default('Pre-sell via Gumroad before building anything.'),
    }).default({
        estimatedDays: 14,
        breakdown: [],
        assumptions: [],
        fastestPath: 'Pre-sell via Gumroad before building anything.',
    }),

    antiScopeCreepRules: z.array(z.object({
        rule: z.string().default('Rule pending.'),
        why: z.string().default('Reason pending.'),
    })).default([]),

    verdict: z.object({
        readiness: z.enum(['ship-now', 'almost-ready', 'needs-rethink']).default('almost-ready'),
        summary: z.string().default('Verdict summary pending.'),
    }).default({
        readiness: 'almost-ready',
        summary: 'Verdict summary pending.',
    }),
})

export type MVPScalpelOutput = z.infer<typeof MVPScalpelSchema>

// ── Edit Patch Schema (all fields optional — for surgical updates) ───────────

const MVPScalpelEditPatchSchema = z.object({
    killList: z.array(z.object({
        feature: z.string().default('Feature name'),
        whyItFeelsEssential: z.string().default('Seems important because...'),
        whyItKills: z.string().default('Wastes time because...'),
        whenToBuild: z.string().default('After first 50 paying customers'),
        effort: z.enum(['days', 'weeks', 'months']).default('weeks'),
    })).optional(),
    skeletonMVP: z.object({
        oneLiner: z.string().optional(),
        coreHypothesis: z.string().optional(),
        features: z.array(z.object({
            name: z.string().default('Core Feature'),
            description: z.string().default('Description pending.'),
            whyIncluded: z.string().default('Directly tests the core hypothesis.'),
        })).optional(),
        explicitlyExcluded: z.array(z.string()).optional(),
        successCriteria: z.string().optional(),
    }).optional(),
    weekendSpec: z.object({
        totalHours: z.number().optional(),
        techStack: z.array(z.string()).optional(),
        pages: z.array(z.object({
            name: z.string().default('Page'),
            purpose: z.string().default('Purpose pending.'),
            components: z.array(z.string()).default([]),
        })).optional(),
        endpoints: z.array(z.object({
            method: z.string().default('GET'),
            path: z.string().default('/api/endpoint'),
            purpose: z.string().default('Purpose pending.'),
        })).optional(),
        thirdPartyServices: z.array(z.object({
            name: z.string().default('Service'),
            purpose: z.string().default('Purpose pending.'),
            cost: z.string().default('Free tier'),
        })).optional(),
        hourByHourPlan: z.array(z.object({
            hour: z.string().default('Hour 1'),
            task: z.string().default('Task pending.'),
            deliverable: z.string().default('Deliverable pending.'),
        })).optional(),
        deployTarget: z.string().optional(),
        launchReady: z.string().optional(),
    }).optional(),
    timeToFirstDollar: z.object({
        estimatedDays: z.number().optional(),
        breakdown: z.array(z.object({
            phase: z.string().default('Phase'),
            days: z.number().default(1),
            description: z.string().default('Description pending.'),
        })).optional(),
        assumptions: z.array(z.string()).optional(),
        fastestPath: z.string().optional(),
    }).optional(),
    antiScopeCreepRules: z.array(z.object({
        rule: z.string().default('Rule pending.'),
        why: z.string().default('Reason pending.'),
    })).optional(),
    verdict: z.object({
        readiness: z.enum(['ship-now', 'almost-ready', 'needs-rethink']).optional(),
        summary: z.string().optional(),
    }).optional(),
})

type MVPScalpelEditPatch = z.infer<typeof MVPScalpelEditPatchSchema>

// ── Merge patch into existing result ─────────────────────────────────────────

function mergePatch(existing: MVPScalpelOutput, patch: MVPScalpelEditPatch): MVPScalpelOutput {
    const merged = { ...existing }

    // Arrays replace entirely
    if (patch.killList) merged.killList = patch.killList
    if (patch.antiScopeCreepRules) merged.antiScopeCreepRules = patch.antiScopeCreepRules

    // Nested objects merge at sub-field level
    if (patch.skeletonMVP) {
        merged.skeletonMVP = { ...existing.skeletonMVP }
        if (patch.skeletonMVP.oneLiner !== undefined) merged.skeletonMVP.oneLiner = patch.skeletonMVP.oneLiner
        if (patch.skeletonMVP.coreHypothesis !== undefined) merged.skeletonMVP.coreHypothesis = patch.skeletonMVP.coreHypothesis
        if (patch.skeletonMVP.successCriteria !== undefined) merged.skeletonMVP.successCriteria = patch.skeletonMVP.successCriteria
        if (patch.skeletonMVP.features) merged.skeletonMVP.features = patch.skeletonMVP.features
        if (patch.skeletonMVP.explicitlyExcluded) merged.skeletonMVP.explicitlyExcluded = patch.skeletonMVP.explicitlyExcluded
    }

    if (patch.weekendSpec) {
        merged.weekendSpec = { ...existing.weekendSpec }
        if (patch.weekendSpec.totalHours !== undefined) merged.weekendSpec.totalHours = patch.weekendSpec.totalHours
        if (patch.weekendSpec.deployTarget !== undefined) merged.weekendSpec.deployTarget = patch.weekendSpec.deployTarget
        if (patch.weekendSpec.launchReady !== undefined) merged.weekendSpec.launchReady = patch.weekendSpec.launchReady
        if (patch.weekendSpec.techStack) merged.weekendSpec.techStack = patch.weekendSpec.techStack
        if (patch.weekendSpec.pages) merged.weekendSpec.pages = patch.weekendSpec.pages
        if (patch.weekendSpec.endpoints) merged.weekendSpec.endpoints = patch.weekendSpec.endpoints
        if (patch.weekendSpec.thirdPartyServices) merged.weekendSpec.thirdPartyServices = patch.weekendSpec.thirdPartyServices
        if (patch.weekendSpec.hourByHourPlan) merged.weekendSpec.hourByHourPlan = patch.weekendSpec.hourByHourPlan
    }

    if (patch.timeToFirstDollar) {
        merged.timeToFirstDollar = { ...existing.timeToFirstDollar }
        if (patch.timeToFirstDollar.estimatedDays !== undefined) merged.timeToFirstDollar.estimatedDays = patch.timeToFirstDollar.estimatedDays
        if (patch.timeToFirstDollar.fastestPath !== undefined) merged.timeToFirstDollar.fastestPath = patch.timeToFirstDollar.fastestPath
        if (patch.timeToFirstDollar.breakdown) merged.timeToFirstDollar.breakdown = patch.timeToFirstDollar.breakdown
        if (patch.timeToFirstDollar.assumptions) merged.timeToFirstDollar.assumptions = patch.timeToFirstDollar.assumptions
    }

    if (patch.verdict) {
        merged.verdict = { ...existing.verdict }
        if (patch.verdict.readiness !== undefined) merged.verdict.readiness = patch.verdict.readiness
        if (patch.verdict.summary !== undefined) merged.verdict.summary = patch.verdict.summary
    }

    return merged
}

// ── Edit System Prompt ───────────────────────────────────────────────────────

const EDIT_SYSTEM_PROMPT = `
# MVP Scalpel — Surgical Edit Mode

You are editing an EXISTING MVP scalpel output. The user wants a specific change — do NOT regenerate everything.

## Rules
1. Read the existing MVP data carefully
2. Identify ONLY the fields that need to change based on the user's request
3. Output a JSON patch containing ONLY the changed fields
4. Unchanged fields must be OMITTED (not copied)
5. For nested objects (skeletonMVP, weekendSpec, timeToFirstDollar, verdict), include only changed sub-fields
6. For arrays (killList, antiScopeCreepRules), if ANY item changes, include the entire array
7. Maintain the brutally specific, YC-caliber tone — no generic advice

## Output Format
Output ONLY a JSON object with the changed fields. No markdown fences, no explanation.
Example: if the user asks to change the tech stack, output:
{"weekendSpec": {"techStack": ["Next.js 15", "Supabase", "Stripe", "Tailwind CSS"]}}
`

// ── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
# MVP Scalpel — Revenue-First Validator

You are a YC-caliber startup advisor with 15 years of experience. You have helped 300+ founders get their first paying customer. You are obsessively specific. You name tools. You write actual scripts. You give exact commands. You never say "relevant communities" — you name the actual subreddits, Slack groups, and LinkedIn hashtags. You never say "set up your tech stack" — you write the exact terminal commands.

## Your North Star

THE ONLY GOAL: Money in the founder's bank account within 14 days.
Not signups. Not waitlist emails. Not "interest." Real payments from real people.

## Non-Negotiable Output Rules

### 1. USE THE ACTUAL VENTURE DATA
You have been given research findings, competitor names, pain points, and feasibility data. You MUST use all of it.
- Never write "your product" — use the actual brand name from context
- Never write "your competitors" — name them by name (e.g., "Notion's weakness is X, Airtable's weakness is Y")
- Never write "relevant pain points" — quote the actual pain points from context
- If feasibility verdict is provided, reference it explicitly in your verdict and skeleton MVP

### 2. KILL LIST — Be Surgically Specific
BAD: "Don't build analytics."
GOOD: "Don't build a real-time activity heatmap dashboard. That's 2-3 weeks and your first 10 customers will tell you what they actually need to see."

BAD: "Don't build social sharing."
GOOD: "Don't build the 'Share to Twitter/LinkedIn' button with auto-generated preview cards. It feels like growth hacking but it's 3 days of work and your first customers haven't even used the product yet."

### 3. WEEKEND SPEC — Real Commands, Real Tools
BAD: "Hour 1: Set up your project."
GOOD: "Hour 1: Run \`npx create-next-app@latest mvp --typescript --tailwind --app --src-dir\`. Push to GitHub. Connect to Vercel. Live URL in 15 minutes."

BAD: "Add payments."
GOOD: "Hour 4: \`npm install stripe @stripe/stripe-js\`. Create Stripe product at dashboard.stripe.com/products. Set price at $X/month. Paste price_ID into env. Done."

Name EXACT tools with EXACT pricing:
- Auth: Supabase Auth (free up to 50k users) OR Clerk ($25/mo for 1k MAU) OR skip auth entirely
- Payments: Stripe (2.9% + 30¢/transaction) OR Gumroad (10% fee, zero setup)
- DB: Supabase Postgres (free 500MB) OR PlanetScale (free 5GB)
- Email: Resend (free 100/day) OR Loops (free 2k contacts)
- Forms: Typeform (free 10 responses/month) OR Tally (free unlimited)
- Hosting: Vercel (free hobby tier) OR Railway ($5/mo)

### 4. TIME TO FIRST DOLLAR — Write the Actual Script
The fastestPath field MUST include the exact outreach message the founder should copy-paste.

Example format:
"Post in r/[subreddit] with title: '[Exact title]' and body: '[First 2 sentences]'. DM everyone who upvotes with: 'Hey [name], saw you upvoted my post about [X]. I'm validating whether founders want [Y]. Would you pay $Z/month for it? Here's a 2-min Loom of what I have: [link]'"

If no research context: name the most likely communities based on the venture concept.

### 5. ANTI-SCOPE-CREEP RULES — Enforce with Mechanisms
BAD: "Focus on the core features."
GOOD: "Any feature request goes into a Notion 'Parking Lot' doc. It ships only if 5 different paying customers requested it in the past 30 days. The doc is reviewed every Monday. Zero exceptions — including your own ideas."

BAD: "Don't over-engineer."
GOOD: "No database schema changes until you hit 25 paying customers. Export to CSV and manage in Airtable if you need it."

## Context Requirements

Study the provided venture context carefully. For EVERY section you output:
- If you know the brand name: use it
- If you know competitors: name them with their specific weaknesses
- If you know the target customer: describe them precisely (not "users" — "indie founders who have failed at consistent content marketing")
- If you know the pain points: reference the top 3 by name
- If feasibility said NO-GO: the entire MVP must be a demand test, zero product built
- If feasibility said CONDITIONAL GO: the skeleton MVP must directly test the named conditions

## Output Schema Requirements

**Kill List (5-8 features):**
- feature: The specific feature name (not category)
- whyItFeelsEssential: The psychological trap — why every founder wants this
- whyItKills: Exact cost in days + what opportunity it kills
- whenToBuild: A specific milestone trigger (paying customer count or revenue amount)
- effort: days | weeks | months

**Skeleton MVP (2-4 features MAX — if you list 5+, you failed):**
- oneLiner: One sentence a 12-year-old understands
- coreHypothesis: "If [specific target customer] [does specific action], they will pay $[amount] because [specific reason from research pain points]"
- features: Max 4, each must directly test the hypothesis
- explicitlyExcluded: At least 8 specific things NOT in the MVP with one-line reason each
- successCriteria: "X paying customers at $Y within Z days" — real numbers

**Weekend Spec (must be ≤ 20 hours total):**
- techStack: Exact package names, not categories
- pages: Each page with specific components listed (not "dashboard" — "single table showing X, Y, Z columns, delete button, status badge")
- endpoints: Exact method + path + what it does in one sentence
- thirdPartyServices: name + exact use + exact pricing tier
- hourByHourPlan: Real terminal commands or specific UI steps — no vague descriptions
- deployTarget: Exact platform + deploy command

**Time to First Dollar:**
- estimatedDays: Must be ≤ 21 days
- breakdown: Specific day ranges with concrete actions
- fastestPath: The full outreach script the founder can copy-paste TODAY. Include the exact post/DM/email text.
- assumptions: What must be true for this timeline to work

**Anti-Scope-Creep Rules:** Exactly 5 rules, each with an enforcement mechanism.

**Verdict:**
- readiness: ship-now | almost-ready | needs-rethink
- summary: "In [X] days, [brand name] founder should have [specific outcome] by doing [specific approach]. The single riskiest assumption is [assumption]. If this assumption is wrong, [consequence]."

Output ONLY valid JSON. Any reasoning MUST be inside <think></think> tags. Only the final JSON goes outside the tags.
`

// ── Agent Runner ────────────────────────────────────────────────────────────

interface VentureInput {
    ventureId: string
    name: string
    globalIdea?: string
    context: Record<string, unknown>
}

export async function runMVPScalpelAgent(
    venture: VentureInput,
    onStream: (chunk: string) => Promise<void>,
    onComplete: (result: MVPScalpelOutput) => Promise<void>,
    history: Content[] = []
): Promise<void> {
    const model = getFlashModel()

    // ── Edit mode detection ──
    const existingMVP = venture.context.mvpScalpel as MVPScalpelOutput | null | undefined
    const isEditMode = !history.length && !!existingMVP?.verdict?.summary && existingMVP.verdict.summary.length > 20

    if (isEditMode) {
        await onStream('[Edit mode] Applying surgical changes to existing MVP scalpel output...\n')

        const existingForContext = {
            killList: existingMVP!.killList?.slice(0, 5),
            skeletonMVP: existingMVP!.skeletonMVP,
            weekendSpec: {
                totalHours: existingMVP!.weekendSpec?.totalHours,
                techStack: existingMVP!.weekendSpec?.techStack,
                pages: existingMVP!.weekendSpec?.pages,
                endpoints: existingMVP!.weekendSpec?.endpoints,
                thirdPartyServices: existingMVP!.weekendSpec?.thirdPartyServices,
                deployTarget: existingMVP!.weekendSpec?.deployTarget,
            },
            timeToFirstDollar: existingMVP!.timeToFirstDollar,
            antiScopeCreepRules: existingMVP!.antiScopeCreepRules,
            verdict: existingMVP!.verdict,
        }

        const editUserMessage = `## Edit Request\n${sanitizeLabel(venture.name)}\n\n## Current MVP Scalpel Data\n\`\`\`json\n${JSON.stringify(existingForContext, null, 2)}\n\`\`\`\n\nApply the requested change. Output ONLY the fields that need to change as a JSON patch.`

        const editRun = async () => {
            const fullText = await streamPrompt(model, EDIT_SYSTEM_PROMPT, editUserMessage, onStream)
            const rawPatch = extractJSON(fullText) as MVPScalpelEditPatch
            const validatedPatch = MVPScalpelEditPatchSchema.parse(rawPatch)
            const merged = mergePatch(existingMVP!, validatedPatch)
            const validated = MVPScalpelSchema.parse(merged)
            await onComplete(validated)
        }

        await withRetry(() => withTimeout(editRun(), 180_000))
        return
    }

    // Build context block from available venture data
    const contextParts: string[] = []

    if (venture.globalIdea) {
        contextParts.push(`Venture Vision: ${sanitize(venture.globalIdea, 1000)}`)
    }

    // Research — deep extraction for MVP scoping
    if (venture.context?.research) {
        const r = venture.context.research as Record<string, any>
        const researchLines: string[] = []

        if (r.marketSummary) researchLines.push(`MARKET OVERVIEW: ${r.marketSummary}`)

        const tam = r.tam?.value || (typeof r.tam === 'string' ? r.tam : '')
        const sam = r.sam?.value || (typeof r.sam === 'string' ? r.sam : '')
        const som = r.som?.value || (typeof r.som === 'string' ? r.som : '')
        if (tam) researchLines.push(`TAM: ${tam}${sam ? ` | SAM: ${sam}` : ''}${som ? ` | SOM: ${som}` : ''}`)

        if (r.targetAudience || r.targetCustomer || r.targetSegment) {
            researchLines.push(`TARGET CUSTOMER: ${r.targetAudience || r.targetCustomer || r.targetSegment}`)
        }

        if (r.competitorGap) researchLines.push(`MARKET GAP: ${r.competitorGap}`)
        if (r.recommendedConcept) {
            const rc = typeof r.recommendedConcept === 'object'
                ? (r.recommendedConcept.name || JSON.stringify(r.recommendedConcept))
                : r.recommendedConcept
            researchLines.push(`RECOMMENDED CONCEPT: ${rc}`)
        }

        if (Array.isArray(r.painPoints) && r.painPoints.length > 0) {
            const pains = r.painPoints.slice(0, 5).map((p: any, i: number) => {
                const desc = typeof p === 'object' ? (p.description || p.name || p.pain || JSON.stringify(p)) : String(p)
                return `  ${i + 1}. ${desc}`
            })
            researchLines.push(`PAIN POINTS (most important — use #1 in your skeleton MVP hypothesis):\n${pains.join('\n')}`)
        }

        if (Array.isArray(r.competitors) && r.competitors.length > 0) {
            const comps = r.competitors.slice(0, 6).map((c: any) => {
                const name = typeof c === 'object' ? (c.name || JSON.stringify(c)) : String(c)
                const weakness = typeof c === 'object' ? (c.weakness || c.gap || c.limitation || '') : ''
                const pricing = typeof c === 'object' ? (c.pricing || c.price || '') : ''
                return `  - ${name}${weakness ? `: weakness = "${weakness}"` : ''}${pricing ? ` | pricing: ${pricing}` : ''}`
            })
            researchLines.push(`COMPETITORS (reference by name in kill list and skeleton MVP):\n${comps.join('\n')}`)
        }

        if (Array.isArray(r.topConcepts) && r.topConcepts.length > 0) {
            const concepts = r.topConcepts.slice(0, 3).map((c: any) => {
                const name = typeof c === 'object' ? (c.name || '') : String(c)
                const score = typeof c === 'object' ? (c.opportunityScore || c.score || '') : ''
                const rationale = typeof c === 'object' ? (c.rationale || c.description || '') : ''
                return `  - ${name}${score ? ` (score: ${score}/10)` : ''}${rationale ? `: ${rationale}` : ''}`
            })
            researchLines.push(`TOP CONCEPTS FROM RESEARCH:\n${concepts.join('\n')}`)
        }

        contextParts.push(`## Market Research\n${researchLines.join('\n')}`)
    }

    // Branding — for product naming and positioning
    if (venture.context?.branding) {
        const b = venture.context.branding as Record<string, any>
        const brandLines: string[] = []
        if (b.brandName) brandLines.push(`BRAND NAME: ${b.brandName} (use this name throughout your output, never "your product")`)
        if (b.tagline) brandLines.push(`TAGLINE: "${b.tagline}"`)
        if (b.missionStatement) brandLines.push(`MISSION: ${b.missionStatement}`)
        if (b.brandArchetype) brandLines.push(`ARCHETYPE: ${b.brandArchetype}`)
        if (b.targetPersona || b.idealCustomer) brandLines.push(`IDEAL CUSTOMER: ${b.targetPersona || b.idealCustomer}`)
        if (Array.isArray(b.brandPersonality) && b.brandPersonality.length > 0) {
            brandLines.push(`BRAND PERSONALITY: ${b.brandPersonality.join(', ')}`)
        }
        contextParts.push(`## Brand Identity\n${brandLines.join('\n')}`)
    }

    // Feasibility — most important for MVP scope decision
    if (venture.context?.feasibility) {
        const f = venture.context.feasibility as Record<string, any>
        const feasLines: string[] = []
        if (f.verdict) feasLines.push(`VERDICT: ${f.verdict}`)
        if (f.verdictRationale) feasLines.push(`RATIONALE: ${f.verdictRationale}`)
        if (f.marketTimingScore) feasLines.push(`MARKET TIMING: ${f.marketTimingScore}/10`)
        if (f.competitiveMoat) feasLines.push(`COMPETITIVE MOAT: ${f.competitiveMoat}`)
        if (f.financialModel) {
            const fm = f.financialModel
            if (fm.cac) feasLines.push(`CAC: ${fm.cac}`)
            if (fm.ltv) feasLines.push(`LTV: ${fm.ltv}`)
            if (fm.ltvCacRatio) feasLines.push(`LTV:CAC: ${fm.ltvCacRatio}`)
            if (fm.breakEvenMonth) feasLines.push(`BREAK-EVEN: Month ${fm.breakEvenMonth}`)
            if (fm.yearOne) feasLines.push(`YEAR 1 TARGET: ${fm.yearOne.revenue} revenue, ${fm.yearOne.customers} customers`)
        }
        if (Array.isArray(f.keyAssumptions) && f.keyAssumptions.length > 0) {
            feasLines.push(`KEY ASSUMPTIONS TO TEST (build the MVP around validating these):\n${f.keyAssumptions.slice(0, 5).map((a: string) => `  - ${a}`).join('\n')}`)
        }
        if (Array.isArray(f.risks) && f.risks.length > 0) {
            const highRisks = f.risks.filter((r: any) => r.likelihood === 'high').slice(0, 3)
            if (highRisks.length > 0) {
                feasLines.push(`HIGHEST RISKS:\n${highRisks.map((r: any) => `  - ${r.risk} (mitigation: ${r.mitigation})`).join('\n')}`)
            }
        }
        contextParts.push(`## Feasibility Analysis\n${feasLines.join('\n')}`)

        if (f.verdict === 'NO-GO') {
            contextParts.push(`⚠️ CRITICAL — FEASIBILITY IS NO-GO: Build NOTHING. The skeleton MVP must be a demand test only (landing page + payment link, or pre-sell via Gumroad). Zero product. The kill list should assume the founder has already over-scoped. The fastest path to first dollar must involve no code at all.`)
        } else if (f.verdict === 'CONDITIONAL GO') {
            contextParts.push(`⚠️ CONDITIONAL GO: The skeleton MVP must directly test the specific conditions from the feasibility verdict rationale above. Reference those conditions explicitly in the coreHypothesis and successCriteria.`)
        }
    }

    const isContinuation = history.length > 0
    const finalUserMessage = isContinuation
        ? "Continue from where you left off. Do not repeat anything already outputted. Complete the MVPScalpelOutput JSON object strictly."
        : `Apply the Scalpel to this venture. Be brutally specific — use every data point from the context below.

Venture: ${sanitizeLabel(venture.name)}

${contextParts.join('\n\n')}

CRITICAL INSTRUCTIONS:
1. Use the ACTUAL brand name throughout (never "your product")
2. Name ACTUAL competitors by name in the kill list reasoning
3. Reference ACTUAL pain points in the core hypothesis
4. Write an ACTUAL outreach script in timeToFirstDollar.fastestPath (copy-paste ready)
5. Use ACTUAL terminal commands in the hourByHourPlan (not descriptions of what to do)
6. Name ACTUAL tools with ACTUAL pricing tiers in thirdPartyServices
7. Make the skeleton MVP directly test assumptions from the feasibility verdict

Produce the complete MVPScalpelOutput JSON. Every field must be specific to THIS venture, not generic startup advice.`

    const run = async () => {
        const prevText = (history.find(h => h.role === 'model')?.parts[0] as any)?.text || ''
        let accumulatedText = prevText

        const responseText = await streamPrompt(
            model,
            SYSTEM_PROMPT,
            finalUserMessage,
            async (chunk) => {
                accumulatedText += chunk
                await onStream(chunk)
            },
            history
        )

        const combinedText = isContinuation ? accumulatedText : responseText
        const raw = extractJSON(combinedText)
        const validated = MVPScalpelSchema.parse(raw)
        await onComplete(validated)
    }

    await withRetry(() => withTimeout(run(), 180_000))
}
