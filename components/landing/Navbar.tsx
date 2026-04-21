'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface SessionData { userId: string }

export function Navbar() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [session, setSession] = useState<SessionData | null | 'loading'>('loading')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.ok ? r.json() : null)
      .then(data => setSession(data))
      .catch(() => setSession(null))
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const sectionIds = ['how-it-works', 'agents', 'compare', 'pricing']
    const observers: IntersectionObserver[] = []
    sectionIds.forEach(id => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id) },
        { threshold: 0.3 }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [])

  const scrollTo = (id: string) => {
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const navLinks = [
    { label: 'How it works', id: 'how-it-works' },
    { label: 'Agents', id: 'agents' },
    { label: 'Compare', id: 'compare' },
    { label: 'Pricing', id: 'pricing' },
  ]

  const isLoggedIn = session !== 'loading' && session !== null

  return (
    <>
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 2rem',
        animation: 'fade-in-scale 0.5s ease both',
        background: scrolled ? 'var(--glass-bg-strong)' : 'transparent',
        backdropFilter: scrolled ? 'blur(var(--glass-blur-strong))' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(var(--glass-blur-strong))' : 'none',
        borderBottom: scrolled ? '1px solid var(--glass-border)' : '1px solid transparent',
        boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
        transition: 'all var(--transition-smooth)',
      }}>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--accent)',
            lineHeight: 1,
            filter: 'drop-shadow(0 0 8px var(--accent-glow))',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
          }}>FZ</span>
          <span style={{
            fontFamily: 'var(--font-dm-sans), sans-serif',
            fontWeight: 700,
            fontSize: '16px',
            letterSpacing: '0.12em',
            color: 'var(--text)',
          }}>FORZE</span>
        </button>

        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          gap: '4px',
        }} className="hide-mobile">
          {navLinks.map((link, idx) => {
            const isActive = activeSection === link.id
            return (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                style={{
                  background: isActive ? 'var(--accent-soft)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--accent)' : 'var(--text-soft)',
                  transition: 'color var(--transition-fast), background var(--transition-fast)',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  position: 'relative',
                  animation: `fade-in-scale 0.4s ${0.1 + idx * 0.06}s ease both`,
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    const t = e.currentTarget
                    t.style.color = 'var(--text)'
                    t.style.background = 'var(--accent-soft)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    const t = e.currentTarget
                    t.style.color = 'var(--text-soft)'
                    t.style.background = 'transparent'
                  }
                }}
              >
                {link.label}
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    bottom: '2px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'block',
                  }} />
                )}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }} className="hide-mobile">
          {isLoggedIn ? (
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'var(--font-dm-sans), sans-serif',
                boxShadow: 'var(--shadow-accent)',
                transition: 'opacity var(--transition-fast)',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Dashboard {'->'}
            </button>
          ) : (
            <>
              <button
                onClick={() => router.push('/signin')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  color: 'var(--text-soft)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                  e.currentTarget.style.color = 'var(--text)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-soft)'
                }}
              >
                Sign in
              </button>
              <button
                onClick={() => router.push('/signup')}
                style={{
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  boxShadow: 'var(--shadow-accent)',
                  transition: 'opacity var(--transition-fast)',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                Start Validating
              </button>
            </>
          )}
        </div>

        <button
          className="show-mobile"
          onClick={() => setMobileOpen(o => !o)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0',
            cursor: 'pointer',
            color: 'var(--text)',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'border-color var(--transition-fast)',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          {mobileOpen ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
        </button>
      </nav>

      {mobileOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99,
          background: 'var(--glass-bg-strong)',
          backdropFilter: 'blur(var(--glass-blur-strong))',
          WebkitBackdropFilter: 'blur(var(--glass-blur-strong))',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* Header row */}
          <div style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontWeight: 700,
              fontSize: '16px',
              letterSpacing: '0.12em',
              color: 'var(--text)',
            }}>FORZE</span>
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Nav links */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '12px 8px',
          }}>
            {navLinks.map(link => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  padding: '16px 12px',
                  textAlign: 'left',
                  borderRadius: 'var(--radius-md)',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-soft)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* CTA buttons */}
          <div style={{
            padding: '20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flexShrink: 0,
          }}>
            {isLoggedIn ? (
              <button
                onClick={() => { setMobileOpen(false); router.push('/dashboard') }}
                style={{
                  padding: '14px 24px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  width: '100%',
                }}
              >
                Dashboard {'->'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => { setMobileOpen(false); router.push('/signup') }}
                  style={{
                    padding: '14px 24px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    width: '100%',
                    boxShadow: 'var(--shadow-accent)',
                  }}
                >
                  Start Validating Free
                </button>
                <button
                  onClick={() => { setMobileOpen(false); router.push('/signin') }}
                  style={{
                    padding: '14px 24px',
                    borderRadius: 'var(--radius-md)',
                    background: 'transparent',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    width: '100%',
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 1023px) {
          .hide-mobile { display: none !important; }
        }
        @media (min-width: 1024px) {
          .show-mobile { display: none !important; }
        }
        @media (max-width: 1023px) {
          nav { padding: 0 1rem !important; }
        }
      `}</style>
    </>
  )
}
