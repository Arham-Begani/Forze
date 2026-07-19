import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { getVentureAccess, listTestimonials, type TestimonialFilters } from '@/lib/queries'
import { logError } from '@/lib/log'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const ventureId = (await params).id
    if (!UUID_RE.test(ventureId)) {
      return NextResponse.json({ error: 'Invalid ventureId' }, { status: 400 })
    }

    const role = await getVentureAccess(ventureId, session.userId)
    if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const url = new URL(req.url)
    const filters: TestimonialFilters = {}
    const kind = url.searchParams.get('kind')
    if (kind === 'testimonial' || kind === 'feedback') filters.kind = kind
    const featured = url.searchParams.get('featured')
    if (featured === 'true') filters.featured = true
    if (featured === 'false') filters.featured = false
    const archived = url.searchParams.get('archived')
    if (archived === 'true') filters.archived = true
    if (archived === 'false') filters.archived = false

    const testimonials = await listTestimonials(ventureId, filters)
    return NextResponse.json({ testimonials })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Failed to load testimonials'
    logError('ventures/id/testimonials', error, { msg: '[GET /api/ventures/[id]/testimonials] error' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
