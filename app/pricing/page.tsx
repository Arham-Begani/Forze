import Link from 'next/link'
import type { CSSProperties } from 'react'
import {
  ALL_BILLING_MODULES,
  ALL_FEATURES,
  BILLING_MODULE_LABELS,
  BILLING_PLANS,
  FEATURE_LABELS,
  MODULE_CREDIT_COSTS,
  PLAN_SEQUENCE,
  TOPUP_PRODUCTS,
  TOPUP_SEQUENCE,
  UNLIMITED_BILLING_VENTURE_LIMIT,
  UNLIMITED_WEEKLY_ACTION_LIMIT,
  isFeatureIncluded,
  isModuleIncluded,
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
              India-first pricing for idea validation and launch
            </h1>
            <p style={{ maxWidth: 720, margin: 0, fontSize: 16, color: 'var(--text-soft)', lineHeight: 1.7 }}>
              Credits refresh every Monday at 00:00 IST. Outreach, CRM, and Inspiration unlock on Builder and above — Free + Starter focus on validation. Top-ups never expire.
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: 18, marginBottom: 28 }}>
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
                    {plan.ventureLimit >= UNLIMITED_BILLING_VENTURE_LIMIT
                      ? 'Unlimited active ventures'
                      : `${plan.ventureLimit} active venture${plan.ventureLimit === 1 ? '' : 's'}`}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text)' }}>{plan.weeklyCredits}</strong> credits / week
                  </div>
                  <div>
                    {plan.allowedFeatures.length === ALL_FEATURES.length
                      ? 'Outreach + CRM + Inspiration unlocked'
                      : 'Validation modules only'}
                  </div>
                  {plan.allowedFeatures.includes('outreach') && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {plan.weeklyActionLimits.campaignsSent >= UNLIMITED_WEEKLY_ACTION_LIMIT
                        ? 'Unlimited campaign sends'
                        : `${plan.weeklyActionLimits.campaignsSent} campaign send${plan.weeklyActionLimits.campaignsSent === 1 ? '' : 's'} / week`}
                    </div>
                  )}
                </div>
                <Link href="/signup" style={{ ...primaryBtnStyle, marginTop: 22, width: '100%', justifyContent: 'center' }}>
                  {plan.cta}
                </Link>
              </section>
            )
          })}
        </div>

        <section className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>What unlocks on which plan</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
            Validation modules (Research, Branding, Landing, Feasibility, Full Launch) work on every plan and burn credits when you run them. Outreach, CRM, and Inspiration unlock from Builder up.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 540 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={tableHeadStyle}>Feature</th>
                  {PLAN_SEQUENCE.map((slug) => (
                    <th key={slug} style={{ ...tableHeadStyle, textAlign: 'center' as const }}>
                      {BILLING_PLANS[slug].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_FEATURES.map((featureId) => (
                  <tr key={featureId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tableCellLabelStyle}>{FEATURE_LABELS[featureId]}</td>
                    {PLAN_SEQUENCE.map((slug) => {
                      const included = isFeatureIncluded(slug, featureId)
                      return (
                        <td key={slug} style={{ ...tableCellStyle, color: included ? 'var(--accent)' : 'var(--muted)' }}>
                          {included ? '✓' : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tableCellLabelStyle}>Launch Autopilot module</td>
                  {PLAN_SEQUENCE.map((slug) => {
                    const included = isModuleIncluded(slug, 'launch-autopilot')
                    return (
                      <td key={slug} style={{ ...tableCellStyle, color: included ? 'var(--accent)' : 'var(--muted)' }}>
                        {included ? '✓' : '—'}
                      </td>
                    )
                  })}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tableCellLabelStyle}>Inspiration analyses / week</td>
                  {PLAN_SEQUENCE.map((slug) => {
                    const limit = BILLING_PLANS[slug].weeklyActionLimits.inspirationAnalyses
                    return (
                      <td key={slug} style={tableCellStyle}>
                        {limit === 0 ? '—' : limit >= UNLIMITED_WEEKLY_ACTION_LIMIT ? '∞' : limit}
                      </td>
                    )
                  })}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tableCellLabelStyle}>CRM emails sent / week</td>
                  {PLAN_SEQUENCE.map((slug) => {
                    const limit = BILLING_PLANS[slug].weeklyActionLimits.crmEmailsSent
                    return (
                      <td key={slug} style={tableCellStyle}>
                        {limit === 0 ? '—' : limit >= UNLIMITED_WEEKLY_ACTION_LIMIT ? '∞' : limit}
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td style={tableCellLabelStyle}>Campaign sends / week</td>
                  {PLAN_SEQUENCE.map((slug) => {
                    const limit = BILLING_PLANS[slug].weeklyActionLimits.campaignsSent
                    return (
                      <td key={slug} style={tableCellStyle}>
                        {limit === 0 ? '—' : limit >= UNLIMITED_WEEKLY_ACTION_LIMIT ? '∞' : limit}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Top-ups</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 14 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 10 }}>
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

const tableHeadStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
}

const tableCellLabelStyle: CSSProperties = {
  padding: '10px 8px',
  color: 'var(--text-soft)',
  fontWeight: 500,
}

const tableCellStyle: CSSProperties = {
  padding: '10px 8px',
  textAlign: 'center',
  fontWeight: 600,
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
