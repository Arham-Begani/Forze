'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Activity-bar items in the mock IDE window.
const RAIL = [
  { glyph: 'FE', accent: '#5A8CA5' },
  { glyph: '⌕', accent: '#6B8F71' },
  { glyph: 'git', accent: '#8C7A5A' },
  { glyph: 'AI', accent: '#C4975A' },
  { glyph: '▲', accent: '#7A5A8C' },
  { glyph: '>_', accent: '#5A8C6E' },
]

// A few syntax-highlighted lines for the mock editor.
const CODE_LINES = [
  { n: 1, gutter: '', tokens: [{ t: 'export async function ', c: '#8C5A7A' }, { t: 'checkout', c: '#5A8CA5' }, { t: '(cart) {', c: 'var(--muted)' }] },
  { n: 2, gutter: '+', tokens: [{ t: '  const ', c: '#8C5A7A' }, { t: 'session', c: 'var(--text)' }, { t: ' = ', c: 'var(--muted)' }, { t: 'await ', c: '#8C5A7A' }, { t: 'stripe', c: '#5A8CA5' }, { t: '.create(cart)', c: 'var(--text-soft)' }] },
  { n: 3, gutter: '+', tokens: [{ t: '  return ', c: '#8C5A7A' }, { t: 'session', c: 'var(--text)' }, { t: '.url', c: 'var(--text-soft)' }] },
  { n: 4, gutter: '', tokens: [{ t: '}', c: 'var(--muted)' }] },
]

// Forze Assistant / agent actions that stream into the right panel.
const ASSISTANT_LINES = [
  { mark: '●', text: 'Assistant opened checkout.ts', accent: '#C4975A', delay: 0 },
  { mark: '⠿', text: 'Claude Code #1 wrote the Stripe call', accent: '#5A8C6E', delay: 700 },
  { mark: '✓', text: 'Commit Guard: no secrets, staged 2 files', accent: '#6B8F71', delay: 1400 },
  { mark: '▲', text: 'Deploy → Vercel: building preview…', accent: '#7A5A8C', delay: 2100 },
]

const STAT_CHIPS = [
  { icon: '3 OS', label: 'macOS · Windows · Linux' },
  { icon: 'local', label: 'Local-first & offline' },
  { icon: 'BYOK', label: 'Bring your own key' },
]

export function IdeHero() {
  const router = useRouter()
  const [streamVisible, setStreamVisible] = useState<boolean[]>([false, false, false, false])
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const play = () => {
      setStreamVisible([false, false, false, false])
      ASSISTANT_LINES.forEach((line, i) => {
        setTimeout(() => {
          setStreamVisible(prev => {
            const next = [...prev]
            next[i] = true
            return next
          })
        }, line.delay + 500)
      })
    }
    play()
    const id = setInterval(play, 9000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const sync = () => setIsMobile(window.innerWidth < 768)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  return (
    <section className="hero-section" style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '120px 24px 72px',
      overflow: 'hidden',
    }}>
      {/* Ambient blobs + dot grid */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute',
          top: '8%',
          right: isMobile ? '-25%' : '-6%',
          width: isMobile ? '300px' : '640px',
          height: isMobile ? '300px' : '640px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, hsla(28,62%,42%,0.14) 0%, transparent 70%)',
          animation: 'blob-float 14s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '2%',
          left: isMobile ? '-18%' : '-8%',
          width: isMobile ? '320px' : '700px',
          height: isMobile ? '320px' : '700px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, hsla(210,50%,50%,0.07) 0%, transparent 70%)',
          animation: 'blob-float 18s ease-in-out infinite reverse',
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, var(--muted) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.08,
        }} />
      </div>

      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: '980px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '26px',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '999px',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          animation: 'fade-in-scale 0.6s ease both',
        }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.6s ease-in-out infinite' }} />
          <span style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '12px',
            color: 'var(--text-soft)',
            letterSpacing: '0.02em',
          }}>
            Desktop · macOS / Windows / Linux
          </span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(42px, 6.6vw, 76px)',
          fontWeight: 800,
          lineHeight: 1.08,
          color: 'var(--text)',
          margin: 0,
          letterSpacing: '-0.02em',
          animation: 'fade-in-scale 0.7s 0.05s ease both',
        }}>
          The{' '}
          <span style={{
            background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Sovereign OS
          </span>
          <br />
          for startup founders.
        </h1>

        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(16px, 2vw, 19px)',
          lineHeight: 1.65,
          color: 'var(--text-soft)',
          maxWidth: '720px',
          margin: 0,
          animation: 'fade-in-scale 0.7s 0.2s ease both',
        }}>
          Forze is a desktop IDE that doesn&apos;t stop at the editor — code, run AI agents, deploy, track, and build in public from one local-first window. Your keys, your files, your data, all on your machine.
        </p>

        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          animation: 'fade-in-scale 0.7s 0.3s ease both',
        }}>
          <button
            onClick={() => router.push('/download')}
            style={{
              padding: '14px 32px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 700,
              fontFamily: 'var(--font-dm-sans), sans-serif',
              boxShadow: 'var(--shadow-accent)',
              transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
              letterSpacing: '0.01em',
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
            Download for free {'->'}
          </button>
          <button
            onClick={() => document.getElementById('editor')?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              padding: '14px 28px',
              borderRadius: 'var(--radius-lg)',
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border-strong)',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              fontFamily: 'var(--font-dm-sans), sans-serif',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent)'
              e.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-strong)'
              e.currentTarget.style.color = 'var(--text)'
            }}
          >
            See the workspace
          </button>
        </div>

        {/* ── The IDE window mock ───────────────────────────────────────── */}
        <div style={{
          width: '100%',
          maxWidth: '900px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          animation: 'card-rise 0.8s 0.5s ease both',
          marginTop: '12px',
        }}>
          {/* Title bar */}
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'hsla(0,0%,0%,0.04)',
          }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['#ef4444', '#f59e0b', '#22c55e'].map(c => (
                <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c, opacity: 0.8 }} />
              ))}
            </div>
            <span style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '12px',
              color: 'var(--muted)',
              flex: 1,
              textAlign: 'center',
            }}>
              Forze IDE — acme/app · main
            </span>
            <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '10px', color: 'var(--accent)' }}>⌘K</span>
          </div>

          {/* Body: activity bar · editor · assistant */}
          <div style={{ display: 'flex', minHeight: '300px' }}>
            {/* Activity bar */}
            <div className="ide-rail" style={{
              width: '56px',
              borderRight: '1px solid var(--border)',
              background: 'hsla(0,0%,0%,0.02)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 0',
              flexShrink: 0,
            }}>
              {RAIL.map((a, i) => (
                <div key={a.glyph} style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: 'var(--radius-sm)',
                  background: `${a.accent}18`,
                  border: `1px solid ${a.accent}35`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: a.accent,
                  animation: `float ${3 + i * 0.4}s ease-in-out ${i * 0.2}s infinite`,
                }}>
                  {a.glyph}
                </div>
              ))}
            </div>

            {/* Editor + terminal */}
            <div style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRight: isMobile ? 'none' : '1px solid var(--border)',
            }}>
              <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '11px', color: '#8C7A5A' }}>checkout.ts</span>
                <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '11px', color: 'var(--muted)' }}>· 2 changes</span>
              </div>
              <div style={{ padding: '12px 8px', flex: 1, fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '12px' }}>
                {CODE_LINES.map((line, i) => (
                  <div key={line.n} style={{
                    display: 'flex',
                    gap: '8px',
                    lineHeight: 1.75,
                    opacity: 1,
                  }}>
                    <span style={{ color: line.gutter ? '#22c55e' : 'var(--border-strong)', width: '8px', textAlign: 'center', userSelect: 'none' }}>{line.gutter || '·'}</span>
                    <span style={{ color: 'var(--muted)', opacity: 0.5, minWidth: '14px', textAlign: 'right', userSelect: 'none' }}>{line.n}</span>
                    <span style={{ whiteSpace: 'pre' }}>
                      {line.tokens.map((tk, j) => <span key={`${i}-${j}`} style={{ color: tk.c }}>{tk.t}</span>)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{
                borderTop: '1px solid var(--border)',
                padding: '10px 14px',
                background: 'hsla(0,0%,0%,0.02)',
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '11px',
                color: 'var(--text-soft)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}>
                <span style={{ color: '#5A8C6E' }}>$</span>
                <span>forze agent <span style={{ color: 'var(--text)' }}>&quot;add stripe checkout&quot;</span></span>
                <span style={{ width: '7px', height: '13px', background: 'var(--accent)', animation: 'pulse 1s ease-in-out infinite', display: 'inline-block' }} />
              </div>
            </div>

            {/* Assistant / agents panel (hidden on mobile) */}
            {!isMobile && (
              <div style={{
                width: '236px',
                flexShrink: 0,
                padding: '16px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '11px',
                background: 'hsla(0,0%,0%,0.015)',
              }}>
                <span style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '11px',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  assistant
                </span>
                {ASSISTANT_LINES.map((line, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    gap: '9px',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    opacity: streamVisible[i] ? 1 : 0,
                    transform: streamVisible[i] ? 'translateY(0)' : 'translateY(8px)',
                    transition: 'opacity 0.4s ease, transform 0.4s ease',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      fontSize: '12px',
                      color: line.accent,
                      flexShrink: 0,
                      fontWeight: 700,
                    }}>
                      {line.mark}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                      fontSize: '12px',
                      color: 'var(--text-soft)',
                      lineHeight: 1.5,
                    }}>
                      {line.text}
                    </span>
                  </div>
                ))}
                <div style={{
                  marginTop: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: streamVisible[3] ? 1 : 0,
                  transition: 'opacity 0.4s ease',
                }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '11px', color: '#22c55e', fontWeight: 700 }}>live</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '11px', color: 'var(--muted)' }}>one shared context</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stat chips */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          animation: 'fade-in-scale 0.7s 0.9s ease both',
        }}>
          {STAT_CHIPS.map((chip, i) => (
            <div key={i} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '999px',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--glass-border)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-soft)',
              animation: `animate-float ${3 + i * 0.7}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}>
              <span style={{ color: 'var(--accent)', fontSize: '11px', fontFamily: 'var(--font-jetbrains-mono), monospace', fontWeight: 700 }}>{chip.icon}</span>
              {chip.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '120px',
        background: 'linear-gradient(to bottom, transparent, var(--bg))',
        pointerEvents: 'none',
        zIndex: 2,
      }} />

      <style>{`
        @media (max-width: 768px) {
          .ide-rail { width: 46px !important; }
        }
      `}</style>
    </section>
  )
}
