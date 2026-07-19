// POST /api/blog/posts/:slug/views — fire-and-forget view counter bump
import { NextRequest, NextResponse } from 'next/server'
import { getPublishedBlogPostBySlug, incrementBlogViewCount } from '@/lib/queries/blog-queries'
import { logError } from '@/lib/log'

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
    logError('blog/posts/slug/views', error, { msg: '[blog/posts/[slug]/views] POST error' })
    return NextResponse.json({ error: 'Failed to record view' }, { status: 500 })
  }
}
