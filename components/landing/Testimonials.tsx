'use client'

import { useEffect, useRef, useState } from 'react'

const TESTIMONIALS = [
  {
    quote: 'Went from a rough idea to an investor conversation in under a day. The research report, feasibility verdict, and landing page gave us a real validation story instead of hype.',
    name: 'Dhruv Shetty',
    role: 'Founder',
    company: 'Safar Raksha',
    initials: 'DS',
    color: '#5A8C6E',
    stars: 5,
  },
  {
    quote: 'The Shadow Board found three critical flaws I had missed - CAC assumptions, onboarding drop-off, and a regulatory blind spot. I changed direction before writing a single expensive line of product code.',
    name: 'Krisheev Gandhi',
    role: 'Founder',
    company: 'SpotPlay',
    initials: 'KG',
    color: '#7A5A8C',
    stars: 5,
  },
  {
    quote: 'Used Forze to validate five ideas before choosing one to build. The feasibility scoring and investor-ready packaging gave me conviction I could actually defend in front of other people.',
    name: 'Samarth Mallikarjuna',
    role: 'Product Manager',
    company: 'SwiftGig',
    initials: 'SM',
    color: '#5A6E8C',
    stars: 5,
  },
]

function Stars({ count, visible, cardIndex }: { count: number; visible: boolean; cardIndex: number }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{
          color: '#f59e0b',
          fontSize: '14px',
          display: 'inline-block',
          animation: visible
            ? `badge-pop 0.4s ${cardIndex * 0.15 + i * 0.08}s cubic-bezier(0.34,1.56,0.64,1) both`
            : 'none',
        }}>★</span>
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
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '20%', right: '-10%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, hsla(28,62%,42%,0.07) 0%, transparent 70%)',
          animation: 'blob-float 16s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', left: '-8%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, hsla(210,50%,50%,0.05) 0%, transparent 70%)',
          animation: 'blob-float 20s ease-in-out infinite reverse',
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '56px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}>
          <p style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 12px' }}>
            Founders Building On Forze
          </p>
          <h2 style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: 'var(--text)', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Real founders. Real ventures. Real outcomes.
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
          gap: '20px',
        }}>
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.name}
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
                transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
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
              <Stars count={t.stars} visible={visible} cardIndex={i} />

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
      </div>
    </section>
  )
}
