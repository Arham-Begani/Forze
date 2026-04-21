// GET    /api/admin/blog/:id — fetch a post (draft or published) for the admin
// PATCH  /api/admin/blog/:id — update any fields on the post
// DELETE /api/admin/blog/:id — hard delete
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAuthError } from '@/lib/auth'
import { BlogPostInputSchema } from '@/lib/schemas/blog'
import {
  deleteBlogPostForAuthor,
  getBlogPostForAuthor,
  updateBlogPostForAuthor,
} from '@/lib/queries/blog-queries'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAdmin()
    const { id } = await params
    const post = await getBlogPostForAuthor(id, session.userId)
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ post })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[admin/blog/[id]] GET error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH accepts the same shape as create. We treat every field as optional so
// the editor can save partial updates (e.g., flip `published` without
// retransmitting the whole body). partial() leaves the strict validators on
// the fields that *are* present.
const UpdateSchema = BlogPostInputSchema.partial()

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAdmin()
    const { id } = await params

    const existing = await getBlogPostForAuthor(id, session.userId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // If the caller is flipping published false → true and didn't provide a
    // timestamp, stamp one so the public listing can sort deterministically.
    const willPublish = parsed.data.published === true && !existing.published
    const published_at = willPublish && !parsed.data.published_at
      ? new Date().toISOString()
      : parsed.data.published_at

    const patch: Parameters<typeof updateBlogPostForAuthor>[2] = {}
    if (parsed.data.slug !== undefined) patch.slug = parsed.data.slug
    if (parsed.data.title !== undefined) patch.title = parsed.data.title
    if (parsed.data.description !== undefined) patch.description = parsed.data.description
    if (parsed.data.content !== undefined) patch.content = parsed.data.content
    if (parsed.data.author_name !== undefined) patch.author_name = parsed.data.author_name
    if (parsed.data.author_photo_url !== undefined) patch.author_photo_url = parsed.data.author_photo_url ?? null
    if (parsed.data.featured_image_url !== undefined) patch.featured_image_url = parsed.data.featured_image_url ?? null
    if (parsed.data.meta_title !== undefined) patch.meta_title = parsed.data.meta_title
    if (parsed.data.meta_description !== undefined) patch.meta_description = parsed.data.meta_description
    if (parsed.data.og_image_url !== undefined) patch.og_image_url = parsed.data.og_image_url ?? null
    if (parsed.data.canonical_url !== undefined) patch.canonical_url = parsed.data.canonical_url ?? null
    if (parsed.data.primary_keyword !== undefined) patch.primary_keyword = parsed.data.primary_keyword ?? null
    if (parsed.data.secondary_keywords !== undefined) patch.secondary_keywords = parsed.data.secondary_keywords
    if (parsed.data.internal_links !== undefined) patch.internal_links = parsed.data.internal_links
    if (parsed.data.related_post_ids !== undefined) patch.related_post_ids = parsed.data.related_post_ids
    if (parsed.data.published !== undefined) patch.published = parsed.data.published
    if (published_at !== undefined) patch.published_at = published_at ?? null

    const post = await updateBlogPostForAuthor(id, session.userId, patch)
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ post })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    const msg = e instanceof Error ? e.message : ''
    if (/duplicate key|unique/i.test(msg)) {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    }
    console.error('[admin/blog/[id]] PATCH error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAdmin()
    const { id } = await params
    const deleted = await deleteBlogPostForAuthor(id, session.userId)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[admin/blog/[id]] DELETE error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
