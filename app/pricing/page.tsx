import Link from 'next/link'
import type { CSSProperties } from 'react'
import {
  BILLING_MODULE_LABELS,
  BILLING_PLANS,
  MODULE_CREDIT_COSTS,
  PLAN_SEQUENCE,
  TOPUP_PRODUCTS,
  TOPUP_SEQUENCE,
} from '@/lib/billing'

function formatPrice(amount: number) {
  return amount.toLocaleString('en-IN')
}

function formatInr(amount: number) {
  return `\u20B9${formatPrice(amount)}`
}

export default function PricingPage() {
  return (
    <main className="ambient-page" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '56px 24px 80px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 40,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
              }}
            >
              Forze Pricing
            </div>
            <h1
              style={{
                fontSize: 'clamp(34px, 6vw, 56px)',
                lineHeight: 1,
                letterSpacing: '-0.05em',
                margin: '10px 0 12px',
              }}
            >
              India-first pricing for founder velocity
            </h1>
            <p style={{ maxWidth: 720, margin: 0, fontSize: 16, color: 'var(--text-soft)', lineHeight: 1.7 }}>
              Buy a plan, get monthly credits, and unlock the high-value Forze agents only when they actually matter.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/signup" style={primaryBtnStyle}>
              Start free
            </Link>
            <Link href="/signin" style={secondaryBtnStyle}>
              Sign in
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18, marginBottom: 28 }}>
          {PLAN_SEQUENCE.map((slug) => {
            const plan = BILLING_PLANS[slug]
            return (
              <section
                key={slug}
                className="glass-card"
                style={{
                  padding: 24,
                  position: 'relative',
                  overflow: 'hidden',
                  borderColor: plan.highlight ? 'var(--accent-glow)' : 'var(--border)',
                  boxShadow: plan.highlight ? '0 24px 48px -20px var(--accent-glow)' : 'var(--shadow-card)',
                }}
              >
                {plan.highlight && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 16,
                      right: -32,
                      transform: 'rotate(18deg)',
                      background: 'var(--accent)',
                      color: '#fff',
                      padding: '6px 36px',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Best Value
                  </div>
                )}
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--accent)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {plan.label}
                </div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.05em' }}>
                    {formatInr(plan.monthlyPriceInr)}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>/month</span>
                </div>
                {plan.yearlyPriceInr > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                    or {formatInr(plan.yearlyPriceInr)}/year
                  </div>
                )}
                <div style={{ marginTop: 18, display: 'grid', gap: 8, fontSize: 13, color: 'var(--text-soft)' }}>
                  <div>
                    {plan.ventureLimit} active venture{plan.ventureLimit === 1 ? '' : 's'}
                  </div>
                  <div>{plan.monthlyCredits} credits/month</div>
                  <div>{plan.allowedModules.length} unlocked modules</div>
                </div>
                <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--muted)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Included
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {plan.allowedModules.map((moduleId) => (
                      <span key={moduleId} style={pillStyle}>
                        {BILLING_MODULE_LABELS[moduleId]}
                      </span>
                    ))}
                  </div>
                </div>
                <Link href="/signup" style={{ ...primaryBtnStyle, marginTop: 22, width: '100%', justifyContent: 'center' }}>
                  {plan.cta}
                </Link>
              </section>
            )
          })}
        </div>

        <section className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Top-ups</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {TOPUP_SEQUENCE.map((slug) => {
              const topup = TOPUP_PRODUCTS[slug]
              return (
                <div
                  key={slug}
                  style={{ padding: 18, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--glass-bg)' }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{topup.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 6 }}>
                    {formatInr(topup.amountInr)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{topup.credits} extra credits</div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="glass-card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Credit cost per module</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {Object.entries(MODULE_CREDIT_COSTS).map(([moduleId, cost]) => (
              <div
                key={moduleId}
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--glass-bg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                  {BILLING_MODULE_LABELS[moduleId as keyof typeof BILLING_MODULE_LABELS] ?? moduleId}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{cost}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

const primaryBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 18px',
  borderRadius: 12,
  background: 'linear-gradient(135deg, var(--accent), #e0a257)',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 700,
  boxShadow: '0 16px 32px -18px var(--accent-glow)',
}

const secondaryBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 18px',
  borderRadius: 12,
  background: 'var(--glass-bg-strong)',
  color: 'var(--text)',
  textDecoration: 'none',
  fontWeight: 700,
  border: '1px solid var(--border)',
}

const pillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 10px',
  borderRadius: 999,
  background: 'var(--accent-soft)',
  border: '1px solid var(--accent-glow)',
  color: 'var(--text)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.02em',
}
