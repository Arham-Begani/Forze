// lib/queries/idea-queries.ts
// Typed helpers for the idea brief + idea_updates changelog (migration 047).
// Lives in lib/queries/ alongside campaign-queries / inspiration-queries so the
// discovery pattern stays consistent.
//
// EVERY helper here tolerates the migration not having been applied: a missing
// column or missing table degrades to a no-op / empty result instead of
// throwing, so the Idea panel can never take down the project page.

import 'server-only'

import { createDb } from '@/lib/db'
import type { IdeaBrief, IdeaUpdate, IdeaUpdateKind } from '@/lib/schemas/idea'
import { logWarn } from '@/lib/log'

/** Postgres "undefined table" / "undefined column" — i.e. migration 047 not applied. */
function isMissingSchemaError(err: { code?: string; message?: string } | null | undefined): boolean {
    if (!err) return false
    if (err.code === '42P01' || err.code === '42703') return true
    const msg = (err.message || '').toLowerCase()
    return (
        msg.includes('idea_updates') ||
        msg.includes('idea_brief') ||
        msg.includes('idea_version') ||
        msg.includes('bump_project_idea')
    )
}

export interface IdeaUpdateInsert {
    projectId: string
    userId: string
    kind: IdeaUpdateKind
    rawText: string
    aiSummary: string | null
    impact: { modules?: string[]; rationale?: string }
    briefVersion: number
}

/**
 * Newest-first changelog for a project. Returns [] when the table is missing so
 * the panel renders an empty timeline rather than erroring.
 */
export async function getIdeaUpdates(projectId: string, limit = 50): Promise<IdeaUpdate[]> {
    try {
        const db = await createDb()
        const { data, error } = await db
            .from('idea_updates')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) {
            if (isMissingSchemaError(error)) {
                logWarn('idea-queries', 'idea_updates unavailable (migration 047 not applied?)')
                return []
            }
            throw new Error(`getIdeaUpdates failed: ${error.message}`)
        }
        return (data ?? []) as IdeaUpdate[]
    } catch (err) {
        logWarn('idea-queries', 'getIdeaUpdates degraded to empty', {
            message: err instanceof Error ? err.message : String(err),
        })
        return []
    }
}

/**
 * Append one changelog entry. Returns null (never throws) when the table is
 * missing — the brief update itself is the important write, the log is
 * secondary.
 */
export async function createIdeaUpdate(input: IdeaUpdateInsert): Promise<IdeaUpdate | null> {
    try {
        const db = await createDb()
        const { data, error } = await db
            .from('idea_updates')
            .insert({
                project_id: input.projectId,
                user_id: input.userId,
                kind: input.kind,
                raw_text: input.rawText,
                ai_summary: input.aiSummary,
                impact: input.impact,
                brief_version: input.briefVersion,
            })
            .select()
            .single()

        if (error) {
            if (isMissingSchemaError(error)) return null
            throw new Error(`createIdeaUpdate failed: ${error.message}`)
        }
        return data as IdeaUpdate
    } catch (err) {
        logWarn('idea-queries', 'createIdeaUpdate skipped', {
            message: err instanceof Error ? err.message : String(err),
        })
        return null
    }
}

/**
 * Persist the next version of the brief and bump `projects.idea_version`.
 *
 * Prefers the atomic RPC from migration 047 so two concurrent updates cannot
 * both land on the same version. Falls back to a read-modify-write when the RPC
 * is absent (migration not applied), which matches the pre-047 behavior of
 * having no versioning at all.
 *
 * Returns the new version, or null if the write could not be applied.
 */
export async function applyBriefUpdate(
    projectId: string,
    brief: IdeaBrief,
    summary: string
): Promise<number | null> {
    const db = await createDb()

    // ── Atomic path ──
    const { data: rpcData, error: rpcError } = await db.rpc('bump_project_idea', {
        project_id_val: projectId,
        new_brief: brief as unknown as Record<string, unknown>,
        new_summary: summary,
    })
    if (!rpcError && typeof rpcData === 'number') return rpcData

    // ── Fallback: read-modify-write ──
    try {
        const { data: project, error: readError } = await db
            .from('projects')
            .select('idea_version')
            .eq('id', projectId)
            .single()

        const current =
            !readError && project && typeof project.idea_version === 'number'
                ? project.idea_version
                : brief.version - 1
        const next = Math.max(1, current + 1)

        const updates: Record<string, unknown> = {
            global_idea: summary,
            updated_at: new Date().toISOString(),
        }
        // Only attempt the new columns if the read above proved they exist.
        if (!readError) {
            updates.idea_brief = brief
            updates.idea_version = next
        }

        const { error: writeError } = await db.from('projects').update(updates).eq('id', projectId)
        if (writeError) {
            if (isMissingSchemaError(writeError)) {
                // Last resort: at least keep global_idea current so the agents
                // see the change even without versioning.
                await db
                    .from('projects')
                    .update({ global_idea: summary, updated_at: new Date().toISOString() })
                    .eq('id', projectId)
                return null
            }
            throw new Error(`applyBriefUpdate failed: ${writeError.message}`)
        }
        return readError ? null : next
    } catch (err) {
        logWarn('idea-queries', 'applyBriefUpdate degraded', {
            message: err instanceof Error ? err.message : String(err),
        })
        return null
    }
}
