'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const ACCENT = '#5A8CA5'

const HIGHLIGHTS = [
  'Monaco code editor',
  'AI agent control room',
  'Vercel deploys',
  'Local-first · BYOK',
]

// Mini code lines for the embedded IDE window mock.
const CODE_LINES = [
  { n: 1, tokens: [{ t: 'export function ', c: '#8C5A7A' }, { t: 'Checkout', c: ACCENT }, { t: '() {', c: 'var(--muted)' }] },
  { n: 2, tokens: [{ t: '  return ', c: '#8C5A7A' }, { t: 'stripe', c: ACCENT }, { t: '.session()', c: 'var(--text-soft)' }] },
  { n: 3, tokens: [{ t: '}', c: 'var(--muted)' }] },
]

export function IdeBanner() {
  const router = useRouter()
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.2 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const sync = () => setIsNarrow(window.innerWidth < 880)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  return (
    <section id="desktop" ref={sectionRef} style={{
      padding: 'clamp(48px, 7vw, 96px) 24px',
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 'var(--radius-xl)',
          background: `linear-gradient(135deg, ${ACCENT}14, ${ACCENT}06)`,
          border: `1px solid ${ACCENT}30`,
          padding: 'clamp(24px, 4vw, 44px)',
          display: 'grid',
          gridTemplateColumns: isNarrow ? '1fr' : 'minmax(0, 1fr) minmax(0, 420px)',
          gap: 'clamp(24px, 4vw, 48px)',
          alignItems: 'center',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(28px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease, border-color var(--transition-fast), box-shadow var(--transition-fast)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = `${ACCENT}60`
          e.currentTarget.style.boxShadow = `0 24px 60px -16px ${ACCENT}25`
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = `${ACCENT}30`
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        {/* Top scan line */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(to right, transparent, ${ACCENT}80, transparent)`,
          animation: 'scan-line 3.5s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 1,
        }} />

        {/* Copy */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: ACCENT,
              padding: '4px 10px',
              borderRadius: '999px',
              background: `${ACCENT}18`,
              border: `1px solid ${ACCENT}35`,
            }}>
              FORZE IDE
            </span>
            <span style={{
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              color: ACCENT,
              textTransform: 'uppercase',
            }}>
              Desktop app
            </span>
          </div>

          <h2 style={{
            fontFamily: 'var(--font-dm-sans), sans-serif',
            fontSize: 'clamp(26px, 3.6vw, 40px)',
            fontWeight: 800,
            color: 'var(--text)',
            margin: '0 0 14px',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}>
            Prefer to build in a real IDE?
          </h2>

          <p style={{
            fontFamily: 'var(--font-dm-sans), sans-serif',
            fontSize: '16px',
            color: 'var(--text-soft)',
            margin: '0 0 20px',
            lineHeight: 1.65,
            maxWidth: '540px',
          }}>
            Forze also ships as a local-first desktop app — a real code editor wrapped in an AI agent control room, Vercel deploys, and founder tools. Code, command your agents, ship, and grow from one window.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
            {HIGHLIGHTS.map((h, i) => (
              <span key={h} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '6px 12px',
                borderRadius: '999px',
                background: `${ACCENT}10`,
                border: `1px solid ${ACCENT}25`,
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-soft)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(8px)',
                transition: `opacity 0.5s ${0.2 + i * 0.07}s ease, transform 0.5s ${0.2 + i * 0.07}s ease`,
              }}>
                <span style={{ color: ACCENT, fontSize: '10px' }}>●</span>
                {h}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <button
              onClick={() => router.push('/ide')}
              style={{
                padding: '13px 28px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 700,
                fontFamily: 'var(--font-dm-sans), sans-serif',
                boxShadow: 'var(--shadow-accent)',
                transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 12px 32px -4px hsla(28,62%,42%,0.45)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'var(--shadow-accent)'
              }}
            >
              Explore Forze IDE {'->'}
            </button>
            <button
              onClick={() => router.push('/download')}
              style={{
                padding: '13px 24px',
                borderRadius: 'var(--radius-lg)',
                background: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--border-strong)',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 600,
                fontFamily: 'var(--font-dm-sans), sans-serif',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = ACCENT
                e.currentTarget.style.color = ACCENT
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-strong)'
                e.currentTarget.style.color = 'var(--text)'
              }}
            >
              Download
            </button>
          </div>
        </div>

        {/* Mini IDE window mock */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.98)',
          transition: 'opacity 0.8s 0.15s ease, transform 0.8s 0.15s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{
            borderRadius: 'var(--radius-lg)',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))',
            WebkitBackdropFilter: 'blur(var(--glass-blur))',
            border: `1px solid ${ACCENT}30`,
            boxShadow: `0 24px 60px -16px ${ACCENT}30`,
            overflow: 'hidden',
          }}>
            {/* title bar */}
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: `${ACCENT}08`,
            }}>
              <div style={{ display: 'flex', gap: '5px' }}>
                {['#ef4444', '#f59e0b', '#22c55e'].map(c => (
                  <div key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.7 }} />
                ))}
              </div>
              <span style={{
                flex: 1,
                textAlign: 'center',
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '11px',
                color: 'var(--muted)',
              }}>
                Forze IDE — acme/app
              </span>
              <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '10px', color: ACCENT }}>⌘K</span>
            </div>
            {/* body */}
            <div style={{ display: 'flex', minHeight: '168px' }}>
              <div style={{
                width: '40px',
                borderRight: '1px solid var(--border)',
                background: 'hsla(0,0%,0%,0.02)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 0',
                flexShrink: 0,
              }}>
                {['FE', 'git', 'AI', '▲'].map((g, i) => (
                  <div key={g} style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    background: `${ACCENT}15`,
                    border: `1px solid ${ACCENT}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontSize: '9px',
                    fontWeight: 700,
                    color: ACCENT,
                    animation: `float ${3 + i * 0.4}s ease-in-out ${i * 0.2}s infinite`,
                  }}>
                    {g}
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 10px', flex: 1, fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '11.5px' }}>
                  {CODE_LINES.map((line, i) => (
                    <div key={line.n} style={{
                      display: 'flex',
                      gap: '8px',
                      lineHeight: 1.8,
                      opacity: visible ? 1 : 0,
                      transform: visible ? 'translateX(0)' : 'translateX(-6px)',
                      transition: `opacity 0.4s ${0.3 + i * 0.08}s ease, transform 0.4s ${0.3 + i * 0.08}s ease`,
                    }}>
                      <span style={{ color: 'var(--muted)', opacity: 0.5, minWidth: '12px', textAlign: 'right', userSelect: 'none' }}>{line.n}</span>
                      <span style={{ whiteSpace: 'pre' }}>
                        {line.tokens.map((tk, j) => <span key={j} style={{ color: tk.c }}>{tk.t}</span>)}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{
                  borderTop: '1px solid var(--border)',
                  padding: '8px 12px',
                  background: 'hsla(0,0%,0%,0.02)',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '10.5px',
                  color: 'var(--text-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                  <span>agent: building preview</span>
                  <span style={{ marginLeft: 'auto', color: '#22c55e' }}>✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
