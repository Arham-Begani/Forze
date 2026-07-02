'use client'

import { useEffect, useRef, useState } from 'react'

const STEPS = [
  {
    number: '01',
    icon: 'V',
    accent: '#6B8F71',
    title: 'Describe The Venture',
    description: 'One paragraph. The problem, the customer, the angle. Forze takes it from there.',
    detail: 'Example: "AI scheduling for insurance agents"',
  },
  {
    number: '02',
    icon: 'F',
    accent: '#C4975A',
    title: 'Ship The Page, Face The Board',
    description: 'Forze deploys a live landing page with lead capture, then convenes the Shadow Board — three adversarial personas that stress-test the venture before the market does.',
    detail: 'Live page · Shadow Board verdict · Co-pilot on call',
  },
  {
    number: '03',
    icon: 'L',
    accent: '#8C7A5A',
    title: 'Ship & Iterate',
    description: 'Your venture is live with a real page, real leads in the CRM, real campaigns going out, and an investor-ready story. Edit any agent. Re-run any module.',
    detail: 'Live URL · leads captured · campaigns sent · deck ready',
  },
]

export function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.15 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="how-it-works" ref={sectionRef} style={{
      padding: 'clamp(64px, 8vw, 112px) 24px',
      maxWidth: '1100px',
      margin: '0 auto',
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '64px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: 'var(--accent)',
          textTransform: 'uppercase',
          margin: '0 0 12px',
        }}>
          The Process
        </p>
        <h2 style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 800,
          color: 'var(--text)',
          margin: '0 0 16px',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}>
          From Idea to a Live Venture in 3 Steps
        </h2>
        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '17px',
          color: 'var(--text-soft)',
          maxWidth: '560px',
          margin: '0 auto',
          lineHeight: 1.6,
        }}>
          Stop spending months on a deck. Forze ships the venture itself — validated, live, and reaching its first customers.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          top: '-60px',
          right: '-80px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, hsla(28,62%,42%,0.08) 0%, transparent 70%)',
          animation: 'blob-float 12s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
        <div className="how-it-works-line" style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(to right, transparent, hsla(28,62%,42%,0.25), transparent)',
          zIndex: -1,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.8s 0.5s ease',
          pointerEvents: 'none',
        }} />
        {STEPS.map((step, i) => (
          <div
            key={step.number}
            style={{
              borderRadius: 'var(--radius-xl)',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--glass-border)',
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              overflow: 'hidden',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(32px)',
              transition: `opacity 0.6s ${i * 0.12}s ease, transform 0.6s ${i * 0.12}s ease`,
              cursor: 'default',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.borderColor = `${step.accent}50`
              el.style.boxShadow = `0 16px 40px -8px ${step.accent}20`
              el.style.transform = 'translateY(-4px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.borderColor = 'var(--glass-border)'
              el.style.boxShadow = 'none'
              el.style.transform = 'translateY(0)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--muted)',
                letterSpacing: '0.06em',
              }}>
                {step.number}
              </span>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-md)',
                background: `${step.accent}18`,
                border: `1px solid ${step.accent}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 700,
                color: step.accent,
                animation: visible
                  ? `badge-pop 0.5s ${0.2 + i * 0.12}s ease both, float ${3 + i * 0.5}s ease-in-out ${0.4 + i * 0.12}s infinite`
                  : 'none',
              }}>
                {step.icon}
              </div>
            </div>

            <div style={{
              height: '2px',
              width: visible ? '40px' : '0px',
              borderRadius: '1px',
              background: `linear-gradient(to right, ${step.accent}, transparent)`,
              transition: `width 0.6s ${0.3 + i * 0.12}s ease`,
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              <h3 style={{
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}>
                {step.title}
              </h3>
              <p style={{
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '15px',
                color: 'var(--text-soft)',
                margin: 0,
                lineHeight: 1.6,
              }}>
                {step.description}
              </p>
              <p style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '12px',
                color: step.accent,
                margin: 0,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: `${step.accent}10`,
                border: `1px solid ${step.accent}20`,
                lineHeight: 1.5,
              }}>
                {step.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
