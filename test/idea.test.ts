import { describe, it, expect } from 'vitest'
import {
    IdeaBriefSchema,
    InterviewRequestSchema,
    IdeaUpdateInputSchema,
    IDEA_SUMMARY_MAX,
} from '@/lib/schemas/idea'
import { renderBriefForPrompt, parseBrief, fallbackBrief, mergeBriefDraft } from '@/lib/idea-brief'

const FULL_BRIEF = {
    version: 2,
    summary: 'A scheduling tool for independent dog walkers.',
    problem: 'Walkers juggle bookings across texts and lose slots.',
    targetCustomer: 'Solo dog walkers with 10-40 recurring clients.',
    solution: 'One calendar that clients book into directly.',
    differentiator: 'Built around recurring weekly slots, not one-offs.',
    businessModel: 'Flat $19/mo per walker.',
    stage: 'prototype' as const,
    keyFeatures: ['Recurring slots', 'Client self-serve booking'],
    openQuestions: ['Do walkers want payments in-app?'],
    transcript: [{ q: 'Who pays?', a: 'The walker, not the owner.' }],
    updatedAt: '2026-08-04T00:00:00.000Z',
}

describe('IdeaBriefSchema', () => {
    it('accepts a full brief unchanged', () => {
        const parsed = IdeaBriefSchema.safeParse(FULL_BRIEF)
        expect(parsed.success).toBe(true)
        if (parsed.success) expect(parsed.data.summary).toBe(FULL_BRIEF.summary)
    })

    it('fills defaults when the model omits optional fields', () => {
        const parsed = IdeaBriefSchema.safeParse({ summary: 'Just a summary.' })
        expect(parsed.success).toBe(true)
        if (parsed.success) {
            expect(parsed.data.version).toBe(1)
            expect(parsed.data.stage).toBe('idea')
            expect(parsed.data.keyFeatures).toEqual([])
            expect(parsed.data.transcript).toEqual([])
        }
    })

    it('rejects a summary over the agent-safe cap', () => {
        const parsed = IdeaBriefSchema.safeParse({ summary: 'x'.repeat(IDEA_SUMMARY_MAX + 1) })
        expect(parsed.success).toBe(false)
    })

    it('rejects an unknown stage', () => {
        expect(IdeaBriefSchema.safeParse({ summary: 'ok', stage: 'scaling' }).success).toBe(false)
    })
})

describe('parseBrief', () => {
    it('returns null for null, undefined and non-objects', () => {
        expect(parseBrief(null)).toBeNull()
        expect(parseBrief(undefined)).toBeNull()
        expect(parseBrief('a string')).toBeNull()
        expect(parseBrief(42)).toBeNull()
    })

    it('returns null rather than throwing on a malformed row', () => {
        expect(parseBrief({ summary: 123, stage: 'nope' })).toBeNull()
    })

    it('round-trips a valid brief', () => {
        expect(parseBrief(FULL_BRIEF)?.problem).toBe(FULL_BRIEF.problem)
    })
})

describe('renderBriefForPrompt', () => {
    it('returns an empty string when there is no brief', () => {
        // Every project created before migration 047 hits this path — the run
        // route concatenates unconditionally, so '' must be a true no-op.
        expect(renderBriefForPrompt(null)).toBe('')
        expect(renderBriefForPrompt(undefined)).toBe('')
        expect(renderBriefForPrompt({})).toBe('')
    })

    it('renders every populated field as a labelled line', () => {
        const out = renderBriefForPrompt(FULL_BRIEF)
        expect(out).toContain('Founder Brief')
        expect(out).toContain('- Problem:')
        expect(out).toContain('- Target customer:')
        expect(out).toContain('- Differentiator:')
        expect(out).toContain('- Business model:')
        expect(out).toContain('Recurring slots; Client self-serve booking')
        expect(out).toContain('v2')
    })

    it('omits the summary — the run route already leads with global_idea', () => {
        expect(renderBriefForPrompt(FULL_BRIEF)).not.toContain(FULL_BRIEF.summary)
    })

    it('skips empty fields instead of emitting blank labels', () => {
        const out = renderBriefForPrompt({ ...FULL_BRIEF, differentiator: '', businessModel: '   ' })
        expect(out).not.toContain('- Differentiator:')
        expect(out).not.toContain('- Business model:')
        expect(out).toContain('- Problem:')
    })

    it('bounds a maximally-full brief so it cannot eat the whole agent budget', () => {
        // The agents clip the composed globalIdea at 6000 chars, shared between
        // global_idea, this block, and uploaded documents. Every field at its
        // schema maximum renders to ~6.2k unbounded, so the block caps itself.
        const fat = {
            ...FULL_BRIEF,
            problem: 'p'.repeat(600),
            solution: 's'.repeat(600),
            targetCustomer: 'c'.repeat(400),
            differentiator: 'd'.repeat(400),
            businessModel: 'm'.repeat(400),
            keyFeatures: Array.from({ length: 12 }, () => 'f'.repeat(200)),
            openQuestions: Array.from({ length: 6 }, () => 'q'.repeat(200)),
        }
        const out = renderBriefForPrompt(fat)
        expect(out.length).toBeLessThanOrEqual(2500)
        // Room must remain for a 900-char global_idea plus documents.
        expect(out.length + 900).toBeLessThan(6000)
    })

    it('leaves a realistic brief untouched', () => {
        expect(renderBriefForPrompt(FULL_BRIEF)).not.toContain('…')
    })
})

describe('fallbackBrief', () => {
    it('always produces a valid brief from a bare sentence', () => {
        const brief = fallbackBrief('an app for dog walkers')
        expect(IdeaBriefSchema.safeParse(brief).success).toBe(true)
        expect(brief.summary).toBe('an app for dog walkers')
    })

    it('clips an over-long seed to the agent-safe cap', () => {
        expect(fallbackBrief('x'.repeat(5000)).summary.length).toBe(IDEA_SUMMARY_MAX)
    })
})

describe('mergeBriefDraft', () => {
    it('falls back to the previous value for fields the model dropped', () => {
        const previous = IdeaBriefSchema.parse(FULL_BRIEF)
        const merged = mergeBriefDraft({ summary: 'Now with a B2B tier.' }, previous, 3)
        expect(merged).not.toBeNull()
        expect(merged!.summary).toBe('Now with a B2B tier.')
        // Detail the founder already gave must never be erased by a lazy response.
        expect(merged!.problem).toBe(FULL_BRIEF.problem)
        expect(merged!.keyFeatures).toEqual(FULL_BRIEF.keyFeatures)
        expect(merged!.version).toBe(3)
    })

    it('returns null when there is no usable summary', () => {
        expect(mergeBriefDraft({ problem: 'only a problem' }, null, 1)).toBeNull()
        expect(mergeBriefDraft(null, null, 1)).toBeNull()
        expect(mergeBriefDraft('nonsense', null, 1)).toBeNull()
    })

    it('coerces an invalid stage to "idea"', () => {
        expect(mergeBriefDraft({ summary: 'ok', stage: 'scaling' }, null, 1)!.stage).toBe('idea')
    })
})

describe('InterviewRequestSchema', () => {
    it('defaults answers and docNames so a first turn needs only a seed', () => {
        const parsed = InterviewRequestSchema.safeParse({ seed: 'an app for dog walkers' })
        expect(parsed.success).toBe(true)
        if (parsed.success) {
            expect(parsed.data.answers).toEqual([])
            expect(parsed.data.finalize).toBe(false)
        }
    })

    it('rejects a seed that is too short or too long', () => {
        expect(InterviewRequestSchema.safeParse({ seed: 'hi' }).success).toBe(false)
        expect(InterviewRequestSchema.safeParse({ seed: 'x'.repeat(2001) }).success).toBe(false)
    })

    it('caps the transcript so a client cannot grow the prompt without bound', () => {
        const answers = Array.from({ length: 13 }, (_, i) => ({ q: `q${i}`, a: `a${i}` }))
        expect(InterviewRequestSchema.safeParse({ seed: 'a valid seed', answers }).success).toBe(false)
    })
})

describe('IdeaUpdateInputSchema', () => {
    it('accepts a normal update note', () => {
        expect(IdeaUpdateInputSchema.safeParse({ text: 'Adding a B2B tier.' }).success).toBe(true)
    })

    it('rejects empty and oversized notes', () => {
        expect(IdeaUpdateInputSchema.safeParse({ text: '' }).success).toBe(false)
        expect(IdeaUpdateInputSchema.safeParse({ text: 'x'.repeat(2001) }).success).toBe(false)
    })
})
