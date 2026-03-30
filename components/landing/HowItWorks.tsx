'use client'

import { useEffect, useRef, useState } from 'react'

const STEPS = [
  {
    number: '01',
    icon: '◉',
    accent: '#6B8F71',
    title: 'Describe Your Idea',
    description: 'One sentence. What problem? Who needs it? Done.',
    detail: 'Example: "AI scheduling for insurance agents"',
  },
  {
    number: '02',
    icon: '⬡',
    accent: '#C4975A',
    title: 'Forze Analyzes',
    description: 'Market potential, competition, unit economics, and GO/NO-GO verdict in 4 minutes.',
    detail: 'TAM · Competition · Financials · Risk assessment',
  },
  {
    number: '03',
    icon: '▣',
    accent: '#8C7A5A',
    title: 'Copy Everything',
    description: 'Market research. Brand identity. Landing page. Business plan. All connected and ready to launch.',
    detail: 'Download or share immediately',
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
      {/* Header */}
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
          From Idea to Market-Ready in 3 Steps
        </h2>
        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '17px',
          color: 'var(--text-soft)',
          maxWidth: '480px',
          margin: '0 auto',
          lineHeight: 1.6,
        }}>
          Everything you need to launch is generated in minutes.
        </p>
      </div>

      {/* Steps */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        position: 'relative',
      }}>
        {STEPS.map((step, i) => (
          <div
            key={i}
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
            {/* Top: number + icon */}
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
                fontSize: '22px',
                color: step.accent,
                animation: visible ? `badge-pop 0.5s ${0.2 + i * 0.12}s ease both` : 'none',
              }}>
                {step.icon}
              </div>
            </div>

            {/* Accent line */}
            <div style={{
              height: '2px',
              width: '40px',
              borderRadius: '1px',
              background: `linear-gradient(to right, ${step.accent}, transparent)`,
            }} />

            {/* Content */}
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
