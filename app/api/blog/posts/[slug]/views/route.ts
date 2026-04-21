// POST /api/blog/posts/:slug/views — fire-and-forget view counter bump
import { NextRequest, NextResponse } from 'next/server'
import { getPublishedBlogPostBySlug, incrementBlogViewCount } from '@/lib/queries/blog-queries'

type RouteContext = { params: Promise<{ slug: string }> }

export async function POST(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { slug } = await params
    const post = await getPublishedBlogPostBySlug(slug)

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    await incrementBlogViewCount(post.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[blog/posts/[slug]/views] POST error:', error)
    return NextResponse.json({ error: 'Failed to record view' }, { status: 500 })
  }
}
