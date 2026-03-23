'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  overview: {
    totalVentures: number
    totalProjects: number
    totalConversations: number
    completedConversations: number
    failedConversations: number
    runningConversations: number
    successRate: number
    totalCreditsUsed: number
    creditsRemaining: number
    totalCohorts: number
    totalInvestorKitViews: number
  }
  subscription: {
    planSlug: string
    billingPeriod: string
    status: string
    creditsPerCycle: number
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
  } | null
  moduleUsage: Record<string, { total: number; complete: number; failed: number; credits: number }>
  dailyActivity: { date: string; runs: number; credits: number }[]
  ventureHealth: {
    id: string
    name: string
    totalRuns: number
    successRate: number
    modulesUsed: number
    completedModules: number
    lastActivity: string
    createdAt: string
  }[]
  recentRuns: {
    id: string
    moduleId: string
    status: string
    prompt: string
    ventureName: string
    createdAt: string
  }[]
  creditFlow: {
    kind: string
    credits: number
    createdAt: string
    metadata: any
  }[]
  weeklyComparison: {
    thisWeek: { runs: number; credits: number }
    lastWeek: { runs: number; credits: number }
    runsDelta: number
    creditsDelta: number
  }
  paymentSummary: {
    totalPayments: number
    totalRevenue: number
    recentPayments: {
      kind: string
      planSlug: string
      topupSlug: string
      amount: number
      status: string
      createdAt: string
    }[]
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  'research': 'Research',
  'branding': 'Branding',
  'marketing': 'Marketing',
  'landing': 'Landing Page',
  'feasibility': 'Feasibility',
  'full-launch': 'Full Launch',
  'general': 'Co-pilot',
  'shadow-board': 'Shadow Board',
  'investor-kit': 'Investor Kit',
  'launch-autopilot': 'Launch Autopilot',
  'mvp-scalpel': 'MVP Scalpel',
}

const MODULE_COLORS: Record<string, string> = {
  'research': '#5A8C6E',
  'branding': '#5A6E8C',
  'marketing': '#8C5A7A',
  'landing': '#8C7A5A',
  'feasibility': '#7A5A8C',
  'full-launch': '#C4975A',
  'general': '#6B8F71',
  'shadow-board': '#6B7F8C',
  'investor-kit': '#8C6B5A',
  'launch-autopilot': '#5A8C7A',
  'mvp-scalpel': '#8C5A5A',
}

const STATUS_COLORS: Record<string, string> = {
  complete: '#22c55e',
  failed: '#ef4444',
  running: '#f59e0b',
}

const CREDIT_COSTS: Record<string, number> = {
  'general': 1, 'branding': 6, 'mvp-scalpel': 6,
  'research': 8, 'marketing': 8, 'launch-autopilot': 8,
  'landing': 10, 'shadow-board': 10, 'investor-kit': 10,
  'feasibility': 12, 'full-launch': 30,
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/analytics')
      if (!res.ok) throw new Error('Failed to load analytics')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAnalytics() }, [loadAnalytics])

  if (loading) return <AnalyticsSkeleton />
  if (error || !data) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
      <p style={{ fontSize: 16 }}>Failed to load analytics</p>
      <button onClick={loadAnalytics} style={{ marginTop: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>Retry</button>
    </div>
  )

  const { overview, moduleUsage, dailyActivity, ventureHealth, recentRuns, weeklyComparison, subscription, creditFlow, paymentSummary } = data

  // Calculate max for bar scaling
  const maxDailyRuns = Math.max(...dailyActivity.map(d => d.runs), 1)
  const maxModuleRuns = Math.max(...Object.values(moduleUsage).map(m => m.total), 1)

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px)', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
          Analytics
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          Your Forze usage at a glance
        </p>
      </div>

      {/* ── Overview Cards ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Ventures" value={overview.totalVentures} icon="V" />
        <StatCard label="Total Runs" value={overview.totalConversations} icon="R" />
        <StatCard label="Success Rate" value={`${overview.successRate}%`} icon="S" color={overview.successRate >= 80 ? '#22c55e' : overview.successRate >= 50 ? '#f59e0b' : '#ef4444'} />
        <StatCard label="Credits Used" value={overview.totalCreditsUsed} icon="C" />
        <StatCard label="Credits Left" value={overview.creditsRemaining} icon="B" color={overview.creditsRemaining > 50 ? '#22c55e' : overview.creditsRemaining > 10 ? '#f59e0b' : '#ef4444'} />
        <StatCard label="Kit Views" value={overview.totalInvestorKitViews} icon="K" />
      </div>

      {/* ── Weekly Comparison ─────────────────────────────────────────── */}
      <div style={{ ...cardStyle, marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>This Week</span>
            <div style={{ display: 'flex', gap: 20, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{weeklyComparison.thisWeek.runs} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>runs</span></span>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{weeklyComparison.thisWeek.credits} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>credits</span></span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <DeltaBadge value={weeklyComparison.runsDelta} label="runs" />
            <DeltaBadge value={weeklyComparison.creditsDelta} label="credits" inverted />
          </div>
        </div>
      </div>

      {/* ── Two Column Grid ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>

        {/* Module Usage */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Module Usage</h3>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {Object.entries(moduleUsage)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([moduleId, stats]) => (
                <div key={moduleId}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{MODULE_LABELS[moduleId] || moduleId}</span>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
                      <span>{stats.total} runs</span>
                      <span style={{ color: '#22c55e' }}>{stats.complete} ok</span>
                      {stats.failed > 0 && <span style={{ color: '#ef4444' }}>{stats.failed} fail</span>}
                      <span>{stats.credits} cr</span>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(stats.total / maxModuleRuns) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      style={{ height: '100%', borderRadius: 3, background: MODULE_COLORS[moduleId] || 'var(--accent)' }}
                    />
                  </div>
                </div>
              ))}
            {Object.keys(moduleUsage).length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' as const, padding: 20 }}>No module runs yet</p>
            )}
          </div>
        </div>

        {/* Activity Chart (30 days) */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Activity (30 Days)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
            {dailyActivity.map((day, i) => {
              const h = maxDailyRuns > 0 ? (day.runs / maxDailyRuns) * 100 : 0
              return (
                <motion.div
                  key={day.date}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(h, 2)}%` }}
                  transition={{ duration: 0.4, delay: i * 0.015 }}
                  title={`${day.date}: ${day.runs} runs, ${day.credits} credits`}
                  style={{
                    flex: 1,
                    borderRadius: '2px 2px 0 0',
                    background: day.runs > 0 ? 'var(--accent)' : 'var(--border)',
                    opacity: day.runs > 0 ? 0.7 + (day.runs / maxDailyRuns) * 0.3 : 0.3,
                    cursor: 'default',
                    minWidth: 4,
                  }}
                />
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{dailyActivity[0]?.date?.slice(5)}</span>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>Today</span>
          </div>
        </div>
      </div>

      {/* ── Venture Health ────────────────────────────────────────────── */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <h3 style={sectionTitle}>Venture Health</h3>
        {ventureHealth.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' as const, padding: 20 }}>No ventures yet</p>
        ) : (
          <div style={{ overflowX: 'auto' as const }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>Venture</th>
                  <th style={{ ...thStyle, textAlign: 'center' as const }}>Runs</th>
                  <th style={{ ...thStyle, textAlign: 'center' as const }}>Success</th>
                  <th style={{ ...thStyle, textAlign: 'center' as const }}>Modules</th>
                  <th style={{ ...thStyle, textAlign: 'right' as const }}>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {ventureHealth.map((v, i) => (
                  <motion.tr
                    key={v.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{v.name}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' as const }}>{v.totalRuns}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' as const }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        background: v.successRate >= 80 ? 'rgba(34,197,94,0.12)' : v.successRate >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                        color: v.successRate >= 80 ? '#22c55e' : v.successRate >= 50 ? '#f59e0b' : '#ef4444',
                      }}>
                        {v.successRate}%
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' as const }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{v.completedModules}/9</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' as const, color: 'var(--muted)', fontSize: 12 }}>
                      {formatRelative(v.lastActivity)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Two Column: Recent Runs + Credit Flow ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>

        {/* Recent Runs */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Recent Runs</h3>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, maxHeight: 360, overflowY: 'auto' as const }}>
            {recentRuns.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' as const, padding: 20 }}>No runs yet</p>
            ) : recentRuns.map((run, i) => (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: STATUS_COLORS[run.status] || 'var(--muted)',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: MODULE_COLORS[run.moduleId] || 'var(--text)' }}>
                    {MODULE_LABELS[run.moduleId] || run.moduleId}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>
                    {run.prompt || 'No prompt'}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, textAlign: 'right' as const }}>
                  <div>{run.ventureName}</div>
                  <div>{formatRelative(run.createdAt)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Credit Flow */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Credit Flow</h3>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, maxHeight: 360, overflowY: 'auto' as const }}>
            {creditFlow.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' as const, padding: 20 }}>No credit activity yet</p>
            ) : creditFlow.map((entry, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                    {formatCreditKind(entry.kind)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{formatRelative(entry.createdAt)}</div>
                </div>
                <span style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                  color: entry.credits > 0 ? '#22c55e' : '#ef4444',
                }}>
                  {entry.credits > 0 ? '+' : ''}{entry.credits}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Subscription & Plan ───────────────────────────────────────── */}
      {subscription && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h3 style={sectionTitle}>Subscription</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <MiniStat label="Plan" value={subscription.planSlug.charAt(0).toUpperCase() + subscription.planSlug.slice(1)} />
            <MiniStat label="Period" value={subscription.billingPeriod} />
            <MiniStat label="Status" value={subscription.status} color={subscription.status === 'active' ? '#22c55e' : '#f59e0b'} />
            <MiniStat label="Credits/Cycle" value={subscription.creditsPerCycle} />
            <MiniStat label="Renews" value={subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'N/A'} />
          </div>
        </div>
      )}

      {/* ── Module Cost Reference ─────────────────────────────────────── */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <h3 style={sectionTitle}>Credit Cost Reference</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
          {Object.entries(CREDIT_COSTS)
            .sort((a, b) => a[1] - b[1])
            .map(([mod, cost]) => (
              <span key={mod} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 500,
                background: 'var(--glass-bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: MODULE_COLORS[mod] || 'var(--accent)' }} />
                {MODULE_LABELS[mod] || mod}
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: 'var(--muted)' }}>{cost}</span>
              </span>
            ))}
        </div>
      </div>

      {/* ── Payment History ────────────────────────────────────────────── */}
      {paymentSummary.recentPayments.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h3 style={sectionTitle}>Payment History</h3>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {paymentSummary.recentPayments.map((p, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                padding: '8px 10px',
                borderRadius: 8,
                background: 'var(--glass-bg)',
                border: '1px solid var(--border)',
              }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                    {p.kind === 'subscription' ? `${(p.planSlug || '').charAt(0).toUpperCase() + (p.planSlug || '').slice(1)} Plan` : `Top-up (${p.topupSlug || ''})`}
                  </span>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{formatRelative(p.createdAt)}</div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>
                    {p.amount ? `INR ${(p.amount / 100).toLocaleString()}` : '-'}
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: p.status === 'captured' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: p.status === 'captured' ? '#22c55e' : '#ef4444',
                  }}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        ...cardStyle,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>{icon}</span>
      </div>
      <span style={{ fontSize: 24, fontWeight: 800, color: color || 'var(--text)', fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', letterSpacing: '-0.02em' }}>
        {value}
      </span>
    </motion.div>
  )
}

function DeltaBadge({ value, label, inverted }: { value: number; label: string; inverted?: boolean }) {
  const isPositive = inverted ? value <= 0 : value >= 0
  const arrow = value > 0 ? '+' : value < 0 ? '' : ''
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 10px',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 600,
      background: value === 0 ? 'var(--border)' : isPositive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      color: value === 0 ? 'var(--muted)' : isPositive ? '#22c55e' : '#ef4444',
    }}>
      {arrow}{value} {label}
    </span>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px)', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ height: 28, width: 120, borderRadius: 6, background: 'var(--border)', marginBottom: 8 }} />
      <div style={{ height: 16, width: 200, borderRadius: 4, background: 'var(--border)', marginBottom: 28, opacity: 0.5 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--glass-bg)', border: '1px solid var(--border)' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div style={{ height: 240, borderRadius: 12, background: 'var(--glass-bg)', border: '1px solid var(--border)' }} />
        <div style={{ height: 240, borderRadius: 12, background: 'var(--glass-bg)', border: '1px solid var(--border)' }} />
      </div>
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--glass-bg)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '16px 18px',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text)',
  margin: '0 0 12px 0',
  letterSpacing: '-0.01em',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left' as const,
  padding: '8px 10px',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--muted)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 10px',
  fontSize: 13,
  color: 'var(--text)',
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCreditKind(kind: string): string {
  switch (kind) {
    case 'monthly_grant': return 'Monthly Credits'
    case 'topup': return 'Top-up'
    case 'usage': return 'Agent Run'
    case 'manual_adjustment': return 'Adjustment'
    default: return kind
  }
}
