'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToast } from '@/components/ui/Toast'

type Kind = 'testimonial' | 'feedback'
type Filter = 'all' | 'testimonials' | 'feedback' | 'featured' | 'archived'

interface Testimonial {
  id: string
  venture_id: string
  lead_id: string | null
  name: string
  email: string
  quote: string
  kind: Kind
  featured: boolean
  archived: boolean
  source: string | null
  created_at: string
}

interface VentureSummary {
  id: string
  name: string
}

interface AsyncState {
  loading: boolean
  error: string | null
  items: Testimonial[]
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

function timeAgo(iso: string): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return '—'
  const diff = Date.now() - then
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function TestimonialsDashboardClient({ venture }: { venture: VentureSummary }) {
  const toast = useToast()
  const [mounted, setMounted] = useState(false)
  const [state, setState] = useState<AsyncState>({ loading: true, error: null, items: [] })
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [publicUrl, setPublicUrl] = useState('')

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      setPublicUrl(`${window.location.origin}/feedback/${venture.id}`)
    }
  }, [venture.id])

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetch(`/api/ventures/${venture.id}/testimonials`)
      const data = (await res.json().catch(() => ({}))) as { testimonials?: Testimonial[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to load testimonials')
      setState({ loading: false, error: null, items: data.testimonials ?? [] })
    } catch (err) {
      setState({ loading: false, error: errorMessage(err, 'Failed to load testimonials'), items: [] })
    }
  }, [venture.id])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return state.items.filter((item) => {
      if (filter === 'all' && item.archived) return false
      if (filter === 'testimonials' && (item.kind !== 'testimonial' || item.archived)) return false
      if (filter === 'feedback' && (item.kind !== 'feedback' || item.archived)) return false
      if (filter === 'featured' && (!item.featured || item.archived)) return false
      if (filter === 'archived' && !item.archived) return false
      if (!q) return true
      return [item.name, item.email, item.quote, item.source].some((value) =>
        (value ?? '').toLowerCase().includes(q)
      )
    })
  }, [state.items, filter, search])

  const totals = useMemo(() => {
    const active = state.items.filter((item) => !item.archived)
    return {
      total: active.length,
      featured: active.filter((item) => item.featured).length,
      linked: active.filter((item) => item.lead_id).length,
      feedback: active.filter((item) => item.kind === 'feedback').length,
    }
  }, [state.items])

  async function toggleFeatured(item: Testimonial) {
    const next = !item.featured
    setState((prev) => ({
      ...prev,
      items: prev.items.map((entry) => (entry.id === item.id ? { ...entry, featured: next } : entry)),
    }))
    try {
      const res = await fetch(`/api/ventures/${venture.id}/testimonials/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: next }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Failed to update')
      }
      toast.success(next ? 'Marked as featured' : 'Unfeatured')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update'))
      await load()
    }
  }

  async function toggleArchived(item: Testimonial) {
    const next = !item.archived
    setState((prev) => ({
      ...prev,
      items: prev.items.map((entry) => (entry.id === item.id ? { ...entry, archived: next } : entry)),
    }))
    try {
      const res = await fetch(`/api/ventures/${venture.id}/testimonials/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: next }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Failed to update')
      }
      toast.success(next ? 'Archived' : 'Restored')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update'))
      await load()
    }
  }

  async function copyQuote(item: Testimonial) {
    try {
      await navigator.clipboard.writeText(`"${item.quote}"\n— ${item.name}`)
      toast.success('Quote copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  async function copyPublicLink() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('Public link copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  if (!mounted) return null

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={{ minWidth: 0 }}>
          <div style={eyebrowStyle}>{venture.name}</div>
          <h1 style={titleStyle}>Testimonials &amp; Feedback</h1>
          <p style={subtitleStyle}>
            Collect public testimonials and private feedback from anyone who has tried this venture.
            Submissions that match an existing lead are automatically linked in your CRM.
          </p>
        </div>
        <div style={headerActionsStyle}>
          <button type="button" style={ghostButtonStyle} onClick={copyPublicLink}>
            Copy public link
          </button>
          <a href={publicUrl} target="_blank" rel="noreferrer" style={primaryLinkStyle}>
            Open public form ↗
          </a>
        </div>
      </header>

      <section style={kpiGridStyle} aria-label="Testimonial KPIs">
        <KpiCard label="Total" value={totals.total} />
        <KpiCard label="Featured" value={totals.featured} accent />
        <KpiCard label="Linked to leads" value={totals.linked} />
        <KpiCard label="Private feedback" value={totals.feedback} />
      </section>

      <section style={toolbarStyle}>
        <div style={segmentStyle} role="tablist" aria-label="Filter testimonials">
          {(
            [
              { id: 'all' as const, label: 'All' },
              { id: 'testimonials' as const, label: 'Testimonials' },
              { id: 'feedback' as const, label: 'Feedback' },
              { id: 'featured' as const, label: 'Featured' },
              { id: 'archived' as const, label: 'Archived' },
            ]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              onClick={() => setFilter(tab.id)}
              style={segmentButtonStyle(filter === tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search name, email or quote"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchStyle}
        />
      </section>

      {state.loading && <StateCard title="Loading testimonials..." />}
      {state.error && <StateCard title="Failed to load testimonials" detail={state.error} tone="error" />}

      {!state.loading && !state.error && visible.length === 0 && (
        <StateCard
          title={state.items.length === 0 ? 'No testimonials yet' : 'Nothing matches this filter'}
          detail={
            state.items.length === 0
              ? 'Share your public form link to start collecting voices.'
              : 'Try a different filter or clear your search.'
          }
          action={
            state.items.length === 0 ? (
              <button type="button" style={primaryButtonStyle} onClick={copyPublicLink}>
                Copy public form link
              </button>
            ) : null
          }
        />
      )}

      {!state.loading && !state.error && visible.length > 0 && (
        <div style={listStyle}>
          {visible.map((item) => (
            <article key={item.id} style={cardStyle(item)}>
              <div style={cardHeaderStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={cardNameStyle}>{item.name}</div>
                  <div style={cardMetaStyle}>
                    {item.email}
                    {item.lead_id && <span style={linkedBadge}>· Linked to lead</span>}
                  </div>
                </div>
                <div style={cardBadgesStyle}>
                  <Badge tone={item.kind === 'testimonial' ? 'amber' : 'plum'}>
                    {item.kind === 'testimonial' ? 'Testimonial' : 'Feedback'}
                  </Badge>
                  {item.featured && <Badge tone="green">Featured</Badge>}
                  {item.archived && <Badge tone="muted">Archived</Badge>}
                </div>
              </div>

              <p style={quoteStyle}>&ldquo;{item.quote}&rdquo;</p>

              <div style={cardFooterStyle}>
                <span style={timestampStyle}>{timeAgo(item.created_at)}</span>
                <div style={cardActionsStyle}>
                  <button type="button" style={chipButton} onClick={() => copyQuote(item)}>
                    Copy quote
                  </button>
                  <button
                    type="button"
                    style={chipButton}
                    onClick={() => toggleFeatured(item)}
                    aria-pressed={item.featured}
                  >
                    {item.featured ? 'Unfeature' : 'Feature'}
                  </button>
                  <button
                    type="button"
                    style={chipButton}
                    onClick={() => toggleArchived(item)}
                    aria-pressed={item.archived}
                  >
                    {item.archived ? 'Restore' : 'Archive'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      style={{
        padding: '16px 18px',
        borderRadius: 16,
        border: accent ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
        background: accent ? 'var(--accent-soft)' : 'var(--sidebar)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: accent ? 'var(--accent)' : 'var(--muted)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          marginTop: 4,
          color: accent ? 'var(--accent)' : 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value.toLocaleString()}
      </div>
    </div>
  )
}

function StateCard({
  title,
  detail,
  tone,
  action,
}: {
  title: string
  detail?: string
  tone?: 'error'
  action?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '28px 22px',
        borderRadius: 16,
        border: '1px dashed var(--border)',
        background: tone === 'error' ? '#dc262610' : 'var(--sidebar)',
        borderColor: tone === 'error' ? '#dc262640' : undefined,
        textAlign: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, color: tone === 'error' ? '#dc2626' : 'var(--text)' }}>
        {title}
      </div>
      {detail && (
        <div style={{ fontSize: 13, color: 'var(--text-soft)', maxWidth: 460, lineHeight: 1.6 }}>{detail}</div>
      )}
      {action}
    </div>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'amber' | 'plum' | 'green' | 'muted' }) {
  const palette = {
    amber: { fg: '#C4975A', bg: '#C4975A14', border: '#C4975A30' },
    plum: { fg: '#8C5A7A', bg: '#8C5A7A14', border: '#8C5A7A30' },
    green: { fg: '#5A8C6E', bg: '#5A8C6E14', border: '#5A8C6E30' },
    muted: { fg: '#6b7280', bg: '#6b728014', border: '#6b728030' },
  }[tone]
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: palette.fg,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        padding: '3px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

const pageStyle: CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '24px 20px 48px',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
}

const headerActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: 'uppercase',
  color: 'var(--accent)',
}

const titleStyle: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 28,
  lineHeight: 1.1,
  fontWeight: 900,
  color: 'var(--text)',
  letterSpacing: -0.5,
}

const subtitleStyle: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 13,
  color: 'var(--text-soft)',
  lineHeight: 1.6,
  maxWidth: 700,
}

const ghostButtonStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--sidebar)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 800,
  padding: '9px 12px',
}

const primaryLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 10,
  border: '1px solid var(--accent-glow)',
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 900,
  padding: '9px 12px',
  textDecoration: 'none',
}

const kpiGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
}

const toolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  flexWrap: 'wrap',
}

const segmentStyle: CSSProperties = {
  display: 'inline-flex',
  gap: 4,
  padding: 4,
  borderRadius: 12,
  background: 'var(--sidebar)',
  border: '1px solid var(--border)',
  flexWrap: 'wrap',
}

function segmentButtonStyle(active: boolean): CSSProperties {
  return {
    border: 'none',
    borderRadius: 9,
    background: active ? 'var(--card-solid)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-soft)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 800,
    padding: '8px 12px',
  }
}

const searchStyle: CSSProperties = {
  minWidth: 220,
  flex: '0 1 280px',
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--bg)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
  padding: '10px 12px',
}

const listStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

function cardStyle(item: Testimonial): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 18,
    borderRadius: 16,
    border: '1px solid var(--border)',
    background: item.featured ? 'var(--accent-soft)' : 'var(--card-solid)',
    opacity: item.archived ? 0.65 : 1,
    boxShadow: '0 12px 32px rgba(0,0,0,0.03)',
  }
}

const cardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
}

const cardNameStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: 'var(--text)',
}

const cardMetaStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--muted)',
  fontWeight: 600,
  marginTop: 2,
}

const linkedBadge: CSSProperties = {
  marginLeft: 4,
  color: 'var(--accent)',
  fontWeight: 800,
}

const cardBadgesStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
}

const quoteStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text-soft)',
  fontSize: 14,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
}

const cardFooterStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
}

const timestampStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--muted)',
  fontWeight: 700,
}

const cardActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
}

const chipButton: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg)',
  color: 'var(--text-soft)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 800,
  padding: '6px 10px',
}

const primaryButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  background: 'var(--text)',
  color: 'var(--bg)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 900,
  padding: '10px 14px',
}
