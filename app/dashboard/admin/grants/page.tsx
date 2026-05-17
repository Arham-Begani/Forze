'use client'

import { useState, useCallback, type CSSProperties, type FormEvent } from 'react'

type PlanSlug = 'starter' | 'builder' | 'pro' | 'studio'
type BillingPeriod = 'monthly' | 'yearly'

interface UserHit {
  id: string
  email: string
  name: string | null
  plan: string | null
  created_at: string
}

interface Grant {
  id: string
  plan_slug: string
  billing_period: string
  status: string
  provider: string
  current_period_start: string | null
  current_period_end: string | null
  credits_per_cycle: number
  created_at: string
  canceled_at: string | null
}

interface LookupResult {
  user: UserHit | null
  grants: Grant[]
}

const PLAN_OPTIONS: { id: PlanSlug; label: string; credits: number; ventures: string }[] = [
  { id: 'starter', label: 'Starter', credits: 40, ventures: '2 ventures' },
  { id: 'builder', label: 'Builder', credits: 120, ventures: '5 ventures' },
  { id: 'pro', label: 'Pro', credits: 400, ventures: '15 ventures' },
  { id: 'studio', label: 'Studio', credits: 1500, ventures: 'unlimited' },
]

const DURATION_OPTIONS = [
  { value: 1, label: '1 month' },
  { value: 3, label: '3 months' },
  { value: 6, label: '6 months' },
  { value: 12, label: '1 year' },
  { value: 24, label: '2 years' },
  { value: 60, label: '5 years' },
]

export default function AdminGrantsPage() {
  const [email, setEmail] = useState('')
  const [lookup, setLookup] = useState<LookupResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const [planSlug, setPlanSlug] = useState<PlanSlug>('pro')
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('yearly')
  const [durationMonths, setDurationMonths] = useState(12)
  const [granting, setGranting] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const runLookup = useCallback(async (e?: FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return
    setLookupLoading(true)
    setLookupError(null)
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/users/grant-plan?email=${encodeURIComponent(trimmed)}`)
      const data = (await res.json().catch(() => ({}))) as { user?: UserHit | null; grants?: Grant[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Lookup failed')
      setLookup({ user: data.user ?? null, grants: data.grants ?? [] })
    } catch (err) {
      setLookup(null)
      setLookupError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setLookupLoading(false)
    }
  }, [email])

  const grant = useCallback(async () => {
    if (!lookup?.user) {
      setFeedback({ kind: 'err', text: 'Look up a user first.' })
      return
    }
    setGranting(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/admin/users/grant-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: lookup.user.email,
          planSlug,
          billingPeriod,
          durationMonths,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; creditsGranted?: number; currentPeriodEnd?: string }
      if (!res.ok) throw new Error(data.error || 'Grant failed')
      setFeedback({
        kind: 'ok',
        text: `Granted ${planSlug.toUpperCase()} (${data.creditsGranted} credits) to ${lookup.user.email}. Active until ${
          data.currentPeriodEnd ? new Date(data.currentPeriodEnd).toLocaleDateString() : 'further notice'
        }.`,
      })
      await runLookup()
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Grant failed' })
    } finally {
      setGranting(false)
    }
  }, [lookup, planSlug, billingPeriod, durationMonths, runLookup])

  const revoke = useCallback(async (subscriptionId: string) => {
    if (!confirm('Revoke this grant? The user will lose Pro access immediately.')) return
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/users/grant-plan?subscriptionId=${encodeURIComponent(subscriptionId)}`, {
        method: 'DELETE',
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Revoke failed')
      setFeedback({ kind: 'ok', text: 'Grant revoked.' })
      await runLookup()
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Revoke failed' })
    }
  }, [runLookup])

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={eyebrowStyle}>Admin · Comp accounts</div>
        <h1 style={titleStyle}>Grant Pro</h1>
        <p style={subtitleStyle}>
          Give an existing user any paid plan without payment. They get the plan&apos;s monthly credits granted up front and the chosen plan persists until the period ends or you revoke it.
        </p>
      </header>

      <section style={panelStyle}>
        <h2 style={panelTitleStyle}>1. Find the user</h2>
        <form onSubmit={runLookup} style={lookupRowStyle}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            style={inputStyle}
          />
          <button type="submit" disabled={lookupLoading} style={primaryButtonStyle(lookupLoading)}>
            {lookupLoading ? 'Looking up…' : 'Find user'}
          </button>
        </form>
        {lookupError && <div style={errorStyle}>{lookupError}</div>}
        {lookup && lookup.user === null && !lookupError && (
          <div style={{ ...errorStyle, background: '#fef3c7', borderColor: '#f59e0b40', color: '#92400e' }}>
            No user with that email. They need to sign up first.
          </div>
        )}
        {lookup?.user && (
          <div style={userCardStyle}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{lookup.user.name || lookup.user.email}</div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{lookup.user.email}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Created {new Date(lookup.user.created_at).toLocaleDateString()} · Current plan:{' '}
                <span style={{ fontWeight: 800, color: 'var(--accent)', textTransform: 'capitalize' }}>{lookup.user.plan || 'free'}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {lookup?.user && (
        <section style={panelStyle}>
          <h2 style={panelTitleStyle}>2. Choose plan</h2>
          <div style={planGridStyle}>
            {PLAN_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.id}
                onClick={() => setPlanSlug(opt.id)}
                style={planButtonStyle(planSlug === opt.id)}
              >
                <div style={{ fontSize: 14, fontWeight: 900, color: planSlug === opt.id ? 'var(--accent)' : 'var(--text)' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{opt.credits} credits · {opt.ventures}</div>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 160 }}>
              <span style={smallLabelStyle}>Billing period</span>
              <select value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value as BillingPeriod)} style={selectStyle}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 160 }}>
              <span style={smallLabelStyle}>Duration</span>
              <select value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))} style={selectStyle}>
                {DURATION_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </label>
          </div>

          <button type="button" onClick={grant} disabled={granting} style={{ ...primaryButtonStyle(granting), marginTop: 14, width: '100%' }}>
            {granting ? 'Granting…' : `Grant ${planSlug.toUpperCase()} to ${lookup.user.email}`}
          </button>

          {feedback && (
            <div style={feedback.kind === 'ok' ? successStyle : errorStyle}>
              {feedback.text}
            </div>
          )}
        </section>
      )}

      {lookup?.user && lookup.grants.length > 0 && (
        <section style={panelStyle}>
          <h2 style={panelTitleStyle}>Manual grants for this user</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {lookup.grants.map((g) => (
              <div key={g.id} style={grantRowStyle(g.status)}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', textTransform: 'capitalize' }}>
                    {g.plan_slug} · {g.billing_period} · {g.status}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {g.credits_per_cycle} credits/cycle · created {new Date(g.created_at).toLocaleDateString()}
                    {g.current_period_end && ` · ends ${new Date(g.current_period_end).toLocaleDateString()}`}
                    {g.canceled_at && ` · canceled ${new Date(g.canceled_at).toLocaleDateString()}`}
                  </div>
                </div>
                {g.status === 'active' && (
                  <button type="button" onClick={() => revoke(g.id)} style={dangerButtonStyle}>
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

const pageStyle: CSSProperties = {
  maxWidth: 760,
  margin: '0 auto',
  padding: '32px 20px 64px',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
}

const headerStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: 'uppercase',
  color: 'var(--accent)',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
  color: 'var(--text)',
  letterSpacing: -0.4,
}

const subtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: 'var(--text-soft)',
  lineHeight: 1.6,
}

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 20,
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'var(--card-solid)',
  boxShadow: '0 12px 32px rgba(0,0,0,0.04)',
}

const panelTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'var(--muted)',
}

const lookupRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'stretch',
  flexWrap: 'wrap',
}

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 220,
  fontFamily: 'inherit',
  fontSize: 14,
  color: 'var(--text)',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '11px 12px',
  outline: 'none',
}

const selectStyle: CSSProperties = {
  ...inputStyle,
  minWidth: 0,
}

const smallLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: 'uppercase',
  color: 'var(--muted)',
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: 'none',
    borderRadius: 10,
    background: 'var(--accent)',
    color: '#fff',
    cursor: disabled ? 'wait' : 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 900,
    padding: '11px 16px',
    opacity: disabled ? 0.7 : 1,
  }
}

const dangerButtonStyle: CSSProperties = {
  border: '1px solid #dc262640',
  borderRadius: 10,
  background: '#dc262610',
  color: '#dc2626',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 800,
  padding: '8px 12px',
}

const userCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 14,
  borderRadius: 12,
  border: '1px solid var(--accent-glow)',
  background: 'var(--accent-soft)',
}

const planGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 8,
}

function planButtonStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    padding: '12px 14px',
    borderRadius: 12,
    border: active ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
    background: active ? 'var(--accent-soft)' : 'var(--sidebar)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  }
}

const errorStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#991b1b',
  fontSize: 12,
  fontWeight: 600,
  marginTop: 8,
}

const successStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  background: '#dcfce7',
  border: '1px solid #86efac',
  color: '#166534',
  fontSize: 12,
  fontWeight: 600,
  marginTop: 8,
}

function grantRowStyle(status: string): CSSProperties {
  const active = status === 'active'
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    border: active ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
    background: active ? 'var(--accent-soft)' : 'var(--sidebar)',
    opacity: active ? 1 : 0.7,
  }
}
