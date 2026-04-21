# 🚀 Forze Blog Setup — Complete Implementation Prompt

**For:** Claude Code (or any AI coding agent)  
**Task:** Build a production-ready blog system for forze.in  
**Stack:** Next.js 15 (App Router) + TypeScript + Antigravity DB + Zod + Tailwind  
**Effort:** ~4 hours solo work (2 hours with AI)  
**Priority:** CRITICAL for organic traffic growth

---

## Executive Summary

Build a **public-facing blog system** that:
- Renders blog posts from database (Antigravity DB / Postgres)
- Per-post SEO optimization (meta tags, schema markup, structured data)
- Internal linking between posts (topic clusters)
- Creator attribution + author schema markup
- No authentication required — public pages
- RSS feed (optional, but nice-to-have)

**Deliverables:**
- [ ] DB migration for `blog_posts` table + RLS policies
- [ ] Zod schema for blog post validation
- [ ] API route: `GET /api/blog/posts` (list all)
- [ ] API route: `GET /api/blog/posts/[slug]` (single post with related)
- [ ] Page: `app/(public)/blog/page.tsx` (listing)
- [ ] Page: `app/(public)/blog/[slug]/page.tsx` (detail + schema)
- [ ] Component: `BlogCard.tsx` (reusable post preview)
- [ ] Component: `BlogMeta.tsx` (SEO meta tags + schema)
- [ ] Utility: `generateBlogSchema()` (structured data helpers)
- [ ] Seed data: 3 initial blog posts (pre-written outlines provided)

---

## 1. Database Architecture

### Create Migration: `db/migrations/016_blog_posts.sql`

```sql
-- Create blog_posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,  -- Markdown content
  author_id UUID REFERENCES auth.users(id),
  author_name TEXT NOT NULL DEFAULT 'Arham Begani',
  author_photo_url TEXT,
  featured_image_url TEXT,
  
  -- SEO fields
  meta_title TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  og_image_url TEXT,
  canonical_url TEXT,
  
  -- Keyword targeting
  primary_keyword TEXT,
  secondary_keywords TEXT[],  -- Array of keywords
  
  -- Internal linking
  internal_links JSONB,  -- [{ title, slug, anchor_text }]
  related_post_ids UUID[],  -- Links to related blog_posts.id
  
  -- Publishing
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Traffic tracking
  view_count INTEGER DEFAULT 0,
  
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC) WHERE published = true;
CREATE INDEX idx_blog_posts_primary_keyword ON blog_posts(primary_keyword);

-- Enable RLS
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view published posts
CREATE POLICY "Public read published posts"
  ON blog_posts FOR SELECT
  USING (published = true);

-- Policy: Only owner can edit
CREATE POLICY "Owners can edit own posts"
  ON blog_posts FOR UPDATE
  USING (auth.uid() = author_id);

-- Policy: Only owner can insert
CREATE POLICY "Owners can insert posts"
  ON blog_posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Policy: Only owner can delete
CREATE POLICY "Owners can delete own posts"
  ON blog_posts FOR DELETE
  USING (auth.uid() = author_id);

-- Create blog_views table (for analytics, optional)
CREATE TABLE IF NOT EXISTS blog_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  referrer TEXT,
  viewed_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_blog_views_post_id ON blog_views(post_id);
CREATE INDEX idx_blog_views_viewed_at ON blog_views(viewed_at DESC);

-- Enable RLS on blog_views
ALTER TABLE blog_views ENABLE ROW LEVEL SECURITY;

-- Policy: Insert views (anonymous users OK)
CREATE POLICY "Anyone can insert views"
  ON blog_views FOR INSERT
  WITH CHECK (true);

-- Policy: View own or public stats
CREATE POLICY "Public read aggregated stats"
  ON blog_views FOR SELECT
  USING (true);
```

### Run Migration
```bash
# From project root
psql $DATABASE_URL < db/migrations/016_blog_posts.sql
```

---

## 2. Zod Validation Schemas

### Create: `lib/schemas/blog.ts`

```typescript
import { z } from 'zod';

// Internal linking structure
export const BlogInternalLinkSchema = z.object({
  title: z.string().min(5).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  anchor_text: z.string().min(3).max(50),
});

// Blog post creation/update
export const BlogPostSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  title: z.string().min(30).max(100, 'Title should be 30-100 chars for SEO'),
  description: z.string().min(50).max(200, 'Meta description 50-200 chars'),
  content: z.string().min(1000, 'Content should be at least 1000 words'),
  author_name: z.string().default('Arham Begani'),
  author_photo_url: z.string().url().optional(),
  featured_image_url: z.string().url().optional(),
  
  // SEO
  meta_title: z.string().min(30).max(60, 'Meta title should be 30-60 chars'),
  meta_description: z.string().min(120).max(160, 'Meta description should be 120-160 chars'),
  og_image_url: z.string().url().optional(),
  canonical_url: z.string().url().optional(),
  
  // Keywords
  primary_keyword: z.string().min(3).max(50),
  secondary_keywords: z.array(z.string()).default([]),
  
  // Internal linking
  internal_links: z.array(BlogInternalLinkSchema).default([]),
  related_post_ids: z.array(z.string().uuid()).default([]),
  
  // Publishing
  published: z.boolean().default(false),
  published_at: z.date().optional(),
});

export const BlogPostWithIdSchema = BlogPostSchema.extend({
  id: z.string().uuid(),
  created_at: z.date(),
  updated_at: z.date(),
  view_count: z.number().int().nonnegative().default(0),
});

// Blog list response with pagination
export const BlogListSchema = z.object({
  posts: z.array(BlogPostWithIdSchema),
  total: z.number().int(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

// Related posts response
export const RelatedPostsSchema = z.array(
  z.object({
    id: z.string().uuid(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
  })
);

export type BlogPost = z.infer<typeof BlogPostSchema>;
export type BlogPostWithId = z.infer<typeof BlogPostWithIdSchema>;
export type BlogList = z.infer<typeof BlogListSchema>;
export type RelatedPosts = z.infer<typeof RelatedPostsSchema>;
```

---

## 3. Database Query Helpers

### Update/Add: `lib/queries.ts`

```typescript
// Add these functions to existing queries.ts

import { BlogPostSchema, BlogPostWithIdSchema, BlogListSchema } from '@/lib/schemas/blog';

// Get all published blog posts with pagination
export async function getBlogPosts(page: number = 1, pageSize: number = 10) {
  const offset = (page - 1) * pageSize;
  
  const query = `
    SELECT 
      id, slug, title, description, featured_image_url,
      author_name, published_at, view_count
    FROM blog_posts
    WHERE published = true
    ORDER BY published_at DESC
    LIMIT $1 OFFSET $2
  `;
  
  const countQuery = 'SELECT COUNT(*) as total FROM blog_posts WHERE published = true';
  
  const [posts, countResult] = await Promise.all([
    db.query(query, [pageSize, offset]),
    db.query(countQuery),
  ]);
  
  return {
    posts: posts.rows,
    total: parseInt(countResult.rows[0].total),
    page,
    pageSize,
  };
}

// Get single blog post by slug
export async function getBlogPostBySlug(slug: string) {
  const query = `
    SELECT * FROM blog_posts
    WHERE slug = $1 AND published = true
  `;
  
  const result = await db.query(query, [slug]);
  
  if (result.rows.length === 0) return null;
  
  return BlogPostWithIdSchema.parse({
    ...result.rows[0],
    published_at: result.rows[0].published_at ? new Date(result.rows[0].published_at) : null,
    created_at: new Date(result.rows[0].created_at),
    updated_at: new Date(result.rows[0].updated_at),
  });
}

// Get related posts (by shared keywords or explicit relations)
export async function getRelatedPosts(postId: string, limit: number = 3) {
  const query = `
    SELECT id, slug, title, description
    FROM blog_posts
    WHERE published = true 
      AND id != $1
      AND (
        primary_keyword IN (SELECT primary_keyword FROM blog_posts WHERE id = $1)
        OR id = ANY(SELECT unnest(related_post_ids) FROM blog_posts WHERE id = $1)
      )
    ORDER BY published_at DESC
    LIMIT $2
  `;
  
  const result = await db.query(query, [postId, limit]);
  return result.rows;
}

// Increment view count
export async function incrementBlogViewCount(postId: string) {
  const query = `
    UPDATE blog_posts 
    SET view_count = view_count + 1 
    WHERE id = $1
  `;
  
  await db.query(query, [postId]);
}

// Get blog post for editing (owner only)
export async function getBlogPostForEdit(postId: string, userId: string) {
  const query = `
    SELECT * FROM blog_posts
    WHERE id = $1 AND author_id = $2
  `;
  
  const result = await db.query(query, [postId, userId]);
  
  if (result.rows.length === 0) return null;
  
  return BlogPostWithIdSchema.parse(result.rows[0]);
}

// Create blog post (author only)
export async function createBlogPost(data: BlogPost, userId: string) {
  const post = BlogPostSchema.parse(data);
  
  const query = `
    INSERT INTO blog_posts (
      slug, title, description, content, author_id, author_name,
      meta_title, meta_description, primary_keyword, secondary_keywords,
      featured_image_url, og_image_url, canonical_url,
      internal_links, published, published_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
    ) RETURNING *
  `;
  
  const result = await db.query(query, [
    post.slug,
    post.title,
    post.description,
    post.content,
    userId,
    post.author_name,
    post.meta_title,
    post.meta_description,
    post.primary_keyword,
    JSON.stringify(post.secondary_keywords),
    post.featured_image_url,
    post.og_image_url,
    post.canonical_url,
    JSON.stringify(post.internal_links),
    post.published,
    post.published_at,
  ]);
  
  return BlogPostWithIdSchema.parse(result.rows[0]);
}
```

---

## 4. API Routes

### Create: `app/api/blog/posts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getBlogPosts } from '@/lib/queries';

export async function GET(request: NextRequest) {
  try {
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const pageSize = parseInt(request.nextUrl.searchParams.get('pageSize') || '10');
    
    const result = await getBlogPosts(page, pageSize);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch blog posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blog posts' },
      { status: 500 }
    );
  }
}
```

### Create: `app/api/blog/posts/[slug]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getBlogPostBySlug, getRelatedPosts } from '@/lib/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const post = await getBlogPostBySlug(params.slug);
    
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }
    
    // Get related posts
    const relatedPosts = await getRelatedPosts(post.id, 3);
    
    return NextResponse.json({
      post,
      related: relatedPosts,
    });
  } catch (error) {
    console.error('Failed to fetch blog post:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blog post' },
      { status: 500 }
    );
  }
}
```

### Create: `app/api/blog/posts/[slug]/views/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { incrementBlogViewCount, getBlogPostBySlug } from '@/lib/queries';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const post = await getBlogPostBySlug(params.slug);
    
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }
    
    await incrementBlogViewCount(post.id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to increment view count:', error);
    return NextResponse.json(
      { error: 'Failed to increment view count' },
      { status: 500 }
    );
  }
}
```

---

## 5. Components

### Create: `components/BlogCard.tsx`

```typescript
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';

interface BlogCardProps {
  slug: string;
  title: string;
  description: string;
  featuredImage?: string;
  authorName: string;
  publishedAt: Date;
  viewCount: number;
}

export function BlogCard({
  slug,
  title,
  description,
  featuredImage,
  authorName,
  publishedAt,
  viewCount,
}: BlogCardProps) {
  return (
    <article className="border border-[#e8e4dc] dark:border-[#272523] rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white dark:bg-[#0d0d0c]">
      {featuredImage && (
        <div className="relative w-full h-48 bg-gray-200 dark:bg-gray-700">
          <Image
            src={featuredImage}
            alt={title}
            fill
            className="object-cover"
          />
        </div>
      )}
      
      <div className="p-6">
        <Link href={`/blog/${slug}`}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 hover:text-[#c07a3a] dark:hover:text-[#d4924a] transition-colors cursor-pointer mb-2">
            {title}
          </h3>
        </Link>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
          {description}
        </p>
        
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
          <div className="flex items-center gap-2">
            <span>{authorName}</span>
            <span>•</span>
            <time>{formatDistanceToNow(new Date(publishedAt), { addSuffix: true })}</time>
          </div>
          <span>{viewCount} views</span>
        </div>
        
        <Link
          href={`/blog/${slug}`}
          className="inline-block mt-4 text-[#c07a3a] dark:text-[#d4924a] hover:underline text-sm font-medium"
        >
          Read more →
        </Link>
      </div>
    </article>
  );
}
```

### Create: `components/BlogMeta.tsx`

```typescript
import { Metadata } from 'next';

interface BlogMetaProps {
  title: string;
  description: string;
  slug: string;
  ogImage?: string;
  canonicalUrl?: string;
  publishedAt?: Date;
  authorName: string;
}

export function generateBlogMetadata(meta: BlogMetaProps): Metadata {
  const baseUrl = 'https://forze.in';
  const url = `${baseUrl}/blog/${meta.slug}`;
  
  return {
    title: meta.title,
    description: meta.description,
    canonical: meta.canonicalUrl || url,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      type: 'article',
      images: meta.ogImage ? [{ url: meta.ogImage, width: 1200, height: 630 }] : [],
      authors: [meta.authorName],
      publishedTime: meta.publishedAt?.toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: meta.ogImage ? [meta.ogImage] : [],
    },
  };
}

export function BlogSchemaMarkup({
  title,
  description,
  slug,
  publishedAt,
  authorName,
  ogImage,
}: BlogMetaProps & { publishedAt: Date }) {
  const baseUrl = 'https://forze.in';
  
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: description,
    image: ogImage || `${baseUrl}/og-image.jpg`,
    datePublished: publishedAt.toISOString(),
    dateModified: publishedAt.toISOString(),
    author: {
      '@type': 'Person',
      name: authorName,
      url: `${baseUrl}/about/team`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Forze',
      url: baseUrl,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/blog/${slug}`,
    },
  };
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

---

## 6. Pages

### Create: `app/(public)/blog/page.tsx`

```typescript
import { Metadata } from 'next';
import { Suspense } from 'react';
import { getBlogPosts } from '@/lib/queries';
import { BlogCard } from '@/components/BlogCard';

export const metadata: Metadata = {
  title: 'Blog | Forze — Startup Validation & Launch',
  description: 'Learn how non-technical founders validate ideas, build MVPs, and scale startups. Tips, strategies, and real founder stories.',
  openGraph: {
    title: 'Blog | Forze',
    description: 'Startup validation insights from the Forze team',
    url: 'https://forze.in/blog',
    type: 'website',
  },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = parseInt(searchParams.page || '1');
  const { posts, total, pageSize } = await getBlogPosts(page, 12);
  const totalPages = Math.ceil(total / pageSize);
  
  return (
    <div>
      {/* Hero Section */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-50 mb-4">
          Startup Validation Insights
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Learn how founders validate ideas, build MVPs, and move with evidence.
        </p>
      </section>
      
      {/* Posts Grid */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        {posts.length === 0 ? (
          <div className="text-center text-gray-500">
            <p>No blog posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <BlogCard
                key={post.id}
                slug={post.slug}
                title={post.title}
                description={post.description}
                featuredImage={post.featured_image_url}
                authorName={post.author_name}
                publishedAt={new Date(post.published_at)}
                viewCount={post.view_count}
              />
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-12">
            {Array.from({ length: totalPages }).map((_, i) => (
              <a
                key={i + 1}
                href={`/blog?page=${i + 1}`}
                className={`px-4 py-2 rounded ${
                  page === i + 1
                    ? 'bg-[#c07a3a] dark:bg-[#d4924a] text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-50'
                }`}
              >
                {i + 1}
              </a>
            ))}
          </div>
        )}
      </section>
      
      {/* Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'Forze Blog',
            url: 'https://forze.in/blog',
            publisher: {
              '@type': 'Organization',
              name: 'Forze',
              url: 'https://forze.in',
            },
          }),
        }}
      />
    </div>
  );
}
```

### Create: `app/(public)/blog/[slug]/page.tsx`

```typescript
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBlogPostBySlug, getRelatedPosts } from '@/lib/queries';
import { BlogSchemaMarkup, generateBlogMetadata } from '@/components/BlogMeta';
import { BlogCard } from '@/components/BlogCard';
import { incrementBlogViewCount } from '@/lib/queries';

interface BlogPostPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = await getBlogPostBySlug(params.slug);
  
  if (!post) return {};
  
  return generateBlogMetadata({
    title: post.meta_title,
    description: post.meta_description,
    slug: params.slug,
    ogImage: post.og_image_url,
    canonicalUrl: post.canonical_url,
    publishedAt: post.published_at,
    authorName: post.author_name,
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = await getBlogPostBySlug(params.slug);
  
  if (!post) notFound();
  
  // Increment views (fire and forget)
  incrementBlogViewCount(post.id).catch(console.error);
  
  // Get related posts
  const relatedPosts = await getRelatedPosts(post.id, 3);
  
  return (
    <>
      <article className="mx-auto max-w-3xl px-6 py-12">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-50 mb-4">
            {post.title}
          </h1>
          
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>{post.author_name}</span>
            <span>•</span>
            <time>{new Date(post.published_at).toLocaleDateString()}</time>
            <span>•</span>
            <span>{post.view_count} views</span>
          </div>
        </header>
        
        {/* Featured Image */}
        {post.featured_image_url && (
          <div className="mb-8 rounded-lg overflow-hidden">
            <img
              src={post.featured_image_url}
              alt={post.title}
              className="w-full h-96 object-cover"
            />
          </div>
        )}
        
        {/* Content */}
        <div
          className="prose dark:prose-invert max-w-none mb-12 text-gray-700 dark:text-gray-300"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
        
        {/* Internal Links Section */}
        {post.internal_links && post.internal_links.length > 0 && (
          <div className="bg-gray-50 dark:bg-[#0d0d0c] border border-gray-200 dark:border-[#272523] rounded-lg p-6 mb-12">
            <h3 className="text-lg font-semibold mb-4">Related Reading:</h3>
            <ul className="space-y-2">
              {post.internal_links.map((link: any, i: number) => (
                <li key={i}>
                  <a
                    href={`/blog/${link.slug}`}
                    className="text-[#c07a3a] dark:text-[#d4924a] hover:underline"
                  >
                    {link.anchor_text} →
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
      
      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-12 bg-gray-50 dark:bg-[#0d0d0c]">
          <h2 className="text-2xl font-bold mb-8">More Posts Like This</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedPosts.map((relatedPost) => (
              <BlogCard
                key={relatedPost.id}
                slug={relatedPost.slug}
                title={relatedPost.title}
                description={relatedPost.description}
                authorName="Arham Begani"
                publishedAt={new Date()}
                viewCount={0}
              />
            ))}
          </div>
        </section>
      )}
      
      {/* Schema Markup */}
      <BlogSchemaMarkup
        title={post.meta_title}
        description={post.meta_description}
        slug={params.slug}
        ogImage={post.og_image_url}
        publishedAt={post.published_at}
        authorName={post.author_name}
      />
    </>
  );
}
```

---

## 7. Seed Data: Initial Blog Posts

### Insert into DB: `db/seeds/blog-posts.sql`

```sql
-- Seed 3 initial blog posts
INSERT INTO blog_posts (
  slug, title, description, content, author_name, meta_title, 
  meta_description, primary_keyword, secondary_keywords, 
  published, published_at
) VALUES (
  'non-technical-founders-build-startup',
  'How Non-Technical Founders Actually Build Startups (No Code Required)',
  'No code skills required. Learn the proven 5-step framework non-technical founders use to validate, launch, and scale their startup idea to first customers.',
  '<h2>The Hidden Advantage You Already Have</h2><p>67% of founders lack technical background. The myth: "You need a technical co-founder or you''ll fail". The reality: Best founders outsource execution, focus on market.</p><h2>The 5-Step Framework</h2><p>[Full content here]</p>',
  'Arham Begani',
  'Non-Technical Founders: How to Actually Build a Startup Today',
  'No code skills required. Learn the proven 5-step framework non-technical founders use to validate, launch, and scale their startup idea to first customers.',
  'non-technical founder',
  ARRAY['non-technical founder build startup', 'founder without technical skills'],
  true,
  now() - interval '7 days'
);

INSERT INTO blog_posts (
  slug, title, description, content, author_name, meta_title,
  meta_description, primary_keyword, secondary_keywords,
  published, published_at
) VALUES (
  'startup-idea-validation-framework',
  'Startup Idea Validation: The 5-Minute Framework Founders Are Using',
  'The complete validation framework founders use to test 1 idea per day. Market sizing, competitor mapping, GO/NO-GO verdict, and investor-ready proof in one run.',
  '<h2>Why 90% of Startups Fail</h2><p>90% of startups fail because of poor market fit, not bad code. Cost: 3-12 months + $50K-$500K wasted.</p><h2>The Framework</h2><p>[Full content here]</p>',
  'Arham Begani',
  'Startup Idea Validation: Test Before You Build (In 5 Minutes)',
  'The complete validation framework founders use to test 1 idea per day. Market sizing, competitor mapping, GO/NO-GO verdict, and investor-ready proof in one run.',
  'startup idea validation',
  ARRAY['how to validate startup idea', 'validate business idea'],
  true,
  now() - interval '5 days'
);

INSERT INTO blog_posts (
  slug, title, description, content, author_name, meta_title,
  meta_description, primary_keyword, secondary_keywords,
  published, published_at
) VALUES (
  'ai-mvp-generator-vs-hiring-developer',
  'AI MVP Generator vs. Hiring a Developer: Real Cost & Time Comparison',
  'Build your MVP faster and cheaper. Compare AI-powered development against hiring a dev team. Real numbers: cost, timeline, and when to use each approach.',
  '<h2>The Traditional Path (Broken)</h2><p>Founder has idea → 2-4 weeks recruiting → 2-4 weeks scoping → 8-12 weeks building → 4-6 months to market feedback.</p><h2>The Modern Path</h2><p>Founder has idea → 5 min validation → 30 min landing page → 1-2 weeks to market feedback.</p><h2>Cost Comparison</h2><p>[Full content here]</p>',
  'Arham Begani',
  'AI MVP Generator vs. Hiring a Developer: Cost & Time Comparison',
  'Build your MVP faster and cheaper. Compare AI-powered development against hiring a dev team. Real numbers: cost, timeline, and when to use each approach.',
  'MVP generator',
  ARRAY['AI MVP generator', 'MVP generator vs hiring developer', 'cost of hiring developer'],
  true,
  now() - interval '3 days'
);
```

---

## 8. Implementation Instructions

### Step 1: Setup Directory Structure
```bash
# Create folders if they don't exist
mkdir -p app/(public)/blog/[slug]
mkdir -p lib/schemas
mkdir -p components
mkdir -p db/seeds
```

### Step 2: Run Migration
```bash
# Connect to your Postgres DB (Antigravity)
psql $DATABASE_URL < db/migrations/016_blog_posts.sql
```

### Step 3: Create All Files
Use the code blocks above to create:
- `lib/schemas/blog.ts`
- `lib/queries.ts` (append blog functions)
- `app/api/blog/posts/route.ts`
- `app/api/blog/posts/[slug]/route.ts`
- `app/api/blog/posts/[slug]/views/route.ts`
- `components/BlogCard.tsx`
- `components/BlogMeta.tsx`
- `app/(public)/blog/page.tsx`
- `app/(public)/blog/[slug]/page.tsx`

### Step 4: Seed Initial Data
```bash
psql $DATABASE_URL < db/seeds/blog-posts.sql
```

### Step 5: Test Locally
```bash
npm run dev
# Visit http://localhost:3000/blog
# Visit http://localhost:3000/blog/non-technical-founders-build-startup
```

### Step 6: Verify Search Console
- [ ] Add `/blog` sitemap to Google Search Console
- [ ] Request indexing for blog pages
- [ ] Monitor crawl errors daily

---

## 9. Best Practices for This Platform

### SEO Best Practices (Forze-Specific)
1. **Internal Linking Strategy**: Each post should link to 2-4 other posts (topic clusters). Use the `internal_links` field.
2. **Author Attribution**: Always include author schema + founder bio link for E-E-A-T signals.
3. **Meta Tags**: Meta titles/descriptions are *required* — they're indexed for SERP display.
4. **Markdown to HTML**: Use a library like `marked` or `react-markdown` to convert content markdown to HTML before storing in DB.
5. **Featured Images**: Always include 1200x630px OG images (required for social sharing).

### Publishing Workflow
1. **Write content with target keyword in mind** (primary_keyword field)
2. **Add internal links to related posts** before publishing
3. **Set published = false until ready**, then manually flip to true
4. **Use structured data** (schema markup) to help Google understand the content type
5. **Track rankings** in Google Search Console weekly

### Performance Optimization
- Blog post content should be *pre-rendered as HTML* (not markdown) before storing in DB
- Use `next/image` for featured images (automatic optimization)
- Blog listing page uses pagination (12 posts/page) to avoid large data transfers
- Cache blog posts with Next.js `revalidateTag('blog')` if using ISR

---

## 10. Security & RLS (Row-Level Security)

✅ **RLS is enabled** on `blog_posts`:
- Public can read published posts
- Only author (auth.uid() = author_id) can create/edit/delete own posts
- No unauthenticated POST/PUT/DELETE allowed

✅ **No sensitive data exposed** via API:
- API endpoints only return published posts with public fields
- Author edit panel requires auth (not yet built, but infrastructure is there)

---

## 11. Testing Checklist

- [ ] Blog listing page loads (`/blog`)
- [ ] Blog post detail page loads (`/blog/[slug]`)
- [ ] Meta tags appear correctly in page source
- [ ] Schema markup renders in page source (ld+json)
- [ ] Featured images display correctly
- [ ] Internal links render as HTML
- [ ] Related posts show up on detail page
- [ ] View count increments on detail page load
- [ ] Pagination works on listing page
- [ ] Search Console can crawl `/blog/sitemap.xml`

---

## 12. File Checklist

Before submitting, verify these files exist:

- [ ] `db/migrations/016_blog_posts.sql`
- [ ] `db/seeds/blog-posts.sql`
- [ ] `lib/schemas/blog.ts`
- [ ] `lib/queries.ts` (updated with blog functions)
- [ ] `app/api/blog/posts/route.ts`
- [ ] `app/api/blog/posts/[slug]/route.ts`
- [ ] `app/api/blog/posts/[slug]/views/route.ts`
- [ ] `components/BlogCard.tsx`
- [ ] `components/BlogMeta.tsx`
- [ ] `app/(public)/blog/page.tsx`
- [ ] `app/(public)/blog/[slug]/page.tsx`

---

## 13. Post-Implementation: Content Roadmap

Once blog is live, publish content in this order:

**Week 1-2** (3 posts):
1. Non-Technical Founders guide
2. Startup Idea Validation framework
3. AI vs. Hiring Developer comparison

**Week 3-4** (3 more posts):
4. Founder's Complete Validation Checklist
5. How to Pitch MVP to Investors
6. Product-Market Fit Framework

**Ongoing** (1-2 posts/week):
- Focus on ranking for keywords with search volume
- Update old posts with new data (boosts rankings)
- Build internal link networks between posts

---

## 14. Questions for Arham

Before starting implementation:

1. **Where should blog drafts be stored?** (DB only, or also in Git as .md files?)
2. **Who needs access to publish blog posts?** (Just you, or team members too?)
3. **Do you want an admin panel for blog management?** (Can build after basic blog launches)
4. **Markdown or HTML content in database?** (Recommend storing as HTML for performance)
5. **Do you have featured images ready for the 3 seed posts?** (Needed for OG tags)

---

**READY TO BUILD?** Copy this prompt to Claude Code with context about your codebase, and it will implement the entire blog system end-to-end.
