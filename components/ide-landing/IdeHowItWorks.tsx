'use client'

import { useEffect, useRef, useState } from 'react'

const STEPS = [
  {
    number: '01',
    icon: 'FE',
    accent: '#5A8CA5',
    title: 'Download & open a folder',
    description: 'Grab the signed build for your OS, launch it, and point Forze at any project — exactly like "Open Folder" in the editor you already use.',
    detail: 'macOS · Windows · Linux',
  },
  {
    number: '02',
    icon: 'AI',
    accent: '#C4975A',
    title: 'Add your keys (optional)',
    description: 'Start instantly with the keyless Gemini default, or plug in your own Claude / OpenAI key. Your keys stay on your machine and calls go straight to the provider.',
    detail: 'Keyless default · bring your own key',
  },
  {
    number: '03',
    icon: '▲',
    accent: '#5A8C6E',
    title: 'Build, ship, grow',
    description: 'Code in Monaco, command a team of AI agents, deploy to Vercel, track real metrics, and post your build-in-public update — all without switching apps.',
    detail: 'Code · agents · deploy · post',
  },
]

export function IdeHowItWorks() {
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
          How it works
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
          From download to shipping in three steps
        </h2>
        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '17px',
          color: 'var(--text-soft)',
          maxWidth: '560px',
          margin: '0 auto',
          lineHeight: 1.6,
        }}>
          No setup marathon. Install, open a project, and the whole founder OS is already around your code.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        position: 'relative',
      }}>
        <div className="ide-hiw-line" style={{
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
                fontSize: '14px',
                fontWeight: 700,
                color: step.accent,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
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
