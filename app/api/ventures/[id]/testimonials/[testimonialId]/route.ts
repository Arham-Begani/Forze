import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import {
  deleteTestimonial,
  getTestimonialById,
  getVentureAccess,
  setTestimonialArchived,
  setTestimonialFeatured,
} from '@/lib/queries'
import { logError } from '@/lib/log'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function ensureAccess(
  ventureId: string,
  testimonialId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!UUID_RE.test(ventureId) || !UUID_RE.test(testimonialId)) {
    return { ok: false, status: 400, error: 'Invalid id' }
  }
  const role = await getVentureAccess(ventureId, userId)
  if (!role) return { ok: false, status: 403, error: 'Forbidden' }
  if (role === 'viewer') return { ok: false, status: 403, error: 'Forbidden' }
  const existing = await getTestimonialById(testimonialId)
  if (!existing || existing.venture_id !== ventureId) {
    return { ok: false, status: 404, error: 'Testimonial not found' }
  }
  return { ok: true }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; testimonialId: string }> }
) {
  try {
    const session = await requireAuth()
    const { id: ventureId, testimonialId } = await params
    const access = await ensureAccess(ventureId, testimonialId, session.userId)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const body = (await req.json().catch(() => ({}))) as {
      featured?: unknown
      archived?: unknown
    }

    if (typeof body.featured === 'boolean') {
      await setTestimonialFeatured(testimonialId, body.featured)
    }
    if (typeof body.archived === 'boolean') {
      await setTestimonialArchived(testimonialId, body.archived)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Failed to update testimonial'
    logError('ventures/id/testimonials/testimonialId', error, { msg: '[PATCH /api/ventures/[id]/testimonials/[testimonialId]] error' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; testimonialId: string }> }
) {
  try {
    const session = await requireAuth()
    const { id: ventureId, testimonialId } = await params
    const access = await ensureAccess(ventureId, testimonialId, session.userId)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    await deleteTestimonial(testimonialId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Failed to delete testimonial'
    logError('ventures/id/testimonials/testimonialId', error, { msg: '[DELETE /api/ventures/[id]/testimonials/[testimonialId]] error' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
