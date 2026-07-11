import { NextRequest, NextResponse } from 'next/server'
import { createTestimonial } from '@/lib/queries'
import { clientIpKey, enforceAnonRateLimit, PUBLIC_FEEDBACK_LIMIT, PUBLIC_WINDOW_SEC } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: corsHeaders })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ventureId = (await params).id

    if (!UUID_RE.test(ventureId)) {
      return bad('Invalid ventureId. Feedback form must POST to /api/ventures/{uuid}/feedback.')
    }

    // Anonymous endpoint — cap per IP so one visitor can't flood testimonials
    const rl = await enforceAnonRateLimit(
      clientIpKey(req),
      `public-feedback:${ventureId}`,
      PUBLIC_WINDOW_SEC,
      PUBLIC_FEEDBACK_LIMIT
    )
    if (!rl.allowed) {
      return bad('Too many submissions — please try again later.', 429)
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const quote = typeof body.quote === 'string' ? body.quote.trim() : ''
    const kindRaw = typeof body.kind === 'string' ? body.kind : 'testimonial'
    const source = typeof body.source === 'string' ? body.source.slice(0, 120) : null

    if (!name) return bad('Name is required')
    if (name.length > 120) return bad('Name is too long (max 120 chars)')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('A valid email is required')
    if (email.length > 200) return bad('Email is too long')
    if (!quote) return bad('Quote is required')
    if (quote.length < 10) return bad('Quote must be at least 10 characters')
    if (quote.length > 2000) return bad('Quote must be 2000 characters or fewer')

    const kind = kindRaw === 'feedback' ? 'feedback' : 'testimonial'

    const testimonial = await createTestimonial(ventureId, {
      name,
      email,
      quote,
      kind,
      source,
    })

    return NextResponse.json({ success: true, testimonial }, { headers: corsHeaders })
  } catch (error: unknown) {
    console.error('[POST /api/ventures/[id]/feedback] error:', error)
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500, headers: corsHeaders })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
