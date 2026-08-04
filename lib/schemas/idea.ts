import { z } from 'zod'

// ──────────────────────────────────────────────────────────────────────────────
// IdeaBrief — the structured shape the intake chatbot produces and the idea
// changelog evolves.
//
// This is ADDITIVE to `projects.global_idea`, never a replacement. `summary`
// is mirrored into `global_idea` so every existing consumer (run route,
// questions route, investor-kit, lead-scout, outreach-brief) keeps working
// untouched. The rest of the fields are appended to the agent prompt by
// `renderBriefForPrompt` (lib/idea-brief.ts).
//
// `summary` is capped at 900 chars ON PURPOSE: the agents historically clipped
// globalIdea at 1000 chars, so a brief that fits under 900 can never regress a
// venture created before this feature existed.
// ──────────────────────────────────────────────────────────────────────────────

export const IDEA_SUMMARY_MAX = 900

export const IdeaStageSchema = z.enum(['idea', 'prototype', 'launched'])
export type IdeaStage = z.infer<typeof IdeaStageSchema>

/**
 * One answered interview turn. Kept on the brief so later re-synthesis (an idea
 * update) can see what the founder originally said, not just our summary of it.
 */
export const InterviewTurnSchema = z.object({
    q: z.string().max(300),
    a: z.string().max(1000),
})
export type InterviewTurn = z.infer<typeof InterviewTurnSchema>

export const IdeaBriefSchema = z.object({
    version: z.number().int().min(1).default(1),
    summary: z.string().max(IDEA_SUMMARY_MAX),
    problem: z.string().max(600).default(''),
    targetCustomer: z.string().max(400).default(''),
    solution: z.string().max(600).default(''),
    differentiator: z.string().max(400).default(''),
    businessModel: z.string().max(400).default(''),
    stage: IdeaStageSchema.default('idea'),
    keyFeatures: z.array(z.string().max(200)).max(12).default([]),
    openQuestions: z.array(z.string().max(200)).max(6).default([]),
    transcript: z.array(InterviewTurnSchema).max(12).default([]),
    updatedAt: z.string().default(() => new Date().toISOString()),
})
export type IdeaBrief = z.infer<typeof IdeaBriefSchema>

/**
 * Loose variant used when parsing raw Gemini output. The model is asked for the
 * full shape but is allowed to omit fields; defaults fill the gaps so one
 * missing key never fails a whole interview.
 */
export const IdeaBriefDraftSchema = IdeaBriefSchema.partial({
    version: true,
    problem: true,
    targetCustomer: true,
    solution: true,
    differentiator: true,
    businessModel: true,
    stage: true,
    keyFeatures: true,
    openQuestions: true,
    transcript: true,
    updatedAt: true,
})

// ──────────────────────────────────────────────────────────────────────────────
// Interview wire format
//
// The question shape deliberately mirrors `app/api/ventures/[id]/questions`
// so the intake chips render with the same component vocabulary as the module
// decision UI.
// ──────────────────────────────────────────────────────────────────────────────

export const InterviewOptionSchema = z.object({
    label: z.string().max(80),
    description: z.string().max(200).default(''),
    recommended: z.boolean().optional(),
})
export type InterviewOption = z.infer<typeof InterviewOptionSchema>

export const InterviewQuestionSchema = z.object({
    id: z.string().max(40),
    category: z.string().max(60),
    question: z.string().max(300),
    options: z.array(InterviewOptionSchema).max(4).default([]),
    allowFreeText: z.boolean().default(true),
})
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>

/** What the model is asked to return each turn. */
export const InterviewStepSchema = z.object({
    done: z.boolean().default(false),
    question: InterviewQuestionSchema.nullable().default(null),
    brief: IdeaBriefDraftSchema.nullable().default(null),
    suggestedName: z.string().max(60).optional(),
})

/** Request body for POST /api/idea/interview. */
export const InterviewRequestSchema = z.object({
    seed: z.string().min(5).max(2000),
    answers: z
        .array(
            z.object({
                q: z.string().min(1).max(300),
                a: z.string().max(1000),
                skipped: z.boolean().optional(),
            })
        )
        .max(12)
        .default([]),
    docNames: z.array(z.string().max(255)).max(5).default([]),
    /** Client asks to wrap up early ("Skip to my venture"). */
    finalize: z.boolean().default(false),
})
export type InterviewRequest = z.infer<typeof InterviewRequestSchema>

// ──────────────────────────────────────────────────────────────────────────────
// Idea updates
// ──────────────────────────────────────────────────────────────────────────────

export const IdeaUpdateKindSchema = z.enum([
    'feature',
    'pivot',
    'scope',
    'audience',
    'tweak',
    'other',
])
export type IdeaUpdateKind = z.infer<typeof IdeaUpdateKindSchema>

/** Module ids the impact analysis is allowed to name — the live module set. */
export const IMPACTABLE_MODULES = ['landing', 'shadow-board', 'investor-kit'] as const

export const IdeaUpdateInputSchema = z.object({
    text: z.string().min(3).max(2000),
})

/** Shape the fold-in model returns. */
export const IdeaFoldResultSchema = z.object({
    kind: IdeaUpdateKindSchema.default('other'),
    summary: z.string().max(200).default(''),
    impactedModules: z.array(z.enum(IMPACTABLE_MODULES)).max(3).default([]),
    rationale: z.string().max(400).default(''),
    brief: IdeaBriefDraftSchema,
})

export interface IdeaUpdate {
    id: string
    project_id: string
    user_id: string
    kind: IdeaUpdateKind
    raw_text: string
    ai_summary: string | null
    impact: { modules?: string[]; rationale?: string }
    brief_version: number
    created_at: string
}
