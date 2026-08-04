// app/api/projects/[id]/idea/route.ts
// The living idea: read the current brief + changelog, or log a new update.
//
// GET  → { brief, version, summary, updates[] }
// POST → { text } → folds the note into the brief, bumps the version, and
//         records a changelog entry naming the modules it invalidates.
export const maxDuration = 60

import { requireAuth, isAuthError } from '@/lib/auth'
import { getProject } from '@/lib/queries'
import { getIdeaUpdates, createIdeaUpdate, applyBriefUpdate } from '@/lib/queries/idea-queries'
import { foldUpdateIntoBrief, parseBrief } from '@/lib/idea-brief'
import { IdeaUpdateInputSchema } from '@/lib/schemas/idea'
import { enforceRateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/log'

// Each POST is a Gemini Flash call plus two writes. 20/hour is far above real
// usage and well below anything that could be used to burn tokens.
const UPDATE_WINDOW_SEC = 3600
const UPDATE_LIMIT = 20

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params

        // Being logged in is not the same as owning the project.
        const project = await getProject(id, session.userId)
        if (!project) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const updates = await getIdeaUpdates(id)

        return NextResponse.json({
            brief: parseBrief(project.idea_brief),
            version: typeof project.idea_version === 'number' ? project.idea_version : 1,
            summary: project.global_idea ?? '',
            updates,
        })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        logError('projects/id/idea', e, { msg: 'GET failed' })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params

        const project = await getProject(id, session.userId)
        if (!project) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const rl = await enforceRateLimit(session.userId, 'idea-update', UPDATE_WINDOW_SEC, UPDATE_LIMIT)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many updates. Please try again later.' },
                { status: 429 }
            )
        }

        const body = await request.json().catch(() => null)
        const parsed = IdeaUpdateInputSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
        }

        const currentVersion =
            typeof project.idea_version === 'number' ? project.idea_version : 1
        const previous = parseBrief(project.idea_brief)

        // Never throws — degrades to a mechanical merge if Gemini is down.
        const folded = await foldUpdateIntoBrief(previous, parsed.data.text, currentVersion + 1)

        // Persist the brief first; the changelog row is secondary.
        const newVersion = await applyBriefUpdate(id, folded.brief, folded.brief.summary)
        const effectiveVersion = newVersion ?? currentVersion + 1

        const update = await createIdeaUpdate({
            projectId: id,
            userId: session.userId,
            kind: folded.kind,
            rawText: parsed.data.text,
            aiSummary: folded.summary || null,
            impact: { modules: folded.impactedModules, rationale: folded.rationale },
            briefVersion: effectiveVersion,
        })

        return NextResponse.json({
            brief: folded.brief,
            version: effectiveVersion,
            summary: folded.brief.summary,
            impactedModules: folded.impactedModules,
            aiApplied: folded.aiApplied,
            // null when migration 047 has not been applied — the brief still
            // updated, only the changelog row was skipped.
            update,
        })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        logError('projects/id/idea', e, { msg: 'POST failed' })
        return NextResponse.json({ error: 'Could not save that update' }, { status: 500 })
    }
}
