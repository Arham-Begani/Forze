// lib/auth.ts
import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface Session {
  userId: string
  email: string
  name: string
}

const FALLBACK_ADMIN_EMAILS = ['arhambegani2@gmail.com']

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

// Custom error for auth failures — avoids instanceof issues with NextResponse across modules
export class AuthError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'AuthError'
  }

  toResponse(): NextResponse {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// Safer check than instanceof which fails across Next.js boundary
export function isAuthError(e: unknown): e is AuthError {
  return e instanceof AuthError || (e instanceof Error && e.name === 'AuthError')
}

// Users whose public.users row has already been ensured on this warm instance.
// The row only needs to be written once ever (it exists so foreign keys resolve
// when the handle_new_user signup trigger didn't fire). Tracking it in module
// scope means the upsert runs at most once per user per warm serverless instance
// instead of on EVERY request — cutting a blocking DB write off the critical path
// of nearly every page load and API call. Worst case (a cold instance) it upserts
// again, which is an idempotent no-op, so correctness is unchanged.
const ensuredUserIds = new Set<string>()

// Get the current session — returns null if not authenticated.
// Wrapped in React cache() so repeated requireAuth()/getSession() calls within a
// single server render (e.g. a layout + page + nested server components) share one
// auth round-trip instead of each hitting Supabase Auth again.
//
// getClaims() verifies the access token's signature locally against the project's
// cached JWKS, so an authenticated request costs no network call at all. getUser()
// — what this used to call — is an HTTP round-trip to the Auth server on EVERY
// invocation, and this function runs on essentially every page load and API call.
// When the project still signs with a symmetric HS256 secret, getClaims falls back
// to getUser internally, so behaviour is identical until the project migrates to an
// asymmetric (ECC/RSA) signing key — at which point it simply gets faster.
export const getSession = cache(async function getSession(): Promise<Session | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  const claims = data?.claims
  if (error || !claims?.sub) return null

  const email = typeof claims.email === 'string' ? claims.email : ''
  const metadataName = claims.user_metadata?.name

  const session = {
    userId: claims.sub,
    email,
    name: typeof metadataName === 'string' && metadataName ? metadataName : email,
  }

  // Lazy sync: ensure the user exists in public.users to satisfy foreign key
  // constraints (safety net for a missed handle_new_user trigger). Skipped once
  // known-present on this instance so it doesn't block every request.
  if (!ensuredUserIds.has(session.userId)) {
    try {
      await supabase.from('users').upsert({
        id: session.userId,
        email: session.email,
        name: session.name,
      }, { onConflict: 'id' })
      ensuredUserIds.add(session.userId)
    } catch (err) {
      console.warn('[auth] Lazy user sync skipped/failed:', err)
    }
  }

  return session
})

// Use in API routes — returns session or throws AuthError
export async function requireAuth(): Promise<Session> {
  const session = await getSession()

  if (!session) {
    throw new AuthError()
  }

  return session
}

// Check if the current user is an admin
// Supports ADMIN_USER_IDS (comma-separated UUIDs) and ADMIN_EMAILS (comma-separated emails)
export function isAdmin(session: Session): boolean {
  const adminIds = process.env.ADMIN_USER_IDS?.split(',').map(s => s.trim()).filter(Boolean) ?? []
  const adminEmails = [
    ...(process.env.ADMIN_EMAILS?.split(',') ?? []),
    ...FALLBACK_ADMIN_EMAILS,
  ]
    .map(normalizeEmail)
    .filter(Boolean)

  return adminIds.includes(session.userId) || adminEmails.includes(normalizeEmail(session.email))
}

// Use in admin API routes — returns session or throws AuthError if not admin
export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth()
  if (!isAdmin(session)) {
    throw new AuthError()
  }
  return session
}
