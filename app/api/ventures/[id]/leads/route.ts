import { NextRequest, NextResponse } from 'next/server'
import { createLead } from '@/lib/queries'

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

    const body = await req.json()
    const { email, name, source } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400, headers: corsHeaders })
    }

    const lead = await createLead(ventureId, email, name, source)
    
    // We should probably allow CORS if landing pages are on different domains
    return NextResponse.json({ success: true, lead }, { headers: corsHeaders })
  } catch (error: any) {
    console.error('Error creating lead:', error)
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
