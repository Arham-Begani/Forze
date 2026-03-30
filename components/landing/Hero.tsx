'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const CYCLING_PHRASES = [
  'validation in minutes',
  'a real market analysis',
  'a landing page live',
  'your investor pitch ready',
]

const STREAM_LINES = [
  { prefix: '◎ Research', text: 'Market analysis: TAM $2.4B, competition gaps identified...', delay: 0 },
  { prefix: '◇ Brand', text: 'Generated names: Vela, Arclo, Nuvro with color palette...', delay: 800 },
  { prefix: '◈ Financial', text: '3-year projection: Year 1 CAC $40 · LTV $850 · Path to profitability...', delay: 1600 },
  { prefix: '▣ Landing', text: 'Live page deployed · Hero copy written · Lead capture ready...', delay: 2400 },
]

const STAT_CHIPS = [
  { icon: '⬡', label: 'Complete in minutes' },
  { icon: '◎', label: '95% DIY founders use it' },
  { icon: '◈', label: 'No expertise needed' },
]

export function Hero() {
  const router = useRouter()
  const [session, setSession] = useState<{ userId: string } | null | 'loading'>('loading')
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [streamVisible, setStreamVisible] = useState<boolean[]>([false, false, false, false])
  const [mouse, setMouse] = useState({ x: 0, y: 0 })

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.ok ? r.json() : null)
      .then(data => setSession(data))
      .catch(() => setSession(null))
  }, [])

  // Typewriter effect
  useEffect(() => {
    const target = CYCLING_PHRASES[phraseIdx]
    let timeout: ReturnType<typeof setTimeout>

    if (!isDeleting && displayed.length < target.length) {
      timeout = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 60)
    } else if (!isDeleting && displayed.length === target.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2200)
    } else if (isDeleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 35)
    } else if (isDeleting && displayed.length === 0) {
      setIsDeleting(false)
      setPhraseIdx(i => (i + 1) % CYCLING_PHRASES.length)
    }

    return () => clearTimeout(timeout)
  }, [displayed, isDeleting, phraseIdx])

  // Stream lines — play once then loop every 9s
  useEffect(() => {
    const play = () => {
      setStreamVisible([false, false, false, false])
      STREAM_LINES.forEach((line, i) => {
        setTimeout(() => {
          setStreamVisible(prev => {
            const next = [...prev]
            next[i] = true
            return next
          })
        }, line.delay + 400)
      })
    }
    play()
    const id = setInterval(play, 9000)
    return () => clearInterval(id)
  }, [])

  // Mouse parallax for blobs
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth - 0.5) * 30,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const isLoggedIn = session !== 'loading' && session !== null

  return (
    <section style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '96px 24px 64px',
      overflow: 'hidden',
    }}>
      {/* Ambient blobs */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}>
        <div style={{
          position: 'absolute',
          top: '10%',
          right: '-5%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, hsla(28,62%,42%,0.13) 0%, transparent 70%)',
          animation: 'blob-float 14s ease-in-out infinite',
          transform: `translate(${mouse.x * 0.6}px, ${mouse.y * 0.4}px)`,
          transition: 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '5%',
          left: '-8%',
          width: '700px',
          height: '700px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, hsla(210,50%,50%,0.07) 0%, transparent 70%)',
          animation: 'blob-float 18s ease-in-out infinite reverse',
          transform: `translate(${mouse.x * -0.4}px, ${mouse.y * -0.3}px)`,
          transition: 'transform 1.8s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
        }} />
        {/* Subtle dot grid */}
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
        willChange: 'transform',
        zIndex: 1,
        maxWidth: '860px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '28px',
      }}>
        {/* Headline */}
        <div style={{ animation: 'fade-in-scale 0.7s 0.05s ease both' }}>
          <h1 style={{
            fontFamily: 'var(--font-dm-sans), sans-serif',
            fontSize: 'clamp(48px, 7vw, 80px)',
            fontWeight: 800,
            lineHeight: 1.1,
            color: 'var(--text)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            Your idea deserves
            <br />
            <span style={{
              background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              display: 'inline-block',
              minWidth: 'min(320px, 70vw)',
            }}>
              {displayed}
              <span style={{
                display: 'inline-block',
                width: '3px',
                height: '0.85em',
                background: 'var(--accent)',
                marginLeft: '3px',
                verticalAlign: 'middle',
                animation: 'pulse 1s ease-in-out infinite',
              }} />
            </span>
          </h1>
        </div>

        {/* Subheadline */}
        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(16px, 2vw, 19px)',
          lineHeight: 1.65,
          color: 'var(--text-soft)',
          maxWidth: '600px',
          margin: 0,
          animation: 'fade-in-scale 0.7s 0.2s ease both',
        }}>
          Market research, brand identity, landing page, and financial model. In 5 minutes. No expertise needed.
        </p>

        {/* CTA row */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          animation: 'fade-in-scale 0.7s 0.3s ease both',
        }}>
          <button
            onClick={() => router.push(isLoggedIn ? '/dashboard' : '/signup')}
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
            {isLoggedIn ? 'Continue →' : 'Start Now (Free) →'}
          </button>
          <button
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
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
            How it works
          </button>
        </div>

        {/* Social proof strip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'fade-in-scale 0.7s 0.4s ease both',
        }}>
          <div style={{ display: 'flex' }}>
            {['A', 'M', 'J', 'R', 'K'].map((initial, i) => (
              <div key={i} style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: `hsl(${(i * 47 + 20) % 360}, 45%, 55%)`,
                border: '2px solid var(--bg)',
                marginLeft: i === 0 ? 0 : '-8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}>
                {initial}
              </div>
            ))}
          </div>
          <span style={{
            fontSize: '13px',
            color: 'var(--muted)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}>
            <strong style={{ color: 'var(--text-soft)' }}>1,000+ founders</strong> validate ideas here
          </span>
        </div>

        {/* Demo terminal card */}
        <div style={{
          width: '100%',
          maxWidth: '720px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          animation: 'card-rise 0.8s 0.5s ease both',
        }}>
          {/* Terminal header */}
          <div style={{
            padding: '14px 20px',
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
              Forze · Full Launch · Running
            </span>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#22c55e',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          </div>

          {/* Stream output */}
          <div style={{
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            minHeight: '140px',
          }}>
            {STREAM_LINES.map((line, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: '12px',
                opacity: streamVisible[i] ? 1 : 0,
                transform: streamVisible[i] ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 0.4s ease, transform 0.4s ease',
                alignItems: 'flex-start',
              }}>
                <span style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '12px',
                  color: 'var(--accent)',
                  flexShrink: 0,
                  paddingTop: '1px',
                }}>
                  {line.prefix}
                </span>
                <span style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '13px',
                  color: 'var(--text-soft)',
                  lineHeight: 1.5,
                }}>
                  {line.text}
                </span>
              </div>
            ))}
            {streamVisible[3] && (
              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                animation: 'fade-in-scale 0.4s ease both',
              }}>
                <span style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '12px',
                  color: '#22c55e',
                  flexShrink: 0,
                }}>✓ Done</span>
                <span style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '13px',
                  color: 'var(--muted)',
                }}>
                  Venture package ready · 4m 12s
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Floating stat chips */}
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
              gap: '7px',
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
              <span style={{ color: 'var(--accent)', fontSize: '15px' }}>{chip.icon}</span>
              {chip.label}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
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

      {/* Scroll indicator */}
      <button
        onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 3,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          opacity: 0.45,
          animation: 'fade-in-scale 1s 1.2s ease both',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.45' }}
      >
        <span style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '10px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}>scroll</span>
        <svg width="16" height="24" viewBox="0 0 16 24" fill="none" style={{ animation: 'soft-bounce 1.8s ease-in-out infinite' }}>
          <rect x="6.5" y="0" width="3" height="3" rx="1.5" fill="var(--accent)" />
          <path d="M8 8 L8 16 M5 13 L8 16 L11 13" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  )
}
