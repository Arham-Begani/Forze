'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BILLING_PLANS, type PlanSlug } from '@/lib/billing'

const PLAN_ORDER: PlanSlug[] = ['free', 'starter', 'builder', 'pro', 'studio']

const PLAN_DESCRIPTIONS: Record<PlanSlug, string> = {
  free: 'Try Forze with no commitment.',
  starter: 'Validate ideas with key agents.',
  builder: 'Full toolkit for serious builders.',
  pro: 'Maximum velocity for ambitious founders.',
  studio: 'Unlimited power for studios and teams.',
}

const PLAN_HIGHLIGHTS: Record<PlanSlug, string[]> = {
  free: ['1 venture', '25 credits / month', 'All modules included', 'Community support'],
  starter: ['2 ventures', '40 credits / month', 'All modules included', 'Email support'],
  builder: ['5 ventures', '120 credits / month', 'All modules included', 'Priority support'],
  pro: ['15 ventures', '400 credits / month', 'All modules included', 'Dedicated support'],
  studio: ['Unlimited ventures', '1,500 credits / month', 'All modules included', 'White-glove support'],
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
      padding: 'clamp(64px, 8vw, 112px) 24px',
      background: 'var(--sidebar)',
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '48px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}>
          <p style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 12px' }}>Pricing</p>
          <h2 style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: 'var(--text)', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Simple pricing
          </h2>
          <p style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '17px', color: 'var(--text-soft)', maxWidth: '400px', margin: '0 auto 28px', lineHeight: 1.6 }}>
            Start free. Scale when you are ready.
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))',
          gap: '16px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s 0.15s ease, transform 0.6s 0.15s ease',
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
                  padding: '28px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
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
                  transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
                  transform: isHighlighted ? 'scale(1.03)' : 'scale(1)',
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
                  }}>
                    MOST POPULAR
                  </div>
                )}

                {/* Plan name + desc */}
                <div>
                  <div style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>
                    {plan.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.4 }}>
                    {PLAN_DESCRIPTIONS[slug]}
                  </div>
                </div>

                {/* Price */}
                <div>
                  {price === 0 ? (
                    <div style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '32px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                      Free
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '13px', color: 'var(--muted)', marginBottom: '6px' }}>₹</span>
                      <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '32px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {yearly ? effectiveMonthly.toLocaleString('en-IN') : price.toLocaleString('en-IN')}
                      </span>
                      <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '13px', color: 'var(--muted)', marginBottom: '6px' }}>/mo</span>
                    </div>
                  )}
                  {yearly && price > 0 && (
                    <div style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      ₹{price.toLocaleString('en-IN')} billed yearly
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'var(--border)' }} />

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  {PLAN_HIGHLIGHTS[slug].map((item, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: isHighlighted ? 'var(--accent)' : '#22c55e', fontSize: '12px', flexShrink: 0, marginTop: '2px' }}>✓</span>
                      <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '13px', color: 'var(--text-soft)', lineHeight: 1.4 }}>{item}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
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
                    padding: '11px 16px',
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
          fontSize: '13px',
          color: 'var(--muted)',
          marginTop: '32px',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.6s 0.4s ease',
        }}>
          Start free with 25 monthly credits. No credit card required.
        </p>
      </div>
    </section>
  )
}
