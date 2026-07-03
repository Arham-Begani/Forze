'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, RefreshCw, Pause, Play, Mail, Users, MousePointerClick, MessageCircle, TrendingUp, RotateCw } from 'lucide-react'
import type { Campaign, CampaignLead, CampaignReply, CampaignMetrics, LeadsByStatus } from '@/lib/schemas/campaign'

const REPLY_TYPE_STYLES: Record<CampaignReply['reply_type'], string> = {
  interested: 'bg-green-500/15 text-green-600 dark:text-green-400',
  question: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  uninterested: 'bg-red-500/15 text-red-600 dark:text-red-400',
  spam: 'bg-[var(--border)] text-[var(--muted)]',
  ooo: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  unknown: 'bg-[var(--border)] text-[var(--muted)]',
}

const STATUS_STYLES: Record<CampaignLead['engagement_status'], string> = {
  fresh: 'bg-[var(--border)] text-[var(--text-soft)]',
  opened: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  clicked: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  replied: 'bg-green-500/15 text-green-600 dark:text-green-400',
  bounced: 'bg-red-500/15 text-red-500',
  unsubscribed: 'bg-[var(--border)] text-[var(--muted)]',
}

function MetricCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold tracking-tight text-[var(--text)]">{value}</p>
      {sub && <p className="text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  )
}

interface CampaignDetailProps {
  campaign: Campaign
  onBack: () => void
  onPause: () => void
  onResume: () => void
  onPollReplies: () => void
}

interface LeadsBySendStatusUI {
  pending: number
  sending: number
  sent: number
  failed: number
  suppressed: number
}

const SEND_STATUS_STYLES: Record<keyof LeadsBySendStatusUI, string> = {
  pending: 'bg-[var(--border)] text-[var(--text-soft)]',
  sending: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  sent: 'bg-green-500/15 text-green-600 dark:text-green-400',
  failed: 'bg-red-500/15 text-red-500',
  suppressed: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
}

export function CampaignDetail({ campaign, onBack, onPause, onResume, onPollReplies }: CampaignDetailProps) {
  const [leads, setLeads] = useState<CampaignLead[]>([])
  const [replies, setReplies] = useState<CampaignReply[]>([])
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null)
  const [leadsByStatus, setLeadsByStatus] = useState<LeadsByStatus | null>(null)
  const [leadsBySendStatus, setLeadsBySendStatus] = useState<LeadsBySendStatusUI | null>(null)
  const [timeline, setTimeline] = useState<Array<{ date: string; sent: number; opened: number; clicked: number; replied: number }>>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'replies'>('overview')
  const [isPolling, setIsPolling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  // All data reads — cheap DB fetches only, no Gmail API hits. Called on mount
  // and by the Refresh button so users don't need to reload the whole page.
  const refreshAll = useCallback(async () => {
    try {
      const [leadsRes, analyticsRes, repliesRes] = await Promise.all([
        fetch(`/api/campaigns/${campaign.id}/leads`),
        fetch(`/api/campaigns/${campaign.id}/analytics?period=30d`),
        fetch(`/api/campaigns/${campaign.id}/poll-replies`),
      ])
      if (leadsRes.ok) {
        const d = await leadsRes.json() as { leads: CampaignLead[] }
        setLeads(d.leads ?? [])
      }
      if (analyticsRes.ok) {
        const d = await analyticsRes.json() as CampaignMetrics & {
          leadsByStatus: LeadsByStatus
          leadsBySendStatus?: LeadsBySendStatusUI
          engagementTimeline?: Array<{ date: string; sent: number; opened: number; clicked: number; replied: number }>
        }
        setMetrics(d)
        setLeadsByStatus(d.leadsByStatus)
        setLeadsBySendStatus(d.leadsBySendStatus ?? null)
        setTimeline(d.engagementTimeline ?? [])
      }
      if (repliesRes.ok) {
        const d = await repliesRes.json() as { replies: CampaignReply[] }
        setReplies(d.replies ?? [])
      }
    } catch {
      // Non-fatal — stale data is better than a broken screen
    }
  }, [campaign.id])

  useEffect(() => {
    setLoading(true)
    void refreshAll().finally(() => setLoading(false))
  }, [refreshAll])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshAll()
    } finally {
      setIsRefreshing(false)
    }
  }

  const handlePollReplies = async () => {
    setIsPolling(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/poll-replies`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json() as { replies: CampaignReply[] }
        setReplies(d.replies ?? [])
        onPollReplies()
      }
    } finally {
      setIsPolling(false)
    }
  }

  const sent = metrics?.sent ?? campaign.sent_count ?? 0
  const opened = metrics?.opened ?? campaign.opened_count ?? 0
  const clicked = metrics?.clicked ?? campaign.clicked_count ?? 0
  const replied = metrics?.replied ?? campaign.replied_count ?? 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeft size={16} />
            Campaigns
          </button>
          <span className="text-[var(--border)]">/</span>
          <h2 className="font-semibold text-[var(--text)]">{campaign.name}</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
            campaign.status === 'active' ? 'bg-green-500/15 text-green-600 dark:text-green-400' :
            campaign.status === 'scheduled' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
            campaign.status === 'draft' ? 'bg-[var(--border)] text-[var(--text-soft)]' :
            campaign.status === 'paused' ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' :
            'bg-[var(--border)] text-[var(--muted)]'
          }`}>
            {campaign.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Re-fetch leads, metrics, and stored replies"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-soft)] hover:bg-[var(--nav-active)] transition-colors disabled:opacity-50"
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handlePollReplies}
            disabled={isPolling}
            title="Poll Gmail for new replies (rate-limited)"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-soft)] hover:bg-[var(--nav-active)] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isPolling ? 'animate-spin' : ''} />
            Sync Replies
          </button>
          {campaign.status === 'active' && (
            <button
              onClick={onPause}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-soft)] hover:bg-[var(--nav-active)] transition-colors"
            >
              <Pause size={14} />
              Pause
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              onClick={onResume}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <Play size={14} />
              Resume
            </button>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Sent" value={sent} icon={<Mail size={13} />} />
        <MetricCard
          label="Opened"
          value={opened}
          sub={sent > 0 ? `${((opened / sent) * 100).toFixed(1)}% open rate` : undefined}
          icon={<Users size={13} />}
        />
        <MetricCard
          label="Clicked"
          value={clicked}
          sub={sent > 0 ? `${((clicked / sent) * 100).toFixed(1)}% click rate` : undefined}
          icon={<MousePointerClick size={13} />}
        />
        <MetricCard
          label="Replied"
          value={replied}
          sub={sent > 0 ? `${((replied / sent) * 100).toFixed(1)}% reply rate` : undefined}
          icon={<MessageCircle size={13} />}
        />
      </div>

      {/* Lead status breakdown */}
      {leadsByStatus && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
            <TrendingUp size={15} />
            Lead Status
          </div>
          <div className="flex flex-wrap gap-3">
            {(Object.entries(leadsByStatus) as [string, number][]).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status as CampaignLead['engagement_status']]}`}>
                  {status}
                </span>
                <span className="text-sm font-mono text-[var(--text-soft)]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery status — complements engagement status above. Shows whether
          messages actually went out: how many are still pending, in-flight,
          delivered, failed at send, or suppressed (unsubscribed/bounced). */}
      {leadsBySendStatus && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
            <Mail size={15} />
            Delivery
          </div>
          <div className="flex flex-wrap gap-3">
            {(Object.entries(leadsBySendStatus) as [keyof LeadsBySendStatusUI, number][]).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${SEND_STATUS_STYLES[status]}`}>
                  {status}
                </span>
                <span className="text-sm font-mono text-[var(--text-soft)]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {(['overview', 'leads', 'replies'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--text-soft)]'
            }`}
          >
            {tab}
            {tab === 'replies' && replies.length > 0 && (
              <span className="ml-1.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-xs text-white">
                {replies.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-[var(--muted)]">Loading...</div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-4">
              {/* 30-day engagement timeline */}
              {timeline.some((d) => d.sent + d.opened + d.replied > 0) && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[var(--text)]">Last 30 days</h3>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
                      <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-[var(--accent)]" /> Sent</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-blue-500" /> Opened</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-green-500" /> Replied</span>
                    </div>
                  </div>
                  <div className="flex h-28 items-end gap-1">
                    {timeline.map((day) => {
                      const max = Math.max(...timeline.map((d) => Math.max(d.sent, d.opened, d.replied)), 1)
                      return (
                        <div
                          key={day.date}
                          className="group relative flex flex-1 items-end justify-center gap-px"
                          title={`${day.date}: ${day.sent} sent · ${day.opened} opened · ${day.replied} replied`}
                        >
                          <div className="w-1/3 rounded-t-sm bg-[var(--accent)] opacity-80" style={{ height: `${(day.sent / max) * 100}%`, minHeight: day.sent > 0 ? 3 : 0 }} />
                          <div className="w-1/3 rounded-t-sm bg-blue-500 opacity-80" style={{ height: `${(day.opened / max) * 100}%`, minHeight: day.opened > 0 ? 3 : 0 }} />
                          <div className="w-1/3 rounded-t-sm bg-green-500 opacity-80" style={{ height: `${(day.replied / max) * 100}%`, minHeight: day.replied > 0 ? 3 : 0 }} />
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] text-[var(--muted)]">
                    <span>{timeline[0]?.date}</span>
                    <span>{timeline[timeline.length - 1]?.date}</span>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Campaign Config</h3>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[var(--muted)]">Data Source</dt>
                    <dd className="font-medium capitalize text-[var(--text)]">{campaign.data_source}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Send Mode</dt>
                    <dd className="font-medium capitalize text-[var(--text)]">
                      {campaign.send_mode === 'staggered'
                        ? `Drip — ${campaign.daily_send_cap ?? 50}/day`
                        : 'All at once'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Follow-ups</dt>
                    <dd className="font-medium text-[var(--text)]">
                      {campaign.enable_followups
                        ? `Up to ${campaign.max_followups ?? 2}, every ${Math.round((campaign.followup_delay_hours ?? 72) / 24)}d without a reply`
                        : 'Disabled'}
                    </dd>
                  </div>
                  {campaign.status === 'scheduled' && campaign.scheduled_send_time && (
                    <div>
                      <dt className="text-[var(--muted)]">Starts</dt>
                      <dd className="font-medium text-[var(--text)]">{new Date(campaign.scheduled_send_time).toLocaleString()}</dd>
                    </div>
                  )}
                  {campaign.started_at && (
                    <div>
                      <dt className="text-[var(--muted)]">Started</dt>
                      <dd className="font-medium text-[var(--text)]">{new Date(campaign.started_at).toLocaleDateString()}</dd>
                    </div>
                  )}
                </dl>
                {campaign.subject_line && (
                  <div className="mt-4">
                    <p className="mb-1 text-xs font-medium text-[var(--muted)]">Email Subject</p>
                    <p className="rounded-lg bg-[var(--sidebar)] px-3 py-2 text-sm text-[var(--text)]">{campaign.subject_line}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'leads' && (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--sidebar)]">
                    <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-soft)]">Name</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-soft)]">Email</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-soft)]">Company</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-soft)]">Status</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-soft)]">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">No leads yet</td>
                    </tr>
                  )}
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--nav-active)]">
                      <td className="px-4 py-2.5 font-medium text-[var(--text)]">
                        {lead.first_name} {lead.last_name ?? ''}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-soft)]">{lead.email}</td>
                      <td className="px-4 py-2.5 text-[var(--text-soft)]">{lead.company ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[lead.engagement_status]}`}>
                          {lead.engagement_status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--muted)]">
                        {lead.email_sent_at ? new Date(lead.email_sent_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'replies' && (
            <div className="flex flex-col gap-3">
              {replies.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--border)] py-12 text-center text-sm text-[var(--muted)]">
                  No replies yet — replies sync automatically every ~30 minutes, or click &quot;Sync Replies&quot; to check now
                </div>
              )}
              {replies.map((reply) => (
                <div key={reply.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-[var(--text)]">{reply.from_name ?? reply.from_email}</p>
                      <p className="text-xs text-[var(--muted)]">{reply.from_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${REPLY_TYPE_STYLES[reply.reply_type]}`}>
                        {reply.reply_type}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {reply.sentiment_score > 0 ? '+' : ''}{reply.sentiment_score.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-medium text-[var(--text-soft)]">{reply.subject}</p>
                  {reply.summary && (
                    <p className="mt-1 text-sm italic text-[var(--muted)]">&ldquo;{reply.summary}&rdquo;</p>
                  )}
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {new Date(reply.received_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
