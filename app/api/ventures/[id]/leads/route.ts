import { NextRequest, NextResponse } from 'next/server'
import { captureLandingLead } from '@/lib/lead-capture'
import { PublicLeadCaptureSchema } from '@/lib/schemas/crm'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    const input = PublicLeadCaptureSchema.safeParse(body)
    if (!input.success) {
      const message = input.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400, headers: corsHeaders })
    }

    // Admin-client capture: this endpoint is hit by anonymous landing-page
    // visitors, so the session client would be blocked by the leads RLS
    // policies from migration 034. Also auto-enrolls the lead into any of
    // the venture's campaigns that opted in (migration 041).
    const lead = await captureLandingLead(ventureId, {
      email: input.data.email,
      name: input.data.name,
      source: input.data.source,
    })

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
