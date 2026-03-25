'use client'

import { useEffect, useRef, useState } from 'react'

const TESTIMONIALS = [
  {
    quote: 'Went from an idea to live venture in 7 minutes. The research report and feasibility analysis alone would have taken my team 3 weeks and ₹80,000 in consultant fees.',
    name: 'Dhruv Shetty',
    role: 'Founder',
    company: 'Safar Raksha',
    initials: 'DS',
    color: '#5A8C6E',
    stars: 5,
  },
  {
    quote: 'The Shadow Board found three critical flaws I hadn\'t considered — CAC assumptions, onboarding drop-off, and a regulatory blind spot. I pivoted early and saved months of wasted build time.',
    name: 'Krisheev Gandhi',
    role: 'Founder',
    company: 'SpotPlay',
    initials: 'KG',
    color: '#7A5A8C',
    stars: 5,
  },
  {
    quote: 'Used Forze to validate 5 ideas before choosing one to build. The feasibility scores and financial projections gave me conviction I couldn\'t get from any other tool.',
    name: 'Samarth Mallikarjuna',
    role: 'Product Manager',
    company: 'SwiftGig',
    initials: 'SM',
    color: '#5A6E8C',
    stars: 5,
  },
]

function Stars({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{ color: '#f59e0b', fontSize: '14px' }}>★</span>
      ))}
    </div>
  )
}

export function Testimonials() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={sectionRef} style={{
      padding: 'clamp(64px, 8vw, 112px) 24px',
      maxWidth: '1100px',
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '56px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        <p style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 12px' }}>
          Social Proof
        </p>
        <h2 style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: 'var(--text)', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
          Founders ship faster
        </h2>
      </div>

      {/* Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
      }}>
        {TESTIMONIALS.map((t, i) => (
          <div
            key={i}
            style={{
              borderRadius: 'var(--radius-xl)',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--glass-border)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0) scale(1)' : `translateY(24px) scale(0.97)`,
              transition: `opacity 0.65s ${i * 0.15}s cubic-bezier(0.16,1,0.3,1), transform 0.65s ${i * 0.15}s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = `0 20px 48px -8px ${t.color}30`
              e.currentTarget.style.borderColor = `${t.color}40`
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.borderColor = 'var(--glass-border)'
              e.currentTarget.style.transform = 'translateY(0) scale(1)'
            }}
          >
            <Stars count={t.stars} />

            <p style={{
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontSize: '15px',
              color: 'var(--text-soft)',
              lineHeight: 1.65,
              margin: 0,
              flex: 1,
            }}>
              "{t.quote}"
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: `${t.color}25`,
                border: `2px solid ${t.color}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                color: t.color,
                flexShrink: 0,
              }}>
                {t.initials}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                  {t.name}
                </div>
                <div style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '12px', color: 'var(--muted)' }}>
                  {t.role} · {t.company}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
