import { z } from 'zod'

// Internal links live inside a post's body — each entry is a pointer to
// another blog post used to build topic clusters.
export const BlogInternalLinkSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  anchor_text: z.string().min(1).max(100),
})

// Shape used to create/update a post. Strings that come back from Postgres
// timestamps are left as ISO strings — we don't want the schema to force a
// Date instance because the API surfaces JSON.
export const BlogPostInputSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens')
    .min(3)
    .max(120),
  title: z.string().min(10).max(200),
  description: z.string().min(30).max(300),
  content: z.string().min(1),
  author_name: z.string().min(1).max(120).default('Arham Begani'),
  author_photo_url: z.string().url().optional().nullable(),
  featured_image_url: z.string().url().optional().nullable(),

  // SEO
  meta_title: z.string().min(10).max(120),
  meta_description: z.string().min(50).max(200),
  og_image_url: z.string().url().optional().nullable(),
  canonical_url: z.string().url().optional().nullable(),

  // Keywords
  primary_keyword: z.string().min(2).max(120).optional().nullable(),
  secondary_keywords: z.array(z.string()).default([]),

  // Internal linking
  internal_links: z.array(BlogInternalLinkSchema).default([]),
  related_post_ids: z.array(z.string().uuid()).default([]),

  // Publishing
  published: z.boolean().default(false),
  published_at: z.string().datetime().optional().nullable(),
})

// Shape of a row read from the database. Everything is permissive on the read
// side so we don't reject legitimately-stored drafts that predate schema
// tightening — validation errors on read would turn into 500s for the user.
export const BlogPostRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  content: z.string(),
  author_id: z.string().uuid().nullable(),
  author_name: z.string(),
  author_photo_url: z.string().nullable(),
  featured_image_url: z.string().nullable(),

  meta_title: z.string(),
  meta_description: z.string(),
  og_image_url: z.string().nullable(),
  canonical_url: z.string().nullable(),

  primary_keyword: z.string().nullable(),
  secondary_keywords: z.array(z.string()).nullable(),

  internal_links: z.array(BlogInternalLinkSchema).nullable(),
  related_post_ids: z.array(z.string().uuid()).nullable(),

  published: z.boolean(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),

  view_count: z.number().int().nonnegative(),
})

// Slim projection used by listings and cards. Avoids loading the full
// Markdown/HTML body when we only need titles and metadata.
export const BlogPostSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  featured_image_url: z.string().nullable(),
  author_name: z.string(),
  published_at: z.string().nullable(),
  view_count: z.number().int().nonnegative(),
})

export const BlogListResponseSchema = z.object({
  posts: z.array(BlogPostSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
})

export type BlogInternalLink = z.infer<typeof BlogInternalLinkSchema>
export type BlogPostInput = z.infer<typeof BlogPostInputSchema>
export type BlogPostRow = z.infer<typeof BlogPostRowSchema>
export type BlogPostSummary = z.infer<typeof BlogPostSummarySchema>
export type BlogListResponse = z.infer<typeof BlogListResponseSchema>
