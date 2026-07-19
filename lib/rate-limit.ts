import 'server-only'

import crypto from 'crypto'
import { createDb } from '@/lib/db'
import { logError } from '@/lib/log'

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
    logError('rate-limit', error, { msg: '[rate-limit] record_rate_limit_event error' })
    return { allowed: true, count: 0 }
  }

  const count = typeof data === 'number' ? data : 0
  return { allowed: count <= limit, count }
}

// Anonymous (IP-keyed) sliding-window limiter for public, unauthenticated
// endpoints (landing-page feedback, tracking, lead capture). Backed by
// `record_anon_rate_limit_event` (migration 044). Fails open both on infra
// errors AND when the migration hasn't been applied to the live DB yet —
// public landing pages must never break because rate-limit plumbing is
// missing (the CLAUDE.md runtime-fallback rule for migrations).
export async function enforceAnonRateLimit(
  identifier: string,
  key: string,
  windowSec: number,
  limit: number
): Promise<{ allowed: boolean; count: number }> {
  try {
    const db = await createDb()
    const { data, error } = await db.rpc('record_anon_rate_limit_event', {
      p_identifier: identifier,
      p_key: key,
      p_window_sec: windowSec,
      p_limit: limit,
    })

    if (error) {
      logError('rate-limit', error, { msg: '[rate-limit] record_anon_rate_limit_event error' })
      return { allowed: true, count: 0 }
    }

    const count = typeof data === 'number' ? data : 0
    return { allowed: count <= limit, count }
  } catch (err) {
    logError('rate-limit', err, { msg: '[rate-limit] anon rate limit failed' })
    return { allowed: true, count: 0 }
  }
}

// Stable, non-reversible per-client bucket key from the caller's IP. Hashing
// keeps raw IPs (PII) out of the rate-limit table while still separating
// clients. Falls back to a shared 'unknown' bucket when no IP header exists.
export function clientIpKey(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = (forwarded?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown').trim()
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32)
}

// Public (anonymous) endpoint ceilings — generous for real visitors, hostile
// to floods. All keyed per IP per venture per hour.
export const PUBLIC_FEEDBACK_LIMIT = 5
export const PUBLIC_LEAD_LIMIT = 20
export const PUBLIC_TRACK_LIMIT = 300
export const PUBLIC_WINDOW_SEC = 3600

// CLAUDE.md mandates 10 agent runs per user per hour across AI endpoints.
export const AI_RUN_LIMIT = 10
export const AI_RUN_WINDOW_SEC = 3600

// Keep bulk send separate from AI runs — different workload, different ceiling.
export const SEND_LIMIT = 5
export const SEND_WINDOW_SEC = 3600

// Reply polling is a read-shaped workload but hits Gmail API. Keep it generous.
export const POLL_LIMIT = 20
export const POLL_WINDOW_SEC = 3600
