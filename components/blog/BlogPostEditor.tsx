'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BlogEditorValue {
  slug: string
  title: string
  description: string
  content: string
  author_name: string
  author_photo_url: string
  featured_image_url: string
  meta_title: string
  meta_description: string
  og_image_url: string
  canonical_url: string
  primary_keyword: string
  secondary_keywords_csv: string
  internal_links_json: string
  published: boolean
  published_at: string
}

export const EMPTY_EDITOR_VALUE: BlogEditorValue = {
  slug: '',
  title: '',
  description: '',
  content: '',
  author_name: 'Arham Begani',
  author_photo_url: '',
  featured_image_url: '',
  meta_title: '',
  meta_description: '',
  og_image_url: '',
  canonical_url: '',
  primary_keyword: '',
  secondary_keywords_csv: '',
  internal_links_json: '[]',
  published: false,
  published_at: '',
}

interface BlogPostEditorProps {
  // When postId is undefined we POST to /api/admin/blog; otherwise PATCH.
  postId?: string
  initialValue: BlogEditorValue
  // Only shown in edit mode; passed through to the DELETE button handler.
  canDelete?: boolean
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toPayload(v: BlogEditorValue): Record<string, unknown> {
  const secondary = v.secondary_keywords_csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  let internalLinks: unknown = []
  try {
    const parsed = JSON.parse(v.internal_links_json || '[]')
    if (Array.isArray(parsed)) internalLinks = parsed
  } catch {
    // Validation happens server-side — let Zod produce the precise error.
  }

  return {
    slug: v.slug.trim(),
    title: v.title.trim(),
    description: v.description.trim(),
    content: v.content,
    author_name: v.author_name.trim() || 'Arham Begani',
    author_photo_url: v.author_photo_url.trim() || null,
    featured_image_url: v.featured_image_url.trim() || null,
    meta_title: v.meta_title.trim(),
    meta_description: v.meta_description.trim(),
    og_image_url: v.og_image_url.trim() || null,
    canonical_url: v.canonical_url.trim() || null,
    primary_keyword: v.primary_keyword.trim() || null,
    secondary_keywords: secondary,
    internal_links: internalLinks,
    related_post_ids: [],
    published: v.published,
    published_at: v.published_at ? new Date(v.published_at).toISOString() : null,
  }
}

// Turn a Zod flatten() error payload into a readable bullet list for the toast.
function formatError(payload: unknown): string {
  if (typeof payload === 'string') return payload
  if (payload && typeof payload === 'object') {
    const maybe = payload as { fieldErrors?: Record<string, string[]>; formErrors?: string[]; error?: unknown }
    const lines: string[] = []
    if (maybe.formErrors?.length) lines.push(...maybe.formErrors)
    if (maybe.fieldErrors) {
      for (const [field, errs] of Object.entries(maybe.fieldErrors)) {
        for (const err of errs) lines.push(`${field}: ${err}`)
      }
    }
    if (lines.length > 0) return lines.join('\n')
    if (typeof maybe.error === 'string') return maybe.error
    if (maybe.error) return formatError(maybe.error)
  }
  return 'Something went wrong'
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function BlogPostEditor({ postId, initialValue, canDelete }: BlogPostEditorProps) {
  const router = useRouter()
  const [value, setValue] = useState<BlogEditorValue>(initialValue)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => setValue(initialValue), [initialValue])

  const patch = useCallback(
    <K extends keyof BlogEditorValue>(key: K, next: BlogEditorValue[K]) => {
      setValue((prev) => ({ ...prev, [key]: next }))
    },
    []
  )

  const onTitleBlur = useCallback(() => {
    setValue((prev) => {
      const updated = { ...prev }
      // Auto-fill companion fields when they're still empty so the author
      // doesn't have to retype the same string three times.
      if (!prev.slug.trim() && prev.title.trim()) {
        updated.slug = slugify(prev.title)
      }
      if (!prev.meta_title.trim() && prev.title.trim()) {
        updated.meta_title = prev.title.trim().slice(0, 120)
      }
      return updated
    })
  }, [])

  const onDescriptionBlur = useCallback(() => {
    setValue((prev) => {
      if (prev.meta_description.trim() || !prev.description.trim()) return prev
      return { ...prev, meta_description: prev.description.trim().slice(0, 200) }
    })
  }, [])

  const submit = useCallback(
    async (publishOverride?: boolean) => {
      setSaving(true)
      setMsg(null)
      try {
        const payload = toPayload(
          publishOverride === undefined ? value : { ...value, published: publishOverride }
        )
        const res = await fetch(postId ? `/api/admin/blog/${postId}` : '/api/admin/blog', {
          method: postId ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          setMsg({ kind: 'err', text: formatError(body) })
          return
        }
        setMsg({ kind: 'ok', text: postId ? 'Saved.' : 'Created.' })
        if (!postId && body?.post?.id) {
          // After creation, reroute to the edit page so subsequent saves PATCH
          // the same row instead of trying to create a duplicate slug.
          router.replace(`/dashboard/admin/blog/${body.post.id}`)
          router.refresh()
          return
        }
        router.refresh()
      } catch (err) {
        setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Network error' })
      } finally {
        setSaving(false)
      }
    },
    [postId, router, value]
  )

  const remove = useCallback(async () => {
    if (!postId) return
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    setDeleting(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/blog/${postId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setMsg({ kind: 'err', text: formatError(body) })
        return
      }
      router.replace('/dashboard/admin/blog')
      router.refresh()
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Network error' })
    } finally {
      setDeleting(false)
    }
  }, [postId, router])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: 'pre-line',
            background:
              msg.kind === 'ok' ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
            color: msg.kind === 'ok' ? '#15803d' : '#b91c1c',
            border: `1px solid ${msg.kind === 'ok' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
          }}
        >
          {msg.text}
        </div>
      )}

      <Section title='Content'>
        <Field label='Title' hint='30–100 characters reads best in SERPs.'>
          <input
            style={inputStyle}
            value={value.title}
            onChange={(e) => patch('title', e.target.value)}
            onBlur={onTitleBlur}
            placeholder='How Non-Technical Founders Actually Build Startups…'
          />
        </Field>

        <Field label='Slug' hint='Lowercase letters, numbers, hyphens. Final URL: /blog/<slug>'>
          <input
            style={inputStyle}
            value={value.slug}
            onChange={(e) => patch('slug', e.target.value)}
            placeholder='non-technical-founders-build-startup'
          />
        </Field>

        <Field label='Short description' hint='Shown in the listing card and meta description fallback.'>
          <textarea
            style={{ ...inputStyle, minHeight: 70 }}
            value={value.description}
            onChange={(e) => patch('description', e.target.value)}
            onBlur={onDescriptionBlur}
            placeholder='One-sentence promise to the reader.'
          />
        </Field>

        <Field label='Body (HTML)' hint='Write HTML directly — &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, etc. Styling comes from .blog-content.'>
          <textarea
            style={{ ...inputStyle, minHeight: 320, fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
            value={value.content}
            onChange={(e) => patch('content', e.target.value)}
            placeholder='<h2>Intro</h2><p>...</p>'
          />
        </Field>
      </Section>

      <Section title='SEO'>
        <Field label='Meta title' hint='30–60 characters. Shown as the SERP headline.'>
          <input
            style={inputStyle}
            value={value.meta_title}
            onChange={(e) => patch('meta_title', e.target.value)}
          />
        </Field>

        <Field label='Meta description' hint='50–200 characters. Shown as the SERP snippet.'>
          <textarea
            style={{ ...inputStyle, minHeight: 60 }}
            value={value.meta_description}
            onChange={(e) => patch('meta_description', e.target.value)}
          />
        </Field>

        <TwoCol>
          <Field label='Primary keyword'>
            <input
              style={inputStyle}
              value={value.primary_keyword}
              onChange={(e) => patch('primary_keyword', e.target.value)}
              placeholder='non-technical founder'
            />
          </Field>
          <Field label='Secondary keywords (comma separated)'>
            <input
              style={inputStyle}
              value={value.secondary_keywords_csv}
              onChange={(e) => patch('secondary_keywords_csv', e.target.value)}
              placeholder='founder without technical skills, no code startup'
            />
          </Field>
        </TwoCol>

        <TwoCol>
          <Field label='Featured image URL'>
            <input
              style={inputStyle}
              value={value.featured_image_url}
              onChange={(e) => patch('featured_image_url', e.target.value)}
              placeholder='https://…/post-hero.jpg'
            />
          </Field>
          <Field label='Open Graph image URL (1200x630)'>
            <input
              style={inputStyle}
              value={value.og_image_url}
              onChange={(e) => patch('og_image_url', e.target.value)}
              placeholder='https://…/og.jpg'
            />
          </Field>
        </TwoCol>

        <TwoCol>
          <Field label='Canonical URL (optional)'>
            <input
              style={inputStyle}
              value={value.canonical_url}
              onChange={(e) => patch('canonical_url', e.target.value)}
              placeholder='https://forze.in/blog/slug'
            />
          </Field>
          <Field label='Author name'>
            <input
              style={inputStyle}
              value={value.author_name}
              onChange={(e) => patch('author_name', e.target.value)}
            />
          </Field>
        </TwoCol>
      </Section>

      <Section title='Internal links'>
        <Field
          label='JSON array of {title, slug, anchor_text}'
          hint='Used to build topic clusters. Paste valid JSON or leave as [].'
        >
          <textarea
            style={{ ...inputStyle, minHeight: 120, fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
            value={value.internal_links_json}
            onChange={(e) => patch('internal_links_json', e.target.value)}
            placeholder='[{"title":"Validation","slug":"startup-idea-validation-framework","anchor_text":"Validate your idea"}]'
          />
        </Field>
      </Section>

      <Section title='Publishing'>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            <input
              type='checkbox'
              checked={value.published}
              onChange={(e) => patch('published', e.target.checked)}
            />
            Published
          </label>
          <Field label='Publish date override' hint='Leave blank to use "now" on first publish.'>
            <input
              type='datetime-local'
              style={{ ...inputStyle, width: 220 }}
              value={value.published_at ? value.published_at.slice(0, 16) : ''}
              onChange={(e) => patch('published_at', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', paddingTop: 8 }}>
        <button
          type='button'
          onClick={() => submit()}
          disabled={saving || deleting}
          style={primaryButtonStyle(saving)}
        >
          {saving ? 'Saving…' : postId ? 'Save changes' : 'Save draft'}
        </button>

        {!value.published && (
          <button
            type='button'
            onClick={() => submit(true)}
            disabled={saving || deleting}
            style={secondaryButtonStyle(saving)}
          >
            Save & publish
          </button>
        )}

        {value.published && (
          <button
            type='button'
            onClick={() => submit(false)}
            disabled={saving || deleting}
            style={secondaryButtonStyle(saving)}
          >
            Unpublish
          </button>
        )}

        {canDelete && postId && (
          <button
            type='button'
            onClick={remove}
            disabled={saving || deleting}
            style={dangerButtonStyle(deleting)}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}

        {value.slug && value.published && (
          <a
            href={`/blog/${value.slug}`}
            target='_blank'
            rel='noopener noreferrer'
            style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--accent, #c07a3a)', fontWeight: 600 }}
          >
            View on site ↗
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Layout primitives ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{hint}</span>}
    </label>
  )
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      {children}
    </div>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent, #c07a3a)',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'wait' : 'pointer',
    opacity: disabled ? 0.7 : 1,
  }
}

function secondaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'wait' : 'pointer',
    opacity: disabled ? 0.7 : 1,
  }
}

function dangerButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid rgba(239,68,68,0.35)',
    background: 'rgba(239,68,68,0.08)',
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'wait' : 'pointer',
    opacity: disabled ? 0.7 : 1,
  }
}
