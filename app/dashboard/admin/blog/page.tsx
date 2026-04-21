'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface AdminBlogRow {
  id: string
  slug: string
  title: string
  description: string
  published: boolean
  published_at: string | null
  updated_at: string
  view_count: number
}

export default function AdminBlogListPage() {
  const [posts, setPosts] = useState<AdminBlogRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/admin/blog', { cache: 'no-store' })
      if (res.status === 401) {
        setError('Access denied. Admin privileges required.')
        setPosts([])
        return
      }
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const body = await res.json()
      setPosts(body.posts ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setPosts([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px)', maxWidth: 1100, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            Blog
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            Draft, edit, and publish posts to{' '}
            <Link href='/blog' style={{ color: 'var(--accent, #c07a3a)' }}>
              /blog
            </Link>
            .
          </p>
        </div>
        <Link
          href='/dashboard/admin/blog/new'
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: 'var(--accent, #c07a3a)',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          + New post
        </Link>
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
            marginBottom: 16,
            border: '1px solid rgba(239,68,68,0.35)',
          }}
        >
          {error}
        </div>
      )}

      {posts === null ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>
      ) : posts.length === 0 && !error ? (
        <div
          style={{
            padding: 32,
            borderRadius: 12,
            border: '1px dashed var(--border)',
            textAlign: 'center',
            color: 'var(--muted)',
          }}
        >
          <p style={{ margin: 0, fontSize: 14 }}>No posts yet.</p>
          <p style={{ marginTop: 6, fontSize: 13 }}>
            Hit <strong>New post</strong> to publish your first one.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                <th style={thStyle}>Title</th>
                <th style={{ ...thStyle, width: 110 }}>Status</th>
                <th style={{ ...thStyle, width: 110, textAlign: 'right' }}>Views</th>
                <th style={{ ...thStyle, width: 160, textAlign: 'right' }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {(posts ?? []).map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>
                    <Link
                      href={`/dashboard/admin/blog/${p.id}`}
                      style={{ color: 'var(--text)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      {p.title || <em style={{ color: 'var(--muted)' }}>(untitled)</em>}
                    </Link>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>/{p.slug}</div>
                  </td>
                  <td style={tdStyle}>
                    <StatusPill published={p.published} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>
                    {p.view_count.toLocaleString()}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--muted)' }}>
                    {formatRelative(p.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusPill({ published }: { published: boolean }) {
  return (
    <span
      style={{
        padding: '2px 10px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 700,
        background: published ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.14)',
        color: published ? '#15803d' : '#b45309',
      }}
    >
      {published ? 'Published' : 'Draft'}
    </span>
  )
}

function formatRelative(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}
const tdStyle: React.CSSProperties = { padding: '12px 14px', fontSize: 13, color: 'var(--text)' }
