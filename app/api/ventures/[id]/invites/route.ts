import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getVentureAccess } from '@/lib/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendVentureInviteMail } from '@/lib/invite-mail'

const inviteSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(['admin', 'editor', 'viewer']),
})

function getAppOrigin(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return new URL(req.url).origin
}

function generateToken(): string {
  // 32-char hex token via Web Crypto (Edge + Node compatible)
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params
    const ventureId = params.id
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = await getVentureAccess(ventureId, session.userId)
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only owners and admins can invite members.' },
        { status: 403 }
      )
    }

    const parsed = inviteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or role' }, { status: 400 })
    }
    const { email, role: inviteRole } = parsed.data

    const db = createAdminClient()

    // Fetch venture name for the email body
    const { data: venture } = await db
      .from('ventures')
      .select('name')
      .eq('id', ventureId)
      .single()

    const ventureName = venture?.name || 'a venture'

    const token = generateToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data, error } = await db
      .from('venture_invites')
      .insert({
        venture_id: ventureId,
        email: email.toLowerCase(),
        role: inviteRole,
        inviter_id: session.userId,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to insert invite:', error)
      return NextResponse.json(
        {
          error: 'Failed to create invite',
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      )
    }

    const inviteUrl = `${getAppOrigin(req)}/invite/${token}`

    const mail = await sendVentureInviteMail({
      to: email,
      inviteUrl,
      ventureName,
      inviterName: session.name || session.email || 'A Forze teammate',
      role: inviteRole,
    })

    return NextResponse.json({
      invite: data,
      inviteUrl,
      emailSent: mail.sent,
      emailReason: mail.sent ? null : mail.reason,
    })
  } catch (error: any) {
    console.error('Failed to create invite:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params
    const ventureId = params.id
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = await getVentureAccess(ventureId, session.userId)
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = createAdminClient()
    const { data, error } = await db
      .from('venture_invites')
      .select('*')
      .eq('venture_id', ventureId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch invites:', error)
      return NextResponse.json(
        { error: 'Failed to fetch invites. Has migration 024 been applied?' },
        { status: 500 }
      )
    }

    const origin = getAppOrigin(req)
    const invites = (data || []).map(inv => ({ ...inv, inviteUrl: `${origin}/invite/${inv.token}` }))

    return NextResponse.json({ invites })
  } catch (error: any) {
    console.error('Failed to fetch invites:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params
    const ventureId = params.id
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = await getVentureAccess(ventureId, session.userId)
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const inviteId = url.searchParams.get('inviteId')
    if (!inviteId) {
      return NextResponse.json({ error: 'inviteId is required' }, { status: 400 })
    }

    const db = createAdminClient()
    const { error } = await db
      .from('venture_invites')
      .delete()
      .eq('id', inviteId)
      .eq('venture_id', ventureId)

    if (error) {
      console.error('Failed to revoke invite:', error)
      return NextResponse.json({ error: 'Failed to revoke invite' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to revoke invite:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
