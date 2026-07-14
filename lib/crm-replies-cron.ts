import 'server-only'

// Background sweep for CRM reply persistence (Phase 5.1). Mirrors the
// Campaigns system's admin-client pattern (lib/outreach-executor.ts) rather
// than lib/queries.ts's session-scoped helpers, since a cron request has no
// user session/cookies to scope RLS against — this runs as a service-role
// client across every venture with tracked outreach messages.

import { createAdminClient } from '@/lib/supabase/admin'
import { getGmailAccessToken } from '@/lib/gmail-oauth'
import { analyzeReply } from '@/lib/email-generator'
import { sendReplyReceivedMail } from '@/lib/forze-mail'
import { enforceAnonRateLimit } from '@/lib/rate-limit'

interface GmailPart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
}

interface GmailThreadMessage {
  id: string
  threadId: string
  labelIds?: string[]
  internalDate?: string
  snippet?: string
  payload?: GmailPart & { headers?: Array<{ name: string; value: string }> }
}

interface GmailThreadResponse {
  id: string
  messages?: GmailThreadMessage[]
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function findBodyData(part: GmailPart | undefined, mimeType: string): string | null {
  if (!part) return null
  if (part.mimeType === mimeType && part.body?.data) return part.body.data
  for (const child of part.parts ?? []) {
    const found = findBodyData(child, mimeType)
    if (found) return found
  }
  return null
}

function htmlToText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function extractBody(message: GmailThreadMessage): string {
  const textData = findBodyData(message.payload, 'text/plain')
  if (textData) return decodeBase64Url(textData)
  const htmlData = findBodyData(message.payload, 'text/html')
  if (htmlData) return htmlToText(decodeBase64Url(htmlData))
  if (message.payload?.body?.data) return decodeBase64Url(message.payload.body.data)
  return message.snippet ?? ''
}

function stripQuotedReply(value: string): string {
  const lines = value.replace(/\r\n/g, '\n').split('\n')
  const kept: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('>')) break
    if (/^On .+ wrote:$/i.test(trimmed)) break
    if (/^From:\s/i.test(trimmed)) break
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(trimmed)) break
    kept.push(line)
  }
  return kept.join('\n').trim()
}

function messageTimestamp(message: GmailThreadMessage): string {
  const millis = Number(message.internalDate ?? 0)
  return Number.isFinite(millis) && millis > 0 ? new Date(millis).toISOString() : new Date().toISOString()
}

interface TrackedMessageRow {
  id: string
  campaign_id: string
  lead_id: string
  google_message_id: string
  google_thread_id: string
  subject: string | null
  body: string | null
}

interface VentureOutreachGroup {
  userId: string
  ventureId: string
  messagesByThread: Map<string, TrackedMessageRow>
}

async function discoverVenturesNeedingSync(): Promise<VentureOutreachGroup[]> {
  const db = createAdminClient()

  const { data: messages, error: messagesError } = await db
    .from('outreach_messages')
    .select('id, campaign_id, lead_id, google_message_id, google_thread_id, subject, body')

  if (messagesError || !messages || messages.length === 0) return []

  const campaignIds = Array.from(new Set(messages.map((m: TrackedMessageRow & { campaign_id: string }) => m.campaign_id)))
  const { data: campaigns, error: campaignsError } = await db
    .from('outreach_campaigns')
    .select('id, venture_id')
    .in('id', campaignIds)

  if (campaignsError || !campaigns) return []

  const ventureIds = Array.from(new Set(campaigns.map((c: { venture_id: string }) => c.venture_id)))
  const { data: ventures, error: venturesError } = await db
    .from('ventures')
    .select('id, user_id')
    .in('id', ventureIds)

  if (venturesError || !ventures) return []

  const ventureUserById = new Map(ventures.map((v: { id: string; user_id: string }) => [v.id, v.user_id]))
  const ventureIdByCampaign = new Map(campaigns.map((c: { id: string; venture_id: string }) => [c.id, c.venture_id]))

  const groups = new Map<string, VentureOutreachGroup>()
  for (const message of messages as TrackedMessageRow[]) {
    const ventureId = ventureIdByCampaign.get(message.campaign_id)
    const userId = ventureId ? ventureUserById.get(ventureId) : undefined
    if (!ventureId || !userId) continue

    if (!groups.has(ventureId)) {
      groups.set(ventureId, { userId, ventureId, messagesByThread: new Map() })
    }
    const group = groups.get(ventureId)!
    if (!group.messagesByThread.has(message.google_thread_id)) {
      group.messagesByThread.set(message.google_thread_id, message)
    }
  }

  return Array.from(groups.values())
}

// Entry point for the poll-crm-replies cron (app/api/cron/poll-crm-replies/route.ts).
// Returns the number of newly-persisted replies across all ventures.
// Resolves + caches the venture owner's email/name and venture name so the
// reply alert doesn't re-query per reply. Returns null when the owner has no
// email (nothing to notify).
async function resolveOwnerInfo(
  db: ReturnType<typeof createAdminClient>,
  cache: Map<string, { email: string; name: string; ventureName: string } | null>,
  ventureId: string,
  userId: string,
): Promise<{ email: string; name: string; ventureName: string } | null> {
  if (cache.has(ventureId)) return cache.get(ventureId) ?? null
  const [{ data: venture }, { data: owner }] = await Promise.all([
    db.from('ventures').select('name').eq('id', ventureId).maybeSingle(),
    db.from('users').select('email, name').eq('id', userId).maybeSingle(),
  ])
  const info = owner?.email
    ? { email: owner.email as string, name: (owner.name as string) ?? '', ventureName: (venture?.name as string) ?? 'your venture' }
    : null
  cache.set(ventureId, info)
  return info
}

export async function runCrmRepliesSync(): Promise<{ ventures: number; repliesPersisted: number }> {
  const db = createAdminClient()
  const groups = await discoverVenturesNeedingSync()

  let repliesPersisted = 0
  const ownerInfoCache = new Map<string, { email: string; name: string; ventureName: string } | null>()

  for (const group of groups) {
    let accessToken: string
    try {
      ;({ accessToken } = await getGmailAccessToken(group.userId))
    } catch {
      continue // Gmail disconnected/expired for this user — skip, not fatal for the sweep
    }

    for (const [, tracked] of group.messagesByThread) {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(tracked.google_thread_id)}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ).catch(() => null)
      if (!response || !response.ok) continue

      const thread = (await response.json()) as GmailThreadResponse
      for (const message of thread.messages ?? []) {
        if (message.labelIds?.includes('SENT')) continue
        if (message.id === tracked.google_message_id) continue

        const body = stripQuotedReply(extractBody(message))
        if (!body) continue

        // Dedup on gmail_message_id (unique index) — cheap existence check
        // before spending a Gemini call on a message we already stored.
        const { data: existing } = await db
          .from('outreach_replies')
          .select('id')
          .eq('gmail_message_id', message.id)
          .maybeSingle()
        if (existing) continue

        const headers = message.payload?.headers ?? []
        const fromHeader = headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? null
        const subjectHeader = headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? null
        const fromEmailMatch = fromHeader?.match(/<([^>]+)>/)
        const fromEmail = fromEmailMatch ? fromEmailMatch[1] : fromHeader

        const analysis = await analyzeReply(
          tracked.subject ?? '',
          tracked.body ?? '',
          fromEmail ?? '',
          subjectHeader ?? '',
          body
        ).catch(() => ({ type: 'unknown' as const, sentiment_score: 0, summary: '' }))

        const { error: insertError } = await db.from('outreach_replies').insert({
          outreach_message_id: tracked.id,
          lead_id: tracked.lead_id,
          gmail_message_id: message.id,
          gmail_thread_id: message.threadId,
          from_email: fromEmail,
          subject: subjectHeader,
          body: body.slice(0, 4000),
          received_at: messageTimestamp(message),
          reply_type: analysis.type,
          sentiment_score: analysis.sentiment_score,
          summary: analysis.summary,
        })
        if (!insertError) {
          repliesPersisted += 1

          // Best-effort founder alert. Capped at 10/hour/venture via the anon
          // limiter (keyed on ventureId) so a busy thread floods the CRM, not
          // the inbox. Fails open pre-migration-044 and no-ops when Resend
          // isn't configured. A failed alert never fails the sync.
          try {
            const rl = await enforceAnonRateLimit(group.ventureId, 'reply-alert', 3600, 10)
            if (rl.allowed) {
              const owner = await resolveOwnerInfo(db, ownerInfoCache, group.ventureId, group.userId)
              if (owner) {
                await sendReplyReceivedMail({
                  to: owner.email,
                  ownerName: owner.name,
                  ventureId: group.ventureId,
                  ventureName: owner.ventureName,
                  fromEmail: fromEmail ?? 'A prospect',
                  subject: subjectHeader,
                  summary: analysis.summary,
                  replyType: analysis.type,
                })
              }
            }
          } catch (err) {
            console.error('[crm-replies] reply alert failed:', err)
          }
        }
      }
    }
  }

  return { ventures: groups.length, repliesPersisted }
}
