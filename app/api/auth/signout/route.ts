// app/api/auth/signout/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('[POST /api/auth/signout] sign-out failed:', error)
      return NextResponse.json({ error: 'Sign-out failed' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/auth/signout] error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
