import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createDb } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  CreateRoutineInput,
  Routine,
  RoutineRun,
  RoutineRunStatus,
  RoutineChannel,
  RoutineCadence,
  UpdateRoutineInput,
} from '@/lib/schemas/routine'
import { computeInitialNextRunAt } from '@/lib/schemas/routine'

// Same DbClient alias used across the codebase. Untyped Supabase generics
// because we don't generate types from the schema yet.
type DbClient = SupabaseClient<any, any, any>

async function resolveDb(db?: DbClient): Promise<DbClient> {
  return db ?? (await createDb())
}

function resolveAdminDb(db?: DbClient): DbClient {
  return db ?? createAdminClient()
}

// ─── User-scoped CRUD ─────────────────────────────────────────────────────────

export async function listRoutinesByVenture(
  ventureId: string,
  userId: string,
  db?: DbClient
): Promise<Routine[]> {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('routines')
    .select('*')
    .eq('venture_id', ventureId)
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`listRoutinesByVenture failed: ${error.message}`)
  return (data ?? []) as Routine[]
}

export async function getRoutineForUser(
  routineId: string,
  userId: string,
  db?: DbClient
): Promise<Routine | null> {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('routines')
    .select('*')
    .eq('id', routineId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  return data as Routine
}

export async function createRoutine(
  userId: string,
  ventureId: string,
  input: CreateRoutineInput,
  db?: DbClient
): Promise<Routine> {
  const client = await resolveDb(db)

  const sendHour = input.send_hour ?? 9
  const sendMinute = input.send_minute ?? 0
  const timezone = input.timezone || 'UTC'
  const nextRunAt = computeInitialNextRunAt(
    input.cadence,
    sendHour,
    sendMinute,
    timezone
  ).toISOString()

  const { data, error } = await client
    .from('routines')
    .insert({
      user_id: userId,
      venture_id: ventureId,
      name: input.name,
      channel: input.channel,
      cadence: input.cadence,
      status: 'active',
      campaign_id: input.campaign_id ?? null,
      angle_hint: input.angle_hint ?? null,
      send_hour: sendHour,
      send_minute: sendMinute,
      timezone,
      next_run_at: nextRunAt,
    })
    .select('*')
    .single()

  if (error) throw new Error(`createRoutine failed: ${error.message}`)
  return data as Routine
}

export async function updateRoutine(
  routineId: string,
  userId: string,
  input: UpdateRoutineInput,
  db?: DbClient
): Promise<Routine> {
  const client = await resolveDb(db)

  // Build payload from only the keys the user supplied — partial-update
  // semantics. updated_at is set by the trg_routines_updated_at trigger.
  const payload: Record<string, unknown> = {}
  if (input.name !== undefined) payload.name = input.name
  if (input.cadence !== undefined) payload.cadence = input.cadence
  if (input.status !== undefined) payload.status = input.status
  if (input.angle_hint !== undefined) payload.angle_hint = input.angle_hint
  if (input.send_hour !== undefined) payload.send_hour = input.send_hour
  if (input.send_minute !== undefined) payload.send_minute = input.send_minute
  if (input.timezone !== undefined) payload.timezone = input.timezone

  // If cadence or schedule changed, recompute next_run_at so the new
  // schedule takes effect immediately instead of after the next fire. Same
  // logic Postgres's compute_routine_initial_next_run uses — we mirror it
  // in TS here so the API response includes the new instant without an
  // extra round-trip.
  const scheduleChanged =
    input.cadence !== undefined ||
    input.send_hour !== undefined ||
    input.send_minute !== undefined ||
    input.timezone !== undefined

  if (scheduleChanged) {
    const current = await getRoutineForUser(routineId, userId, client)
    if (!current) throw new Error('Routine not found')
    const cadence = (input.cadence ?? current.cadence) as RoutineCadence
    const hour = input.send_hour ?? current.send_hour
    const minute = input.send_minute ?? current.send_minute
    const timezone = input.timezone ?? current.timezone
    payload.next_run_at = computeInitialNextRunAt(
      cadence,
      hour,
      minute,
      timezone
    ).toISOString()
  }

  const { data, error } = await client
    .from('routines')
    .update(payload)
    .eq('id', routineId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw new Error(`updateRoutine failed: ${error.message}`)
  return data as Routine
}

export async function deleteRoutine(
  routineId: string,
  userId: string,
  db?: DbClient
): Promise<void> {
  const client = await resolveDb(db)
  const { error } = await client
    .from('routines')
    .delete()
    .eq('id', routineId)
    .eq('user_id', userId)

  if (error) throw new Error(`deleteRoutine failed: ${error.message}`)
}

// ─── Cron / executor (admin client) ───────────────────────────────────────────

// Atomic batch claim. The RPC marks rows as run (last_run_at + run_count)
// inside the same statement that selects them, so two overlapping cron
// invocations never see the same row.
export interface ClaimedRoutine {
  id: string
  user_id: string
  venture_id: string
  channel: RoutineChannel
  cadence: RoutineCadence
  campaign_id: string | null
  angle_hint: string | null
  name: string
  run_count: number
}

export async function claimDueRoutines(
  limit = 50,
  db?: DbClient
): Promise<ClaimedRoutine[]> {
  const client = resolveAdminDb(db)
  const { data, error } = await client.rpc('claim_due_routines', { p_limit: limit })
  if (error) throw new Error(`claimDueRoutines failed: ${error.message}`)
  return (data ?? []) as ClaimedRoutine[]
}

// Per-user atomic claim. Used by the user-triggered "fire mine" endpoint so
// opening the Routines panel runs only the caller's due routines — never
// touching another tenant's queue. Mirrors claim_due_routines's SKIP LOCKED
// semantics so two overlapping requests for the same user can't double-fire.
export async function claimDueRoutinesForUser(
  userId: string,
  limit = 25,
  db?: DbClient
): Promise<ClaimedRoutine[]> {
  const client = resolveAdminDb(db)
  const { data, error } = await client.rpc('claim_due_routines_for_user', {
    p_user_id: userId,
    p_limit: limit,
  })
  if (error) throw new Error(`claimDueRoutinesForUser failed: ${error.message}`)
  return (data ?? []) as ClaimedRoutine[]
}

export async function advanceRoutineNextRun(
  routineId: string,
  clearError = true,
  db?: DbClient
): Promise<void> {
  const client = resolveAdminDb(db)
  const { error } = await client.rpc('advance_routine_next_run', {
    p_id: routineId,
    p_clear_error: clearError,
  })
  if (error) throw new Error(`advanceRoutineNextRun failed: ${error.message}`)
}

export async function recordRoutineRun(args: {
  routineId: string
  userId: string
  status: RoutineRunStatus
  channel: RoutineChannel
  metadata?: Record<string, unknown>
  errorMessage?: string | null
  db?: DbClient
}): Promise<void> {
  const client = resolveAdminDb(args.db)
  const { error } = await client.rpc('record_routine_run', {
    p_routine_id: args.routineId,
    p_user_id: args.userId,
    p_status: args.status,
    p_channel: args.channel,
    p_metadata: args.metadata ?? {},
    p_error_message: args.errorMessage ?? null,
  })
  if (error) {
    // Don't throw — the run already happened; losing the audit row is bad
    // but not as bad as failing the cron and double-charging on retry.
    console.error('[routine-queries] recordRoutineRun failed:', error.message)
  }
}

// Used by the cron executor to mark a routine paused when its linked
// campaign has been deleted (campaign_id is now NULL).
export async function pauseRoutineWithError(
  routineId: string,
  errorMessage: string,
  db?: DbClient
): Promise<void> {
  const client = resolveAdminDb(db)
  const { error } = await client
    .from('routines')
    .update({
      status: 'paused',
      last_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routineId)
  if (error) console.error('[routine-queries] pauseRoutineWithError failed:', error.message)
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

export async function listRoutineRuns(
  routineId: string,
  userId: string,
  limit = 20,
  db?: DbClient
): Promise<RoutineRun[]> {
  const client = await resolveDb(db)
  // Verify ownership in the same query — RLS allows the SELECT, but we want
  // a clean "not found vs forbidden" boundary at the API layer.
  const owned = await client
    .from('routines')
    .select('id')
    .eq('id', routineId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!owned.data) return []

  const { data, error } = await client
    .from('routine_runs')
    .select('*')
    .eq('routine_id', routineId)
    .order('ran_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)))

  if (error) throw new Error(`listRoutineRuns failed: ${error.message}`)
  return (data ?? []) as RoutineRun[]
}

// Admin-side venture context fetch for the executor (no user session in cron).
export async function getVentureContextAdmin(
  ventureId: string,
  db?: DbClient
): Promise<{
  id: string
  user_id: string
  name: string
  context: Record<string, unknown>
} | null> {
  const client = resolveAdminDb(db)
  const { data, error } = await client
    .from('ventures')
    .select('id, user_id, name, context')
    .eq('id', ventureId)
    .maybeSingle()

  if (error || !data) return null
  return data as { id: string; user_id: string; name: string; context: Record<string, unknown> }
}
