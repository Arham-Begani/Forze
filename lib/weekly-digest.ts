import 'server-only'

// Weekly founder digest — the retention loop the platform was missing. For
// every founder who had landing-page activity in the past 7 days, emails a
// short "here's your week" summary (new leads + page views). Runs from the
// weekly-digest cron. Admin-client, service-role: a cron has no user session
// to scope RLS against, same pattern as the outreach/reply crons.
//
// Fail-open + best-effort throughout: a per-user once-a-week send guard rides
// the anon rate limiter (fails open pre-migration-044 → at worst a duplicate
// email), and any single send failure never aborts the sweep.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendWeeklyDigestMail } from '@/lib/forze-mail'
import { enforceAnonRateLimit } from '@/lib/rate-limit'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
// 6-day window / limit 1: one digest per founder per run-week even if the cron
// fires more than once. Comfortably an INTEGER for the rate-limit RPC.
const DIGEST_GUARD_WINDOW_SEC = 6 * 24 * 60 * 60

interface VentureRow {
  id: string
  user_id: string | null
  name: string | null
}

export async function runWeeklyDigest(sinceIso: string): Promise<{ usersConsidered: number; usersEmailed: number }> {
  const db = createAdminClient()

  const { data: ventures } = await db.from('ventures').select('id, user_id, name')
  if (!ventures || ventures.length === 0) return { usersConsidered: 0, usersEmailed: 0 }

  const ownerByVenture = new Map<string, string>()
  const nameByVenture = new Map<string, string>()
  for (const v of ventures as VentureRow[]) {
    if (v.user_id) ownerByVenture.set(v.id, v.user_id)
    nameByVenture.set(v.id, v.name ?? 'your venture')
  }

  // Only rows from the past week are fetched (bounded by weekly activity, not
  // total history), so no need to filter by venture id — group by owner after.
  const [{ data: leads }, { data: views }] = await Promise.all([
    db.from('leads').select('venture_id').gte('created_at', sinceIso),
    db.from('analytics_events').select('venture_id').eq('event_type', 'pageview').gte('created_at', sinceIso),
  ])

  interface Tally { leads: number; pageviews: number; topVentureId: string | null; topVentureLeads: number }
  const byUser = new Map<string, Tally>()
  const ensure = (userId: string): Tally => {
    let t = byUser.get(userId)
    if (!t) { t = { leads: 0, pageviews: 0, topVentureId: null, topVentureLeads: 0 }; byUser.set(userId, t) }
    return t
  }
  const perVentureLeads = new Map<string, number>()

  for (const row of (leads ?? []) as Array<{ venture_id: string | null }>) {
    if (!row.venture_id) continue
    const userId = ownerByVenture.get(row.venture_id)
    if (!userId) continue
    ensure(userId).leads += 1
    perVentureLeads.set(row.venture_id, (perVentureLeads.get(row.venture_id) ?? 0) + 1)
  }
  for (const row of (views ?? []) as Array<{ venture_id: string | null }>) {
    if (!row.venture_id) continue
    const userId = ownerByVenture.get(row.venture_id)
    if (!userId) continue
    ensure(userId).pageviews += 1
  }

  // Resolve each user's busiest venture (by leads) for a personal touch.
  for (const [ventureId, count] of perVentureLeads) {
    const userId = ownerByVenture.get(ventureId)
    if (!userId) continue
    const t = byUser.get(userId)
    if (t && count > t.topVentureLeads) { t.topVentureLeads = count; t.topVentureId = ventureId }
  }

  const activeUserIds = [...byUser.entries()]
    .filter(([, t]) => t.leads > 0 || t.pageviews > 0)
    .map(([userId]) => userId)
  if (activeUserIds.length === 0) return { usersConsidered: 0, usersEmailed: 0 }

  const { data: users } = await db
    .from('users')
    .select('id, email, name')
    .in('id', activeUserIds)
  const userById = new Map((users ?? []).map((u: { id: string; email: string | null; name: string | null }) => [u.id, u]))

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://tryforze.ai').trim().replace(/\/+$/, '')
  let usersEmailed = 0

  for (const userId of activeUserIds) {
    const user = userById.get(userId)
    if (!user?.email) continue
    const tally = byUser.get(userId)!

    try {
      // Once-per-week guard — dedups double cron fires without extra tables.
      const rl = await enforceAnonRateLimit(userId, 'weekly-digest', DIGEST_GUARD_WINDOW_SEC, 1)
      if (!rl.allowed) continue

      const topVentureName = tally.topVentureId ? nameByVenture.get(tally.topVentureId) ?? null : null
      const ctaUrl = tally.topVentureId ? `${appUrl}/dashboard/venture/${tally.topVentureId}/crm` : `${appUrl}/dashboard`

      const result = await sendWeeklyDigestMail({
        to: user.email,
        ownerName: user.name ?? '',
        leads: tally.leads,
        pageviews: tally.pageviews,
        topVentureName,
        ctaUrl,
      })
      if (result.sent) usersEmailed += 1
    } catch (err) {
      console.error('[weekly-digest] send failed for user:', userId, err)
    }
  }

  return { usersConsidered: activeUserIds.length, usersEmailed }
}

export function weekAgoIso(nowMs: number): string {
  return new Date(nowMs - WEEK_MS).toISOString()
}
