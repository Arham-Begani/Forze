import 'server-only'

import { createDb } from '@/lib/db'
import {
  BlogPostRowSchema,
  BlogPostSummarySchema,
  type BlogPostRow,
  type BlogPostSummary,
} from '@/lib/schemas/blog'

const SUMMARY_COLUMNS =
  'id, slug, title, description, featured_image_url, author_name, published_at, view_count'

// List published posts with pagination. Row counts are cheap because the
// partial index (published = true) covers the filter.
export async function listPublishedBlogPosts(
  page: number = 1,
  pageSize: number = 12
): Promise<{ posts: BlogPostSummary[]; total: number; page: number; pageSize: number }> {
  const safePage = Math.max(1, Math.floor(page))
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)))
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  const db = await createDb()
  const { data, error, count } = await db
    .from('blog_posts')
    .select(SUMMARY_COLUMNS, { count: 'exact' })
    .eq('published', true)
    .order('published_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(`listPublishedBlogPosts failed: ${error.message}`)

  const posts = (data ?? []).map((row) => BlogPostSummarySchema.parse(row))
  return { posts, total: count ?? posts.length, page: safePage, pageSize: safePageSize }
}

// Full post lookup by slug. RLS already restricts anonymous callers to
// published rows, but we add the filter explicitly so author-scoped reads
// (which can see their own drafts) don't accidentally leak them via the
// public detail route.
export async function getPublishedBlogPostBySlug(slug: string): Promise<BlogPostRow | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()

  if (error) throw new Error(`getPublishedBlogPostBySlug failed: ${error.message}`)
  if (!data) return null
  return BlogPostRowSchema.parse(data)
}

// Related posts — prefers explicit related_post_ids, falls back to shared
// primary keyword. Returns summaries so cards can render without a second
// round trip.
export async function getRelatedBlogPosts(
  post: Pick<BlogPostRow, 'id' | 'primary_keyword' | 'related_post_ids'>,
  limit: number = 3
): Promise<BlogPostSummary[]> {
  const db = await createDb()

  // Explicit relations win. Only fall back if none resolve to published rows.
  if (post.related_post_ids && post.related_post_ids.length > 0) {
    const { data, error } = await db
      .from('blog_posts')
      .select(SUMMARY_COLUMNS)
      .in('id', post.related_post_ids)
      .eq('published', true)
      .neq('id', post.id)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`getRelatedBlogPosts failed: ${error.message}`)
    const parsed = (data ?? []).map((row) => BlogPostSummarySchema.parse(row))
    if (parsed.length > 0) return parsed
  }

  if (!post.primary_keyword) return []

  const { data, error } = await db
    .from('blog_posts')
    .select(SUMMARY_COLUMNS)
    .eq('published', true)
    .eq('primary_keyword', post.primary_keyword)
    .neq('id', post.id)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getRelatedBlogPosts (keyword) failed: ${error.message}`)
  return (data ?? []).map((row) => BlogPostSummarySchema.parse(row))
}

// Atomic view count bump via SECURITY DEFINER RPC. Anonymous visitors don't
// have UPDATE on blog_posts, so this is the only way to record reads without
// either widening RLS or proxying through an authenticated endpoint.
export async function incrementBlogViewCount(postId: string): Promise<void> {
  const db = await createDb()
  const { error } = await db.rpc('increment_blog_view_count', { p_post_id: postId })
  if (error) throw new Error(`incrementBlogViewCount failed: ${error.message}`)
}

// ─── Admin helpers ────────────────────────────────────────────────────────────
// These operate under the caller's session — RLS on blog_posts allows authors
// to read their own drafts and manage their own rows. Callers must gate on
// requireAdmin() before invoking these (we don't want arbitrary authenticated
// users authoring under the public blog).

// List every post authored by the given admin, drafts included. Sorted with
// drafts floated to the top so the editor surfaces unpublished work first.
export async function listAllBlogPostsForAuthor(authorId: string): Promise<BlogPostRow[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('blog_posts')
    .select('*')
    .eq('author_id', authorId)
    .order('published', { ascending: true })
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`listAllBlogPostsForAuthor failed: ${error.message}`)
  return (data ?? []).map((row) => BlogPostRowSchema.parse(row))
}

export async function getBlogPostForAuthor(
  postId: string,
  authorId: string
): Promise<BlogPostRow | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('blog_posts')
    .select('*')
    .eq('id', postId)
    .eq('author_id', authorId)
    .maybeSingle()

  if (error) throw new Error(`getBlogPostForAuthor failed: ${error.message}`)
  if (!data) return null
  return BlogPostRowSchema.parse(data)
}

type BlogInsertPayload = {
  slug: string
  title: string
  description: string
  content: string
  author_id: string
  author_name: string
  author_photo_url: string | null
  featured_image_url: string | null
  meta_title: string
  meta_description: string
  og_image_url: string | null
  canonical_url: string | null
  primary_keyword: string | null
  secondary_keywords: string[]
  internal_links: Array<{ title: string; slug: string; anchor_text: string }>
  related_post_ids: string[]
  published: boolean
  published_at: string | null
}

export async function createBlogPostForAuthor(
  payload: BlogInsertPayload
): Promise<BlogPostRow> {
  const db = await createDb()
  const { data, error } = await db
    .from('blog_posts')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw new Error(`createBlogPostForAuthor failed: ${error.message}`)
  return BlogPostRowSchema.parse(data)
}

export async function updateBlogPostForAuthor(
  postId: string,
  authorId: string,
  patch: Partial<Omit<BlogInsertPayload, 'author_id'>>
): Promise<BlogPostRow | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('blog_posts')
    .update(patch)
    .eq('id', postId)
    .eq('author_id', authorId)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`updateBlogPostForAuthor failed: ${error.message}`)
  if (!data) return null
  return BlogPostRowSchema.parse(data)
}

export async function deleteBlogPostForAuthor(
  postId: string,
  authorId: string
): Promise<boolean> {
  const db = await createDb()
  const { error, count } = await db
    .from('blog_posts')
    .delete({ count: 'exact' })
    .eq('id', postId)
    .eq('author_id', authorId)

  if (error) throw new Error(`deleteBlogPostForAuthor failed: ${error.message}`)
  return (count ?? 0) > 0
}
