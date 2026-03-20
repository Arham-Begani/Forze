import { z } from 'zod'
import {
    getFlashModel,
    streamPrompt,
    extractJSON,
    withTimeout,
    withRetry,
    Content,
} from '@/lib/gemini'

// ── Launch Autopilot Output Schema ──────────────────────────────────────────

export const LaunchAutopilotSchema = z.object({
    launchName: z.string().default('14-Day Launch Plan'),
    summary: z.string().default('Launch plan pending.'),
    days: z.array(z.object({
        day: z.number().default(1),
        date: z.string().default('Day 1'),
        theme: z.string().default('Soft Launch'),
        tasks: z.array(z.object({
            time: z.string().default('9:00 AM'),
            channel: z.string().default('Reddit'),
            action: z.string().default('Post'),
            exactCopy: z.string().default('Copy pending.'),
            notes: z.string().default(''),
            priority: z.enum(['critical', 'important', 'nice-to-have']).default('important'),
        })).default([]),
        milestone: z.string().default('Milestone pending.'),
    })).default([]),
    channels: z.array(z.object({
        name: z.string().default('Channel'),
        totalPosts: z.number().default(0),
        bestTime: z.string().default('9:00 AM'),
        rationale: z.string().default('Rationale pending.'),
    })).default([]),
    weekOneGoal: z.string().default('Week 1 goal pending.'),
    weekTwoGoal: z.string().default('Week 2 goal pending.'),
    launchDayChecklist: z.array(z.string()).default([]),
    postLaunchAdvice: z.string().default('Post-launch advice pending.'),
})

export type LaunchAutopilotOutput = z.infer<typeof LaunchAutopilotSchema>

// ── Edit Patch Schema (all fields optional — for surgical updates) ───────────

const LaunchAutopilotEditPatchSchema = z.object({
    launchName: z.string().optional(),
    summary: z.string().optional(),
    days: z.array(z.object({
        day: z.number().default(1),
        date: z.string().default('Day 1'),
        theme: z.string().default('Soft Launch'),
        tasks: z.array(z.object({
            time: z.string().default('9:00 AM'),
            channel: z.string().default('Reddit'),
            action: z.string().default('Post'),
            exactCopy: z.string().default('Copy pending.'),
            notes: z.string().default(''),
            priority: z.enum(['critical', 'important', 'nice-to-have']).default('important'),
        })).default([]),
        milestone: z.string().default('Milestone pending.'),
    })).optional(),
    channels: z.array(z.object({
        name: z.string().default('Channel'),
        totalPosts: z.number().default(0),
        bestTime: z.string().default('9:00 AM'),
        rationale: z.string().default('Rationale pending.'),
    })).optional(),
    weekOneGoal: z.string().optional(),
    weekTwoGoal: z.string().optional(),
    launchDayChecklist: z.array(z.string()).optional(),
    postLaunchAdvice: z.string().optional(),
})

type LaunchAutopilotEditPatch = z.infer<typeof LaunchAutopilotEditPatchSchema>

// ── Merge patch into existing result ─────────────────────────────────────────

function mergePatch(existing: LaunchAutopilotOutput, patch: LaunchAutopilotEditPatch): LaunchAutopilotOutput {
    const merged = { ...existing }

    if (patch.launchName !== undefined) merged.launchName = patch.launchName
    if (patch.summary !== undefined) merged.summary = patch.summary
    if (patch.weekOneGoal !== undefined) merged.weekOneGoal = patch.weekOneGoal
    if (patch.weekTwoGoal !== undefined) merged.weekTwoGoal = patch.weekTwoGoal
    if (patch.postLaunchAdvice !== undefined) merged.postLaunchAdvice = patch.postLaunchAdvice

    // Arrays replace entirely
    if (patch.days) merged.days = patch.days
    if (patch.channels) merged.channels = patch.channels
    if (patch.launchDayChecklist) merged.launchDayChecklist = patch.launchDayChecklist

    return merged
}

// ── Edit System Prompt ───────────────────────────────────────────────────────

const EDIT_SYSTEM_PROMPT = `
# Launch Autopilot — Surgical Edit Mode

You are editing an EXISTING 14-day launch plan. The user wants a specific change — do NOT regenerate the entire calendar.

## Rules
1. Read the existing launch plan carefully
2. Identify ONLY the fields that need to change based on the user's request
3. Output a JSON patch containing ONLY the changed fields
4. Unchanged fields must be OMITTED (not copied)
5. For the days array — if only specific days change, still include the ENTIRE days array (with unchanged days copied as-is) since partial array patches aren't supported
6. Every task must still include exactCopy — the literal paste-ready text

## Output Format
Output ONLY a JSON object with the changed fields. No markdown fences, no explanation.
Example: if the user asks to change the week one goal, output:
{"weekOneGoal": "Get 50 beta signups and 5 paying customers"}
`

// ── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
# Launch Autopilot — 14-Day Execution Strategist

You are a launch execution strategist. You do NOT produce vague plans. You produce a 14-day day-by-day calendar where every single task includes the EXACT TEXT the founder should copy and paste. No "write a post about X" — the literal words they paste into the platform.

## Philosophy

- Free channels first. Paid ads are a last resort.
- Day 1 is ALWAYS a soft launch — low stakes, friendly audiences.
- Day 14 ends with a retrospective prompt.
- Product Hunt gets its own dedicated prep + launch day.
- Be specific about subreddits (r/SideProject, r/startups, r/entrepreneur) — never just "Reddit".
- Every cold email includes a subject line + full body.
- Every social post includes hashtags where appropriate.
- Every DM template is personalized with a [NAME] placeholder.

## What You Must Produce

### 1. Launch Name & Summary
A catchy name for this launch campaign and a 2-3 sentence summary.

### 2. 14-Day Calendar
Each day MUST have:
- day: number (1-14)
- date: relative label ("Day 1 — Soft Launch", "Day 7 — Product Hunt Prep")
- theme: the strategic theme for that day
- tasks: array of 1-4 tasks, each with:
  - time: when to execute (e.g. "9:00 AM EST")
  - channel: the SPECIFIC platform (not "social media" — say "r/SideProject", "X/Twitter", "LinkedIn", "Product Hunt", "Hacker News", "IndieHackers", "Email — Newsletter Curators", "Email — Cold Outreach", "Discord — [specific server]")
  - action: what to do ("Post", "Send cold email batch", "Submit", "Comment in thread", "DM influencer", "Reply to comments")
  - exactCopy: the LITERAL TEXT to paste. For emails: "Subject: [subject]\\n\\n[body]". For social: full post with hashtags. For Product Hunt: tagline (60 chars max) + description + first comment draft. For DMs: full message with [NAME] placeholder.
  - notes: tactical advice (e.g. "Post at 9am EST for max visibility", "Reply to every comment within 1 hour")
  - priority: "critical" (must do), "important" (should do), "nice-to-have"
- milestone: what success looks like at end of day

### 3. Channel Summary
For each channel used across the 14 days:
- name, totalPosts, bestTime, rationale for using this channel

### 4. Weekly Goals
- weekOneGoal: measurable goal for days 1-7
- weekTwoGoal: measurable goal for days 8-14

### 5. Launch Day Checklist
A checklist of 8-12 items for the main launch day (usually Day 10-12).

### 6. Post-Launch Advice
300-500 words on what to do after the 14 days are over.

## Critical Rules

- ALL copy must be written in the venture's brand voice if branding data is available.
- If marketing context exists, REMIX that content into scheduled posts — do not generate from scratch.
- NEVER produce a task without exactCopy. Every task must have paste-ready text.
- Prioritize subreddits where the target audience actually lives (use research data for this).
- Include at least 2 cold email/DM campaigns targeting newsletter curators or micro-influencers.
- Product Hunt launch should be on Day 10, 11, or 12 — not Day 1.
- Include a "reply to comments" task the day after every major post.
- Reference actual venture data: brand name, tagline, landing page URL, key features, pricing.

## Output Format

Output strict JSON matching the schema. No conversational text outside the JSON.
Output ONLY the JSON. No markdown fences, no preamble, no commentary.
`

// ── Agent Runner ────────────────────────────────────────────────────────────

interface VentureInput {
    ventureId: string
    name: string
    globalIdea?: string
    context: Record<string, unknown>
}

export async function runLaunchAutopilotAgent(
    venture: VentureInput,
    onStream: (chunk: string) => Promise<void>,
    onComplete: (result: LaunchAutopilotOutput) => Promise<void>,
    history: Content[] = []
): Promise<void> {
    const model = getFlashModel()

    // ── Edit mode detection ──
    const existingLaunch = venture.context.launchAutopilot as LaunchAutopilotOutput | null | undefined
    const isEditMode = !history.length && !!existingLaunch?.launchName && existingLaunch.launchName.length > 3

    if (isEditMode) {
        await onStream('[Edit mode] Applying surgical changes to existing launch plan...\n')

        const existingForContext = {
            launchName: existingLaunch!.launchName,
            summary: existingLaunch!.summary,
            weekOneGoal: existingLaunch!.weekOneGoal,
            weekTwoGoal: existingLaunch!.weekTwoGoal,
            channels: existingLaunch!.channels,
            launchDayChecklist: existingLaunch!.launchDayChecklist,
            days: existingLaunch!.days?.slice(0, 7).map(d => ({
                day: d.day,
                theme: d.theme,
                tasks: d.tasks?.slice(0, 2).map(t => ({ channel: t.channel, action: t.action })),
            })),
            postLaunchAdvice: existingLaunch!.postLaunchAdvice?.length > 300
                ? existingLaunch!.postLaunchAdvice.slice(0, 150) + '... [truncated]'
                : existingLaunch!.postLaunchAdvice,
        }

        const editUserMessage = `## Edit Request\n${venture.name}\n\n## Current Launch Plan\n\`\`\`json\n${JSON.stringify(existingForContext, null, 2)}\n\`\`\`\n\nApply the requested change. Output ONLY the fields that need to change as a JSON patch.`

        const editRun = async () => {
            const fullText = await streamPrompt(model, EDIT_SYSTEM_PROMPT, editUserMessage, onStream)
            const rawPatch = extractJSON(fullText) as LaunchAutopilotEditPatch
            const validatedPatch = LaunchAutopilotEditPatchSchema.parse(rawPatch)
            const merged = mergePatch(existingLaunch!, validatedPatch)
            const validated = LaunchAutopilotSchema.parse(merged)
            await onComplete(validated)
        }

        await withTimeout(withRetry(editRun), 180_000)
        return
    }

    // Build context block from all available venture data
    const contextParts: string[] = []

    if (venture.globalIdea) {
        contextParts.push(`Venture Vision: ${venture.globalIdea}`)
    }

    // Research — extract only what the launch calendar needs
    if (venture.context?.research) {
        const r = venture.context.research as Record<string, any>
        const lines: string[] = []
        if (r.marketSummary) lines.push(`Market: ${r.marketSummary}`)
        if (r.targetAudience || r.targetCustomer) lines.push(`Target customer: ${r.targetAudience || r.targetCustomer}`)
        if (r.competitorGap) lines.push(`Market gap: ${r.competitorGap}`)
        if (Array.isArray(r.painPoints) && r.painPoints.length > 0) {
            const pains = r.painPoints.slice(0, 3).map((p: any, i: number) => {
                const desc = typeof p === 'object' ? (p.description || p.name || JSON.stringify(p)) : String(p)
                return `  ${i + 1}. ${desc}`
            })
            lines.push(`Pain points:\n${pains.join('\n')}`)
        }
        if (lines.length > 0) contextParts.push(`Market Research Data:\n${lines.join('\n')}`)
    }

    // Branding — extract voice/identity tokens for copy generation
    if (venture.context?.branding) {
        const b = venture.context.branding as Record<string, any>
        const lines: string[] = []
        if (b.brandName) lines.push(`Brand name: ${b.brandName}`)
        if (b.tagline) lines.push(`Tagline: "${b.tagline}"`)
        if (b.brandArchetype) lines.push(`Archetype: ${b.brandArchetype}`)
        const tone = b.toneOfVoice || b.brandVoice
        if (tone) {
            const toneDesc = typeof tone === 'object' ? (tone.description || tone.name || JSON.stringify(tone)) : String(tone)
            lines.push(`Tone of voice: ${toneDesc}`)
        }
        if (Array.isArray(b.brandPersonality) && b.brandPersonality.length > 0) {
            lines.push(`Brand personality: ${b.brandPersonality.join(', ')}`)
        }
        if (lines.length > 0) contextParts.push(`Brand Identity (USE THIS VOICE FOR ALL COPY):\n${lines.join('\n')}`)
    }

    // Marketing — extract GTM overview, weekly themes, social calendar, email subjects
    if (venture.context?.marketing) {
        const m = venture.context.marketing as Record<string, any>
        const lines: string[] = []
        const gtm = m.gtmStrategy || m
        if (gtm.overview) lines.push(`GTM overview: ${gtm.overview}`)
        if (Array.isArray(gtm.weeks) && gtm.weeks.length > 0) {
            const weekLines = gtm.weeks.slice(0, 3).map((w: any) => {
                const week = w.week || w.name || ''
                const theme = w.theme || ''
                const actions = Array.isArray(w.actions) ? w.actions.join('; ') : (w.actions || '')
                return `  - ${week}${theme ? ` — ${theme}` : ''}${actions ? `: ${actions}` : ''}`
            })
            lines.push(`GTM weeks:\n${weekLines.join('\n')}`)
        }
        if (Array.isArray(m.socialCalendar) && m.socialCalendar.length > 0) {
            const posts = m.socialCalendar.slice(0, 5).map((s: any) => {
                const day = s.day || s.date || ''
                const platform = s.platform || s.channel || ''
                const caption = s.caption || s.content || s.text || ''
                return `  - ${day} [${platform}]: ${caption}`
            })
            lines.push(`Social calendar (REMIX these into scheduled posts):\n${posts.join('\n')}`)
        }
        if (Array.isArray(m.emailSequence) && m.emailSequence.length > 0) {
            const emails = m.emailSequence.slice(0, 3).map((e: any) => {
                const day = e.day || e.sendDay || ''
                const subject = typeof e === 'object' ? (e.subject || e.title || '') : String(e)
                return `  - Day ${day}: "${subject}"`
            })
            lines.push(`Email sequence:\n${emails.join('\n')}`)
        }
        if (m.hashtagStrategy) lines.push(`Hashtag strategy: ${typeof m.hashtagStrategy === 'object' ? JSON.stringify(m.hashtagStrategy) : String(m.hashtagStrategy)}`)
        if (lines.length > 0) contextParts.push(`Marketing Strategy (REMIX THIS CONTENT INTO SCHEDULED POSTS):\n${lines.join('\n')}`)
    }

    // Feasibility — verdict only
    if (venture.context?.feasibility) {
        const f = venture.context.feasibility as Record<string, any>
        if (f.verdict) contextParts.push(`Feasibility verdict: ${f.verdict}`)
    }

    // Landing — minimal deployment reference data
    if (venture.context?.landing) {
        const l = venture.context.landing as Record<string, any>
        const lines: string[] = []
        if (l.deploymentUrl) lines.push(`Landing page URL: ${l.deploymentUrl}`)
        if (l.seoMetadata?.title) lines.push(`SEO title: ${l.seoMetadata.title}`)
        if (l.landingPageCopy?.hero?.headline) lines.push(`Hero headline: "${l.landingPageCopy.hero.headline}"`)
        if (lines.length > 0) contextParts.push(`Landing Page (REFERENCE THIS URL AND COPY IN ALL TASKS):\n${lines.join('\n')}`)
    }

    const isContinuation = history.length > 0
    const finalUserMessage = isContinuation
        ? "Continue from where you left off. Do not repeat anything already outputted. Complete the LaunchAutopilotOutput JSON object strictly."
        : `Generate a complete 14-day launch execution calendar for this venture.

Venture: ${venture.name}

${contextParts.join('\n\n')}

Produce the complete LaunchAutopilotOutput JSON. Every task MUST include exactCopy — the literal text to paste. No placeholders like "write about X".`

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
        const validated = LaunchAutopilotSchema.parse(raw)
        await onComplete(validated)
    }

    await withTimeout(withRetry(run), 180_000)
}
