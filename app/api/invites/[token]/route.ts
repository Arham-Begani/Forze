import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  try {
    const params = await props.params
    const token = params.token
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createAdminClient()
    
    // 1. Validate Invite
    const { data: invite, error: inviteError } = await db
      .from('venture_invites')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 })
    }

    if (new Date(invite.expires_at) < new Date()) {
       await db.from('venture_invites').update({ status: 'expired' }).eq('id', invite.id)
       return NextResponse.json({ error: 'Invite expired' }, { status: 400 })
    }

    // 2. Add User to Venture
    const { error: memberError } = await db
      .from('venture_members')
      .insert({
        venture_id: invite.venture_id,
        user_id: session.userId,
        role: invite.role,
      })

    if (memberError) {
       // If unique constraint violated, they might already be a member
       if (memberError.code !== '23505') {
         throw memberError
       }
    }

    // 3. Mark Invite as Accepted
    await db
      .from('venture_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id)

    return NextResponse.json({ success: true, ventureId: invite.venture_id })
  } catch (error: any) {
    console.error('Failed to accept invite:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  try {
    const params = await props.params
    const token = params.token
    const db = createAdminClient()
    
    const { data, error } = await db
      .from('venture_invites')
      .select('*, venture:ventures(name)')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Invalid invite' }, { status: 404 })
    }

    return NextResponse.json({ invite: data })
  } catch (error: any) {
    console.error('Failed to fetch invite:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
