'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IdeNav } from './IdeNav'
import { IdeHero } from './IdeHero'
import { IdeProblem } from './IdeProblem'
import { IdeShowcase } from './IdeShowcase'
import { IdeCapabilities } from './IdeCapabilities'
import { IdeHowItWorks } from './IdeHowItWorks'
import { IdePlatforms } from './IdePlatforms'
import { IdeFaq } from './IdeFaq'

// ─── Final CTA ──────────────────────────────────────────────────────────────

function IdeCTA() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.2 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={sectionRef} style={{
      padding: 'clamp(80px, 10vw, 128px) 24px',
      position: 'relative',
      overflow: 'hidden',
      textAlign: 'center',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, hsla(28,62%,42%,0.10) 0%, hsla(210,50%,50%,0.05) 100%)',
        animation: 'gradient-shift 8s ease infinite',
      }} />
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, hsla(28,62%,42%,0.18) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: '700px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--accent-soft)',
          border: '1px solid hsla(28,62%,42%,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '15px',
          fontWeight: 700,
          color: 'var(--accent)',
          animation: 'glow-pulse 3s ease-in-out infinite',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
        }}>
          IDE
        </div>

        <h2 style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(32px, 5vw, 56px)',
          fontWeight: 800,
          color: 'var(--text)',
          margin: 0,
          letterSpacing: '-0.025em',
          lineHeight: 1.1,
        }}>
          Stop tab-switching.<br />
          <span style={{
            background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Start shipping.
          </span>
        </h2>

        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '18px',
          color: 'var(--text-soft)',
          margin: 0,
          lineHeight: 1.6,
        }}>
          One local-first window to code, command your AI agents, deploy, track, and build in public. Your machine, your keys, your data.
        </p>

        <button
          onClick={() => router.push('/download')}
          style={{
            padding: '16px 40px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: '17px',
            fontWeight: 700,
            fontFamily: 'var(--font-dm-sans), sans-serif',
            boxShadow: '0 12px 36px -4px hsla(28,62%,42%,0.45)',
            transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
            letterSpacing: '0.01em',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-3px)'
            e.currentTarget.style.boxShadow = '0 20px 48px -4px hsla(28,62%,42%,0.55)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 12px 36px -4px hsla(28,62%,42%,0.45)'
          }}
        >
          Download Forze — Free {'->'}
        </button>

        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '13px',
          color: 'var(--muted)',
          margin: 0,
        }}>
          macOS · Windows · Linux · local-first · free while in beta
        </p>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────

function IdeFooter() {
  const router = useRouter()

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  const columns: { title: string; links: { label: string; onClick: () => void }[] }[] = [
    {
      title: 'Forze IDE',
      links: [
        { label: 'Editor', onClick: () => scrollTo('editor') },
        { label: 'AI agents', onClick: () => scrollTo('ai-control') },
        { label: 'Features', onClick: () => scrollTo('capabilities') },
        { label: 'Download', onClick: () => router.push('/download') },
      ],
    },
    {
      title: 'Forze',
      links: [
        { label: 'Web app', onClick: () => router.push('/') },
        { label: 'Pricing', onClick: () => router.push('/pricing') },
        { label: 'Sign in', onClick: () => router.push('/signin') },
        { label: 'Dashboard', onClick: () => router.push('/dashboard') },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', onClick: () => router.push('/legal/privacy-policy') },
        { label: 'Terms of Service', onClick: () => router.push('/legal/terms-of-service') },
        { label: 'Refund Policy', onClick: () => router.push('/pricing') },
      ],
    },
  ]

  const socials = [
    { label: '𝕏', href: 'https://x.com/ArhamBegani', title: 'Twitter/X' },
    { label: 'in', href: 'https://www.linkedin.com/in/arhambegani/', title: 'LinkedIn' },
  ]

  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--sidebar)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '64px 24px 32px' }}>
        <div className="ide-footer-grid" style={{
          display: 'grid',
          gridTemplateColumns: '2fr repeat(3, 1fr)',
          gap: '40px',
          marginBottom: '56px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px', color: 'var(--accent)', filter: 'drop-shadow(0 0 6px var(--accent-glow))' }}>⬡</span>
              <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontWeight: 700, fontSize: '16px', letterSpacing: '0.12em', color: 'var(--text)' }}>FORZE</span>
              <span style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--accent)',
                padding: '2px 7px',
                borderRadius: '999px',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-glow)',
              }}>IDE</span>
            </div>
            <p style={{
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontSize: '14px',
              color: 'var(--muted)',
              lineHeight: 1.65,
              margin: 0,
              maxWidth: '280px',
            }}>
              The Sovereign OS for startup founders. Code, run AI agents, deploy, and grow — from one local-first desktop window.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {socials.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  title={s.title}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--text-soft)',
                    textDecoration: 'none',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                    e.currentTarget.style.color = 'var(--accent)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--text-soft)'
                  }}
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {columns.map(col => (
            <div key={col.title} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '4px',
              }}>
                {col.title}
              </div>
              {col.links.map(link => (
                <button
                  key={link.label}
                  onClick={link.onClick}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    fontSize: '14px',
                    color: 'var(--muted)',
                    textAlign: 'left',
                    transition: 'color var(--transition-fast)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                >
                  {link.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={{
          paddingTop: '24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '13px', color: 'var(--muted)' }}>
            © 2026 Forze. All rights reserved.
          </span>
          <span style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '12px',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span style={{ color: 'var(--accent)' }}>⬡</span>
            Made for founders, by founders · forze.in
          </span>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .ide-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }
        }
        @media (max-width: 480px) {
          .ide-footer-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
      `}</style>
    </footer>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function IdeLandingPage() {
  const [scrollPct, setScrollPct] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const pct = el.scrollTop / (el.scrollHeight - el.clientHeight)
      setScrollPct(Math.min(pct * 100, 100))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: 'var(--font-dm-sans), sans-serif',
      overflowX: 'hidden',
    }}>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 200,
        height: '2px',
        width: `${scrollPct}%`,
        background: 'linear-gradient(to right, var(--accent), #e8a04e)',
        transition: 'width 0.1s linear',
        pointerEvents: 'none',
        boxShadow: '0 0 8px hsla(28,62%,42%,0.6)',
      }} />
      <IdeNav />
      <IdeHero />
      <IdeProblem />
      <IdeShowcase />
      <IdeCapabilities />
      <IdeHowItWorks />
      <IdePlatforms />
      <IdeFaq />
      <IdeCTA />
      <IdeFooter />
    </div>
  )
}
