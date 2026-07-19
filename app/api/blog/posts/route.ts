// GET /api/blog/posts?page=1&pageSize=12 — list published blog posts
import { NextRequest, NextResponse } from 'next/server'
import { listPublishedBlogPosts } from '@/lib/queries/blog-queries'
import { logError } from '@/lib/log'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const page = Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10)
    const pageSize = Number.parseInt(
      request.nextUrl.searchParams.get('pageSize') ?? '12',
      10
    )

    const result = await listPublishedBlogPosts(
      Number.isFinite(page) ? page : 1,
      Number.isFinite(pageSize) ? pageSize : 12
    )

    return NextResponse.json(result)
  } catch (error) {
    logError('blog/posts', error, { msg: '[blog/posts] GET error' })
    return NextResponse.json({ error: 'Failed to fetch blog posts' }, { status: 500 })
  }
}
