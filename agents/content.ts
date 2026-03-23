// Content Factory Agent

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

// ── ContentOutput Zod Schema ────────────────────────────────────────────────

const ContentOutputSchema = z.object({
    marketingPlan: z.string().default('# Marketing Plan\n\nFull marketing documentation pending.'),
    gtmStrategy: z.object({
        overview: z.string().default('GTM overview pending.'),
        weeks: z.array(
            z.object({
                week: z.number(),
                theme: z.string().default('Theme pending'),
                actions: z.array(z.string()).default([]),
                kpis: z.array(z.string()).default([]),
            })
        ).default([]),
    }).default({
        overview: 'GTM overview pending.',
        weeks: []
    }),
    socialCalendar: z.array(
        z.object({
            day: z.number(),
            platform: z.enum(['x', 'linkedin', 'instagram']).default('x'),
            caption: z.string().default('Caption pending.'),
            hashtags: z.array(z.string()).default([]),
            postType: z.string().default('Social post'),
        })
    ).default([]),
    seoOutlines: z.array(
        z.object({
            title: z.string(),
            targetKeyword: z.string().default('Keyword pending'),
            searchIntent: z.string().default('Informational'),
            outline: z.array(z.string()).default([]),
            estimatedTraffic: z.string().default('Low'),
        })
    ).default([]),
    emailSequence: z.array(
        z.object({
            day: z.number(),
            subject: z.string().default('Subject pending'),
            preview: z.string().default('Preview pending'),
            bodyOutline: z.array(z.string()).default([]),
        })
    ).default([]),
    hashtagStrategy: z.object({
        x: z.array(z.string()).default([]),
        linkedin: z.array(z.string()).default([]),
        instagram: z.array(z.string()).default([]),
    }).default({
        x: [],
        linkedin: [],
        instagram: []
    }),
})

export type ContentOutput = z.infer<typeof ContentOutputSchema>

// ── Edit Patch Schema (all fields optional — for surgical updates) ───────────

const ContentEditPatchSchema = z.object({
    marketingPlan: z.string().optional(),
    gtmStrategy: z.object({
        overview: z.string().optional(),
        weeks: z.array(z.object({
            week: z.number(),
            theme: z.string().default('Theme pending'),
            actions: z.array(z.string()).default([]),
            kpis: z.array(z.string()).default([]),
        })).optional(),
    }).optional(),
    socialCalendar: z.array(z.object({
        day: z.number(),
        platform: z.enum(['x', 'linkedin', 'instagram']).default('x'),
        caption: z.string().default('Caption pending.'),
        hashtags: z.array(z.string()).default([]),
        postType: z.string().default('Social post'),
    })).optional(),
    seoOutlines: z.array(z.object({
        title: z.string(),
        targetKeyword: z.string().default('Keyword pending'),
        searchIntent: z.string().default('Informational'),
        outline: z.array(z.string()).default([]),
        estimatedTraffic: z.string().default('Low'),
    })).optional(),
    emailSequence: z.array(z.object({
        day: z.number(),
        subject: z.string().default('Subject pending'),
        preview: z.string().default('Preview pending'),
        bodyOutline: z.array(z.string()).default([]),
    })).optional(),
    hashtagStrategy: z.object({
        x: z.array(z.string()).optional(),
        linkedin: z.array(z.string()).optional(),
        instagram: z.array(z.string()).optional(),
    }).optional(),
})

type ContentEditPatch = z.infer<typeof ContentEditPatchSchema>

// ── Merge patch into existing result ─────────────────────────────────────────

function mergePatch(existing: ContentOutput, patch: ContentEditPatch): ContentOutput {
    const merged = { ...existing }

    if (patch.marketingPlan !== undefined) merged.marketingPlan = patch.marketingPlan

    if (patch.gtmStrategy) {
        merged.gtmStrategy = { ...existing.gtmStrategy }
        if (patch.gtmStrategy.overview !== undefined) merged.gtmStrategy.overview = patch.gtmStrategy.overview
        if (patch.gtmStrategy.weeks) merged.gtmStrategy.weeks = patch.gtmStrategy.weeks
    }

    // Arrays replace entirely
    if (patch.socialCalendar) merged.socialCalendar = patch.socialCalendar
    if (patch.seoOutlines) merged.seoOutlines = patch.seoOutlines
    if (patch.emailSequence) merged.emailSequence = patch.emailSequence

    if (patch.hashtagStrategy) {
        merged.hashtagStrategy = { ...existing.hashtagStrategy }
        if (patch.hashtagStrategy.x) merged.hashtagStrategy.x = patch.hashtagStrategy.x
        if (patch.hashtagStrategy.linkedin) merged.hashtagStrategy.linkedin = patch.hashtagStrategy.linkedin
        if (patch.hashtagStrategy.instagram) merged.hashtagStrategy.instagram = patch.hashtagStrategy.instagram
    }

    return merged
}

// ── Edit System Prompt ───────────────────────────────────────────────────────

const EDIT_SYSTEM_PROMPT = `
# Content Factory — Surgical Edit Mode

You are editing an EXISTING marketing output. The user wants a specific change — do NOT regenerate everything.

## Rules
1. Read the existing marketing data carefully
2. Identify ONLY the fields that need to change based on the user's request
3. Output a JSON patch containing ONLY the changed fields
4. Unchanged fields must be OMITTED (not copied)
5. For nested objects (gtmStrategy, hashtagStrategy), include only changed sub-fields
6. For arrays (socialCalendar, seoOutlines, emailSequence), if ANY item changes, include the entire array

## Output Format
Output ONLY a JSON object with the changed fields. No markdown fences, no explanation.
Example: if the user asks to change the email sequence, output:
{"emailSequence": [{"day": 0, "subject": "New subject", "preview": "New preview", "bodyOutline": ["point 1"]}]}
`

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
# Content Factory — Marketing Specialist

You are Forze's marketing agent. You build go-to-market systems that compound.

## What You Build

Before writing a single word:
1. Read venture.context.research (Genesis output) — this is your strategic foundation
2. Read venture.context.branding (Identity output) — this defines your voice
3. Every piece of content must use the brand voice Identity Architect defined
4. Every strategic insight must be grounded in Genesis's market data
5. If either context is missing, ask the user to run Research and Branding first

## What You Build

### 1. 30-Day GTM Strategy
Week-by-week breakdown with:
- Weekly theme and strategic focus
- 3–5 specific actions per week
- KPIs to track per week
- Channel priorities per phase

Week 1: Awareness (launch day)
Week 2: Engagement (community building)
Week 3: Conversion (first customers)
Week 4: Retention (early user success)

### 2. Social Media Calendar (90 posts)
30 posts per platform: X (Twitter), LinkedIn, Instagram

For each post:
- Day number (1–30)
- Platform
- Post type (Educational, Launch, Social proof, Behind-the-scenes, Question, CTA)
- Caption in brand voice — specific, not generic
- Hashtags (platform-appropriate, researched)

Post types should vary — no two consecutive posts of the same type.
Captions must reference real pain points from Genesis research.

### 3. SEO Blog Outlines (5 articles)
Each outline targets a keyword the user's audience actually searches for.
Structure:
- Target keyword + search volume estimate
- Search intent (informational/commercial/navigational)
- H1 title
- Meta description
- Section-by-section outline (H2s and H3s)
- Internal link opportunities
- Estimated time to rank

Target keywords that the venture can realistically rank for from Day 1 — not "best CRM software".

### 4. Launch Email Sequence (7 emails)
Day 0 through Day 14:
- Subject line
- Preview text
- Body outline (3–5 bullet points)
- Primary CTA

### 5. Hashtag Strategy
Platform-specific sets:
- X: 2–4 hashtags per post (trending + niche)
- LinkedIn: 3–5 hashtags (professional + industry)
- Instagram: 10–15 hashtags (broad + niche + brand)

### 6. Comprehensive Marketing Strategy Document
Write a long-form, professional "30-Day Growth & GTM Strategy".
- Target length: 1000+ words.
- Format: Professional Markdown with headers, schedules, and strategic frameworks.
- Sections required:
  - Executive Overview
  - Market Segmentation & Targeting (based on Genesis data)
  - Messaging Framework: Hero Hook, Key Value Props (in Brand Voice)
  - Detailed 30-Day Execution Roadmap
  - Multi-Channel Content Strategy (X, LinkedIn, SEO)
  - Paid vs. Organic Acquisition Plan
  - Conversion Funnel Optimization
  - Success Metrics & KPIs for Month 1

## Document Formatting Standard

Follow this Markdown formatting guide exactly for the marketingPlan field:

${DOCUMENT_STYLE_GUIDE}

## Output Rules

- Output strict JSON matching ContentOutputSchema from VENTURE_OBJECT.md
- Validate output structure before returning
- No generic content — every caption must be specific to this venture
- Brand voice must be consistent across all 90 posts
- Pain points from Genesis must appear naturally in marketing copy
- The marketingPlan field must be a long-form, professional Markdown document.

## Output Schema

Output your full marketing package as a single JSON object matching this exact structure:

{
  "marketingPlan": "Detailed Markdown content...",
  "gtmStrategy": {
    "overview": "string",
    "weeks": [
      { "week": 1, "theme": "string", "actions": ["string"], "kpis": ["string"] }
    ]
  },
  "socialCalendar": [
    { "day": 1, "platform": "x|linkedin|instagram", "caption": "string", "hashtags": ["string"], "postType": "string" }
  ],
  "seoOutlines": [
    { "title": "string", "targetKeyword": "string", "searchIntent": "string", "outline": ["string"], "estimatedTraffic": "string" }
  ],
  "emailSequence": [
    { "day": 0, "subject": "string", "preview": "string", "bodyOutline": ["string"] }
  ],
  "hashtagStrategy": {
    "x": ["string"],
    "linkedin": ["string"],
    "instagram": ["string"]
  }
}

CRITICAL OUTPUT INSTRUCTION:
After your full marketing analysis, output the complete marketing package as a single
valid JSON object matching the structure above. The JSON must be the last
thing you output. Do not include any text after the closing brace.
Output ONLY the JSON — no markdown fences, no explanation after.

IMPORTANT: Do not output any conversational text or "Thought Process" headers. Any step-by-step reasoning or thought process MUST be strictly wrapped inside <think> and </think> tags. Only the final valid JSON should be outside the <think> tags.
`

// ── Agent Runner ──────────────────────────────────────────────────────────────

export async function runContentAgent(
    venture: { ventureId: string; name: string; globalIdea?: string; context: Record<string, unknown> },
    onStream: (line: string) => Promise<void>,
    onComplete: (result: ContentOutput) => Promise<void>,
    history: Content[] = []
): Promise<void> {
    const hasResearch = !!venture.context.research
    const hasBranding = !!venture.context.branding

    const contextParts: string[] = []
    if (venture.globalIdea) contextParts.push(`Global Startup Vision: ${venture.globalIdea}`)

    // Research — extract only fields the marketing agent needs (not the full ~20KB dump)
    if (hasResearch) {
        const r = venture.context.research as Record<string, any>
        const lines: string[] = []
        if (r.marketSummary) lines.push(`Market: ${r.marketSummary}`)
        const tam = r.tam?.value || (typeof r.tam === 'string' ? r.tam : '')
        if (tam) lines.push(`TAM: ${tam}`)
        if (r.targetAudience || r.targetCustomer) lines.push(`Target customer: ${r.targetAudience || r.targetCustomer}`)
        if (r.competitorGap) lines.push(`Market gap: ${r.competitorGap}`)
        if (Array.isArray(r.painPoints) && r.painPoints.length > 0) {
            const pains = r.painPoints.slice(0, 5).map((p: any, i: number) => {
                const desc = typeof p === 'object' ? (p.description || p.name || JSON.stringify(p)) : String(p)
                return `  ${i + 1}. ${desc}`
            })
            lines.push(`Pain points (reference in social captions & email copy):\n${pains.join('\n')}`)
        }
        if (Array.isArray(r.competitors) && r.competitors.length > 0) {
            const comps = r.competitors.slice(0, 5).map((c: any) => {
                const name = typeof c === 'object' ? (c.name || JSON.stringify(c)) : String(c)
                const positioning = typeof c === 'object' ? (c.positioning || c.weakness || c.gap || '') : ''
                return `  - ${name}${positioning ? `: ${positioning}` : ''}`
            })
            lines.push(`Competitors:\n${comps.join('\n')}`)
        }
        if (lines.length > 0) contextParts.push(`## Market Research\n${lines.join('\n')}`)
    }

    // Branding — extract voice & identity tokens only (skip colorPalette, logoConceptDescriptions, uiKitSpec, typography, nameCandidates)
    if (hasBranding) {
        const b = venture.context.branding as Record<string, any>
        const lines: string[] = []
        if (b.brandName) lines.push(`Brand name: ${b.brandName}`)
        if (b.tagline) lines.push(`Tagline: "${b.tagline}"`)
        if (b.brandArchetype) lines.push(`Archetype: ${b.brandArchetype}`)
        if (b.toneOfVoice) {
            const tone = typeof b.toneOfVoice === 'object' ? (b.toneOfVoice.description || b.toneOfVoice.name || String(b.toneOfVoice)) : String(b.toneOfVoice)
            lines.push(`Tone of voice: ${tone}`)
        }
        if (Array.isArray(b.brandPersonality) && b.brandPersonality.length > 0) {
            lines.push(`Brand personality: ${b.brandPersonality.join(', ')}`)
        }
        if (b.missionStatement) lines.push(`Mission: ${b.missionStatement}`)
        if (lines.length > 0) contextParts.push(`## Brand Identity (use this voice consistently across all content)\n${lines.join('\n')}`)
    }

    // ── Edit mode detection ──
    const existingMarketing = venture.context.marketing as ContentOutput | null | undefined
    const isEditMode = !history.length && !!existingMarketing?.gtmStrategy?.overview && existingMarketing.gtmStrategy.overview.length > 20

    if (isEditMode) {
        await onStream('[Edit mode] Applying surgical changes to existing marketing content...\n')

        const existingForContext = {
            gtmStrategy: existingMarketing!.gtmStrategy,
            socialCalendar: existingMarketing!.socialCalendar?.slice(0, 10),
            seoOutlines: existingMarketing!.seoOutlines,
            emailSequence: existingMarketing!.emailSequence,
            hashtagStrategy: existingMarketing!.hashtagStrategy,
            marketingPlan: existingMarketing!.marketingPlan?.length > 500
                ? existingMarketing!.marketingPlan.slice(0, 250) + '\n... [truncated] ...\n' + existingMarketing!.marketingPlan.slice(-250)
                : existingMarketing!.marketingPlan,
        }

        const editUserMessage = `## Edit Request\n${venture.name}\n\n## Current Marketing Data\n\`\`\`json\n${JSON.stringify(existingForContext, null, 2)}\n\`\`\`\n\nApply the requested change. Output ONLY the fields that need to change as a JSON patch.`

        const editRun = async () => {
            const model = getFlashModel()
            let fullText = ''
            await streamPrompt(model, EDIT_SYSTEM_PROMPT, editUserMessage, async (chunk) => {
                fullText += chunk
                await onStream(chunk)
            })
            const rawPatch = extractJSON(fullText) as ContentEditPatch
            const validatedPatch = ContentEditPatchSchema.parse(rawPatch)
            const merged = mergePatch(existingMarketing!, validatedPatch)
            const validated = ContentOutputSchema.parse(merged)
            await onComplete(validated)
        }

        await withTimeout(withRetry(editRun), Number(process.env.AGENT_TIMEOUT_MS ?? 120000))
        return
    }

    const isContinuation = history.length > 0
    const userMessage = isContinuation
        ? "Continue from where you left off. Do not repeat anything already outputted. Complete the ContentOutput JSON object strictly."
        : `Build a complete marketing package for this venture.

${contextParts.join('\n\n')}

Specific Venture Focus: ${venture.name}

${hasResearch && hasBranding
    ? 'All content must use the brand voice from the identity document.\nSocial captions must reference real pain points from the research.'
    : hasResearch
    ? 'Use the research data to ground your marketing strategy. Create a consistent brand voice since no brand identity is available yet.'
    : hasBranding
    ? 'Use the brand voice from the identity document. Since no research data is available, use your best judgment for market positioning.'
    : 'No prior research or branding data is available. Create a compelling marketing package based on the venture concept alone. Be specific and actionable.'}
Output the full ContentOutput JSON at the end.`

    const run = async () => {
        const model = getFlashModel()
        let fullText = (history.find(h => h.role === 'model')?.parts[0] as any)?.text || ''

        await streamPrompt(
            model,
            SYSTEM_PROMPT,
            userMessage,
            async (chunk) => {
                fullText += chunk
                await onStream(chunk)
            },
            history
        )

        const raw = extractJSON(fullText)
        const validated = ContentOutputSchema.parse(raw)
        await onComplete(validated)
    }

    await withTimeout(
        withRetry(run),
        Number(process.env.AGENT_TIMEOUT_MS ?? 120000)
    )
}
