'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import type { IdeOs, IdePlatformKey } from '@/lib/ide-release'
import { ThemeToggle } from '../landing/ThemeToggle'

export interface DownloadItem {
  key: IdePlatformKey
  label: string
  os: IdeOs
  arch: string
  ext: string
  available: boolean
}

interface DownloadClientProps {
  version: string | null
  pubDate: string | null
  items: DownloadItem[]
  // False until IDE_MANIFEST_URL is wired — drives the "coming soon" notice.
  configured: boolean
}

// Per-OS visual treatment, matched to the IDE landing page.
const OS_STYLE: Record<IdeOs, { glyph: string; accent: string }> = {
  macos: { glyph: 'Mac', accent: '#8C7A5A' },
  windows: { glyph: 'Win', accent: '#5A8CA5' },
  linux: { glyph: 'Tux', accent: '#5A8C6E' },
}

const TRUST = [
  { value: 'Local-first', label: 'your data, your machine' },
  { value: 'BYOK', label: 'keyless or your own key' },
  { value: 'Signed', label: 'auto-updating builds' },
  { value: 'Free', label: 'while in beta' },
]

// Best-effort OS guess from the browser. Apple Silicon vs Intel can't be told
// apart from the UA reliably, so on macOS we default the primary CTA to Apple
// Silicon (the overwhelming majority of new Macs) and surface Intel below.
function detectPrimaryKey(): IdePlatformKey | null {
  if (typeof navigator === 'undefined') return null
  const uaData = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData
  const platform = (uaData?.platform || navigator.platform || '').toLowerCase()
  const ua = navigator.userAgent.toLowerCase()

  if (platform.includes('win') || ua.includes('windows')) return 'windows-x86_64'
  if (platform.includes('mac') || ua.includes('mac os') || ua.includes('macintosh')) {
    return 'darwin-aarch64'
  }
  if (platform.includes('linux') || ua.includes('linux')) return 'linux-x86_64'
  return null
}

export function DownloadClient({ version, pubDate, items, configured }: DownloadClientProps) {
  const [primaryKey, setPrimaryKey] = useState<IdePlatformKey | null>(null)

  useEffect(() => {
    setPrimaryKey(detectPrimaryKey())
  }, [])

  const primary = useMemo(
    () => items.find((i) => i.key === primaryKey) ?? null,
    [items, primaryKey]
  )
  // Everything that isn't the detected primary, for the "other platforms" row.
  const others = useMemo(
    () => items.filter((i) => i.key !== primary?.key),
    [items, primary]
  )

  const releasedOn = useMemo(() => {
    if (!pubDate) return null
    const t = new Date(pubDate).getTime()
    if (!Number.isFinite(t) || t <= 0) return null
    return new Date(t).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }, [pubDate])

  const hasVersion = Boolean(version && version !== '0.0.0')

  return (
    <main style={{
      position: 'relative',
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: 'var(--font-dm-sans), sans-serif',
      overflow: 'hidden',
    }}>
      {/* Ambient background */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute',
          top: '-8%',
          right: '-8%',
          width: '560px',
          height: '560px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, hsla(28,62%,42%,0.14) 0%, transparent 70%)',
          animation: 'blob-float 14s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-12%',
          left: '-10%',
          width: '640px',
          height: '640px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, hsla(210,50%,50%,0.07) 0%, transparent 70%)',
          animation: 'blob-float 18s ease-in-out infinite reverse',
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, var(--muted) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.07,
        }} />
      </div>

      {/* Header */}
      <header style={{
        position: 'relative',
        zIndex: 2,
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}>
        <Link href="/ide" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--accent)',
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
        </Link>
        <ThemeToggle />
      </header>

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: '640px',
        margin: '0 auto',
        padding: '40px 24px 88px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '999px',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '12px',
          color: 'var(--text-soft)',
          animation: 'fade-in-scale 0.6s ease both',
        }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.6s ease-in-out infinite' }} />
          Forze IDE {hasVersion && <span style={{ color: 'var(--accent)' }}>v{version}</span>}
        </span>

        <h1 style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(34px, 6vw, 52px)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          color: 'var(--text)',
          margin: '20px 0 0',
          animation: 'fade-in-scale 0.7s 0.05s ease both',
        }}>
          Download{' '}
          <span style={{
            background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Forze IDE
          </span>
        </h1>

        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(15px, 2vw, 17px)',
          color: 'var(--text-soft)',
          lineHeight: 1.6,
          maxWidth: '460px',
          margin: '14px 0 0',
          animation: 'fade-in-scale 0.7s 0.15s ease both',
        }}>
          The Sovereign OS for startup founders. Pick your platform — it&apos;s local-first, bring-your-own-key, and keeps itself up to date after install.
        </p>

        {!configured && (
          <div style={{
            width: '100%',
            marginTop: '28px',
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-strong)',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))',
            WebkitBackdropFilter: 'blur(var(--glass-blur))',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            fontSize: '14px',
            color: 'var(--text-soft)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fade-in-scale 0.6s 0.2s ease both',
          }}>
            <span style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--accent)',
              flexShrink: 0,
            }}>SOON</span>
            No build has been published yet. Downloads light up here the moment the first release lands.
          </div>
        )}

        {/* Primary CTA — the detected platform. */}
        {primary && (
          <div style={{ width: '100%', marginTop: '32px', animation: 'card-rise 0.7s 0.25s ease both' }}>
            <PrimaryButton item={primary} />
          </div>
        )}

        {/* Other platforms. */}
        {others.length > 0 && (
          <>
            <p style={{
              alignSelf: 'flex-start',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              margin: '32px 0 12px',
            }}>
              {primary ? 'Other platforms' : 'Choose your platform'}
            </p>
            <div className="dl-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              width: '100%',
            }}>
              {others.map((item) => (
                <SecondaryCard key={item.key} item={item} />
              ))}
            </div>
          </>
        )}

        {/* Trust chips */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '10px',
          marginTop: '36px',
          animation: 'fade-in-scale 0.7s 0.4s ease both',
        }}>
          {TRUST.map((t, i) => (
            <div key={t.value} style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '999px',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              animation: `animate-float ${3 + i * 0.6}s ease-in-out ${i * 0.3}s infinite`,
            }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>{t.value}</span>
              <span style={{ fontSize: '12.5px', color: 'var(--text-soft)' }}>{t.label}</span>
            </div>
          ))}
        </div>

        <p style={{
          marginTop: '24px',
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '13px',
          color: 'var(--muted)',
        }}>
          {releasedOn ? <>Latest release · {releasedOn} · </> : null}
          <Link href="/ide" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
            See everything Forze does →
          </Link>
        </p>
      </div>

      <style>{`
        @media (max-width: 520px) {
          .dl-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  )
}

function PrimaryButton({ item }: { item: DownloadItem }) {
  const disabled = !item.available
  const os = OS_STYLE[item.os]

  if (disabled) {
    return (
      <div
        aria-disabled
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          width: '100%',
          padding: '18px 22px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          background: 'var(--glass-bg)',
          color: 'var(--muted)',
          cursor: 'not-allowed',
        }}
      >
        <Glyph glyph={os.glyph} accent="var(--muted)" muted />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '17px', fontWeight: 700 }}>Coming soon</div>
          <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '12px', opacity: 0.8 }}>{item.label}</div>
        </div>
      </div>
    )
  }

  return (
    <a
      href={`/api/download/${item.key}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        width: '100%',
        padding: '18px 22px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--accent)',
        color: '#fff',
        textDecoration: 'none',
        boxShadow: 'var(--shadow-accent)',
        transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 16px 40px -6px hsla(28,62%,42%,0.5)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'var(--shadow-accent)'
      }}
    >
      <Glyph glyph={os.glyph} accent="rgba(255,255,255,0.9)" onAccent />
      <div style={{ textAlign: 'left', flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '17px', fontWeight: 700 }}>
          Download for {item.label}
        </div>
        <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '12px', opacity: 0.85 }}>
          {item.arch} · {item.ext}
        </div>
      </div>
      <span style={{ fontSize: '18px', fontWeight: 700, opacity: 0.9 }}>↓</span>
    </a>
  )
}

function SecondaryCard({ item }: { item: DownloadItem }) {
  const disabled = !item.available
  const os = OS_STYLE[item.os]

  const inner = (
    <>
      <Glyph glyph={os.glyph} accent={disabled ? 'var(--muted)' : os.accent} muted={disabled} small />
      <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '14px',
          fontWeight: 700,
          color: disabled ? 'var(--muted)' : 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {item.label}
        </div>
        <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '11px', color: 'var(--muted)' }}>
          {disabled ? 'coming soon' : `${item.arch} · ${item.ext}`}
        </div>
      </div>
    </>
  )

  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: `1px solid ${disabled ? 'var(--border)' : `${os.accent}30`}`,
    textDecoration: 'none',
  }

  if (disabled) {
    return <div aria-disabled style={{ ...baseStyle, cursor: 'not-allowed' }}>{inner}</div>
  }

  return (
    <a
      href={`/api/download/${item.key}`}
      style={{ ...baseStyle, transition: 'transform var(--transition-fast), box-shadow 0.25s ease, border-color 0.2s ease' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = `0 16px 36px -10px ${os.accent}35`
        e.currentTarget.style.borderColor = `${os.accent}70`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = `${os.accent}30`
      }}
    >
      {inner}
    </a>
  )
}

function Glyph({ glyph, accent, small, muted, onAccent }: { glyph: string; accent: string; small?: boolean; muted?: boolean; onAccent?: boolean }) {
  const size = small ? 36 : 48
  return (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: 'var(--radius-md)',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-jetbrains-mono), monospace',
      fontSize: small ? '11px' : '13px',
      fontWeight: 700,
      color: onAccent ? '#fff' : accent,
      background: onAccent ? 'rgba(255,255,255,0.16)' : muted ? 'var(--border)' : `${accent}18`,
      border: onAccent ? '1px solid rgba(255,255,255,0.25)' : `1px solid ${muted ? 'var(--border-strong)' : `${accent}35`}`,
    }}>
      {glyph}
    </div>
  )
}
