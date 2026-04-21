// GET  /api/admin/blog — list all posts authored by the admin (drafts included)
// POST /api/admin/blog — create a new post (admin-gated)
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAuthError } from '@/lib/auth'
import { BlogPostInputSchema } from '@/lib/schemas/blog'
import {
  createBlogPostForAuthor,
  listAllBlogPostsForAuthor,
} from '@/lib/queries/blog-queries'

export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireAdmin()
    const posts = await listAllBlogPostsForAuthor(session.userId)
    return NextResponse.json({ posts })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[admin/blog] GET error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAdmin()
    const body = await req.json()
    const parsed = BlogPostInputSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const input = parsed.data
    // Normalise: if the author is publishing for the first time and forgot to
    // stamp a date, backfill it to "now" so the listing page can sort on it.
    const published_at =
      input.published && !input.published_at
        ? new Date().toISOString()
        : input.published_at ?? null

    const post = await createBlogPostForAuthor({
      slug: input.slug,
      title: input.title,
      description: input.description,
      content: input.content,
      author_id: session.userId,
      author_name: input.author_name || session.name || 'Arham Begani',
      author_photo_url: input.author_photo_url ?? null,
      featured_image_url: input.featured_image_url ?? null,
      meta_title: input.meta_title,
      meta_description: input.meta_description,
      og_image_url: input.og_image_url ?? null,
      canonical_url: input.canonical_url ?? null,
      primary_keyword: input.primary_keyword ?? null,
      secondary_keywords: input.secondary_keywords,
      internal_links: input.internal_links,
      related_post_ids: input.related_post_ids,
      published: input.published,
      published_at,
    })

    return NextResponse.json({ post }, { status: 201 })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    // Unique-violation on slug surfaces as a Postgres error — surface it as 409.
    const msg = e instanceof Error ? e.message : ''
    if (/duplicate key|unique/i.test(msg)) {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    }
    console.error('[admin/blog] POST error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
