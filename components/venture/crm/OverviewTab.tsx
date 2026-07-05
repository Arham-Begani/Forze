'use client'

import type { CSSProperties } from 'react'
import {
  ArrowConnector,
  MetricCard,
  SectionHeader,
  StateCard,
  formatDate,
  panelStyle,
  grid3Style,
  twoColumnStyle,
  type AnalyticsEvent,
  type AsyncState,
  type CrmAnalytics,
  type EmailLead,
  type InboxItem,
} from './shared'

export function OverviewTab({
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
      label: `Lead captured: ${lead.email ?? lead.name ?? 'unknown'}`,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section style={panelStyle}>
        <SectionHeader title="Conversion funnel" detail="Landing-page pageviews + social reach to captured leads." />
        <div style={funnelStyle}>
          <MetricCard
            label="Visitors"
            value={(data?.visitors ?? 0).toLocaleString()}
            sublabel={
              data
                ? `${(data.landingPageviews ?? 0).toLocaleString()} landing · ${(data.socialReach ?? 0).toLocaleString()} social`
                : undefined
            }
          />
          <ArrowConnector />
          <MetricCard label="Leads" value={(data?.leads ?? 0).toLocaleString()} />
          <ArrowConnector />
          <MetricCard label="Conversion" value={`${data?.conversionRate ?? '0.00'}%`} accent />
        </div>
      </section>

      <section style={panelStyle}>
        <SectionHeader title="Social engagement by platform" detail="Likes, comments, and views from connected social accounts." />
        <div style={grid3Style}>
          {(data?.socialBreakdown ?? []).map((source) => (
            <div key={source.platform} style={sourceCardStyle}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{source.platform}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>
                  {(source.posts ?? 0).toLocaleString()} {source.posts === 1 ? 'post' : 'posts'}
                </div>
              </div>
              <div style={socialMetricRowStyle}>
                <SocialMetric label="Views" value={source.views ?? source.count ?? 0} />
                <SocialMetric label="Likes" value={source.likes ?? 0} />
                <SocialMetric label="Comments" value={source.comments ?? 0} />
              </div>
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

function SocialMetric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString()}</div>
    </div>
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

const funnelStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(150px, 1fr) 24px minmax(150px, 1fr) 24px minmax(150px, 1fr)',
  gap: 10,
  overflowX: 'auto',
}

const sourceCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
}

const socialMetricRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
  padding: '10px 0',
  borderTop: '1px solid var(--border)',
  borderBottom: '1px solid var(--border)',
}

const activityRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '11px 0',
  borderBottom: '1px solid var(--border)',
}

const sparklineWrapStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
  padding: 12,
}
