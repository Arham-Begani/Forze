import { NextRequest, NextResponse } from 'next/server'
import { createAnalyticsEvent } from '@/lib/queries'

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
      // Tracking is fire-and-forget — never fail the page over an invalid id
      return NextResponse.json({ success: false, ignored: true }, { status: 200, headers: corsHeaders })
    }

    const body = await req.json()
    const { event_type, metadata } = body

    if (!event_type) {
      return NextResponse.json({ error: 'event_type is required' }, { status: 400, headers: corsHeaders })
    }

    const event = await createAnalyticsEvent(ventureId, event_type, metadata)

    return NextResponse.json({ success: true, event }, { headers: corsHeaders })
  } catch (error: any) {
    console.error('Error creating analytics event:', error)
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
