'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'
import type { SocialConnection } from '@/lib/marketing.shared'
import {
  CHANNELS,
  ConfirmModal,
  errorMessage,
  panelStyle,
  readJson,
  statusColor,
  type AsyncState,
  type ChannelDescriptor,
  type CrmAnalytics,
  type EmailLead,
  type GmailUI,
  type InboxItem,
  type LeadStatus,
  type TabId,
  type VentureSummary,
} from './crm/shared'
import { OverviewTab } from './crm/OverviewTab'
import { InboxTab } from './crm/InboxTab'
import { LeadsTab } from './crm/LeadsTab'
import { LeadDetailDrawer } from './crm/LeadDetailDrawer'
import { OutreachTab } from './crm/OutreachTab'
import { PipelineTab } from './crm/PipelineTab'

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

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'leads', label: 'Leads' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'outreach', label: 'Outreach' },
]

export function CrmDashboardClient({ venture }: { venture: VentureSummary }) {
  const toast = useToast()
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<TabId>('overview')
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [gmail, setGmail] = useState<GmailUI | null>(null)
  const [connectionsLoading, setConnectionsLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AsyncState<CrmAnalytics | null>>({ data: null, loading: true, error: null })
  const [inbox, setInbox] = useState<AsyncState<InboxItem[]>>({ data: [], loading: true, error: null })
  const [leads, setLeads] = useState<AsyncState<EmailLead[]>>({ data: [], loading: true, error: null })
  const [inboxSearch, setInboxSearch] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [campaignType, setCampaignType] = useState('initial_outreach')
  const [dispatching, setDispatching] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<EmailLead | null>(null)

  const qualifiedLeads = leads.data.filter((lead) => lead.status !== 'lost' && Boolean(lead.email))
  const previewLead = qualifiedLeads[0] ?? leads.data.find((l) => l.email) ?? null
  const emailLeadCount = leads.data.filter((l) => l.email).length

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
      setLeads((prev) => ({ ...prev, loading: true, error: null }))

      const [analyticsResult, inboxResult, leadsResult] = await Promise.allSettled([
        fetch(`/api/ventures/${venture.id}/crm/analytics`),
        fetch(`/api/ventures/${venture.id}/crm/inbox`),
        // Also syncs newly-seen social commenters into the unified `leads`
        // table server-side (see app/api/ventures/[id]/crm/leads/route.ts).
        fetch(`/api/ventures/${venture.id}/crm/leads`),
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

      await applyResponse(leadsResult, 'Failed to load leads', async (res) => {
        const data = await readJson<{ leads?: EmailLead[] }>(res)
        setLeads({ data: data.leads ?? [], loading: false, error: null })
      }, (message) => setLeads({ data: [], loading: false, error: message }))
    }

    loadCrmData()
    return () => {
      cancelled = true
    }
  }, [venture.id])

  async function loadLeads() {
    setLeads((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetch(`/api/ventures/${venture.id}/crm/leads`)
      const data = await readJson<{ leads?: EmailLead[]; error?: unknown }>(res)
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load leads')
      setLeads({ data: data.leads ?? [], loading: false, error: null })
    } catch (error) {
      setLeads({ data: [], loading: false, error: errorMessage(error, 'Failed to load leads') })
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
    setLeads((prev) => ({
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
      await loadLeads()
    }
  }

  async function handleDeleteLead(lead: EmailLead) {
    if (!window.confirm(`Delete ${lead.email ?? lead.name ?? 'this lead'}? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/ventures/${venture.id}/crm/leads/${lead.id}`, { method: 'DELETE' })
      const data = await readJson<{ error?: unknown }>(res)
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete lead')
      setLeads((prev) => ({ ...prev, data: prev.data.filter((item) => item.id !== lead.id) }))
      toast.success('Lead deleted')
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to delete lead'))
    }
  }

  async function handleBulkStatusChange(leadIds: string[], status: LeadStatus) {
    const prevData = leads.data
    setLeads((prev) => ({ ...prev, data: prev.data.map((l) => leadIds.includes(l.id) ? { ...l, status } : l) }))
    try {
      const res = await fetch(`/api/ventures/${venture.id}/crm/leads/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds, status }),
      })
      const data = await readJson<{ success?: boolean; error?: unknown }>(res)
      if (!res.ok || !data.success) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update leads')
      toast.success(`Updated ${leadIds.length} lead${leadIds.length === 1 ? '' : 's'}`)
    } catch (error) {
      setLeads({ data: prevData, loading: false, error: null })
      toast.error(errorMessage(error, 'Failed to update leads'))
    }
  }

  async function handleBulkDelete(leadIds: string[]) {
    const prevData = leads.data
    setLeads((prev) => ({ ...prev, data: prev.data.filter((l) => !leadIds.includes(l.id)) }))
    try {
      const res = await fetch(`/api/ventures/${venture.id}/crm/leads/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds }),
      })
      const data = await readJson<{ success?: boolean; error?: unknown }>(res)
      if (!res.ok || !data.success) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete leads')
      toast.success(`Deleted ${leadIds.length} lead${leadIds.length === 1 ? '' : 's'}`)
    } catch (error) {
      setLeads({ data: prevData, loading: false, error: null })
      toast.error(errorMessage(error, 'Failed to delete leads'))
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
      await loadLeads()
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to dispatch campaign'))
    } finally {
      setDispatching(false)
    }
  }

  if (!mounted) return null

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>{venture.name}</div>
          <h1 style={titleStyle}>CRM Dashboard</h1>
          <p style={subtitleStyle}>Track inbound signal, manage leads, run a real pipeline, and dispatch outreach from one venture workspace.</p>
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

      <section style={kpiGridStyle}>
        <KpiCard label="Visitors" value={analytics.loading ? '...' : (analytics.data?.visitors ?? 0).toLocaleString()} />
        <KpiCard label="Leads" value={emailLeadCount.toLocaleString()} />
        <KpiCard label="Conv %" value={analytics.loading ? '...' : `${analytics.data?.conversionRate ?? '0.00'}%`} accent />
        <KpiCard label="Inbox" value={inbox.data.length.toLocaleString()} />
      </section>

      <nav style={tabsStyle} aria-label="CRM sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            style={tabButtonStyle(tab === item.id)}
          >
            {item.label}
            {tab === item.id && (
              <motion.div layoutId="crm-active-tab" style={activeTabUnderlineStyle} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
            )}
          </button>
        ))}
      </nav>

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {tab === 'overview' && (
              <OverviewTab analytics={analytics} emailLeads={leads} inbox={inbox} />
            )}
            {tab === 'inbox' && (
              <InboxTab
                ventureId={venture.id}
                loading={inbox.loading}
                error={inbox.error}
                items={inbox.data.filter((item) => {
                  const query = inboxSearch.trim().toLowerCase()
                  if (!query) return true
                  return [item.username, item.text, item.source].some((value) => (value ?? '').toLowerCase().includes(query))
                })}
                totalItems={inbox.data.length}
                search={inboxSearch}
                onSearch={setInboxSearch}
              />
            )}
            {tab === 'leads' && (
              <LeadsTab
                ventureId={venture.id}
                state={leads}
                onStatusChange={handleStatusChange}
                onDeleteLead={handleDeleteLead}
                onBulkStatusChange={handleBulkStatusChange}
                onBulkDelete={handleBulkDelete}
                onOpenLead={setSelectedLead}
              />
            )}
            {tab === 'pipeline' && (
              <PipelineTab ventureId={venture.id} leads={leads.data} />
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
          </motion.div>
        </AnimatePresence>
      </main>

      {confirmOpen && (
        <ConfirmModal
          title={`Send to ${qualifiedLeads.length.toLocaleString()} leads?`}
          message="This will dispatch the campaign to every qualified email lead. This cannot be undone."
          confirmLabel="Send campaign"
          disabled={dispatching}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleDispatch}
        />
      )}

      {selectedLead && (
        <LeadDetailDrawer
          ventureId={venture.id}
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={(updated) => {
            setLeads((prev) => ({ ...prev, data: prev.data.map((l) => l.id === updated.id ? updated : l) }))
            setSelectedLead(updated)
          }}
          onDeleted={(leadId) => {
            setLeads((prev) => ({ ...prev, data: prev.data.filter((l) => l.id !== leadId) }))
            setSelectedLead(null)
          }}
        />
      )}
    </div>
  )
}

function KpiCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
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
    position: 'relative',
    appearance: 'none',
    background: 'transparent',
    border: 'none',
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

const activeTabUnderlineStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: -1,
  height: 2,
  background: 'var(--accent)',
}
