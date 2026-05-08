import { NextRequest, NextResponse } from 'next/server'
import { createAnalyticsEvent } from '@/lib/queries'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ventureId = (await params).id
    const body = await req.json()
    const { event_type, metadata } = body

    if (!event_type) {
      return NextResponse.json({ error: 'event_type is required' }, { status: 400 })
    }

    const event = await createAnalyticsEvent(ventureId, event_type, metadata)
    
    return NextResponse.json({ success: true, event }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  } catch (error: any) {
    console.error('Error creating analytics event:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
