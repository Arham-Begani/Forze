import 'server-only'

import { createDb } from '@/lib/db'

// Sliding-window rate limiter backed by `rate_limit_events` (see migration 014).
// Returns { allowed, count }. The RPC inserts the event when allowed and skips
// insertion when at-or-over limit, so callers can just 429 on !allowed.
export async function enforceRateLimit(
  userId: string,
  key: string,
  windowSec: number,
  limit: number
): Promise<{ allowed: boolean; count: number }> {
  const db = await createDb()
  const { data, error } = await db.rpc('record_rate_limit_event', {
    p_user_id: userId,
    p_key: key,
    p_window_sec: windowSec,
    p_limit: limit,
  })

  if (error) {
    // Fail-open on infra errors — never block product on rate-limit plumbing
    console.error('[rate-limit] record_rate_limit_event error:', error)
    return { allowed: true, count: 0 }
  }

  const count = typeof data === 'number' ? data : 0
  return { allowed: count <= limit, count }
}

// CLAUDE.md mandates 10 agent runs per user per hour across AI endpoints.
export const AI_RUN_LIMIT = 10
export const AI_RUN_WINDOW_SEC = 3600

// Keep bulk send separate from AI runs — different workload, different ceiling.
export const SEND_LIMIT = 5
export const SEND_WINDOW_SEC = 3600

// Reply polling is a read-shaped workload but hits Gmail API. Keep it generous.
export const POLL_LIMIT = 20
export const POLL_WINDOW_SEC = 3600
