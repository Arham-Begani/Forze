// app/api/ventures/[id]/questions/route.ts
import { requireAuth, isAuthError } from '@/lib/auth'
import { getVenture, getProject } from '@/lib/queries'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getFlashModel, extractJSON } from '@/lib/gemini'
import { evaluateModuleScope } from '@/lib/module-scope'

const bodySchema = z.object({
    moduleId: z.enum(['research', 'branding', 'marketing', 'landing', 'feasibility', 'full-launch']),
    prompt: z.string().min(1).max(2000),
})

const QuestionSchema = z.object({
    questions: z.array(z.object({
        id: z.string(),
        category: z.string(),
        question: z.string(),
        options: z.array(z.object({
            label: z.string(),
            description: z.string(),
            recommended: z.boolean().optional(),
        })),
    })).max(4),
})

const MODULE_CONTEXT: Record<string, string> = {
    'research': 'market research, competitive analysis, TAM/SAM/SOM sizing, and pain point discovery',
    'branding': 'brand identity, naming, color palette, typography, tone of voice, and brand archetype',
    'marketing': '30-day go-to-market strategy, social media calendar, SEO outlines, and email sequences',
    'landing': 'landing page design, sitemap, copy, hero sections, pricing, and CTA strategy',
    'feasibility': 'financial modeling, risk assessment, GO/NO-GO verdict, and 3-year projections',
    'full-launch': 'complete venture package including research, branding, landing page, and feasibility',
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params

        const body = await request.json()
        const parsed = bodySchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
        }

        const { moduleId, prompt } = parsed.data
        const venture = await getVenture(id, session.userId)
        if (!venture) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const scopeDecision = await evaluateModuleScope({
            moduleId,
            prompt,
            context: venture.context as unknown as Record<string, unknown>,
            mode: 'preflight',
        })
        if (!scopeDecision.allowed) {
            return NextResponse.json({ questions: [], blocked: scopeDecision.refusal })
        }

        const project = venture.project_id ? await getProject(venture.project_id, session.userId) : null
        const context = venture.context as unknown as Record<string, unknown>
        const moduleDesc = MODULE_CONTEXT[moduleId] || 'venture building'

        // Build context summary for the AI
        const contextParts: string[] = []
        if (project?.global_idea) contextParts.push(`Global Idea: ${project.global_idea}`)
        if (venture.name) contextParts.push(`Venture Name: ${venture.name}`)
        if (context?.research) contextParts.push(`Research data exists: yes`)
        if (context?.branding) contextParts.push(`Branding data exists: yes`)
        if (context?.marketing) contextParts.push(`Marketing data exists: yes`)
        if (context?.landing) contextParts.push(`Landing page data exists: yes`)
        if (context?.feasibility) contextParts.push(`Feasibility data exists: yes`)

        const systemPrompt = `You are Forze, an AI venture orchestrator. You MUST decide whether the user's prompt requires strategic questions before running the ${moduleId} agent.

The ${moduleId} module handles: ${moduleDesc}

${contextParts.length > 0 ? `Current venture context:\n${contextParts.join('\n')}` : 'This is a fresh venture with no prior context.'}

CRITICAL RULES — when to return an EMPTY questions array (no questions):
- The user gives a specific, clear instruction (e.g. "change the name to X", "use blue instead of red", "make the tagline shorter", "add a pricing section")
- The user is making a modification, tweak, or update to existing output
- The user's intent is unambiguous and doesn't require strategic input
- The user is asking for a single concrete change
- The prompt is a follow-up refining previous results

ONLY generate 2-3 questions when ALL of these are true:
- The prompt is broad or open-ended (e.g. "build my brand", "create a landing page", "do market research")
- There are genuinely important strategic decisions the user should weigh in on
- The user has NOT already specified enough detail to proceed
- This appears to be an initial/fresh run of the module, not a refinement

If questions are NOT needed, respond with: { "questions": [] }

If questions ARE needed, generate 2-3 focused questions. Each should:
- Address a real strategic decision the user should weigh in on
- Have 2-3 clear options (one can be marked as recommended)
- Include a brief description for each option explaining the tradeoff
- Have a category label (1-2 words like "Target Market", "Brand Voice", "Risk Appetite")

Respond with ONLY valid JSON matching this schema:
{
  "questions": [
    {
      "id": "q1",
      "category": "Category Name",
      "question": "The question text?",
      "options": [
        { "label": "Option A", "description": "What this means", "recommended": true },
        { "label": "Option B", "description": "What this means" }
      ]
    }
  ]
}`

        const model = getFlashModel()
        const chat = model.startChat({
            history: [],
            systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
        })

        const result = await chat.sendMessage(`The user wants to run the ${moduleId} module with this prompt: "${prompt}"

First decide: is this prompt specific enough to proceed without questions? If yes, return {"questions": []}. Only generate questions if the prompt is genuinely open-ended and would benefit from strategic input.`)

        const text = result.response.text()
        const json = extractJSON(text)
        const validated = QuestionSchema.safeParse(json)

        if (!validated.success) {
            // If validation fails, return a default set
            return NextResponse.json({ questions: [] })
        }

        return NextResponse.json({ questions: validated.data.questions })

    } catch (e) {
        if (isAuthError(e)) return (e as any).toResponse()
        console.error('Questions generation failed:', e)
        // Graceful degradation — if question gen fails, just return empty
        return NextResponse.json({ questions: [] })
    }
}
