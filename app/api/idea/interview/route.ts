// app/api/idea/interview/route.ts
// One turn of the idea-intake interview.
//
// STATELESS: this runs BEFORE any project or venture exists, so the client
// holds the transcript and re-posts it each turn. Nothing is written to the DB
// here — the founder only creates a project when they confirm the brief.
export const maxDuration = 60

import { requireAuth, isAuthError } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { runInterviewStep, MIN_QUESTIONS, MAX_QUESTIONS } from '@/lib/idea-intake'
import { fallbackBrief } from '@/lib/idea-brief'
import { InterviewRequestSchema } from '@/lib/schemas/idea'
import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/log'

// Each turn is a Gemini Flash call. A full interview is ~8 turns, so 60/hour
// allows several complete interviews while capping a scripted abuse loop.
const INTERVIEW_WINDOW_SEC = 3600
const INTERVIEW_LIMIT = 60

export async function POST(request: NextRequest) {
    let seedForFallback = ''

    try {
        const session = await requireAuth()

        const rl = await enforceRateLimit(
            session.userId,
            'idea-interview',
            INTERVIEW_WINDOW_SEC,
            INTERVIEW_LIMIT
        )
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { status: 429 }
            )
        }

        const body = await request.json().catch(() => null)
        const parsed = InterviewRequestSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
        }
        seedForFallback = parsed.data.seed

        const step = await runInterviewStep(parsed.data)

        return NextResponse.json({
            done: step.done,
            question: step.question,
            brief: step.brief,
            suggestedName: step.suggestedName ?? null,
            aiApplied: step.aiApplied,
            progress: {
                asked: parsed.data.answers.length,
                min: MIN_QUESTIONS,
                max: MAX_QUESTIONS,
            },
        })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        logError('idea/interview', e, { msg: 'interview turn failed' })

        // Graceful degradation: the founder must always be able to finish and
        // get a venture. Mirrors ventures/[id]/questions returning {questions:[]}
        // rather than surfacing an error.
        if (seedForFallback) {
            return NextResponse.json({
                done: true,
                question: null,
                brief: fallbackBrief(seedForFallback),
                suggestedName: null,
                aiApplied: false,
                progress: { asked: 0, min: MIN_QUESTIONS, max: MAX_QUESTIONS },
            })
        }
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
