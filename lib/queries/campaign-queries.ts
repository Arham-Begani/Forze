import 'server-only'

import { createDb } from '@/lib/db'
import type { Campaign, CampaignLead, CampaignReply, CampaignMetrics, LeadsByStatus } from '@/lib/schemas/campaign'

// ─── Campaign CRUD ─────────────────────────────────────────────────────────────

export async function createCampaign(
  userId: string,
  ventureId: string,
  data: {
    name: string
    description?: string
    data_source?: Campaign['data_source']
    data_source_config?: Record<string, unknown>
  }
): Promise<Campaign> {
  const db = await createDb()
  const { data: row, error } = await db
    .from('campaigns')
    .insert({
      venture_id: ventureId,
      created_by: userId,
      name: data.name,
      description: data.description ?? null,
      data_source: data.data_source ?? 'manual',
      data_source_config: data.data_source_config ?? {},
      status: 'draft',
    })
    .select()
    .single()

  if (error) throw new Error(`createCampaign failed: ${error.message}`)
  return row as Campaign
}

export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (error) return null
  return data as Campaign
}

// Single-query campaign + ownership check. Replaces the two-round-trip pattern
// of getCampaign() + getVenture(venture_id, userId) used across every route.
// Returns null both when the campaign doesn't exist and when the caller
// doesn't own the parent venture — callers treat both as 404 on purpose so we
// don't leak existence of other users' campaigns.
export async function getCampaignForUser(
  campaignId: string,
  userId: string
): Promise<Campaign | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('campaigns')
    .select('*, venture:ventures!inner(user_id)')
    .eq('id', campaignId)
    .eq('venture.user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  const { venture: _venture, ...campaign } = data as Campaign & { venture: unknown }
  return campaign as Campaign
}

export async function listVentureCampaigns(ventureId: string): Promise<Campaign[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('campaigns')
    .select('*')
    .eq('venture_id', ventureId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`listVentureCampaigns failed: ${error.message}`)
  return (data ?? []) as Campaign[]
}

export async function updateCampaign(
  campaignId: string,
  updates: Partial<Omit<Campaign, 'id' | 'venture_id' | 'created_by' | 'created_at'>>,
  createdBy?: string
): Promise<Campaign> {
  const db = await createDb()
  let query = db
    .from('campaigns')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', campaignId)

  if (createdBy) {
    query = query.eq('created_by', createdBy)
  }

  const { data, error } = await query.select().single()
  if (error) throw new Error(`updateCampaign failed: ${error.message}`)
  return data as Campaign
}

export async function deleteCampaign(campaignId: string, createdBy?: string): Promise<void> {
  const db = await createDb()
  let query = db.from('campaigns').delete().eq('id', campaignId)

  if (createdBy) {
    query = query.eq('created_by', createdBy)
  }

  const { error } = await query
  if (error) throw new Error(`deleteCampaign failed: ${error.message}`)
}

// ─── Campaign Leads ────────────────────────────────────────────────────────────

// Upserts by (campaign_id, email) — the UNIQUE index added in migration 016
// makes this the single source of truth for dedupe. `ignoreDuplicates: true`
// ensures a second upload of the same list is a no-op rather than clobbering
// engagement state we've already tracked (opens, clicks, sends).
export async function createCampaignLeads(
  campaignId: string,
  leads: Array<{
    first_name: string
    last_name?: string
    email: string
    company?: string
    job_title?: string
  }>
): Promise<CampaignLead[]> {
  if (leads.length === 0) return []
  const db = await createDb()
  const rows = leads.map((l) => ({
    campaign_id: campaignId,
    first_name: l.first_name,
    last_name: l.last_name ?? null,
    email: l.email.trim().toLowerCase(),
    company: l.company ?? null,
    job_title: l.job_title ?? null,
    source: 'manual' as const,
    engagement_status: 'fresh' as const,
    send_status: 'pending' as const,
    verified: false,
  }))

  const { data, error } = await db
    .from('campaign_leads')
    .upsert(rows, { onConflict: 'campaign_id,email', ignoreDuplicates: true })
    .select()
  if (error) throw new Error(`createCampaignLeads failed: ${error.message}`)
  return (data ?? []) as CampaignLead[]
}

export async function getCampaignLeads(
  campaignId: string,
  page = 1,
  limit = 50
): Promise<{ leads: CampaignLead[]; total: number }> {
  const db = await createDb()
  const offset = (page - 1) * limit

  const { data, error, count } = await db
    .from('campaign_leads')
    .select('*', { count: 'exact' })
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(`getCampaignLeads failed: ${error.message}`)
  return { leads: (data ?? []) as CampaignLead[], total: count ?? 0 }
}

export async function getLeadEmailsForCampaign(campaignId: string): Promise<string[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('campaign_leads')
    .select('email')
    .eq('campaign_id', campaignId)

  if (error) throw new Error(`getLeadEmailsForCampaign failed: ${error.message}`)
  return (data ?? []).map((r: { email: string }) => r.email)
}

// Leads eligible for a fresh send. The filter moved from
// (email_sent_at IS NULL AND engagement_status = 'fresh') to the durable
// send_status lifecycle + suppression timestamps added in migration 016.
// That change matters for two reasons:
//   1. It excludes rows in 'sending' (claimed by a concurrent request) so a
//      retry can't double-send in the window between claim and mark-sent.
//   2. It honors unsubscribed_at / bounced_at regardless of what the
//      engagement_status column happens to say, which keeps CAN-SPAM
//      compliance from depending on enum ordering.
export async function getUnsentLeads(campaignId: string): Promise<CampaignLead[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('campaign_leads')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('send_status', 'pending')
    .is('unsubscribed_at', null)
    .is('bounced_at', null)

  if (error) throw new Error(`getUnsentLeads failed: ${error.message}`)
  return (data ?? []) as CampaignLead[]
}

// Atomic pending → sending compare-and-swap. Returns true only for the caller
// that actually flipped the row; every other concurrent request (retry,
// parallel worker) sees false and skips the lead. Backed by the
// claim_lead_for_sending RPC from migration 016.
export async function claimLeadForSending(leadId: string): Promise<boolean> {
  const db = await createDb()
  const { data, error } = await db.rpc('claim_lead_for_sending', { p_lead_id: leadId })
  if (error) return false
  return data === true
}

export async function markLeadSent(
  leadId: string,
  sent: { subject: string; body: string }
): Promise<void> {
  const db = await createDb()
  const now = new Date().toISOString()
  const { error } = await db
    .from('campaign_leads')
    .update({
      send_status: 'sent',
      email_sent_at: now,
      email_subject_sent: sent.subject,
      email_body_sent: sent.body,
      last_send_error: null,
      updated_at: now,
    })
    .eq('id', leadId)

  if (error) throw new Error(`markLeadSent failed: ${error.message}`)
}

export async function markLeadFailed(leadId: string, errorMessage: string): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('campaign_leads')
    .update({
      send_status: 'failed',
      last_send_error: errorMessage.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (error) throw new Error(`markLeadFailed failed: ${error.message}`)
}

// Used by the unsubscribe route and any future bounce-handler. Admin client
// is passed in because these call sites have no session (email-client POSTs
// have no auth cookies) — we can't use the user-scoped DB client here.
export async function suppressLeadByEmail(
  db: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  campaignId: string,
  leadId: string,
  reason: 'unsubscribed' | 'bounced'
): Promise<boolean> {
  const now = new Date().toISOString()
  const column = reason === 'unsubscribed' ? 'unsubscribed_at' : 'bounced_at'
  const engagement = reason === 'unsubscribed' ? 'unsubscribed' : 'bounced'

  const { data, error } = await db
    .from('campaign_leads')
    .update({
      send_status: 'suppressed',
      engagement_status: engagement,
      [column]: now,
      updated_at: now,
    })
    .eq('id', leadId)
    .eq('campaign_id', campaignId)
    .is(column, null)
    .select('id')
    .maybeSingle()

  if (error) return false
  return data !== null
}

export async function updateLeadEngagement(
  leadId: string,
  updates: {
    email_sent_at?: string
    email_opened_at?: string
    email_clicked_at?: string
    email_replied_at?: string
    email_subject_sent?: string
    email_body_sent?: string
    engagement_status?: CampaignLead['engagement_status']
  }
): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('campaign_leads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) throw new Error(`updateLeadEngagement failed: ${error.message}`)
}

export async function findLeadByEmail(
  campaignId: string,
  email: string
): Promise<CampaignLead | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('campaign_leads')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error) return null
  return data as CampaignLead
}

// ─── Campaign Analytics ────────────────────────────────────────────────────────

export async function getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
  const db = await createDb()
  const { data, error } = await db
    .from('campaigns')
    .select('sent_count, opened_count, clicked_count, replied_count, bounced_count')
    .eq('id', campaignId)
    .single()

  if (error) throw new Error(`getCampaignMetrics failed: ${error.message}`)

  const sent = data.sent_count ?? 0
  return {
    sent,
    opened: data.opened_count ?? 0,
    clicked: data.clicked_count ?? 0,
    replied: data.replied_count ?? 0,
    bounced: data.bounced_count ?? 0,
    open_rate: sent > 0 ? (data.opened_count ?? 0) / sent : 0,
    click_rate: sent > 0 ? (data.clicked_count ?? 0) / sent : 0,
    reply_rate: sent > 0 ? (data.replied_count ?? 0) / sent : 0,
  }
}

export async function getLeadsByStatus(campaignId: string): Promise<LeadsByStatus> {
  const db = await createDb()
  const { data, error } = await db
    .from('campaign_leads')
    .select('engagement_status')
    .eq('campaign_id', campaignId)

  if (error) throw new Error(`getLeadsByStatus failed: ${error.message}`)

  const counts: LeadsByStatus = { fresh: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, unsubscribed: 0 }
  for (const row of (data ?? [])) {
    const s = (row as { engagement_status: string }).engagement_status as keyof LeadsByStatus
    if (s in counts) counts[s]++
  }
  return counts
}

export interface LeadsBySendStatus {
  pending: number
  sending: number
  sent: number
  failed: number
  suppressed: number
}

// Send-lifecycle breakdown, distinct from the engagement view above.
// Engagement answers "how did they react?" — send status answers "did we
// actually get the message out?". Exposing both lets the UI show things like
// "50 sent, 3 failed, 2 suppressed" which is what operators actually debug.
export async function getLeadsBySendStatus(campaignId: string): Promise<LeadsBySendStatus> {
  const db = await createDb()
  const { data, error } = await db
    .from('campaign_leads')
    .select('send_status')
    .eq('campaign_id', campaignId)

  if (error) throw new Error(`getLeadsBySendStatus failed: ${error.message}`)

  const counts: LeadsBySendStatus = { pending: 0, sending: 0, sent: 0, failed: 0, suppressed: 0 }
  for (const row of (data ?? [])) {
    const s = (row as { send_status: string }).send_status as keyof LeadsBySendStatus
    if (s && s in counts) counts[s]++
  }
  return counts
}

export async function getEngagementTimeline(
  campaignId: string,
  days = 30
): Promise<Array<{ date: string; sent: number; opened: number; clicked: number; replied: number }>> {
  const db = await createDb()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data, error } = await db
    .from('campaign_analytics')
    .select('date, sent, opened, clicked, replied')
    .eq('campaign_id', campaignId)
    .gte('date', since)
    .order('date', { ascending: true })

  if (error) throw new Error(`getEngagementTimeline failed: ${error.message}`)
  return (data ?? []) as Array<{ date: string; sent: number; opened: number; clicked: number; replied: number }>
}

// Single-query atomic upsert — defers accumulation to the Postgres function
// (see migration 014). Replaces a racy read-modify-write that lost writes when
// two tracking pixels fired at the same timestamp.
export async function upsertDailyAnalytics(
  campaignId: string,
  date: string,
  increments: { sent?: number; opened?: number; clicked?: number; replied?: number; bounced?: number }
): Promise<void> {
  const db = await createDb()
  const { error } = await db.rpc('upsert_campaign_analytics', {
    p_campaign_id: campaignId,
    p_date: date,
    p_sent: increments.sent ?? 0,
    p_opened: increments.opened ?? 0,
    p_clicked: increments.clicked ?? 0,
    p_replied: increments.replied ?? 0,
    p_bounced: increments.bounced ?? 0,
  })
  if (error) throw new Error(`upsertDailyAnalytics failed: ${error.message}`)
}

// ─── Campaign Replies ──────────────────────────────────────────────────────────

export async function createCampaignReply(
  campaignId: string,
  leadId: string | null,
  reply: {
    from_email: string
    from_name?: string
    subject: string
    body: string
    gmail_message_id: string
    gmail_thread_id?: string
    received_at: string
    reply_type?: CampaignReply['reply_type']
    sentiment_score?: number
    summary?: string
  }
): Promise<CampaignReply> {
  const db = await createDb()
  const { data, error } = await db
    .from('campaign_replies')
    .insert({
      campaign_id: campaignId,
      campaign_lead_id: leadId,
      from_email: reply.from_email,
      from_name: reply.from_name ?? null,
      subject: reply.subject,
      body: reply.body,
      gmail_message_id: reply.gmail_message_id,
      gmail_thread_id: reply.gmail_thread_id ?? null,
      received_at: reply.received_at,
      reply_type: reply.reply_type ?? 'unknown',
      sentiment_score: reply.sentiment_score ?? 0,
      summary: reply.summary ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`createCampaignReply failed: ${error.message}`)
  return data as CampaignReply
}

export async function getCampaignReplies(campaignId: string): Promise<CampaignReply[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('campaign_replies')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('received_at', { ascending: false })

  if (error) throw new Error(`getCampaignReplies failed: ${error.message}`)
  return (data ?? []) as CampaignReply[]
}

export async function replyMessageIdExists(gmailMessageId: string): Promise<boolean> {
  const db = await createDb()
  const { data } = await db
    .from('campaign_replies')
    .select('id')
    .eq('gmail_message_id', gmailMessageId)
    .maybeSingle()

  return data !== null
}

// ─── Campaign events (observability) ───────────────────────────────────────────
// Deliberately fire-and-forget: if the event log is down, the user-visible
// operation must still succeed. All throws are swallowed here so call sites
// can `await recordCampaignEvent(...)` without a try/catch everywhere.

export type CampaignEventSeverity = 'info' | 'warn' | 'error'

export interface RecordEventArgs {
  campaignId?: string | null
  leadId?: string | null
  userId?: string | null
  eventType: string
  severity?: CampaignEventSeverity
  message?: string | null
  metadata?: Record<string, unknown>
}

export async function recordCampaignEvent(args: RecordEventArgs): Promise<void> {
  try {
    const db = await createDb()
    await db.rpc('log_campaign_event', {
      p_campaign_id: args.campaignId ?? null,
      p_lead_id: args.leadId ?? null,
      p_user_id: args.userId ?? null,
      p_event_type: args.eventType,
      p_severity: args.severity ?? 'info',
      p_message: args.message ?? null,
      p_metadata: args.metadata ?? {},
    })
  } catch {
    // Observability must never break user flows.
  }
}
