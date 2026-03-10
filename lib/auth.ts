// lib/auth.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface Session {
  userId: string
  email: string
  name: string
}

// Get the current session — returns null if not authenticated
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null

  return {
    userId: user.id,
    email: user.email ?? '',
    name: user.user_metadata?.name ?? user.email ?? '',
  }
}

// Use in API routes — returns session or throws a 401 Response
export async function requireAuth(): Promise<Session> {
  const session = await getSession()

  if (!session) {
    throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return session
}