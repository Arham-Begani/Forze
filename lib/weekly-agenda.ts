import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { listUpcomingEvents, type CalendarEvent } from '@/lib/google-calendar'
import { listVentureEvents, listSuggestedActions } from '@/lib/queries/autopilot-queries'
import { logError } from '@/lib/log'

type DbClient = SupabaseClient<any, any, any>

export interface AgendaCalendarEntry {
  title: string
  start: string | null
  end: string | null
  allDay: boolean
  location: string | null
  isForzeCreated: boolean
}

export interface AgendaPendingPost {
  assetId: string
  provider: string
  title: string
  publishAt: string | null
}

export interface AgendaEventPick {
  name: string
  url: string | null
  startsAt: string | null
  city: string | null
  score: number
  conflictCount: number
  whyRelevant: string | null
}

export interface WeeklyAgenda {
  generatedAt: string
  calendarConnected: boolean
  calendarError: string | null
  week: AgendaCalendarEntry[]
  pendingApproval: AgendaPendingPost[]
  events: AgendaEventPick[]
  suggestions: number
  newLeads: number
  unansweredReplies: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function toAgendaCalendarEntry(event: CalendarEvent): AgendaCalendarEntry {
  return {
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    location: event.location,
    isForzeCreated: event.isForzeCreated,
  }
}

async function readCalendar(
  userId: string
): Promise<{ connected: boolean; entries: AgendaCalendarEntry[]; error: string | null }> {
  try {
    const now = new Date()
    const events = await listUpcomingEvents(userId, {
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + WEEK_MS).toISOString(),
      maxResults: 60,
    })
    return { connected: true, entries: events.map(toAgendaCalendarEntry), error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'calendar unavailable'
    return { connected: false, entries: [], error: message }
  }
}

async function readPendingApprovals(
  ventureId: string,
  adminDb: DbClient
): Promise<AgendaPendingPost[]> {
  try {
    const { data, error } = await adminDb
      .from('marketing_assets')
      .select('id, provider, title, scheduled_for, status')
      .eq('venture_id', ventureId)
      .eq('status', 'scheduled')
      .order('scheduled_for', { ascending: true })
      .limit(25)

    if (error) return []
    return (data ?? []).map(
      (row: { id: string; provider: string; title: string; scheduled_for: string | null }) => ({
        assetId: row.id,
        provider: row.provider,
        title: row.title,
        publishAt: row.scheduled_for,
      })
    )
  } catch {
    return []
  }
}

async function countNewLeads(
  adminDb: DbClient,
  ventureId: string,
  sinceIso: string
): Promise<number> {
  try {
    const { count, error } = await adminDb
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('venture_id', ventureId)
      .gte('created_at', sinceIso)

    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

// outreach_replies has no venture_id of its own — it reaches a venture through
// leads.lead_id. Counting it with a direct venture_id filter would silently
// return 0 forever, which reads as "no replies" rather than "not measured".
async function countRecentReplies(
  adminDb: DbClient,
  ventureId: string,
  sinceIso: string
): Promise<number> {
  try {
    const { data: leadRows, error: leadError } = await adminDb
      .from('leads')
      .select('id')
      .eq('venture_id', ventureId)
      .limit(1000)

    if (leadError || !leadRows || leadRows.length === 0) return 0
    const leadIds = leadRows.map((row: { id: string }) => row.id)

    const { count, error } = await adminDb
      .from('outreach_replies')
      .select('id', { count: 'exact', head: true })
      .in('lead_id', leadIds)
      .gte('created_at', sinceIso)

    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

export async function buildWeeklyAgenda(args: {
  userId: string
  ventureId: string
  adminDb: DbClient
}): Promise<WeeklyAgenda> {
  const sinceIso = new Date(Date.now() - WEEK_MS).toISOString()

  const [calendar, pendingApproval, events, suggestions, newLeads, unansweredReplies] =
    await Promise.all([
      readCalendar(args.userId),
      readPendingApprovals(args.ventureId, args.adminDb),
      listVentureEvents(args.ventureId, args.userId).catch(() => []),
      listSuggestedActions(args.ventureId, args.userId).catch(() => []),
      countNewLeads(args.adminDb, args.ventureId, sinceIso),
      countRecentReplies(args.adminDb, args.ventureId, sinceIso),
    ])

  return {
    generatedAt: new Date().toISOString(),
    calendarConnected: calendar.connected,
    calendarError: calendar.error,
    week: calendar.entries,
    pendingApproval,
    events: events.slice(0, 5).map((row) => ({
      name: row.name,
      url: row.url,
      startsAt: row.starts_at,
      city: row.city,
      score: row.score,
      conflictCount: Array.isArray(row.conflicts) ? row.conflicts.length : 0,
      whyRelevant: row.why_relevant,
    })),
    suggestions: suggestions.length,
    newLeads,
    unansweredReplies,
  }
}

export function summarizeAgenda(agenda: WeeklyAgenda): string {
  const parts: string[] = []
  parts.push(
    agenda.calendarConnected
      ? `${agenda.week.length} thing${agenda.week.length === 1 ? '' : 's'} on your calendar this week`
      : 'calendar not connected'
  )
  if (agenda.pendingApproval.length > 0) {
    parts.push(`${agenda.pendingApproval.length} post${agenda.pendingApproval.length === 1 ? '' : 's'} awaiting your veto`)
  }
  if (agenda.events.length > 0) {
    parts.push(`${agenda.events.length} event${agenda.events.length === 1 ? '' : 's'} worth a look`)
  }
  if (agenda.newLeads > 0) {
    parts.push(`${agenda.newLeads} new lead${agenda.newLeads === 1 ? '' : 's'}`)
  }
  if (agenda.unansweredReplies > 0) {
    parts.push(`${agenda.unansweredReplies} repl${agenda.unansweredReplies === 1 ? 'y' : 'ies'} to read`)
  }
  return parts.join(', ')
}

export function logAgendaFailure(scope: string, err: unknown, ventureId: string): void {
  logError(scope, err, { ventureId })
}
