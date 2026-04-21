'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AdminAnalytics {
  platform: {
    totalUsers: number
    activeUsers7d: number
    activeUsers30d: number
    newUsers7d: number
    newUsers30d: number
    totalVentures: number
    totalProjects: number
    totalConversations: number
    completedConversations: number
    failedConversations: number
    successRate: number
    totalCohorts: number
    totalInvestorKitViews: number
    timezone?: string
    todayDate?: string
    accessMode?: 'service_role' | 'session_fallback'
  }
  revenue: {
    totalRevenue: number
    revenue7d: number
    revenue30d: number
    paymentSuccessRate: number
    totalPayments: number
    capturedPayments: number
  }
  planDistribution: Record<string, number>
  activeSubscriptions: Record<string, number>
  moduleUsage: Record<string, { total: number; complete: number; failed: number; credits: number }>
  dailyActivity: { date: string; runs: number; users: number; credits: number; signups: number }[]
  topUsers: {
    id: string
    email: string
    name: string
    plan: string
    createdAt: string
    runs: number
    credits: number | string
    ventures: number
  }[]
  creditEconomy: {
    totalGranted: number
    totalSpent: number
    netBalance: number
    byKind: Record<string, number>
  }
  weeklyComparison: {
    thisWeek: { runs: number; signups: number }
    lastWeek: { runs: number; signups: number }
    runsDelta: number
    signupsDelta: number
  }
  recentPayments: {
    kind: string
    planSlug: string
    topupSlug: string
    amount: number
    status: string
    userEmail: string
    createdAt: string
  }[]
  warnings?: string[]
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  'research': 'Research', 'branding': 'Branding', 'marketing': 'Marketing',
  'landing': 'Landing Page', 'feasibility': 'Feasibility', 'full-launch': 'Full Launch',
  'general': 'Co-pilot', 'shadow-board': 'Shadow Board', 'investor-kit': 'Investor Kit',
  'launch-autopilot': 'Launch Autopilot', 'mvp-scalpel': 'MVP Scalpel',
}

const MODULE_COLORS: Record<string, string> = {
  'research': '#5A8C6E', 'branding': '#5A6E8C', 'marketing': '#8C5A7A',
  'landing': '#8C7A5A', 'feasibility': '#7A5A8C', 'full-launch': '#C4975A',
  'general': '#6B8F71', 'shadow-board': '#6B7F8C', 'investor-kit': '#8C6B5A',
  'launch-autopilot': '#5A8C7A', 'mvp-scalpel': '#8C5A5A',
}

const PLAN_COLORS: Record<string, string> = {
  free: '#71717a', starter: '#0f766e', builder: '#3b82f6', pro: '#C4975A', studio: '#a855f7', unlimited: '#dc2626',
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/admin/analytics', { cache: 'no-store' })
      if (res.status === 401) {
        setError('Access denied. Admin privileges required.')
        return
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error || 'Failed to load admin analytics')
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  if (loading) return <AdminSkeleton />
  if (error) return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>&#x1f512;</div>
      <p style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>{error}</p>
      <button onClick={loadData} style={{ marginTop: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Retry</button>
    </div>
  )
  if (!data) return null

  const { platform, revenue, planDistribution, activeSubscriptions, moduleUsage, dailyActivity, topUsers, creditEconomy, weeklyComparison, recentPayments } = data
  const maxDailyRuns = Math.max(...dailyActivity.map(d => d.runs), 1)
  const maxModuleRuns = Math.max(...Object.values(moduleUsage).map(m => m.total), 1)

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px)', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            Admin Dashboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            Platform-wide analytics {platform.timezone ? `· ${platform.timezone}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a
            href='/dashboard/admin/blog'
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--glass-bg)', color: 'var(--text)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
          >
            Blog
          </a>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={loadData}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--glass-bg)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Refresh
          </motion.button>
        </div>
      </div>

      {data.warnings && data.warnings.length > 0 && (
        <div style={{
          marginBottom: 18,
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid rgba(245, 158, 11, 0.35)',
          background: 'rgba(245, 158, 11, 0.08)',
          color: '#b45309',
          fontSize: 12,
          fontWeight: 600,
        }}>
          {data.warnings.join(' ')}
        </div>
      )}

      {/* ── Platform Overview ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard label="Total Users" value={platform.totalUsers} icon="U" />
        <StatCard label="Active (7d)" value={platform.activeUsers7d} icon="A" color="#22c55e" />
        <StatCard label="Active (30d)" value={platform.activeUsers30d} icon="A" />
        <StatCard label="New (7d)" value={platform.newUsers7d} icon="N" color="#3b82f6" />
        <StatCard label="Ventures" value={platform.totalVentures} icon="V" />
        <StatCard label="Total Runs" value={platform.totalConversations} icon="R" />
        <StatCard label="Success Rate" value={`${platform.successRate}%`} icon="S" color={platform.successRate >= 80 ? '#22c55e' : '#f59e0b'} />
        <StatCard label="Cohorts" value={platform.totalCohorts} icon="C" />
      </div>

      {/* ── Revenue + Weekly Comparison ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Revenue */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Revenue</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            <MiniStat label="Total" value={formatINR(revenue.totalRevenue)} />
            <MiniStat label="Last 7d" value={formatINR(revenue.revenue7d)} color="#22c55e" />
            <MiniStat label="Last 30d" value={formatINR(revenue.revenue30d)} />
            <MiniStat label="Payments" value={revenue.totalPayments} />
            <MiniStat label="Captured" value={revenue.capturedPayments} color="#22c55e" />
            <MiniStat label="Pay Success" value={`${revenue.paymentSuccessRate}%`} color={revenue.paymentSuccessRate >= 90 ? '#22c55e' : '#f59e0b'} />
          </div>
        </div>

        {/* Weekly Comparison */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Week over Week</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>This Week</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{weeklyComparison.thisWeek.runs} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>runs</span></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{weeklyComparison.thisWeek.signups} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>signups</span></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
              <DeltaBadge value={weeklyComparison.runsDelta} label="runs" />
              <DeltaBadge value={weeklyComparison.signupsDelta} label="signups" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Plan Distribution + Credit Economy ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Plan Distribution */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>User Plans</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(planDistribution).sort((a, b) => b[1] - a[1]).map(([plan, count]) => {
              const pct = platform.totalUsers > 0 ? Math.round((count / platform.totalUsers) * 100) : 0
              return (
                <div key={plan}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: PLAN_COLORS[plan] || 'var(--text)', textTransform: 'capitalize' }}>{plan}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{count} users ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5 }}
                      style={{ height: '100%', borderRadius: 3, background: PLAN_COLORS[plan] || 'var(--accent)' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          {Object.keys(activeSubscriptions).length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Active Subscriptions: </span>
              {Object.entries(activeSubscriptions).map(([plan, count]) => (
                <span key={plan} style={{ fontSize: 11, color: PLAN_COLORS[plan] || 'var(--text)', fontWeight: 600, marginRight: 10, textTransform: 'capitalize' }}>
                  {plan}: {count}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Credit Economy */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Credit Economy</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            <MiniStat label="Granted" value={creditEconomy.totalGranted} color="#22c55e" />
            <MiniStat label="Spent" value={creditEconomy.totalSpent} color="#ef4444" />
            <MiniStat label="Net Balance" value={creditEconomy.netBalance} color={creditEconomy.netBalance > 0 ? '#22c55e' : '#ef4444'} />
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(creditEconomy.byKind).map(([kind, amount]) => (
              <span key={kind} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 6,
                background: 'var(--glass-bg)', border: '1px solid var(--border)',
                color: amount > 0 ? '#22c55e' : '#ef4444', fontWeight: 600,
              }}>
                {formatCreditKind(kind)}: {amount > 0 ? '+' : ''}{amount}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Module Usage + Activity Chart ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Module Usage */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Module Usage (Platform)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(moduleUsage)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([moduleId, stats]) => (
                <div key={moduleId}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{MODULE_LABELS[moduleId] || moduleId}</span>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
                      <span>{stats.total}</span>
                      <span style={{ color: '#22c55e' }}>{stats.complete}</span>
                      {stats.failed > 0 && <span style={{ color: '#ef4444' }}>{stats.failed}</span>}
                      <span>{stats.credits} cr</span>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(stats.total / maxModuleRuns) * 100}%` }}
                      transition={{ duration: 0.5 }}
                      style={{ height: '100%', borderRadius: 3, background: MODULE_COLORS[moduleId] || 'var(--accent)' }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Activity Chart */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Daily Activity (30 Days)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
            {dailyActivity.map((day, i) => {
              const h = maxDailyRuns > 0 ? (day.runs / maxDailyRuns) * 100 : 0
              return (
                <motion.div
                  key={day.date}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(h, 2)}%` }}
                  transition={{ duration: 0.4, delay: i * 0.015 }}
                  title={`${day.date}: ${day.runs} runs, ${day.users} users, ${day.credits} credits, ${day.signups} signups`}
                  style={{
                    flex: 1, borderRadius: '2px 2px 0 0', minWidth: 4,
                    background: day.runs > 0 ? 'var(--accent)' : 'var(--border)',
                    opacity: day.runs > 0 ? 0.6 + (day.runs / maxDailyRuns) * 0.4 : 0.3,
                    cursor: 'default',
                  }}
                />
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{dailyActivity[0]?.date?.slice(5)}</span>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{platform.todayDate || 'Today'}</span>
          </div>
          {/* Signup sparkline */}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Signups</span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 30, marginTop: 4 }}>
              {dailyActivity.map((day) => {
                const maxSignups = Math.max(...dailyActivity.map(d => d.signups), 1)
                const h = (day.signups / maxSignups) * 100
                return (
                  <div
                    key={`signup-${day.date}`}
                    title={`${day.date}: ${day.signups} signups`}
                    style={{
                      flex: 1, minWidth: 4, borderRadius: '2px 2px 0 0',
                      height: `${Math.max(h, 4)}%`,
                      background: day.signups > 0 ? '#3b82f6' : 'var(--border)',
                      opacity: day.signups > 0 ? 0.7 : 0.2,
                    }}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top Users ─────────────────────────────────────────────────── */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <h3 style={sectionTitle}>Top Users</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>User</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Plan</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Runs</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Balance</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Ventures</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((u, i) => (
                <motion.tr
                  key={u.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || u.email}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      background: `${PLAN_COLORS[u.plan] || 'var(--muted)'}18`,
                      color: PLAN_COLORS[u.plan] || 'var(--muted)',
                      textTransform: 'capitalize',
                    }}>{u.plan}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>{u.runs}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>{u.credits}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{u.ventures}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>{formatDate(u.createdAt)}</td>
                </motion.tr>
              ))}
              {topUsers.length === 0 && (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)' }}>No users yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent Payments ───────────────────────────────────────────── */}
      {recentPayments.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h3 style={sectionTitle}>Recent Payments</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentPayments.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
                  padding: '8px 12px', borderRadius: 8,
                  background: 'var(--glass-bg)', border: '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                    {p.kind === 'subscription' ? `${capitalize(p.planSlug || '')} Plan` : `Top-up (${p.topupSlug || ''})`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.userEmail} &middot; {formatRelative(p.createdAt)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>
                    {formatINR(p.amount)}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                    background: p.status === 'captured' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: p.status === 'captured' ? '#22c55e' : '#ef4444',
                  }}>{p.status}</span>
                </div>
              </motion.div>
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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ ...cardStyle, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--muted)' }}>{icon}</span>
      </div>
      <span style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--text)', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '-0.02em', marginTop: 2, display: 'block' }}>{value}</span>
    </motion.div>
  )
}

function DeltaBadge({ value, label }: { value: number; label: string }) {
  const isPositive = value >= 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      background: value === 0 ? 'var(--border)' : isPositive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      color: value === 0 ? 'var(--muted)' : isPositive ? '#22c55e' : '#ef4444',
    }}>
      {value > 0 ? '+' : ''}{value} {label}
    </span>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>{value}</div>
    </div>
  )
}

function AdminSkeleton() {
  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px)', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ height: 28, width: 160, borderRadius: 6, background: 'var(--border)', marginBottom: 28 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[...Array(8)].map((_, i) => <div key={i} style={{ height: 72, borderRadius: 12, background: 'var(--glass-bg)', border: '1px solid var(--border)' }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ height: 180, borderRadius: 12, background: 'var(--glass-bg)', border: '1px solid var(--border)' }} />
        <div style={{ height: 180, borderRadius: 12, background: 'var(--glass-bg)', border: '1px solid var(--border)' }} />
      </div>
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px 0', letterSpacing: '-0.01em',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600,
  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
}

const tdStyle: React.CSSProperties = { padding: '10px 10px', fontSize: 13, color: 'var(--text)' }

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatINR(paise: number): string {
  if (!paise) return 'INR 0'
  return `INR ${(paise / 100).toLocaleString('en-IN')}`
}

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

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatCreditKind(kind: string): string {
  switch (kind) {
    case 'monthly_grant': return 'Grants'
    case 'topup': return 'Top-ups'
    case 'usage': return 'Usage'
    case 'manual_adjustment': return 'Adjustments'
    default: return kind
  }
}
