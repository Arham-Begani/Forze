'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BILLING_PLANS, type PlanSlug } from '@/lib/billing'

const PLAN_ORDER: PlanSlug[] = ['free', 'starter', 'builder', 'pro', 'studio']

const PLAN_DESCRIPTIONS: Record<PlanSlug, string> = {
  free: 'Pressure-test one venture with the validation stack.',
  starter: 'Rerun research and feasibility with more room to iterate.',
  builder: 'Outreach, CRM, and Inspiration unlock — go from idea to launched venture.',
  pro: 'Founder diligence at full tempo with rerun-heavy quotas.',
  studio: 'Portfolio-level operations for teams and venture studios.',
}

const PLAN_HIGHLIGHTS: Record<PlanSlug, string[]> = {
  free: [
    '1 validation workspace',
    '10 credits / week',
    'Validation modules only',
    'Community support',
  ],
  starter: [
    '2 ventures',
    '20 credits / week',
    'Validation modules only',
    'Email support',
  ],
  builder: [
    '5 ventures',
    '60 credits / week',
    'Outreach, CRM, Inspiration unlocked',
    '3 campaign sends / week · 50 CRM emails / week',
    'Priority support',
  ],
  pro: [
    '15 ventures',
    '300 credits / week',
    'Outreach, CRM, Inspiration unlocked',
    '15 campaign sends / week · 250 CRM emails / week',
    'Dedicated support',
  ],
  studio: [
    'Unlimited ventures',
    '600 credits / week',
    'Outreach, CRM, Inspiration unlocked',
    'Unlimited campaign + CRM sends',
    'White-glove support',
  ],
}

export function PricingSection() {
  const router = useRouter()
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [yearly, setYearly] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.08 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="pricing" ref={sectionRef} style={{
      padding: 'clamp(80px, 10vw, 136px) 24px',
      background: 'var(--sidebar)',
    }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '64px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}>
          <p style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 12px' }}>Pricing</p>
          <h2 style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: 'var(--text)', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Pricing for validation velocity
          </h2>
          <p style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '17px', color: 'var(--text-soft)', maxWidth: '460px', margin: '0 auto 28px', lineHeight: 1.6 }}>
            Credits refresh every Monday 00:00 IST. Outreach, CRM, and Inspiration unlock on Builder and up. Top-ups never expire.
          </p>

          {/* Billing toggle */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '4px', borderRadius: '999px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setYearly(false)}
              style={{
                padding: '6px 18px',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '13px',
                fontWeight: 600,
                background: !yearly ? 'var(--accent)' : 'transparent',
                color: !yearly ? '#fff' : 'var(--text-soft)',
                transition: 'all var(--transition-fast)',
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              style={{
                padding: '6px 18px',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '13px',
                fontWeight: 600,
                background: yearly ? 'var(--accent)' : 'transparent',
                color: yearly ? '#fff' : 'var(--text-soft)',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Yearly
              <span style={{
                padding: '1px 6px',
                borderRadius: '999px',
                background: yearly ? 'rgba(255,255,255,0.25)' : '#22c55e20',
                color: yearly ? '#fff' : '#22c55e',
                fontSize: '10px',
                fontWeight: 700,
              }}>
                –17%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
          gap: '24px',
          alignItems: 'stretch',
        }}>
          {PLAN_ORDER.map((slug, i) => {
            const plan = BILLING_PLANS[slug]
            const isHighlighted = plan.highlight === true
            const price = yearly ? plan.yearlyPriceInr : plan.monthlyPriceInr
            const effectiveMonthly = yearly && plan.yearlyPriceInr > 0
              ? Math.round(plan.yearlyPriceInr / 12)
              : plan.monthlyPriceInr

            return (
              <div
                key={slug}
                style={{
                  borderRadius: 'var(--radius-xl)',
                  padding: '36px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                  position: 'relative',
                  background: isHighlighted
                    ? 'linear-gradient(160deg, hsla(28,62%,42%,0.12), hsla(28,62%,42%,0.04))'
                    : 'var(--glass-bg)',
                  backdropFilter: 'blur(var(--glass-blur))',
                  WebkitBackdropFilter: 'blur(var(--glass-blur))',
                  border: isHighlighted
                    ? '1.5px solid hsla(28,62%,42%,0.35)'
                    : '1px solid var(--glass-border)',
                  boxShadow: isHighlighted ? 'var(--shadow-accent)' : 'none',
                  animation: isHighlighted ? 'border-glow 3s ease-in-out infinite' : 'none',
                  transition: `transform var(--transition-fast), box-shadow var(--transition-fast), opacity 0.6s ${0.1 + i * 0.08}s cubic-bezier(0.16,1,0.3,1)`,
                  transform: visible
                    ? (isHighlighted ? 'scale(1.03)' : 'translateY(0) scale(1)')
                    : 'translateY(28px) scale(0.97)',
                  opacity: visible ? 1 : 0,
                  animationDelay: `${i * 0.07}s`,
                }}
                onMouseEnter={e => {
                  if (!isHighlighted) {
                    e.currentTarget.style.transform = 'translateY(-4px)'
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isHighlighted) {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              >
                {/* Ambient particles for highlighted card */}
                {isHighlighted && [
                  { top: '15%', left: '8%', size: 4, delay: '0s', dur: '3.5s' },
                  { top: '70%', left: '85%', size: 3, delay: '0.8s', dur: '4.2s' },
                  { top: '40%', left: '90%', size: 5, delay: '0.3s', dur: '3.8s' },
                  { top: '80%', left: '20%', size: 3, delay: '1.2s', dur: '4.5s' },
                ].map((p, j) => (
                  <div key={j} style={{
                    position: 'absolute',
                    top: p.top,
                    left: p.left,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    opacity: 0.35,
                    pointerEvents: 'none',
                    animation: `blob-float ${p.dur} ease-in-out ${p.delay} infinite`,
                  }} />
                ))}
                {/* Popular badge */}
                {isHighlighted && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '4px 14px',
                    borderRadius: '999px',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    whiteSpace: 'nowrap',
                    boxShadow: 'var(--shadow-accent)',
                    animation: 'glow-pulse 2s ease-in-out infinite',
                  }}>
                    MOST POPULAR
                  </div>
                )}

                {/* Plan name + desc */}
                <div>
                  <div style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '17px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px', letterSpacing: '-0.01em' }}>
                    {plan.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55, minHeight: '40px' }}>
                    {PLAN_DESCRIPTIONS[slug]}
                  </div>
                </div>

                {/* Price */}
                <div>
                  {price === 0 ? (
                    <div style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '40px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.025em', lineHeight: 1 }}>
                      Free
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '15px', color: 'var(--muted)', marginBottom: '8px' }}>₹</span>
                      <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '40px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.025em', lineHeight: 1 }}>
                        {yearly ? effectiveMonthly.toLocaleString('en-IN') : price.toLocaleString('en-IN')}
                      </span>
                      <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '14px', color: 'var(--muted)', marginBottom: '8px' }}>/mo</span>
                    </div>
                  )}
                  {yearly && price > 0 && (
                    <div style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                      ₹{price.toLocaleString('en-IN')} billed yearly
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'var(--border)' }} />

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  {PLAN_HIGHLIGHTS[slug].map((item, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ color: isHighlighted ? 'var(--accent)' : '#22c55e', fontSize: '12px', flexShrink: 0, marginTop: '3px' }}>✓</span>
                      <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '13px', color: 'var(--text-soft)', lineHeight: 1.55 }}>{item}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
                    <span style={{ color: 'var(--muted)', fontSize: '12px', flexShrink: 0 }}>◎</span>
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '12px', color: 'var(--muted)' }}>
                      {plan.ventureLimit >= 1_000_000 ? 'Unlimited' : plan.ventureLimit} venture{plan.ventureLimit !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={() => router.push('/signup')}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: isHighlighted ? 'none' : '1px solid var(--border-strong)',
                    background: isHighlighted ? 'var(--accent)' : 'transparent',
                    color: isHighlighted ? '#fff' : 'var(--text)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    fontSize: '14px',
                    fontWeight: 700,
                    transition: 'all var(--transition-fast)',
                    boxShadow: isHighlighted ? 'var(--shadow-accent)' : 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isHighlighted) {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.color = 'var(--accent)'
                    } else {
                      e.currentTarget.style.opacity = '0.88'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isHighlighted) {
                      e.currentTarget.style.borderColor = 'var(--border-strong)'
                      e.currentTarget.style.color = 'var(--text)'
                    } else {
                      e.currentTarget.style.opacity = '1'
                    }
                  }}
                >
                  {plan.cta} →
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: 'center',
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '14px',
          color: 'var(--muted)',
          marginTop: '56px',
          lineHeight: 1.6,
          maxWidth: '560px',
          marginLeft: 'auto',
          marginRight: 'auto',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.6s 0.4s ease',
        }}>
          Start free with weekly credits. No card required. Top-ups never expire.
        </p>
      </div>
    </section>
  )
}
