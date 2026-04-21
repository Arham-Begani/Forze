// GET /api/blog/posts/:slug — single published post + related summaries
import { NextRequest, NextResponse } from 'next/server'
import { getPublishedBlogPostBySlug, getRelatedBlogPosts } from '@/lib/queries/blog-queries'

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { slug } = await params
    const post = await getPublishedBlogPostBySlug(slug)

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const related = await getRelatedBlogPosts(post, 3)

    return NextResponse.json({ post, related })
  } catch (error) {
    console.error('[blog/posts/[slug]] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch blog post' }, { status: 500 })
  }
}
