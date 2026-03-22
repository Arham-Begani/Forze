// lib/auth.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface Session {
  userId: string
  email: string
  name: string
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

// Get the current session — returns null if not authenticated
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null

  const session = {
    userId: user.id,
    email: user.email ?? '',
    name: user.user_metadata?.name ?? user.email ?? '',
  }

  // Lazy sync: Ensure user exists in public.users to satisfy foreign key constraints.
  // This helps when the database trigger (handle_new_user) didn't run for some reason.
  try {
    await supabase.from('users').upsert({
      id: session.userId,
      email: session.email,
      name: session.name,
    }, { onConflict: 'id' })
  } catch (err) {
    console.warn('[auth] Lazy user sync skipped/failed:', err)
  }

  return session
}

// Use in API routes — returns session or throws AuthError
export async function requireAuth(): Promise<Session> {
  const session = await getSession()

  if (!session) {
    throw new AuthError()
  }

  return session
}

// Check if the current user is an admin (set ADMIN_USER_IDS=id1,id2 in env)
export function isAdmin(session: Session): boolean {
  const adminIds = process.env.ADMIN_USER_IDS?.split(',').map(s => s.trim()) ?? []
  return adminIds.includes(session.userId)
}

// Use in admin API routes — returns session or throws AuthError if not admin
export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth()
  if (!isAdmin(session)) {
    throw new AuthError()
  }
  return session
}