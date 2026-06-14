'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const PLATFORMS = [
  { name: 'macOS', meta: 'Apple Silicon & Intel · .dmg', accent: '#8C7A5A', glyph: 'Mac' },
  { name: 'Windows', meta: '64-bit · .msi / .exe', accent: '#5A8CA5', glyph: 'Win' },
  { name: 'Linux', meta: '.AppImage / .deb', accent: '#5A8C6E', glyph: 'Tux' },
]

const TRUST = [
  { value: 'Local-first', label: 'your data, your machine' },
  { value: 'BYOK', label: 'no middleman on AI calls' },
  { value: 'Signed', label: 'auto-updating builds' },
  { value: 'Free', label: 'while in beta' },
]

export function IdePlatforms() {
  const router = useRouter()
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
    <section id="platforms" ref={sectionRef} style={{
      padding: 'clamp(64px, 8vw, 112px) 24px',
      maxWidth: '1100px',
      margin: '0 auto',
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '48px',
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
          Get the app
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
          Download Forze IDE
        </h2>
        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '17px',
          color: 'var(--text-soft)',
          maxWidth: '560px',
          margin: '0 auto',
          lineHeight: 1.6,
        }}>
          Pick your platform, sign in once, and install. Local-first, bring-your-own-key, and free while in beta — the IDE keeps itself current from there.
        </p>
      </div>

      <div className="ide-platform-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '32px',
      }}>
        {PLATFORMS.map((p, i) => (
          <button
            key={p.name}
            onClick={() => router.push('/download')}
            style={{
              textAlign: 'left',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: `1px solid ${p.accent}30`,
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              cursor: 'pointer',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(28px)',
              transition: `opacity 0.6s ${0.1 + i * 0.1}s ease, transform 0.6s ${0.1 + i * 0.1}s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease, border-color 0.2s ease`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = `${p.accent}70`
              e.currentTarget.style.boxShadow = `0 20px 48px -12px ${p.accent}30`
              e.currentTarget.style.transform = 'translateY(-4px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = `${p.accent}30`
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--radius-md)',
              background: `${p.accent}18`,
              border: `1px solid ${p.accent}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '13px',
              fontWeight: 700,
              color: p.accent,
            }}>
              {p.glyph}
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '-0.01em',
              }}>
                {p.name}
              </div>
              <div style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '12px',
                color: 'var(--muted)',
                marginTop: '4px',
              }}>
                {p.meta}
              </div>
            </div>
            <span style={{
              marginTop: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              color: p.accent,
            }}>
              Download {'->'}
            </span>
          </button>
        ))}
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '12px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s 0.4s ease',
      }}>
        {TRUST.map((t) => (
          <div key={t.label} style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '7px',
            padding: '8px 16px',
            borderRadius: '999px',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>{t.value}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-soft)' }}>{t.label}</span>
          </div>
        ))}
      </div>

      <p style={{
        textAlign: 'center',
        marginTop: '24px',
        fontFamily: 'var(--font-dm-sans), sans-serif',
        fontSize: '13px',
        color: 'var(--muted)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s 0.5s ease',
      }}>
        You&apos;ll be asked to sign in before the download — the IDE links to your existing Forze account.
      </p>

      <style>{`
        @media (max-width: 760px) {
          .ide-platform-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
