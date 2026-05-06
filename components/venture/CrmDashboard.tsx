'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import type { SocialConnection, SocialProvider } from '@/lib/marketing.shared'

type InboxItem = {
  id: string
  source: 'instagram' | 'linkedin' | 'gmail' | 'reddit' | 'telegram'
  username: string | null
  text: string
  timestamp: string | null
  permalink: string | null
  assetId: string | null
}

type LeadRow = {
  id: string
  identity: string
  source: InboxItem['source']
  count: number
  lastTimestamp: string | null
  lastText: string
  lastPermalink: string | null
}

type CampaignSummary = {
  id: string
  name: string
  status: string
  sent_count?: number
  opened_count?: number
  clicked_count?: number
  replied_count?: number
}

interface CrmDashboardProps {
  ventureId: string
  ventureName: string
}

type TabId = 'inbox' | 'leads' | 'pipeline'

type GmailUI = {
  connected: boolean
  email: string | null
  canSend: boolean
  state: 'not_connected' | 'active' | 'needs_reauth' | 'error' | 'disconnected'
  errorMessage: string | null
}

type ChannelKey = SocialProvider | 'gmail' | 'reddit' | 'telegram'

interface ChannelDescriptor {
  key: ChannelKey
  label: string
  comingSoon?: boolean
}

const CHANNELS: ChannelDescriptor[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'gmail', label: 'Gmail' },
  { key: 'reddit', label: 'Reddit', comingSoon: true },
  { key: 'telegram', label: 'Telegram', comingSoon: true },
]

function statusColor(status: string | null | undefined): string {
  switch (status) {
    case 'active':
      return '#16a34a'
    case 'reauth_required':
    case 'needs_reauth':
      return '#d97706'
    case 'expired':
    case 'revoked':
    case 'error':
      return '#dc2626'
    default:
      return '#6b7280'
  }
}

export function CrmDashboard({ ventureId, ventureName }: CrmDashboardProps) {
  const toast = useToast()
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<TabId>('inbox')
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [gmail, setGmail] = useState<GmailUI | null>(null)
  const [loading, setLoading] = useState(true)
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [inboxLoading, setInboxLoading] = useState(true)
  const [inboxError, setInboxError] = useState<string | null>(null)
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [leadsError, setLeadsError] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [campaignsError, setCampaignsError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [socialRes, gmailRes] = await Promise.all([
          fetch('/api/integrations'),
          fetch('/api/integrations/gmail'),
        ])
        if (!cancelled && socialRes.ok) {
          const data = (await socialRes.json()) as { connections: SocialConnection[] }
          setConnections(data.connections ?? [])
        }
        if (!cancelled && gmailRes.ok) {
          const d = (await gmailRes.json()) as GmailUI
          setGmail({
            connected: Boolean(d.connected),
            email: d.email ?? null,
            canSend: Boolean(d.canSend),
            state: d.state ?? (d.connected ? 'active' : 'not_connected'),
            errorMessage: d.errorMessage ?? null,
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ventureId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setInboxLoading(true)
      setInboxError(null)
      try {
        const res = await fetch(`/api/ventures/${ventureId}/crm/inbox`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to load CRM inbox')
        if (!cancelled) setInbox((data.items as InboxItem[]) ?? [])
      } catch (e) {
        if (!cancelled) setInboxError(e instanceof Error ? e.message : 'Failed to load CRM inbox')
      } finally {
        if (!cancelled) setInboxLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ventureId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLeadsLoading(true)
      setLeadsError(null)
      try {
        const res = await fetch(`/api/ventures/${ventureId}/crm/leads`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to load leads')
        if (!cancelled) setLeads((data.leads as LeadRow[]) ?? [])
      } catch (e) {
        if (!cancelled) setLeadsError(e instanceof Error ? e.message : 'Failed to load leads')
      } finally {
        if (!cancelled) setLeadsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ventureId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setCampaignsLoading(true)
      setCampaignsError(null)
      try {
        const res = await fetch(`/api/campaigns?venture_id=${encodeURIComponent(ventureId)}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to load campaigns')
        if (!cancelled) setCampaigns((data.campaigns as CampaignSummary[]) ?? [])
      } catch (e) {
        if (!cancelled) setCampaignsError(e instanceof Error ? e.message : 'Failed to load campaigns')
      } finally {
        if (!cancelled) setCampaignsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ventureId])

  if (!mounted) return null

  function pillStatus(channel: ChannelDescriptor): { label: string; color: string } {
    if (channel.comingSoon) return { label: 'Coming soon', color: '#6b7280' }
    if (channel.key === 'gmail') {
      if (!gmail) return { label: 'Loading…', color: '#6b7280' }
      if (gmail.connected) return { label: 'Connected', color: statusColor('active') }
      if (gmail.state === 'needs_reauth') return { label: 'Reconnect', color: statusColor('reauth_required') }
      return { label: 'Not connected', color: '#6b7280' }
    }
    const conn = connections.find((c) => c.provider === channel.key)
    if (!conn) return { label: 'Not connected', color: '#6b7280' }
    return { label: conn.status.replace('_', ' '), color: statusColor(conn.status) }
  }

  function handleComingSoon(label: string) {
    toast.info(`${label} CRM is on the roadmap — connection coming soon.`)
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 48px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
          textTransform: 'uppercase', color: 'var(--accent)',
        }}>
          {ventureName}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>
          CRM Dashboard
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6, maxWidth: 720 }}>
          Inbound signal from every connected channel — comments, replies, and threads — aggregated into one inbox, deduplicated into leads, and tracked through your outreach pipeline.
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        marginBottom: 20,
      }}>
        {CHANNELS.map((channel) => {
          const { label, color } = pillStatus(channel)
          const interactive = Boolean(channel.comingSoon)
          return (
            <button
              key={channel.key}
              type="button"
              onClick={interactive ? () => handleComingSoon(channel.label) : undefined}
              disabled={!interactive}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px',
                borderRadius: 999,
                border: `1px solid ${color}30`,
                background: `${color}10`,
                color: 'var(--text)',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                cursor: interactive ? 'pointer' : 'default',
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: color,
              }} />
              <span>{channel.label}</span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: 'var(--text-soft)',
                textTransform: 'capitalize',
              }}>
                · {label}
              </span>
            </button>
          )
        })}
      </div>

      <div style={{
        display: 'flex', gap: 4,
        borderBottom: '1px solid var(--border)',
        marginBottom: 18,
      }}>
        {([
          { id: 'inbox' as const, label: 'Inbox' },
          { id: 'leads' as const, label: 'Leads' },
          { id: 'pipeline' as const, label: 'Pipeline' },
        ]).map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                appearance: 'none',
                background: 'transparent',
                border: 'none',
                padding: '10px 14px',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--text)' : 'var(--text-soft)',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div>
        {tab === 'inbox' && (
          <InboxTab loading={inboxLoading} error={inboxError} items={inbox} />
        )}
        {tab === 'leads' && (
          <LeadsTab loading={leadsLoading} error={leadsError} leads={leads} />
        )}
        {tab === 'pipeline' && (
          <PipelineTab
            ventureId={ventureId}
            loading={campaignsLoading}
            error={campaignsError}
            campaigns={campaigns}
          />
        )}
      </div>
    </div>
  )
}

function InboxTab({
  loading,
  error,
  items,
}: {
  loading: boolean
  error: string | null
  items: InboxItem[]
}) {
  if (loading) {
    return (
      <div style={emptyStateStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Loading inbox…</div>
      </div>
    )
  }
  if (error) {
    return (
      <div style={{
        ...emptyStateStyle,
        borderColor: '#dc262630',
        background: '#dc262610',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>Failed to load inbox</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{error}</div>
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div style={emptyStateStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>No inbound signal yet</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          Once you publish content or run outreach, comments and replies will land here.
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item) => (
        <InboxItemRow key={item.id} item={item} />
      ))}
    </div>
  )
}

function sourceBadgeColor(source: InboxItem['source']): string {
  switch (source) {
    case 'instagram': return '#8C5A7A'
    case 'linkedin':  return '#5A6E8C'
    case 'gmail':     return '#5A8C6E'
    default:          return '#6b7280'
  }
}

function InboxItemRow({ item }: { item: InboxItem }) {
  const color = sourceBadgeColor(item.source)
  const stamp = item.timestamp ? new Date(item.timestamp).toLocaleString() : null
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '14px 16px',
      borderRadius: 14,
      border: '1px solid var(--border)',
      background: 'var(--sidebar)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5,
          color, background: `${color}14`, border: `1px solid ${color}30`,
          padding: '3px 8px', borderRadius: 999,
        }}>
          {item.source}
        </span>
        {item.username && (
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            @{item.username}
          </span>
        )}
        {stamp && (
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
            {stamp}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {item.text}
      </div>
      {item.permalink && (
        <a
          href={item.permalink}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
        >
          Open original ↗
        </a>
      )}
    </div>
  )
}

function LeadsTab({
  loading,
  error,
  leads,
}: {
  loading: boolean
  error: string | null
  leads: LeadRow[]
}) {
  if (loading) {
    return (
      <div style={emptyStateStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Loading leads…</div>
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ ...emptyStateStyle, borderColor: '#dc262630', background: '#dc262610' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>Failed to load leads</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{error}</div>
      </div>
    )
  }
  if (leads.length === 0) {
    return (
      <div style={emptyStateStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>No leads yet</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          Leads will appear once people engage with your content or campaigns.
        </div>
      </div>
    )
  }
  return (
    <div style={{
      borderRadius: 14,
      border: '1px solid var(--border)',
      background: 'var(--sidebar)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 1.4fr) minmax(80px, 1fr) 80px minmax(120px, 1fr)',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        color: 'var(--muted)',
      }}>
        <div>Identity</div>
        <div>Source</div>
        <div>Count</div>
        <div>Last touch</div>
      </div>
      {leads.map((lead) => {
        const color = sourceBadgeColor(lead.source)
        const stamp = lead.lastTimestamp ? new Date(lead.lastTimestamp).toLocaleDateString() : '—'
        return (
          <div
            key={lead.id}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 1.4fr) minmax(80px, 1fr) 80px minmax(120px, 1fr)',
              gap: 12,
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center',
              fontSize: 13,
              color: 'var(--text)',
            }}
          >
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.identity === 'unknown' ? <span style={{ color: 'var(--muted)' }}>unknown</span> : `@${lead.identity}`}
            </div>
            <div>
              <span style={{
                fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4,
                color, background: `${color}14`, border: `1px solid ${color}30`,
                padding: '3px 8px', borderRadius: 999,
              }}>
                {lead.source}
              </span>
            </div>
            <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{lead.count}</div>
            <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{stamp}</div>
          </div>
        )
      })}
    </div>
  )
}

function PipelineTab({
  ventureId,
  loading,
  error,
  campaigns,
}: {
  ventureId: string
  loading: boolean
  error: string | null
  campaigns: CampaignSummary[]
}) {
  if (loading) {
    return (
      <div style={emptyStateStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Loading campaigns…</div>
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ ...emptyStateStyle, borderColor: '#dc262630', background: '#dc262610' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>Failed to load pipeline</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{error}</div>
      </div>
    )
  }

  const totals = campaigns.reduce(
    (acc, c) => ({
      sent: acc.sent + (c.sent_count ?? 0),
      opened: acc.opened + (c.opened_count ?? 0),
      clicked: acc.clicked + (c.clicked_count ?? 0),
      replied: acc.replied + (c.replied_count ?? 0),
    }),
    { sent: 0, opened: 0, clicked: 0, replied: 0 }
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{
        display: 'grid',
        gap: 10,
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      }}>
        <PipelineMetric label="Sent" value={totals.sent} color="#5A6E8C" />
        <PipelineMetric label="Opened" value={totals.opened} color="#5A8C6E" />
        <PipelineMetric label="Clicked" value={totals.clicked} color="#C4975A" />
        <PipelineMetric label="Replied" value={totals.replied} color="#8C5A7A" />
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 4px 0',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
          textTransform: 'uppercase', color: 'var(--muted)',
        }}>
          Campaigns · {campaigns.length}
        </div>
        <a
          href={`/dashboard/venture/${ventureId}/campaigns`}
          style={{
            fontSize: 12, fontWeight: 600, color: 'var(--accent)',
            textDecoration: 'none',
          }}
        >
          View all →
        </a>
      </div>

      {campaigns.length === 0 ? (
        <div style={emptyStateStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>No campaigns yet</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
            Start an outreach campaign to populate this pipeline view.
          </div>
        </div>
      ) : (
        <div style={{
          borderRadius: 14,
          border: '1px solid var(--border)',
          background: 'var(--sidebar)',
          overflow: 'hidden',
        }}>
          {campaigns.map((c) => (
            <a
              key={c.id}
              href={`/dashboard/venture/${ventureId}/campaigns/${c.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(160px, 2fr) 80px repeat(4, minmax(64px, 1fr))',
                gap: 10,
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
                fontSize: 13,
                color: 'var(--text)',
                textDecoration: 'none',
              }}
            >
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                color: 'var(--text-soft)',
              }}>
                {c.status}
              </div>
              <PipelineCell value={c.sent_count} />
              <PipelineCell value={c.opened_count} />
              <PipelineCell value={c.clicked_count} />
              <PipelineCell value={c.replied_count} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function PipelineMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '12px 14px',
      borderRadius: 12,
      border: `1px solid ${color}30`,
      background: `${color}10`,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: 0.4,
        textTransform: 'uppercase', color,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 20, fontWeight: 800, color: 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value.toLocaleString()}
      </div>
    </div>
  )
}

function PipelineCell({ value }: { value: number | undefined }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 600,
      color: 'var(--text-soft)',
      fontVariantNumeric: 'tabular-nums',
      textAlign: 'right',
    }}>
      {(value ?? 0).toLocaleString()}
    </div>
  )
}

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  borderRadius: 14,
  border: '1px dashed var(--border)',
  background: 'var(--sidebar)',
  padding: '24px 20px',
}
