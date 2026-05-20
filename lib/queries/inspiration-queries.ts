// lib/queries/inspiration-queries.ts
// Typed helpers for the inspiration_analyses + inspiration_rate_limits tables.
// Lives in lib/queries/ alongside blog-queries / campaign-queries / routine-queries
// so the discovery pattern stays consistent.

import { createDb } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'
import type { DesignTokens } from '@/lib/schemas/inspiration'

export interface InspirationAnalysisRow {
    id: string
    venture_id: string
    user_id: string
    urls: string[]
    capture_tier: number | null
    capture_metadata: Record<string, unknown>
    raw_vision: Record<string, unknown> | null
    tokens: DesignTokens | null
    user_adjustments: Record<string, unknown>
    locked_paths: string[]
    confidence: Record<string, number>
    mood: string | null
    status: 'analyzing' | 'complete' | 'failed'
    error_message: string | null
    applied_at: string | null
    created_at: string
    updated_at: string
}

interface InspirationAnalysisInsert {
    venture_id: string
    user_id: string
    urls: string[]
    capture_tier?: number | null
    capture_metadata?: Record<string, unknown>
    raw_vision?: Record<string, unknown> | null
    tokens?: DesignTokens | null
    confidence?: Record<string, number>
    mood?: string | null
    status?: InspirationAnalysisRow['status']
    error_message?: string | null
}

const DAILY_USER_LIMIT = 20
const DAILY_VENTURE_LIMIT = 5

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Hot-path check: how many analyses the user has spent today on this venture
// (and total across all ventures). Returns the remaining counts so the UI can
// show "4/5 left today" before the founder pastes URLs.

export interface RateLimitView {
    perVentureUsed: number
    perVentureRemaining: number
    perUserUsed: number
    perUserRemaining: number
    allowed: boolean
    resetUtcDate: string
}

export async function checkInspirationRateLimit(
    userId: string,
    ventureId: string,
): Promise<RateLimitView> {
    const db = await createDb()
    const today = todayUtc()

    // Per-venture count (zero rows is fine — implies first run today).
    const { data: ventureRow } = await db
        .from('inspiration_rate_limits')
        .select('analysis_count')
        .eq('user_id', userId)
        .eq('venture_id', ventureId)
        .eq('window_date', today)
        .maybeSingle()
    const perVentureUsed = ventureRow?.analysis_count ?? 0

    // Per-user total across ALL ventures today.
    const { data: userRows } = await db
        .from('inspiration_rate_limits')
        .select('analysis_count')
        .eq('user_id', userId)
        .eq('window_date', today)
    const perUserUsed = (userRows ?? []).reduce((sum, r) => sum + (r.analysis_count ?? 0), 0)

    const perVentureRemaining = Math.max(0, DAILY_VENTURE_LIMIT - perVentureUsed)
    const perUserRemaining = Math.max(0, DAILY_USER_LIMIT - perUserUsed)
    const allowed = perVentureRemaining > 0 && perUserRemaining > 0

    return {
        perVentureUsed,
        perVentureRemaining,
        perUserUsed,
        perUserRemaining,
        allowed,
        resetUtcDate: nextUtcMidnight(),
    }
}

export async function incrementInspirationRateLimit(userId: string, ventureId: string): Promise<void> {
    // Upsert with on-conflict increment. Supabase doesn't expose ON CONFLICT
    // DO UPDATE for arbitrary expressions through .upsert(), so we do a
    // read-then-write under a try/catch — the unique constraint will reject
    // any duplicate insert, and the increment closure is idempotent under
    // the day window.
    const db = await createDb()
    const today = todayUtc()

    const { data: existing } = await db
        .from('inspiration_rate_limits')
        .select('id, analysis_count')
        .eq('user_id', userId)
        .eq('venture_id', ventureId)
        .eq('window_date', today)
        .maybeSingle()

    if (existing) {
        const { error } = await db
            .from('inspiration_rate_limits')
            .update({ analysis_count: (existing.analysis_count ?? 0) + 1 })
            .eq('id', existing.id)
        if (error) throw new Error(`incrementInspirationRateLimit update failed: ${error.message}`)
        return
    }

    const { error } = await db
        .from('inspiration_rate_limits')
        .insert({
            user_id: userId,
            venture_id: ventureId,
            analysis_count: 1,
            window_date: today,
        })
    if (error) throw new Error(`incrementInspirationRateLimit insert failed: ${error.message}`)
}

// ── Analyses CRUD ─────────────────────────────────────────────────────────────

export async function createInspirationAnalysis(input: InspirationAnalysisInsert): Promise<InspirationAnalysisRow> {
    const db = await createDb()
    const { data, error } = await db
        .from('inspiration_analyses')
        .insert({
            venture_id: input.venture_id,
            user_id: input.user_id,
            urls: input.urls,
            capture_tier: input.capture_tier ?? null,
            capture_metadata: input.capture_metadata ?? {},
            raw_vision: input.raw_vision ?? null,
            tokens: input.tokens ?? null,
            confidence: input.confidence ?? {},
            mood: input.mood ?? null,
            status: input.status ?? 'analyzing',
            error_message: input.error_message ?? null,
        })
        .select()
        .single()
    if (error) throw new Error(`createInspirationAnalysis failed: ${error.message}`)
    return data as InspirationAnalysisRow
}

export async function updateInspirationAnalysis(
    id: string,
    userId: string,
    patch: Partial<{
        tokens: DesignTokens | null
        raw_vision: Record<string, unknown> | null
        capture_tier: number | null
        capture_metadata: Record<string, unknown>
        confidence: Record<string, number>
        mood: string | null
        status: InspirationAnalysisRow['status']
        error_message: string | null
        user_adjustments: Record<string, unknown>
        locked_paths: string[]
        applied_at: string | null
    }>,
): Promise<InspirationAnalysisRow | null> {
    const db = await createDb()
    const { data, error } = await db
        .from('inspiration_analyses')
        .update(patch)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .maybeSingle()
    if (error) throw new Error(`updateInspirationAnalysis failed: ${error.message}`)
    return (data as InspirationAnalysisRow | null) ?? null
}

export async function getInspirationAnalysis(
    id: string,
    userId: string,
): Promise<InspirationAnalysisRow | null> {
    const db = await createDb()
    const { data, error } = await db
        .from('inspiration_analyses')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle()
    if (error) throw new Error(`getInspirationAnalysis failed: ${error.message}`)
    return (data as InspirationAnalysisRow | null) ?? null
}

export async function listInspirationAnalysesForVenture(
    ventureId: string,
    userId: string,
    limit = 25,
): Promise<InspirationAnalysisRow[]> {
    const db = await createDb()
    const { data, error } = await db
        .from('inspiration_analyses')
        .select('*')
        .eq('venture_id', ventureId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
    if (error) throw new Error(`listInspirationAnalysesForVenture failed: ${error.message}`)
    return (data ?? []) as InspirationAnalysisRow[]
}

// ── Apply tokens to venture context ───────────────────────────────────────────
// Stores the chosen design tokens at `ventures.context.inspirationTokens`.
// The pipeline agent reads from this key on the next landing-page run.
//
// We always use the admin client here because the caller (the apply route)
// has already verified access via getVentureAccess. Mixing cookie-scoped
// reads with admin writes turned out to silently no-op for venture_members
// who weren't the original owner — RLS on ventures.select returned null and
// the helper threw "Venture not found" before getting to the update.
export async function setVentureInspirationTokens(
    ventureId: string,
    _userId: string,
    tokens: DesignTokens | null,
    options: { clearLanding?: boolean } = {},
): Promise<void> {
    const admin = createAdminClient()
    const { data: venture, error: fetchError } = await admin
        .from('ventures')
        .select('context')
        .eq('id', ventureId)
        .maybeSingle()
    if (fetchError) throw new Error(`setVentureInspirationTokens fetch failed: ${fetchError.message}`)
    if (!venture) throw new Error('Venture not found')

    const currentContext = (venture.context as Record<string, unknown>) ?? {}
    const nextContext: Record<string, unknown> = {
        ...currentContext,
        inspirationTokens: tokens,
    }

    // When the founder explicitly applies (or re-applies) tokens, they want a
    // visual redesign — not the pipeline agent's surgical edit-mode patch
    // against the previous landing copy. Clearing landing forces a fresh
    // generation that actually consumes the inspiration briefing.
    if (options.clearLanding) {
        nextContext.landing = null
    }

    const { error } = await admin
        .from('ventures')
        .update({ context: nextContext, updated_at: new Date().toISOString() })
        .eq('id', ventureId)
    if (error) throw new Error(`setVentureInspirationTokens update failed: ${error.message}`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayUtc(): string {
    return new Date().toISOString().slice(0, 10)
}

function nextUtcMidnight(): string {
    const now = new Date()
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
    return tomorrow.toISOString()
}
