'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useToast } from '@/components/ui/Toast'
import type { SocialConnection, SocialProvider } from '@/lib/marketing.shared'

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'lost' | 'won'
type TabId = 'overview' | 'inbox' | 'leads' | 'outreach' | 'pipeline'
type LeadSegment = 'email' | 'social'
type ChannelKey = SocialProvider | 'gmail' | 'reddit' | 'telegram'

type VentureSummary = {
  id: string
  name: string
}

type AnalyticsEvent = {
  id: string
  event_type: string
  metadata?: Record<string, unknown>
  created_at: string
}

type SocialBreakdown = {
  platform: string
  count: number
  leads: number
}

type CrmAnalytics = {
  visitors: number
  leads: number
  conversionRate: string
  rawAnalytics: AnalyticsEvent[]
  socialBreakdown: SocialBreakdown[]
}

type InboxItem = {
  id: string
  source: 'instagram' | 'linkedin' | 'gmail' | 'reddit' | 'telegram'
  username: string | null
  text: string
  timestamp: string | null
  permalink: string | null
  assetId: string | null
}

type SocialLead = {
  id: string
  identity: string
  source: InboxItem['source']
  count: number
  lastTimestamp: string | null
  lastText: string
  lastPermalink: string | null
}

type EmailLead = {
  id: string
  venture_id: string
  email: string
  name: string | null
  status: LeadStatus
  source: string
  created_at: string
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

type GmailUI = {
  connected: boolean
  email: string | null
  canSend: boolean
  state: 'not_connected' | 'active' | 'needs_reauth' | 'error' | 'disconnected'
  errorMessage: string | null
}

type AsyncState<T> = {
  data: T
  loading: boolean
  error: string | null
}

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
]

const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'lost', 'won']

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T
}

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

function sourceBadgeColor(source: InboxItem['source']): string {
  switch (source) {
    case 'instagram': return '#8C5A7A'
    case 'linkedin': return '#5A6E8C'
    case 'gmail': return '#5A8C6E'
    default: return '#6b7280'
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function interpolateTemplate(template: string, lead: EmailLead | null): string {
  const name = lead?.name?.trim() || 'there'
  return template.replace(/{{\s*name\s*}}/g, name)
}

export function CrmDashboardClient({ venture }: { venture: VentureSummary }) {
  const toast = useToast()
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<TabId>('overview')
  const [leadSegment, setLeadSegment] = useState<LeadSegment>('email')
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [gmail, setGmail] = useState<GmailUI | null>(null)
  const [connectionsLoading, setConnectionsLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AsyncState<CrmAnalytics | null>>({ data: null, loading: true, error: null })
  const [inbox, setInbox] = useState<AsyncState<InboxItem[]>>({ data: [], loading: true, error: null })
  const [socialLeads, setSocialLeads] = useState<AsyncState<SocialLead[]>>({ data: [], loading: true, error: null })
  const [emailLeads, setEmailLeads] = useState<AsyncState<EmailLead[]>>({ data: [], loading: true, error: null })
  const [campaigns, setCampaigns] = useState<AsyncState<CampaignSummary[]>>({ data: [], loading: true, error: null })
  const [sourceFilter, setSourceFilter] = useState<InboxItem['source'] | 'all'>('all')
  const [inboxSearch, setInboxSearch] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [campaignType, setCampaignType] = useState('initial_outreach')
  const [dispatching, setDispatching] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const qualifiedLeads = emailLeads.data.filter((lead) => lead.status !== 'lost' && Boolean(lead.email))
  const previewLead = qualifiedLeads[0] ?? emailLeads.data[0] ?? null

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadConnections() {
      setConnectionsLoading(true)
      try {
        const [socialRes, gmailRes] = await Promise.all([
          fetch('/api/integrations'),
          fetch('/api/integrations/gmail'),
        ])
        if (!cancelled && socialRes.ok) {
          const data = await readJson<{ connections?: SocialConnection[] }>(socialRes)
          setConnections(data.connections ?? [])
        }
        if (!cancelled && gmailRes.ok) {
          const data = await readJson<Partial<GmailUI>>(gmailRes)
          setGmail({
            connected: Boolean(data.connected),
            email: data.email ?? null,
            canSend: Boolean(data.canSend),
            state: data.state ?? (data.connected ? 'active' : 'not_connected'),
            errorMessage: data.errorMessage ?? null,
          })
        }
      } finally {
        if (!cancelled) setConnectionsLoading(false)
      }
    }

    loadConnections()
    return () => {
      cancelled = true
    }
  }, [venture.id])

  useEffect(() => {
    let cancelled = false

    async function loadCrmData() {
      setAnalytics((prev) => ({ ...prev, loading: true, error: null }))
      setInbox((prev) => ({ ...prev, loading: true, error: null }))
      setSocialLeads((prev) => ({ ...prev, loading: true, error: null }))
      setCampaigns((prev) => ({ ...prev, loading: true, error: null }))

      const [analyticsResult, inboxResult, socialLeadsResult, campaignsResult] = await Promise.allSettled([
        fetch(`/api/ventures/${venture.id}/crm/analytics`),
        fetch(`/api/ventures/${venture.id}/crm/inbox`),
        fetch(`/api/ventures/${venture.id}/crm/leads`),
        fetch(`/api/campaigns?venture_id=${encodeURIComponent(venture.id)}`),
      ])

      if (cancelled) return

      await applyResponse(analyticsResult, 'Failed to load CRM analytics', async (res) => {
        const data = await readJson<CrmAnalytics>(res)
        setAnalytics({ data, loading: false, error: null })
      }, (message) => setAnalytics({ data: null, loading: false, error: message }))

      await applyResponse(inboxResult, 'Failed to load CRM inbox', async (res) => {
        const data = await readJson<{ items?: InboxItem[] }>(res)
        setInbox({ data: data.items ?? [], loading: false, error: null })
      }, (message) => setInbox({ data: [], loading: false, error: message }))

      await applyResponse(socialLeadsResult, 'Failed to load social leads', async (res) => {
        const data = await readJson<{ leads?: SocialLead[] }>(res)
        setSocialLeads({ data: data.leads ?? [], loading: false, error: null })
      }, (message) => setSocialLeads({ data: [], loading: false, error: message }))

      await applyResponse(campaignsResult, 'Failed to load campaigns', async (res) => {
        const data = await readJson<{ campaigns?: CampaignSummary[] }>(res)
        setCampaigns({ data: data.campaigns ?? [], loading: false, error: null })
      }, (message) => setCampaigns({ data: [], loading: false, error: message }))
    }

    loadCrmData()
    return () => {
      cancelled = true
    }
  }, [venture.id])

  useEffect(() => {
    void loadEmailLeads()
  }, [venture.id])

  async function applyResponse(
    result: PromiseSettledResult<Response>,
    fallback: string,
    onSuccess: (response: Response) => Promise<void>,
    onError: (message: string) => void
  ) {
    if (result.status === 'rejected') {
      onError(errorMessage(result.reason, fallback))
      return
    }
    if (!result.value.ok) {
      const data = await readJson<{ error?: unknown }>(result.value)
      onError(typeof data.error === 'string' ? data.error : fallback)
      return
    }
    await onSuccess(result.value)
  }

  async function loadEmailLeads() {
    setEmailLeads((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetch(`/api/ventures/${venture.id}/crm/leads/email`)
      const data = await readJson<{ leads?: EmailLead[]; error?: unknown }>(res)
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load email leads')
      setEmailLeads({ data: data.leads ?? [], loading: false, error: null })
    } catch (error) {
      setEmailLeads({ data: [], loading: false, error: errorMessage(error, 'Failed to load email leads') })
    }
  }

  function pillStatus(channel: ChannelDescriptor): { label: string; color: string } {
    if (connectionsLoading) return { label: 'Loading', color: '#6b7280' }
    if (channel.comingSoon) return { label: 'Coming soon', color: '#6b7280' }
    if (channel.key === 'gmail') {
      if (!gmail) return { label: 'Not connected', color: '#6b7280' }
      if (gmail.connected) return { label: 'Connected', color: statusColor('active') }
      if (gmail.state === 'needs_reauth') return { label: 'Reconnect', color: statusColor('reauth_required') }
      return { label: 'Not connected', color: '#6b7280' }
    }
    const conn = connections.find((c) => c.provider === channel.key)
    if (!conn) return { label: 'Not connected', color: '#6b7280' }
    return { label: conn.status.replace('_', ' '), color: statusColor(conn.status) }
  }

  async function handleStatusChange(lead: EmailLead, status: LeadStatus) {
    setEmailLeads((prev) => ({
      ...prev,
      data: prev.data.map((item) => item.id === lead.id ? { ...item, status } : item),
    }))
    try {
      const res = await fetch(`/api/ventures/${venture.id}/crm/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await readJson<{ error?: unknown }>(res)
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update lead status')
      toast.success('Lead status updated')
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to update lead status'))
      await loadEmailLeads()
    }
  }

  async function handleDeleteLead(lead: EmailLead) {
    if (!window.confirm(`Delete ${lead.email}? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/ventures/${venture.id}/crm/leads/${lead.id}`, { method: 'DELETE' })
      const data = await readJson<{ error?: unknown }>(res)
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete lead')
      setEmailLeads((prev) => ({ ...prev, data: prev.data.filter((item) => item.id !== lead.id) }))
      toast.success('Lead deleted')
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to delete lead'))
    }
  }

  async function handleDispatch() {
    setDispatching(true)
    try {
      const res = await fetch(`/api/ventures/${venture.id}/crm/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignType, emailSubject, emailBody }),
      })
      const result = await readJson<{ success?: boolean; sentCount?: number; error?: unknown }>(res)
      if (!res.ok || !result.success) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Failed to dispatch campaign')
      }
      toast.success(`Sent to ${result.sentCount ?? 0} leads`)
      setConfirmOpen(false)
      await Promise.all([loadEmailLeads(), refreshCampaigns()])
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to dispatch campaign'))
    } finally {
      setDispatching(false)
    }
  }

  async function refreshCampaigns() {
    try {
      const res = await fetch(`/api/campaigns?venture_id=${encodeURIComponent(venture.id)}`)
      const data = await readJson<{ campaigns?: CampaignSummary[]; error?: unknown }>(res)
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load campaigns')
      setCampaigns({ data: data.campaigns ?? [], loading: false, error: null })
    } catch (error) {
      setCampaigns({ data: [], loading: false, error: errorMessage(error, 'Failed to load campaigns') })
    }
  }

  if (!mounted) return null

  const filteredInbox = inbox.data.filter((item) => {
    const matchesSource = sourceFilter === 'all' || item.source === sourceFilter
    const query = inboxSearch.trim().toLowerCase()
    const matchesSearch = !query || [item.username, item.text, item.source].some((value) => (value ?? '').toLowerCase().includes(query))
    return matchesSource && matchesSearch
  })

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>{venture.name}</div>
          <h1 style={titleStyle}>CRM Dashboard</h1>
          <p style={subtitleStyle}>Track inbound signal, manage leads, and run outreach from one venture workspace.</p>
        </div>
      </header>

      <section style={channelRowStyle} aria-label="Connected channels">
        {CHANNELS.map((channel) => {
          const { label, color } = pillStatus(channel)
          return (
            <span key={channel.key} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 999,
              border: `1px solid ${color}30`,
              background: `${color}10`,
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 700,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              {channel.label}
              <span style={{ color: 'var(--text-soft)', fontWeight: 600 }}>· {label}</span>
            </span>
          )
        })}
      </section>

      <KpiStrip analytics={analytics} emailLeadCount={emailLeads.data.length} inboxCount={inbox.data.length} />

      <nav style={tabsStyle} aria-label="CRM sections">
        {([
          { id: 'overview' as const, label: 'Overview' },
          { id: 'inbox' as const, label: 'Inbox' },
          { id: 'leads' as const, label: 'Leads' },
          { id: 'outreach' as const, label: 'Outreach' },
          { id: 'pipeline' as const, label: 'Pipeline' },
        ]).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            style={tabButtonStyle(tab === item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'overview' && (
          <OverviewTab analytics={analytics} emailLeads={emailLeads} inbox={inbox} />
        )}
        {tab === 'inbox' && (
          <InboxTab
            loading={inbox.loading}
            error={inbox.error}
            items={filteredInbox}
            totalItems={inbox.data.length}
            sourceFilter={sourceFilter}
            search={inboxSearch}
            onSourceFilter={setSourceFilter}
            onSearch={setInboxSearch}
          />
        )}
        {tab === 'leads' && (
          <LeadsTab
            ventureId={venture.id}
            segment={leadSegment}
            onSegmentChange={setLeadSegment}
            emailLeads={emailLeads}
            socialLeads={socialLeads}
            onStatusChange={handleStatusChange}
            onDeleteLead={handleDeleteLead}
          />
        )}
        {tab === 'outreach' && (
          <OutreachTab
            campaignType={campaignType}
            subject={emailSubject}
            body={emailBody}
            recipientCount={qualifiedLeads.length}
            previewLead={previewLead}
            dispatching={dispatching}
            onCampaignType={setCampaignType}
            onSubject={setEmailSubject}
            onBody={setEmailBody}
            onOpenConfirm={() => setConfirmOpen(true)}
          />
        )}
        {tab === 'pipeline' && (
          <PipelineTab ventureId={venture.id} loading={campaigns.loading} error={campaigns.error} campaigns={campaigns.data} />
        )}
      </main>

      {confirmOpen && (
        <ConfirmModal
          count={qualifiedLeads.length}
          disabled={dispatching}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleDispatch}
        />
      )}
    </div>
  )
}

function KpiStrip({
  analytics,
  emailLeadCount,
  inboxCount,
}: {
  analytics: AsyncState<CrmAnalytics | null>
  emailLeadCount: number
  inboxCount: number
}) {
  const data = analytics.data
  return (
    <section style={kpiGridStyle}>
      <MetricCard label="Visitors" value={analytics.loading ? '...' : (data?.visitors ?? 0).toLocaleString()} />
      <MetricCard label="E-Leads" value={emailLeadCount.toLocaleString()} />
      <MetricCard label="Conv %" value={analytics.loading ? '...' : `${data?.conversionRate ?? '0.00'}%`} accent />
      <MetricCard label="Replies" value={inboxCount.toLocaleString()} />
    </section>
  )
}

function OverviewTab({
  analytics,
  emailLeads,
  inbox,
}: {
  analytics: AsyncState<CrmAnalytics | null>
  emailLeads: AsyncState<EmailLead[]>
  inbox: AsyncState<InboxItem[]>
}) {
  if (analytics.loading) return <StateCard title="Loading overview..." />
  if (analytics.error) return <StateCard title="Failed to load overview" detail={analytics.error} tone="error" />

  const data = analytics.data
  const recentActivity = [
    ...emailLeads.data.map((lead) => ({
      id: `lead:${lead.id}`,
      label: `Lead captured: ${lead.email}`,
      detail: lead.source || 'landing page',
      timestamp: lead.created_at,
    })),
    ...inbox.data.map((item) => ({
      id: `inbox:${item.id}`,
      label: `${item.source} comment${item.username ? ` from @${item.username}` : ''}`,
      detail: item.text,
      timestamp: item.timestamp ?? '',
    })),
  ]
    .filter((item) => item.timestamp)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 5)

  return (
    <div style={stackStyle}>
      <section style={panelStyle}>
        <SectionHeader title="Conversion funnel" detail="Visitors to captured leads." />
        <div style={funnelStyle}>
          <MetricCard label="Visitors" value={(data?.visitors ?? 0).toLocaleString()} />
          <ArrowConnector />
          <MetricCard label="Leads" value={(data?.leads ?? 0).toLocaleString()} />
          <ArrowConnector />
          <MetricCard label="Conversion" value={`${data?.conversionRate ?? '0.00'}%`} accent />
        </div>
      </section>

      <section style={panelStyle}>
        <SectionHeader title="Traffic source attribution" detail="Reach, clicks, and generated leads by source." />
        <div style={grid3Style}>
          {(data?.socialBreakdown ?? []).map((source) => (
            <div key={source.platform} style={sourceCardStyle}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{source.platform}</div>
              <div style={{ color: 'var(--text-soft)', fontSize: 12 }}>{source.count.toLocaleString()} reach/clicks</div>
              <div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>{source.leads.toLocaleString()} leads generated</div>
            </div>
          ))}
        </div>
      </section>

      <div style={twoColumnStyle}>
        <section style={panelStyle}>
          <SectionHeader title="7-day trend" detail="Pageviews per day." />
          <Sparkline events={data?.rawAnalytics ?? []} />
        </section>

        <section style={panelStyle}>
          <SectionHeader title="Recent activity" detail="Latest captured leads and inbound comments." />
          {recentActivity.length === 0 ? (
            <StateCard title="No activity yet" detail="Lead captures and comments will appear here." compact />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {recentActivity.map((item) => (
                <div key={item.id} style={activityRowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.detail}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatDate(item.timestamp)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function InboxTab({
  loading,
  error,
  items,
  totalItems,
  sourceFilter,
  search,
  onSourceFilter,
  onSearch,
}: {
  loading: boolean
  error: string | null
  items: InboxItem[]
  totalItems: number
  sourceFilter: InboxItem['source'] | 'all'
  search: string
  onSourceFilter: (value: InboxItem['source'] | 'all') => void
  onSearch: (value: string) => void
}) {
  return (
    <section style={panelStyle}>
      <div style={toolbarStyle}>
        <SectionHeader title="Inbox" detail={`${totalItems.toLocaleString()} total inbound comments and replies.`} />
        <div style={filterRowStyle}>
          <select value={sourceFilter} onChange={(event) => onSourceFilter(event.target.value as InboxItem['source'] | 'all')} style={inputStyle}>
            <option value="all">All sources</option>
            <option value="instagram">Instagram</option>
            <option value="linkedin">LinkedIn</option>
            <option value="gmail">Gmail</option>
          </select>
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search comments" style={inputStyle} />
        </div>
      </div>

      {loading && <StateCard title="Loading inbox..." />}
      {error && <StateCard title="Failed to load inbox" detail={error} tone="error" />}
      {!loading && !error && items.length === 0 && (
        <StateCard title="No inbound signal yet" detail="Once content or outreach receives replies, comments land here." />
      )}
      {!loading && !error && items.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item) => <InboxItemRow key={item.id} item={item} />)}
        </div>
      )}
    </section>
  )
}

function InboxItemRow({ item }: { item: InboxItem }) {
  const color = sourceBadgeColor(item.source)
  return (
    <div style={inboxRowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Badge color={color}>{item.source}</Badge>
        {item.username && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>@{item.username}</span>}
        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{formatTime(item.timestamp)}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.text}</div>
      {item.permalink && (
        <a href={item.permalink} target="_blank" rel="noreferrer" style={linkStyle}>Open original</a>
      )}
    </div>
  )
}

function LeadsTab({
  ventureId,
  segment,
  onSegmentChange,
  emailLeads,
  socialLeads,
  onStatusChange,
  onDeleteLead,
}: {
  ventureId: string
  segment: LeadSegment
  onSegmentChange: (segment: LeadSegment) => void
  emailLeads: AsyncState<EmailLead[]>
  socialLeads: AsyncState<SocialLead[]>
  onStatusChange: (lead: EmailLead, status: LeadStatus) => void
  onDeleteLead: (lead: EmailLead) => void
}) {
  return (
    <section style={panelStyle}>
      <div style={toolbarStyle}>
        <div>
          <SectionHeader title="Leads" detail="Manage email leads separately from social engagement leads." />
          <div style={segmentStyle}>
            <button type="button" onClick={() => onSegmentChange('email')} style={segmentButtonStyle(segment === 'email')}>Email leads</button>
            <button type="button" onClick={() => onSegmentChange('social')} style={segmentButtonStyle(segment === 'social')}>Social leads</button>
          </div>
        </div>
        <a href={`/api/ventures/${ventureId}/crm/leads/export?type=${segment}`} style={buttonLinkStyle}>Export CSV</a>
      </div>

      {segment === 'email' ? (
        <EmailLeadsTable state={emailLeads} onStatusChange={onStatusChange} onDeleteLead={onDeleteLead} />
      ) : (
        <SocialLeadsTable state={socialLeads} />
      )}
    </section>
  )
}

function EmailLeadsTable({
  state,
  onStatusChange,
  onDeleteLead,
}: {
  state: AsyncState<EmailLead[]>
  onStatusChange: (lead: EmailLead, status: LeadStatus) => void
  onDeleteLead: (lead: EmailLead) => void
}) {
  if (state.loading) return <StateCard title="Loading email leads..." />
  if (state.error) return <StateCard title="Failed to load email leads" detail={state.error} tone="error" />
  if (state.data.length === 0) {
    return <StateCard title="No email leads yet" detail="Lead capture submissions from landing pages will appear here." />
  }

  return (
    <div style={tableWrapStyle}>
      <div style={emailHeaderStyle}>
        <div>Name</div>
        <div>Email</div>
        <div>Source</div>
        <div>Status</div>
        <div>Captured</div>
        <div>Actions</div>
      </div>
      {state.data.map((lead) => (
        <div key={lead.id} style={emailRowStyle}>
          <div style={cellStrongStyle}>{lead.name || 'Unknown'}</div>
          <div style={cellStyle}>{lead.email}</div>
          <div style={cellStyle}>{lead.source}</div>
          <div>
            <select value={lead.status} onChange={(event) => onStatusChange(lead, event.target.value as LeadStatus)} style={smallSelectStyle}>
              {LEAD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div style={cellStyle}>{formatDate(lead.created_at)}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => onStatusChange(lead, 'won')} style={miniButtonStyle}>Won</button>
            <button type="button" onClick={() => onStatusChange(lead, 'lost')} style={miniButtonStyle}>Lost</button>
            <button type="button" onClick={() => onDeleteLead(lead)} style={dangerButtonStyle}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function SocialLeadsTable({ state }: { state: AsyncState<SocialLead[]> }) {
  if (state.loading) return <StateCard title="Loading social leads..." />
  if (state.error) return <StateCard title="Failed to load social leads" detail={state.error} tone="error" />
  if (state.data.length === 0) {
    return <StateCard title="No social leads yet" detail="Social leads appear after commenters engage with published content." />
  }

  return (
    <div style={tableWrapStyle}>
      <div style={socialHeaderStyle}>
        <div>Handle</div>
        <div>Source</div>
        <div>Interactions</div>
        <div>Last touch</div>
      </div>
      {state.data.map((lead) => {
        const color = sourceBadgeColor(lead.source)
        return (
          <div key={lead.id} style={socialRowStyle}>
            <div style={cellStrongStyle}>{lead.identity === 'unknown' ? 'unknown' : `@${lead.identity}`}</div>
            <div><Badge color={color}>{lead.source}</Badge></div>
            <div style={{ ...cellStyle, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{lead.count}</div>
            <div style={cellStyle}>{formatDate(lead.lastTimestamp)}</div>
          </div>
        )
      })}
    </div>
  )
}

function OutreachTab({
  campaignType,
  subject,
  body,
  recipientCount,
  previewLead,
  dispatching,
  onCampaignType,
  onSubject,
  onBody,
  onOpenConfirm,
}: {
  campaignType: string
  subject: string
  body: string
  recipientCount: number
  previewLead: EmailLead | null
  dispatching: boolean
  onCampaignType: (value: string) => void
  onSubject: (value: string) => void
  onBody: (value: string) => void
  onOpenConfirm: () => void
}) {
  const disabled = !subject.trim() || !body.trim() || recipientCount === 0 || dispatching
  return (
    <div style={outreachGridStyle}>
      <section style={panelStyle}>
        <SectionHeader title="Outreach" detail="Dispatch one campaign to qualified email leads." />
        <div style={recipientCardStyle}>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>Recipients</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>
            Will send to {recipientCount.toLocaleString()} qualified email leads
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Qualified means every email lead where status is not lost.</div>
        </div>

        <div style={formStackStyle}>
          <label style={labelStyle}>
            Campaign Type
            <select value={campaignType} onChange={(event) => onCampaignType(event.target.value)} style={inputStyle}>
              <option value="initial_outreach">Welcome / Initial Outreach</option>
              <option value="follow_up">Product Update Follow-up</option>
              <option value="newsletter">Weekly Newsletter</option>
            </select>
          </label>
          <label style={labelStyle}>
            Email Subject
            <input value={subject} onChange={(event) => onSubject(event.target.value)} placeholder="Welcome to the waitlist" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Email Body
            <textarea value={body} onChange={(event) => onBody(event.target.value)} rows={8} placeholder={'Hi {{name}},\n\nThanks for joining...'} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Use {'{{name}}'} to inject the lead name.</span>
          </label>
          <button type="button" disabled={disabled} onClick={onOpenConfirm} style={primaryButtonStyle(disabled)}>
            {dispatching ? 'Dispatching...' : `Dispatch to ${recipientCount.toLocaleString()} Leads`}
          </button>
        </div>
      </section>

      <aside style={panelStyle}>
        <SectionHeader title="Live preview" detail={previewLead ? `Previewing ${previewLead.email}` : 'Add a lead to preview personalization.'} />
        <div style={previewStyle}>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Subject</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{subject || 'Untitled campaign'}</div>
          <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
          <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-soft)', fontSize: 13, lineHeight: 1.7 }}>
            {interpolateTemplate(body || 'Hi {{name}},\n\nYour email body preview will appear here.', previewLead)}
          </div>
        </div>
      </aside>
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
  if (loading) return <StateCard title="Loading campaigns..." />
  if (error) return <StateCard title="Failed to load pipeline" detail={error} tone="error" />

  const totals = campaigns.reduce(
    (acc, campaign) => ({
      sent: acc.sent + (campaign.sent_count ?? 0),
      opened: acc.opened + (campaign.opened_count ?? 0),
      clicked: acc.clicked + (campaign.clicked_count ?? 0),
      replied: acc.replied + (campaign.replied_count ?? 0),
    }),
    { sent: 0, opened: 0, clicked: 0, replied: 0 }
  )

  return (
    <section style={panelStyle}>
      <div style={toolbarStyle}>
        <SectionHeader title="Pipeline" detail={`${campaigns.length.toLocaleString()} campaigns tracked.`} />
        <a href={`/dashboard/venture/${ventureId}/campaigns`} style={linkStyle}>View all</a>
      </div>
      <div style={grid4Style}>
        <PipelineMetric label="Sent" value={totals.sent} color="#5A6E8C" />
        <PipelineMetric label="Opened" value={totals.opened} color="#5A8C6E" />
        <PipelineMetric label="Clicked" value={totals.clicked} color="#C4975A" />
        <PipelineMetric label="Replied" value={totals.replied} color="#8C5A7A" />
      </div>

      {campaigns.length === 0 ? (
        <StateCard title="No campaigns yet" detail="Start an outreach campaign to populate this pipeline." />
      ) : (
        <div style={{ ...tableWrapStyle, marginTop: 16 }}>
          {campaigns.map((campaign) => (
            <a key={campaign.id} href={`/dashboard/venture/${ventureId}/campaigns/${campaign.id}`} style={campaignRowStyle}>
              <div style={cellStrongStyle}>{campaign.name}</div>
              <div style={{ ...cellStyle, textTransform: 'capitalize' }}>{campaign.status}</div>
              <PipelineCell value={campaign.sent_count} />
              <PipelineCell value={campaign.opened_count} />
              <PipelineCell value={campaign.clicked_count} />
              <PipelineCell value={campaign.replied_count} />
            </a>
          ))}
        </div>
      )}
    </section>
  )
}

function Sparkline({ events }: { events: AnalyticsEvent[] }) {
  const today = new Date()
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    return {
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      key: date.toISOString().slice(0, 10),
      value: 0,
    }
  })
  for (const event of events) {
    if (event.event_type !== 'pageview') continue
    const key = new Date(event.created_at).toISOString().slice(0, 10)
    const bucket = buckets.find((item) => item.key === key)
    if (bucket) bucket.value += 1
  }
  const max = Math.max(1, ...buckets.map((bucket) => bucket.value))
  const points = buckets.map((bucket, index) => {
    const x = 12 + index * 44
    const y = 96 - (bucket.value / max) * 72
    return { x, y, ...bucket }
  })
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  return (
    <div style={sparklineWrapStyle}>
      <svg viewBox="0 0 288 120" role="img" aria-label="Seven day pageview trend" style={{ width: '100%', height: 160 }}>
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.key}>
            <circle cx={point.x} cy={point.y} r="4" fill="var(--accent)" />
            <text x={point.x} y="116" textAnchor="middle" fontSize="9" fill="var(--muted)">{point.label}</text>
            <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="10" fill="var(--text-soft)">{point.value}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function ConfirmModal({
  count,
  disabled,
  onCancel,
  onConfirm,
}: {
  count: number
  disabled: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div style={modalOverlayStyle} role="dialog" aria-modal="true" aria-labelledby="confirm-dispatch-title">
      <div style={modalStyle}>
        <h2 id="confirm-dispatch-title" style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>Send to {count.toLocaleString()} leads?</h2>
        <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: 13, lineHeight: 1.6 }}>This will dispatch the campaign to every qualified email lead. This cannot be undone.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button type="button" onClick={onCancel} style={secondaryButtonStyle}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={disabled} style={primaryButtonStyle(disabled)}>Send campaign</button>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      padding: '16px 18px',
      borderRadius: 16,
      border: accent ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
      background: accent ? 'var(--accent-soft)' : 'var(--sidebar)',
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: accent ? 'var(--accent)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent ? 'var(--accent)' : 'var(--text)', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{value}</div>
    </div>
  )
}

function PipelineMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 14, border: `1px solid ${color}30`, background: `${color}10` }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{value.toLocaleString()}</div>
    </div>
  )
}

function PipelineCell({ value }: { value: number | undefined }) {
  return <div style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(value ?? 0).toLocaleString()}</div>
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color, background: `${color}14`, border: `1px solid ${color}30`, padding: '3px 8px', borderRadius: 999 }}>
      {children}
    </span>
  )
}

function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.2 }}>{title}</h2>
      {detail && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>{detail}</p>}
    </div>
  )
}

function StateCard({ title, detail, tone, compact = false }: { title: string; detail?: string; tone?: 'error'; compact?: boolean }) {
  return (
    <div style={{
      ...emptyStateStyle,
      padding: compact ? '16px 18px' : emptyStateStyle.padding,
      borderColor: tone === 'error' ? '#dc262630' : 'var(--border)',
      background: tone === 'error' ? '#dc262610' : 'var(--sidebar)',
    }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: tone === 'error' ? '#dc2626' : 'var(--text)' }}>{title}</div>
      {detail && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{detail}</div>}
    </div>
  )
}

function ArrowConnector() {
  return <div aria-hidden="true" style={{ color: 'var(--muted)', fontWeight: 900, alignSelf: 'center', textAlign: 'center' }}>→</div>
}

const pageStyle: CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: '24px 20px 48px',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 20,
  marginBottom: 20,
}

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: 'uppercase',
  color: 'var(--accent)',
}

const titleStyle: CSSProperties = {
  margin: '5px 0 0',
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
  maxWidth: 720,
}

const channelRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 18,
}

const kpiGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
  marginBottom: 20,
}

const tabsStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  overflowX: 'auto',
  borderBottom: '1px solid var(--border)',
  marginBottom: 18,
}

function tabButtonStyle(active: boolean): CSSProperties {
  return {
    appearance: 'none',
    background: 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    color: active ? 'var(--text)' : 'var(--text-soft)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: active ? 800 : 600,
    marginBottom: -1,
    padding: '11px 14px',
    whiteSpace: 'nowrap',
  }
}

const stackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const panelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--border)',
  background: 'var(--card-solid)',
  padding: 18,
  boxShadow: '0 16px 40px rgba(0,0,0,0.04)',
}

const funnelStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(150px, 1fr) 24px minmax(150px, 1fr) 24px minmax(150px, 1fr)',
  gap: 10,
  overflowX: 'auto',
}

const grid3Style: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
}

const grid4Style: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 10,
}

const sourceCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
}

const twoColumnStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 16,
}

const activityRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '11px 0',
  borderBottom: '1px solid var(--border)',
}

const toolbarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const filterRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--bg)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
  padding: '10px 12px',
}

const inboxRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
}

const linkStyle: CSSProperties = {
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 700,
  textDecoration: 'none',
}

const segmentStyle: CSSProperties = {
  display: 'inline-flex',
  gap: 4,
  padding: 4,
  borderRadius: 12,
  background: 'var(--sidebar)',
  border: '1px solid var(--border)',
  marginBottom: 14,
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
    padding: '7px 10px',
  }
}

const buttonLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 10,
  border: '1px solid var(--accent-glow)',
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 800,
  padding: '9px 12px',
  textDecoration: 'none',
}

const tableWrapStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
  overflowX: 'auto',
}

const emailHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '130px minmax(190px, 1.4fr) 110px 130px 120px 180px',
  minWidth: 860,
  gap: 12,
  padding: '12px 16px',
  background: 'var(--bg)',
  borderBottom: '1px solid var(--border)',
  color: 'var(--muted)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

const emailRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '130px minmax(190px, 1.4fr) 110px 130px 120px 180px',
  minWidth: 860,
  gap: 12,
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  alignItems: 'center',
}

const socialHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(180px, 1.4fr) 120px 120px 140px',
  minWidth: 620,
  gap: 12,
  padding: '12px 16px',
  background: 'var(--bg)',
  borderBottom: '1px solid var(--border)',
  color: 'var(--muted)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

const socialRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(180px, 1.4fr) 120px 120px 140px',
  minWidth: 620,
  gap: 12,
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  alignItems: 'center',
}

const cellStyle: CSSProperties = {
  color: 'var(--text-soft)',
  fontSize: 13,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const cellStrongStyle: CSSProperties = {
  ...cellStyle,
  color: 'var(--text)',
  fontWeight: 800,
}

const smallSelectStyle: CSSProperties = {
  ...inputStyle,
  padding: '7px 8px',
  textTransform: 'capitalize',
}

const miniButtonStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg)',
  color: 'var(--text-soft)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 800,
  padding: '6px 8px',
}

const dangerButtonStyle: CSSProperties = {
  ...miniButtonStyle,
  borderColor: '#dc262630',
  color: '#dc2626',
}

const outreachGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 1.2fr) minmax(260px, 0.8fr)',
  gap: 16,
  alignItems: 'start',
}

const recipientCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--accent-glow)',
  background: 'var(--accent-soft)',
  marginBottom: 16,
}

const formStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  color: 'var(--text-soft)',
  fontSize: 12,
  fontWeight: 800,
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: 'none',
    borderRadius: 11,
    background: 'var(--text)',
    color: 'var(--bg)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 900,
    opacity: disabled ? 0.5 : 1,
    padding: '11px 14px',
  }
}

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 11,
  background: 'var(--sidebar)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 800,
  padding: '11px 14px',
}

const previewStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
  padding: 16,
  minHeight: 280,
}

const campaignRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(180px, 2fr) 90px repeat(4, minmax(70px, 1fr))',
  minWidth: 760,
  gap: 10,
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  alignItems: 'center',
  color: 'var(--text)',
  textDecoration: 'none',
}

const sparklineWrapStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
  padding: 12,
}

const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 18,
  background: 'rgba(0,0,0,0.42)',
}

const modalStyle: CSSProperties = {
  width: 'min(440px, 100%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  borderRadius: 18,
  border: '1px solid var(--border)',
  background: 'var(--card-solid)',
  padding: 20,
  boxShadow: '0 28px 80px rgba(0,0,0,0.32)',
}

const emptyStateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  borderRadius: 14,
  border: '1px dashed var(--border)',
  background: 'var(--sidebar)',
  padding: '24px 20px',
}
