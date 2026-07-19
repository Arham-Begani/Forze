// app/api/auth/signout/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/log'

export async function POST() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      logError('auth/signout', error, { msg: '[POST /api/auth/signout] sign-out failed' })
      return NextResponse.json({ error: 'Sign-out failed' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    logError('auth/signout', error, { msg: '[POST /api/auth/signout] error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
