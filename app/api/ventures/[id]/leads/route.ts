import { NextRequest, NextResponse } from 'next/server'
import { createLead } from '@/lib/queries'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ventureId = (await params).id

    if (!UUID_RE.test(ventureId)) {
      return NextResponse.json(
        { error: 'Invalid ventureId. Landing page form must POST to /api/ventures/{uuid}/leads.' },
        { status: 400, headers: corsHeaders }
      )
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const emailRaw = typeof body.email === 'string' ? body.email.trim() : ''
    const nameRaw = typeof body.name === 'string' ? body.name.trim() : ''
    const sourceRaw = typeof body.source === 'string' ? body.source.trim() : ''

    if (!emailRaw) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400, headers: corsHeaders })
    }
    if (emailRaw.length > 254 || !EMAIL_RE.test(emailRaw)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400, headers: corsHeaders })
    }
    if (nameRaw.length > 200) {
      return NextResponse.json({ error: 'Name is too long' }, { status: 400, headers: corsHeaders })
    }

    const safeName = nameRaw ? nameRaw.slice(0, 200) : undefined
    const safeSource = sourceRaw ? sourceRaw.slice(0, 120) : undefined

    const lead = await createLead(ventureId, emailRaw, safeName, safeSource)

    return NextResponse.json({ success: true, lead }, { headers: corsHeaders })
  } catch (error) {
    // Never echo the raw DB / driver error back to anonymous landing-page
    // traffic — it can leak schema details.
    console.error('Error creating lead:', error)
    return NextResponse.json({ error: 'Failed to submit lead' }, { status: 500, headers: corsHeaders })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
