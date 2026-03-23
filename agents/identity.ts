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

// ── IdentityOutput Zod Schema ────────────────────────────────────────────────

const IdentityOutputSchema = z.object({
    brandName: z.string().default('Untitled Venture'),
    brandNameRationale: z.string().default('No rationale provided.'),
    brandBible: z.string().default('# Brand Bible\n\nFull brand documentation pending.'),
    nameCandidates: z.array(z.string()).default([]),
    tagline: z.string().default('Innovation redefined.'),
    missionStatement: z.string().default('To build the future of our industry.'),
    brandArchetype: z.string().default('The Creator'),
    brandPersonality: z.array(z.string()).default(['Professional', 'Innovative', 'Trustworthy']),
    toneOfVoice: z.object({
        description: z.string().default('Professional and encouraging.'),
        doExamples: z.array(z.string()).default([]),
        dontExamples: z.array(z.string()).default([]),
    }).default({
        description: 'Professional and encouraging.',
        doExamples: [],
        dontExamples: []
    }),
    colorPalette: z.array(
        z.object({
            name: z.string(),
            hex: z.string(),
            role: z.string(),
            psychology: z.string(),
        })
    ).default([
        { name: 'Primary Blue', hex: '#2563eb', role: 'Primary', psychology: 'Trust and stability' },
        { name: 'Accent Orange', hex: '#f97316', role: 'Accent', psychology: 'Energy and action' }
    ]),
    typography: z.object({
        displayFont: z.string().default('Montserrat'),
        bodyFont: z.string().default('Open Sans'),
        usageRules: z.string().default('Use for headlines and body text.'),
    }).default({
        displayFont: 'Montserrat',
        bodyFont: 'Open Sans',
        usageRules: 'Use for headlines and body text.'
    }),
    logoConceptDescriptions: z.array(z.string()).default([]),
    uiKitSpec: z.object({
        borderRadius: z.string().default('8px'),
        spacing: z.string().default('16px'),
        buttonStyle: z.string().default('Filled with rounded corners'),
        cardStyle: z.string().default('Elevated with subtle shadow'),
    }).default({
        borderRadius: '8px',
        spacing: '16px',
        buttonStyle: 'Filled with rounded corners',
        cardStyle: 'Elevated with subtle shadow'
    }),
})

export type IdentityOutput = z.infer<typeof IdentityOutputSchema>

// ── Edit Patch Schema (all fields optional — for surgical updates) ───────────

const IdentityEditPatchSchema = z.object({
    brandName: z.string().optional(),
    brandNameRationale: z.string().optional(),
    brandBible: z.string().optional(),
    nameCandidates: z.array(z.string()).optional(),
    tagline: z.string().optional(),
    missionStatement: z.string().optional(),
    brandArchetype: z.string().optional(),
    brandPersonality: z.array(z.string()).optional(),
    toneOfVoice: z.object({
        description: z.string().optional(),
        doExamples: z.array(z.string()).optional(),
        dontExamples: z.array(z.string()).optional(),
    }).optional(),
    colorPalette: z.array(z.object({
        name: z.string(),
        hex: z.string(),
        role: z.string(),
        psychology: z.string(),
    })).optional(),
    typography: z.object({
        displayFont: z.string().optional(),
        bodyFont: z.string().optional(),
        usageRules: z.string().optional(),
    }).optional(),
    logoConceptDescriptions: z.array(z.string()).optional(),
    uiKitSpec: z.object({
        borderRadius: z.string().optional(),
        spacing: z.string().optional(),
        buttonStyle: z.string().optional(),
        cardStyle: z.string().optional(),
    }).optional(),
})

type IdentityEditPatch = z.infer<typeof IdentityEditPatchSchema>

// ── Merge patch into existing result ─────────────────────────────────────────

function mergePatch(existing: IdentityOutput, patch: IdentityEditPatch): IdentityOutput {
    const merged = { ...existing }

    if (patch.brandName !== undefined) merged.brandName = patch.brandName
    if (patch.brandNameRationale !== undefined) merged.brandNameRationale = patch.brandNameRationale
    if (patch.brandBible !== undefined) merged.brandBible = patch.brandBible
    if (patch.tagline !== undefined) merged.tagline = patch.tagline
    if (patch.missionStatement !== undefined) merged.missionStatement = patch.missionStatement
    if (patch.brandArchetype !== undefined) merged.brandArchetype = patch.brandArchetype

    // Arrays replace entirely
    if (patch.nameCandidates) merged.nameCandidates = patch.nameCandidates
    if (patch.brandPersonality) merged.brandPersonality = patch.brandPersonality
    if (patch.colorPalette) merged.colorPalette = patch.colorPalette
    if (patch.logoConceptDescriptions) merged.logoConceptDescriptions = patch.logoConceptDescriptions

    // Nested objects merge at sub-field level
    if (patch.toneOfVoice) {
        merged.toneOfVoice = { ...existing.toneOfVoice }
        if (patch.toneOfVoice.description !== undefined) merged.toneOfVoice.description = patch.toneOfVoice.description
        if (patch.toneOfVoice.doExamples) merged.toneOfVoice.doExamples = patch.toneOfVoice.doExamples
        if (patch.toneOfVoice.dontExamples) merged.toneOfVoice.dontExamples = patch.toneOfVoice.dontExamples
    }
    if (patch.typography) merged.typography = { ...existing.typography, ...patch.typography }
    if (patch.uiKitSpec) merged.uiKitSpec = { ...existing.uiKitSpec, ...patch.uiKitSpec }

    return merged
}

// ── Edit System Prompt ───────────────────────────────────────────────────────

const EDIT_SYSTEM_PROMPT = `
# Identity Architect — Surgical Edit Mode

You are editing an EXISTING brand identity output. The user wants a specific change — do NOT regenerate everything.

## Rules
1. Read the existing brand data carefully
2. Identify ONLY the fields that need to change based on the user's request
3. Output a JSON patch containing ONLY the changed fields
4. Unchanged fields must be OMITTED (not copied)
5. For nested objects (toneOfVoice, typography, uiKitSpec), include only changed sub-fields
6. For arrays (colorPalette, nameCandidates, brandPersonality, logoConceptDescriptions), if ANY item changes, include the entire array

## Output Format
Output ONLY a JSON object with the changed fields. No markdown fences, no explanation.
Example: if the user asks to change the tagline, output:
{"tagline": "New tagline here"}
`

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
# Identity Architect — Brand Specialist

You are Forze's brand creation agent. You build brands that feel inevitable — like they could only belong to this venture.

## Your Job

1. Read Genesis Engine's findings before writing a single word
2. The brand must reflect the market positioning Genesis identified
3. The brand voice must speak directly to the pain points Genesis found
4. Generate a complete Brand Bible — not just a name

## Brand Bible Components

### 1. Brand Name (5 candidates, 1 recommendation)
- Names must be: memorable, domain-available (infer), pronounceable globally
- Avoid generic tech names (-ify, -ly, -hub endings unless justified)
- Provide clear rationale for the recommended name

### 2. Tagline
- One sentence. Benefit-led. No jargon.
- Must speak to the primary pain point Genesis identified

### 3. Mission Statement
- Why this company exists beyond making money
- Grounded in the market gap Genesis found

### 4. Brand Archetype
- Choose from: The Creator, The Challenger, The Sage, The Explorer,
  The Innocent, The Hero, The Ruler, The Caregiver, The Jester,
  The Lover, The Everyman, The Magician
- Justify the choice based on the target market and positioning

### 5. Tone of Voice
- 3–5 personality adjectives
- DO examples (3 sample sentences in brand voice)
- DON'T examples (3 anti-examples)
- The voice must match the market's communication style

### 6. Color Palette
- 3–5 colors with hex values
- Role for each: Primary, Accent, Background, Text, Surface
- Psychology rationale — why each color works for this brand
- Base palette on Genesis's market findings — who are the users?

### 7. Typography
- Display font (headlines): must be distinctive, not generic
- Body font (UI/copy): must be highly readable
- Usage rules: when to use each, sizing guidelines
- Never recommend: Inter, Roboto, Arial, Helvetica, or system fonts

### 8. Logo Concept Descriptions (3 options)
- Text descriptions detailed enough for an image generation prompt
- One wordmark, one symbol, one combination mark
- Describe style, composition, colors, feeling

### 9. UI Kit Spec
- Border radius style (sharp/medium/rounded)
- Spacing system
- Button style (filled/outlined/ghost preferences)
- Card style (elevated/flat/bordered)
- Component feel (dense/airy/balanced)

### 10. Comprehensive Brand Bible Document
Write a long-form, professional "Brand Identity & Design Bible".
- Target length: 1000+ words.
- Format: Professional Markdown with headers and visual descriptions.
- Sections required:
  - Brand Core: Mission, Vision, and Value Proposition
  - Target Audience: Psychographics and user personas (based on Genesis research)
  - Verbal Identity: Tone of Voice deep-dive with samples
  - Visual Identity: Color theory, typography rationale, and imagery style
  - Logo System: Detailed concepts and usage principles
  - UI/UX Principles: The "feel" of the digital product
  - Brand Manifest: A 3-paragraph inspiring manifesto

## Document Formatting Standard

Follow this Markdown formatting guide exactly for the brandBible field:

${DOCUMENT_STYLE_GUIDE}

## Output Rules

- Output strict JSON matching IdentityOutputSchema from VENTURE_OBJECT.md
- Validate output structure before returning
- The brand must be coherent — every element must reinforce the same archetype
- No generic outputs — every field must be specific to this venture
- The brandBible field must be a long-form, professional Markdown document.

## Output Schema

Output your final Brand Bible as a single JSON object matching this exact structure:

{
  "brandName": "string",
  "brandNameRationale": "string",
  "brandBible": "Detailed Markdown content...",
  "nameCandidates": ["string", "string", "string", "string", "string"],
  "tagline": "string",
  "missionStatement": "string",
  "brandArchetype": "string",
  "brandPersonality": ["string", "string", "string"],
  "toneOfVoice": {
    "description": "string",
    "doExamples": ["string", "string", "string"],
    "dontExamples": ["string", "string", "string"]
  },
  "colorPalette": [
    { "name": "string", "hex": "#XXXXXX", "role": "Primary|Accent|Background|Text|Surface", "psychology": "string" }
  ],
  "typography": {
    "displayFont": "string",
    "bodyFont": "string",
    "usageRules": "string"
  },
  "logoConceptDescriptions": ["string", "string", "string"],
  "uiKitSpec": {
    "borderRadius": "string",
    "spacing": "string",
    "buttonStyle": "string",
    "cardStyle": "string"
  }
}

CRITICAL OUTPUT INSTRUCTION:
After your full brand analysis, output your Brand Bible as a single
valid JSON object matching the structure above. The JSON must be the last
thing you output. Do not include any text after the closing brace.
Output ONLY the JSON — no markdown fences, no explanation after.

IMPORTANT: Do not output any conversational text or "Thought Process" headers. Any step-by-step reasoning or thought process MUST be strictly wrapped inside <think> and </think> tags. Only the final valid JSON should be outside the <think> tags.
`

// ── Agent Runner ──────────────────────────────────────────────────────────────

export async function runIdentityAgent(
    venture: { ventureId: string; name: string; globalIdea?: string; context: Record<string, unknown> },
    onStream: (line: string) => Promise<void>,
    onComplete: (result: IdentityOutput) => Promise<void>,
    history: Content[] = []
): Promise<void> {
    const hasResearch = !!venture.context.research

    const contextParts: string[] = []
    if (venture.context?.architectPlan) contextParts.push(`Architect's Plan:\n${venture.context.architectPlan}`)
    if (venture.globalIdea) contextParts.push(`Global Startup Vision: ${venture.globalIdea}`)
    if (hasResearch) {
        const r = venture.context.research as Record<string, any>
        const lines: string[] = []
        if (r.marketSummary) lines.push(`Market: ${r.marketSummary}`)
        const tam = r.tam?.value || (typeof r.tam === 'string' ? r.tam : '')
        if (tam) lines.push(`TAM: ${tam}`)
        const sam = r.sam?.value || (typeof r.sam === 'string' ? r.sam : '')
        if (sam) lines.push(`SAM: ${sam}`)
        const som = r.som?.value || (typeof r.som === 'string' ? r.som : '')
        if (som) lines.push(`SOM: ${som}`)
        if (r.targetAudience || r.targetCustomer) lines.push(`Target customer: ${r.targetAudience || r.targetCustomer}`)
        if (r.competitorGap) lines.push(`Market gap: ${r.competitorGap}`)
        if (r.recommendedConcept) {
            const concept = typeof r.recommendedConcept === 'object'
                ? (r.recommendedConcept.name || r.recommendedConcept.title || JSON.stringify(r.recommendedConcept))
                : String(r.recommendedConcept)
            lines.push(`Recommended concept: ${concept}`)
        }
        if (Array.isArray(r.painPoints) && r.painPoints.length > 0) {
            const pains = r.painPoints.slice(0, 5).map((p: any, i: number) => {
                const desc = typeof p === 'object' ? (p.description || p.name || JSON.stringify(p)) : String(p)
                return `  ${i + 1}. ${desc}`
            })
            lines.push(`Pain points (brand voice must address these):\n${pains.join('\n')}`)
        }
        if (Array.isArray(r.competitors) && r.competitors.length > 0) {
            const comps = r.competitors.slice(0, 5).map((c: any) => {
                const name = typeof c === 'object' ? (c.name || JSON.stringify(c)) : String(c)
                const weakness = typeof c === 'object' ? (c.weakness || c.gap || '') : ''
                return `  - ${name}${weakness ? `: weakness = "${weakness}"` : ''}`
            })
            lines.push(`Competitors:\n${comps.join('\n')}`)
        }
        contextParts.push(`Market research (use this to ground every brand decision):\n${lines.join('\n')}`)
    }

    // ── Edit mode detection ──
    const existingBranding = venture.context.branding as IdentityOutput | null | undefined
    const isEditMode = !history.length && !!existingBranding?.brandName && existingBranding.brandName !== 'Untitled Venture'

    if (isEditMode) {
        await onStream('[Edit mode] Applying surgical changes to existing brand identity...\n')

        const existingForContext = {
            brandName: existingBranding!.brandName,
            tagline: existingBranding!.tagline,
            missionStatement: existingBranding!.missionStatement,
            brandArchetype: existingBranding!.brandArchetype,
            brandPersonality: existingBranding!.brandPersonality,
            toneOfVoice: existingBranding!.toneOfVoice,
            colorPalette: existingBranding!.colorPalette,
            typography: existingBranding!.typography,
            logoConceptDescriptions: existingBranding!.logoConceptDescriptions,
            uiKitSpec: existingBranding!.uiKitSpec,
            nameCandidates: existingBranding!.nameCandidates,
            brandBible: existingBranding!.brandBible?.length > 500
                ? existingBranding!.brandBible.slice(0, 250) + '\n... [truncated] ...\n' + existingBranding!.brandBible.slice(-250)
                : existingBranding!.brandBible,
        }

        const editUserMessage = `## Edit Request\n${venture.name}\n\n## Current Brand Identity\n\`\`\`json\n${JSON.stringify(existingForContext, null, 2)}\n\`\`\`\n\nApply the requested change. Output ONLY the fields that need to change as a JSON patch.`

        const editRun = async () => {
            const model = getFlashModel()
            const fullText = await streamPrompt(model, EDIT_SYSTEM_PROMPT, editUserMessage, onStream)
            const rawPatch = extractJSON(fullText) as IdentityEditPatch
            const validatedPatch = IdentityEditPatchSchema.parse(rawPatch)
            const merged = mergePatch(existingBranding!, validatedPatch)
            const validated = IdentityOutputSchema.parse(merged)
            await onComplete(validated)
        }

        await withTimeout(withRetry(editRun), Number(process.env.AGENT_TIMEOUT_MS ?? 120000))
        return
    }

    const isContinuation = history.length > 0
    const userMessage = isContinuation
        ? "Continue from where you left off. Do not repeat anything already outputted. Complete the IdentityOutput JSON object strictly."
        : `Build a complete Brand Bible for this venture.

${contextParts.join('\n\n')}

Specific Venture Focus: ${venture.name}

${hasResearch
    ? 'The brand name, voice, and colors must be specific to this market based on the research above.'
    : 'No prior research data is available. Use your knowledge to create a strong brand identity based on the venture concept. Be specific — not generic tech startup branding.'}
Do not produce generic tech startup branding.
Output the full IdentityOutput JSON at the end.`

    const finalUserMessage = isContinuation
        ? "Continue from where you left off. Do not repeat anything already outputted. Complete the IdentityOutput JSON strictly."
        : userMessage

    const run = async () => {
        const model = getFlashModel()
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
        const validated = IdentityOutputSchema.parse(raw)
        await onComplete(validated)
    }

    await withTimeout(
        withRetry(run),
        Number(process.env.AGENT_TIMEOUT_MS ?? 120000)
    )
}
