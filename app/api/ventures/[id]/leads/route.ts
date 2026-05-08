import { NextRequest, NextResponse } from 'next/server'
import { createLead } from '@/lib/queries'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ventureId = (await params).id
    const body = await req.json()
    const { email, name, source } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const lead = await createLead(ventureId, email, name, source)
    
    // We should probably allow CORS if landing pages are on different domains
    return NextResponse.json({ success: true, lead }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  } catch (error: any) {
    console.error('Error creating lead:', error)
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
