import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createDb } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'

type DbClient = SupabaseClient<any, any, any>

async function resolveDb(db?: DbClient): Promise<DbClient> {
  return db ?? (await createDb())
}

function resolveAdminDb(db?: DbClient): DbClient {
  return db ?? createAdminClient()
}

export interface AutopilotSettings {
  venture_id: string
  user_id: string
  location: string | null
  default_approval_window_hours: number
  event_radar_enabled: boolean
  max_comment_replies_per_run: number
}

export const DEFAULT_AUTOPILOT_SETTINGS: Omit<AutopilotSettings, 'venture_id' | 'user_id'> = {
  location: null,
  default_approval_window_hours: 12,
  event_radar_enabled: true,
  max_comment_replies_per_run: 10,
}

export interface VentureEventRow {
  id: string
  venture_id: string
  user_id: string
  name: string
  url: string | null
  url_key: string
  source_url: string | null
  starts_at: string | null
  ends_at: string | null
  city: string | null
  venue: string | null
  format: 'in_person' | 'virtual' | 'hybrid'
  price_note: string | null
  audience: string | null
  why_relevant: string | null
  score: number
  conflicts: unknown
  status: 'suggested' | 'saved' | 'dismissed' | 'added_to_calendar'
  calendar_event_id: string | null
  discovered_at: string
}

export interface SuggestedActionRow {
  id: string
  venture_id: string
  user_id: string
  routine_id: string | null
  kind: 'comment_suggestion' | 'comment_escalation' | 'event_rsvp' | 'other'
  channel: string | null
  title: string
  body: string
  target_url: string | null
  context: Record<string, unknown>
  status: 'pending' | 'done' | 'dismissed'
  created_at: string
}

export function buildEventKey(name: string, url: string | null | undefined): string {
  const fromUrl = (url ?? '').trim().toLowerCase()
  if (fromUrl) {
    const stripped = fromUrl
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('#')[0]
      .split('?')[0]
      .replace(/\/+$/, '')
    if (stripped) return stripped.slice(0, 400)
  }
  return name.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 400)
}

export async function getRoutineApprovalWindowHours(
  routineId: string,
  db?: DbClient
): Promise<number> {
  try {
    const client = resolveAdminDb(db)
    const { data, error } = await client
      .from('routines')
      .select('approval_window_hours')
      .eq('id', routineId)
      .maybeSingle()

    if (error || !data) return 0
    const raw = (data as { approval_window_hours?: unknown }).approval_window_hours
    const value = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(value) || value <= 0) return 0
    return Math.min(Math.floor(value), 168)
  } catch {
    return 0
  }
}

export async function getAutopilotSettings(
  ventureId: string,
  db?: DbClient
): Promise<Omit<AutopilotSettings, 'venture_id' | 'user_id'>> {
  try {
    const client = resolveAdminDb(db)
    const { data, error } = await client
      .from('venture_autopilot_settings')
      .select('location, default_approval_window_hours, event_radar_enabled, max_comment_replies_per_run')
      .eq('venture_id', ventureId)
      .maybeSingle()

    if (error || !data) return { ...DEFAULT_AUTOPILOT_SETTINGS }
    return {
      location: data.location ?? null,
      default_approval_window_hours:
        data.default_approval_window_hours ?? DEFAULT_AUTOPILOT_SETTINGS.default_approval_window_hours,
      event_radar_enabled:
        data.event_radar_enabled ?? DEFAULT_AUTOPILOT_SETTINGS.event_radar_enabled,
      max_comment_replies_per_run:
        data.max_comment_replies_per_run ?? DEFAULT_AUTOPILOT_SETTINGS.max_comment_replies_per_run,
    }
  } catch {
    return { ...DEFAULT_AUTOPILOT_SETTINGS }
  }
}

export async function upsertAutopilotSettings(
  ventureId: string,
  userId: string,
  patch: Partial<Omit<AutopilotSettings, 'venture_id' | 'user_id'>>,
  db?: DbClient
): Promise<void> {
  const client = await resolveDb(db)
  const payload: Record<string, unknown> = {
    venture_id: ventureId,
    user_id: userId,
    updated_at: new Date().toISOString(),
  }
  if (patch.location !== undefined) payload.location = patch.location
  if (patch.default_approval_window_hours !== undefined) {
    payload.default_approval_window_hours = patch.default_approval_window_hours
  }
  if (patch.event_radar_enabled !== undefined) {
    payload.event_radar_enabled = patch.event_radar_enabled
  }
  if (patch.max_comment_replies_per_run !== undefined) {
    payload.max_comment_replies_per_run = patch.max_comment_replies_per_run
  }

  const { error } = await client
    .from('venture_autopilot_settings')
    .upsert(payload, { onConflict: 'venture_id' })

  if (error) throw new Error(`upsertAutopilotSettings failed: ${error.message}`)
}

export async function saveDiscoveredEvents(
  ventureId: string,
  userId: string,
  rows: Array<Omit<VentureEventRow, 'id' | 'venture_id' | 'user_id' | 'discovered_at'>>,
  db?: DbClient
): Promise<number> {
  if (rows.length === 0) return 0
  const client = resolveAdminDb(db)

  const payload = rows.map((row) => ({
    venture_id: ventureId,
    user_id: userId,
    name: row.name,
    url: row.url,
    url_key: row.url_key,
    source_url: row.source_url,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    city: row.city,
    venue: row.venue,
    format: row.format,
    price_note: row.price_note,
    audience: row.audience,
    why_relevant: row.why_relevant,
    score: row.score,
    conflicts: row.conflicts ?? [],
    status: row.status,
    calendar_event_id: row.calendar_event_id,
  }))

  const { data, error } = await client
    .from('venture_events')
    .upsert(payload, { onConflict: 'venture_id,url_key', ignoreDuplicates: true })
    .select('id')

  if (error) throw new Error(`saveDiscoveredEvents failed: ${error.message}`)
  return (data ?? []).length
}

export async function listVentureEvents(
  ventureId: string,
  userId: string,
  db?: DbClient
): Promise<VentureEventRow[]> {
  try {
    const client = await resolveDb(db)
    const { data, error } = await client
      .from('venture_events')
      .select('*')
      .eq('venture_id', ventureId)
      .eq('user_id', userId)
      .neq('status', 'dismissed')
      .order('score', { ascending: false })
      .limit(50)

    if (error) return []
    const now = Date.now()
    return ((data ?? []) as VentureEventRow[]).filter((row) => {
      if (!row.starts_at) return true
      const start = new Date(row.starts_at).getTime()
      return Number.isFinite(start) ? start >= now - 24 * 60 * 60 * 1000 : true
    })
  } catch {
    return []
  }
}

export async function updateVentureEvent(
  eventId: string,
  userId: string,
  patch: { status?: VentureEventRow['status']; calendar_event_id?: string | null },
  db?: DbClient
): Promise<VentureEventRow | null> {
  const client = await resolveDb(db)
  const payload: Record<string, unknown> = {}
  if (patch.status !== undefined) payload.status = patch.status
  if (patch.calendar_event_id !== undefined) payload.calendar_event_id = patch.calendar_event_id
  if (Object.keys(payload).length === 0) return null

  const { data, error } = await client
    .from('venture_events')
    .update(payload)
    .eq('id', eventId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle()

  if (error || !data) return null
  return data as VentureEventRow
}

export async function getVentureEvent(
  eventId: string,
  userId: string,
  db?: DbClient
): Promise<VentureEventRow | null> {
  try {
    const client = await resolveDb(db)
    const { data, error } = await client
      .from('venture_events')
      .select('*')
      .eq('id', eventId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return null
    return data as VentureEventRow
  } catch {
    return null
  }
}

export async function createSuggestedAction(
  args: {
    ventureId: string
    userId: string
    routineId?: string | null
    kind: SuggestedActionRow['kind']
    channel?: string | null
    title: string
    body?: string
    targetUrl?: string | null
    context?: Record<string, unknown>
  },
  db?: DbClient
): Promise<void> {
  try {
    const client = resolveAdminDb(db)
    await client.from('suggested_actions').insert({
      venture_id: args.ventureId,
      user_id: args.userId,
      routine_id: args.routineId ?? null,
      kind: args.kind,
      channel: args.channel ?? null,
      title: args.title.slice(0, 300),
      body: (args.body ?? '').slice(0, 4000),
      target_url: args.targetUrl ?? null,
      context: args.context ?? {},
      status: 'pending',
    })
  } catch {
    // a lost suggestion must never fail the routine that produced it
  }
}

export async function listSuggestedActions(
  ventureId: string,
  userId: string,
  db?: DbClient
): Promise<SuggestedActionRow[]> {
  try {
    const client = await resolveDb(db)
    const { data, error } = await client
      .from('suggested_actions')
      .select('*')
      .eq('venture_id', ventureId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return []
    return (data ?? []) as SuggestedActionRow[]
  } catch {
    return []
  }
}

export async function updateSuggestedActionStatus(
  actionId: string,
  userId: string,
  status: SuggestedActionRow['status'],
  db?: DbClient
): Promise<boolean> {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('suggested_actions')
    .update({ status })
    .eq('id', actionId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  return !error && Boolean(data)
}

export async function listRepliedCommentIds(
  ventureId: string,
  commentIds: string[],
  db?: DbClient
): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set()
  try {
    const client = resolveAdminDb(db)
    const { data, error } = await client
      .from('instagram_comment_replies')
      .select('comment_id')
      .eq('venture_id', ventureId)
      .in('comment_id', commentIds)

    if (error) return new Set()
    return new Set((data ?? []).map((row: { comment_id: string }) => row.comment_id))
  } catch {
    return new Set()
  }
}

export async function recordCommentReply(
  args: {
    userId: string
    ventureId: string
    routineId?: string | null
    commentId: string
    mediaId?: string | null
    commentText?: string | null
    replyText?: string | null
    classification: 'positive' | 'question' | 'negative' | 'spam' | 'ambiguous'
    outcome: 'replied' | 'escalated' | 'skipped' | 'failed'
    errorMessage?: string | null
  },
  db?: DbClient
): Promise<boolean> {
  try {
    const client = resolveAdminDb(db)
    const { error } = await client.from('instagram_comment_replies').insert({
      user_id: args.userId,
      venture_id: args.ventureId,
      routine_id: args.routineId ?? null,
      comment_id: args.commentId,
      media_id: args.mediaId ?? null,
      comment_text: (args.commentText ?? '').slice(0, 2000),
      reply_text: (args.replyText ?? '').slice(0, 2000),
      classification: args.classification,
      outcome: args.outcome,
      error_message: args.errorMessage ?? null,
    })
    return !error
  } catch {
    return false
  }
}
