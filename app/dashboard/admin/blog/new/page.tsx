'use client'

import Link from 'next/link'
import { BlogPostEditor, EMPTY_EDITOR_VALUE } from '@/components/blog/BlogPostEditor'

export default function NewBlogPostPage() {
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
          New blog post
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          Save as draft, or publish immediately with <em>Save & publish</em>.
        </p>
      </div>

      <BlogPostEditor initialValue={EMPTY_EDITOR_VALUE} />
    </div>
  )
}
