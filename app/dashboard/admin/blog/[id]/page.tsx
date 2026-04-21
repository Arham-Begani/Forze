'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { BlogPostEditor, EMPTY_EDITOR_VALUE, type BlogEditorValue } from '@/components/blog/BlogPostEditor'

interface AdminBlogRow {
  id: string
  slug: string
  title: string
  description: string
  content: string
  author_name: string
  author_photo_url: string | null
  featured_image_url: string | null
  meta_title: string
  meta_description: string
  og_image_url: string | null
  canonical_url: string | null
  primary_keyword: string | null
  secondary_keywords: string[] | null
  internal_links: unknown
  published: boolean
  published_at: string | null
}

function toEditorValue(row: AdminBlogRow): BlogEditorValue {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    content: row.content,
    author_name: row.author_name || 'Arham Begani',
    author_photo_url: row.author_photo_url ?? '',
    featured_image_url: row.featured_image_url ?? '',
    meta_title: row.meta_title,
    meta_description: row.meta_description,
    og_image_url: row.og_image_url ?? '',
    canonical_url: row.canonical_url ?? '',
    primary_keyword: row.primary_keyword ?? '',
    secondary_keywords_csv: (row.secondary_keywords ?? []).join(', '),
    internal_links_json: JSON.stringify(row.internal_links ?? [], null, 2),
    published: row.published,
    published_at: row.published_at ? row.published_at.slice(0, 19) : '',
  }
}

// Next 16 route params are a Promise; we unwrap with React.use().
type PageProps = { params: Promise<{ id: string }> }

export default function EditBlogPostPage({ params }: PageProps) {
  const { id } = use(params)
  const [value, setValue] = useState<BlogEditorValue | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/blog/${id}`, { cache: 'no-store' })
        if (res.status === 404) {
          if (alive) setError('Post not found.')
          return
        }
        if (res.status === 401) {
          if (alive) setError('Access denied. Admin privileges required.')
          return
        }
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const body = await res.json()
        if (alive) setValue(toEditorValue(body.post as AdminBlogRow))
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px)', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <Link
          href='/dashboard/admin/blog'
          style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}
        >
          ← All posts
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '6px 0 0', letterSpacing: '-0.02em' }}>
          Edit blog post
        </h1>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'rgba(239,68,68,0.10)',
            color: '#b91c1c',
            fontSize: 13,
            fontWeight: 600,
            border: '1px solid rgba(239,68,68,0.35)',
          }}
        >
          {error}
        </div>
      )}

      {!error && value === null && (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>
      )}

      {value && (
        <BlogPostEditor postId={id} initialValue={value ?? EMPTY_EDITOR_VALUE} canDelete />
      )}
    </div>
  )
}
