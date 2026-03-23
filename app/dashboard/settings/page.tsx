'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { BillingPanel } from '@/components/billing/BillingPanel'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SessionData {
  userId: string
  email: string
  name: string
  plan: string
  planLabel?: string
  creditsRemaining?: number
  hasUnlimitedAccess?: boolean
}

interface ForzeSettings {
  showThoughtProcess: boolean
  streamAutoScroll: boolean
  compactMode: boolean
  defaultDepth: 'brief' | 'medium' | 'detailed'
  agentSounds: boolean
  confirmBeforeRun: boolean
  maxStreamLines: number
}

const DEFAULT_SETTINGS: ForzeSettings = {
  showThoughtProcess: true,
  streamAutoScroll: true,
  compactMode: false,
  defaultDepth: 'medium',
  agentSounds: false,
  confirmBeforeRun: false,
  maxStreamLines: 500,
}

function loadSettings(): ForzeSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem('Forze-settings')
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: ForzeSettings) {
  localStorage.setItem('Forze-settings', JSON.stringify(settings))
  window.dispatchEvent(new CustomEvent('Forze:settings-changed', { detail: settings }))
}

// ─── Themes ─────────────────────────────────────────────────────────────────────

const THEMES = [
  {
    id: 'amber', label: 'Amber', description: 'Warm & golden',
    accent: '#C07A3A', accentLight: '#D4924A',
    bg: '#faf9f6', sidebar: '#f0ede6', card: '#ffffff',
    darkBg: '#111110', darkSidebar: '#0d0d0c', darkCard: '#1a1916',
    textDark: '#1c1a16', textLight: '#ffffff',
    gradient: 'linear-gradient(135deg, #faf3e8 0%, #f5e8d0 100%)',
    gradientDark: 'linear-gradient(135deg, #1a1510 0%, #0f0d0a 100%)',
  },
  {
    id: 'ocean', label: 'Ocean', description: 'Deep & serene',
    accent: '#1A78A8', accentLight: '#2A9FD6',
    bg: '#f0f6fa', sidebar: '#e4f0f7', card: '#ffffff',
    darkBg: '#0c1318', darkSidebar: '#0a1016', darkCard: '#111b22',
    textDark: '#0d1e2a', textLight: '#ffffff',
    gradient: 'linear-gradient(135deg, #e8f4fb 0%, #d0e8f5 100%)',
    gradientDark: 'linear-gradient(135deg, #0d1a24 0%, #081018 100%)',
  },
  {
    id: 'forest', label: 'Forest', description: 'Earthy & natural',
    accent: '#2D7A50', accentLight: '#3D9E68',
    bg: '#f2f8f4', sidebar: '#e4f0e8', card: '#ffffff',
    darkBg: '#0c1510', darkSidebar: '#091209', darkCard: '#121e15',
    textDark: '#0f2016', textLight: '#ffffff',
    gradient: 'linear-gradient(135deg, #e8f5ed 0%, #d0ecda 100%)',
    gradientDark: 'linear-gradient(135deg, #0d1e12 0%, #081009 100%)',
  },
  {
    id: 'rose', label: 'Rose', description: 'Bold & expressive',
    accent: '#C43A6E', accentLight: '#E04D85',
    bg: '#fdf2f6', sidebar: '#f7e4ed', card: '#ffffff',
    darkBg: '#180c12', darkSidebar: '#12090e', darkCard: '#221018',
    textDark: '#2a0e1a', textLight: '#ffffff',
    gradient: 'linear-gradient(135deg, #fce8f2 0%, #f5d0e5 100%)',
    gradientDark: 'linear-gradient(135deg, #201018 0%, #120a10 100%)',
  },
  {
    id: 'slate', label: 'Slate', description: 'Clean & focused',
    accent: '#4A6EC8', accentLight: '#6285E0',
    bg: '#f2f5fc', sidebar: '#e4eaf7', card: '#ffffff',
    darkBg: '#0d1020', darkSidebar: '#090c18', darkCard: '#131828',
    textDark: '#0d1630', textLight: '#ffffff',
    gradient: 'linear-gradient(135deg, #eaf0fc 0%, #d5e0f8 100%)',
    gradientDark: 'linear-gradient(135deg, #111828 0%, #090e1c 100%)',
  },
  {
    id: 'violet', label: 'Violet', description: 'Creative & vivid',
    accent: '#7A4AC8', accentLight: '#9B6AE8',
    bg: '#f6f2fc', sidebar: '#ede4f7', card: '#ffffff',
    darkBg: '#110d1e', darkSidebar: '#0d0a18', darkCard: '#1a1228',
    textDark: '#1a0e30', textLight: '#ffffff',
    gradient: 'linear-gradient(135deg, #f0e8fc 0%, #e2d0f8 100%)',
    gradientDark: 'linear-gradient(135deg, #1a1028 0%, #0f0a1c 100%)',
  },
] as const

type ThemeId = typeof THEMES[number]['id']

function ThemePicker({ currentTheme, onSelect }: { currentTheme: ThemeId; onSelect: (id: ThemeId) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
      {THEMES.map((t, i) => {
        const active = currentTheme === t.id
        return (
          <motion.button
            key={t.id}
            onClick={() => onSelect(t.id)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            whileHover={{ scale: 1.03, y: -3 }}
            whileTap={{ scale: 0.97 }}
            style={{
              borderRadius: 16,
              border: active ? `2px solid ${t.accent}` : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              textAlign: 'left',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: active
                ? `0 0 0 1px ${t.accent}30, 0 8px 24px ${t.accent}30`
                : '0 2px 12px rgba(0,0,0,0.12)',
              padding: 0,
              background: 'none',
              transition: 'transform 200ms, box-shadow 200ms, border-color 200ms',
            }}
          >
            {/* ── Mini UI preview ── */}
            <div style={{
              background: t.gradient,
              height: 80,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
            }}>
              {/* Sidebar strip */}
              <div style={{
                width: 28,
                height: '100%',
                background: t.sidebar,
                borderRight: `1px solid ${t.accent}20`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 8,
                gap: 5,
                flexShrink: 0,
              }}>
                {/* Logo dot */}
                <div style={{
                  width: 10, height: 10, borderRadius: 3,
                  background: t.accent,
                  boxShadow: `0 0 6px ${t.accent}80`,
                }} />
                {[0.9, 0.6, 0.8, 0.5].map((op, j) => (
                  <div key={j} style={{
                    width: 16, height: 3, borderRadius: 2,
                    background: t.accent, opacity: op,
                  }} />
                ))}
              </div>
              {/* Content area */}
              <div style={{
                flex: 1, padding: '8px 8px 0',
                display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                {/* Top bar */}
                <div style={{
                  height: 14, borderRadius: 4,
                  background: t.card,
                  border: `1px solid ${t.accent}18`,
                  display: 'flex', alignItems: 'center', paddingLeft: 6, gap: 4,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.accent }} />
                  <div style={{ height: 3, width: '50%', borderRadius: 2, background: t.accent, opacity: 0.3 }} />
                </div>
                {/* Card rows */}
                {[1, 0.65].map((op, j) => (
                  <div key={j} style={{
                    height: 16, borderRadius: 5,
                    background: t.card,
                    border: `1px solid ${t.accent}15`,
                    opacity: op,
                    padding: '0 6px',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: t.accent, opacity: 0.7 }} />
                    <div style={{ flex: 1, height: 3, borderRadius: 2, background: t.accent, opacity: 0.2 }} />
                    <div style={{ width: '20%', height: 5, borderRadius: 3, background: t.accent, opacity: 0.6 }} />
                  </div>
                ))}
              </div>
              {/* Accent glow blob */}
              <div style={{
                position: 'absolute',
                width: 60, height: 60,
                borderRadius: '50%',
                background: t.accent,
                opacity: 0.12,
                filter: 'blur(18px)',
                right: -10, bottom: -10,
                pointerEvents: 'none',
              }} />
            </div>

            {/* ── Dark strip ── */}
            <div style={{
              background: t.gradientDark,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '0 10px',
              borderTop: `1px solid ${t.accent}25`,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.accentLight, boxShadow: `0 0 6px ${t.accentLight}` }} />
              {[0.6, 0.35, 0.5].map((op, j) => (
                <div key={j} style={{ height: 3, width: `${[30, 20, 25][j]}%`, borderRadius: 2, background: t.accentLight, opacity: op }} />
              ))}
            </div>

            {/* ── Label row ── */}
            <div style={{
              padding: '10px 12px 11px',
              background: active ? `${t.accent}10` : 'var(--glass-bg)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderTop: `1px solid ${active ? t.accent + '30' : 'var(--border)'}`,
            }}>
              {/* Color swatch */}
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                background: `linear-gradient(135deg, ${t.accent}, ${t.accentLight})`,
                boxShadow: `0 2px 8px ${t.accent}50`,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, lineHeight: 1.2,
                  color: active ? t.accent : 'var(--text)',
                }}>{t.label}</div>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>{t.description}</div>
              </div>
              {/* Active badge */}
              {active ? (
                <motion.div
                  layoutId="theme-active-check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: t.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </motion.div>
              ) : (
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: '1.5px solid var(--border)',
                  flexShrink: 0,
                }} />
              )}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

// ─── Toggle Switch ──────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, accent = 'var(--accent)' }: { checked: boolean; onChange: (v: boolean) => void; accent?: string }) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked ? accent : 'var(--border-strong)',
        border: 'none',
        cursor: 'pointer',
        padding: 2,
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        transition: 'background 200ms ease',
        boxShadow: checked ? `0 0 12px ${accent}40` : 'var(--shadow-xs)',
      }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </motion.button>
  )
}

// ─── Setting Row ────────────────────────────────────────────────────────────────

function SettingRow({ icon, title, description, children, delay = 0 }: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        padding: '18px 20px',
        borderRadius: 14,
        background: 'var(--glass-bg)',
        border: '1px solid var(--border)',
        transition: 'border-color 200ms, box-shadow 200ms',
      }}
      whileHover={{ borderColor: 'var(--border-strong)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: 'var(--accent-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: 'var(--accent)',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>{description}</div>
      </div>
      <div style={{ flexShrink: 0, marginLeft: 'auto' }}>
        {children}
      </div>
    </motion.div>
  )
}

// ─── Section Header ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, description, delay = 0 }: { icon: React.ReactNode; title: string; description: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      style={{ marginBottom: 12, marginTop: 8 }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
        <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, paddingLeft: 22 }}>{description}</p>
    </motion.div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [session, setSession] = useState<SessionData | null>(null)
  const [settings, setSettings] = useState<ForzeSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentTheme, setCurrentTheme] = useState<ThemeId>('amber')

  const THEME_IDS = THEMES.map(t => t.id)

  function applyTheme(id: ThemeId) {
    const root = document.documentElement
    THEME_IDS.forEach(t => root.classList.remove(`theme-${t}`))
    if (id !== 'amber') root.classList.add(`theme-${id}`)
    setCurrentTheme(id)
    localStorage.setItem('Forze-theme', id)
    window.dispatchEvent(new CustomEvent('Forze:theme-changed', { detail: { themeId: id } }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  useEffect(() => {
    setMounted(true)
    setSettings(loadSettings())
    const stored = (localStorage.getItem('Forze-theme') || 'amber') as ThemeId
    setCurrentTheme(stored)
    fetch('/api/auth/session')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSession(d) })
      .finally(() => setLoading(false))
  }, [])

  const update = useCallback((key: keyof ForzeSettings, value: ForzeSettings[keyof ForzeSettings]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      saveSettings(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      return next
    })
  }, [])

  if (!mounted) return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', position: 'relative' }}>

      {/* Ambient background */}
      <div style={{
        position: 'fixed',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, hsla(var(--accent-h), var(--accent-s), var(--accent-l), 0.12) 0%, transparent 70%)',
        filter: 'blur(80px)',
        top: -150,
        right: -100,
        pointerEvents: 'none',
        zIndex: 0,
        animation: 'blob-float 18s ease-in-out infinite',
      }} />

      {/* Header */}
      <motion.header
        style={{
          padding: '20px 32px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'relative',
          zIndex: 2,
          flexShrink: 0,
        }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, background: 'linear-gradient(90deg, var(--accent-glow), var(--accent), var(--accent-glow))' }} />
        <div className="flex items-center gap-3">
          <motion.button
            onClick={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--glass-bg)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text)',
              flexShrink: 0,
            }}
            whileHover={{ scale: 1.05, borderColor: 'var(--accent)' }}
            whileTap={{ scale: 0.95 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </motion.button>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              Settings
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Customize your Forze experience
            </div>
          </div>

          {/* Save indicator */}
          {mounted && (
            <AnimatePresence mode="wait">
            {saved && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 10,
                  background: 'rgba(90, 140, 110, 0.12)',
                  border: '1px solid rgba(90, 140, 110, 0.2)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#5A8C6E',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved
              </motion.div>
            )}
            </AnimatePresence>
          )}
        </div>
      </motion.header>

      {/* Content */}
      <div className="overflow-y-auto flex-1" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 24px 60px' }}>

          {/* ── Account Section ── */}
          <SectionHeader
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
            title="Account"
            description="Your profile and plan information"
          />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            style={{
              padding: '20px 24px',
              borderRadius: 16,
              background: 'var(--glass-bg-strong)',
              border: '1px solid var(--border)',
              marginBottom: 32,
              display: 'flex',
              alignItems: 'center',
              gap: 18,
            }}
          >
            {loading ? (
              <div className="flex items-center gap-4" style={{ width: '100%' }}>
                <div className="skeleton" style={{ width: 52, height: 52, borderRadius: 16 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8, borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 10, width: '55%', borderRadius: 4 }} />
                </div>
              </div>
            ) : (
              <>
                <motion.div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    flexShrink: 0,
                    boxShadow: '0 8px 24px var(--accent-glow)',
                  }}
                  whileHover={{ scale: 1.05, rotate: 2 }}
                >
                  {session?.name
                    ? session.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
                    : session?.email?.[0]?.toUpperCase() ?? '?'}
                </motion.div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                    {session?.name || 'User'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {session?.email || '—'}
                  </div>
                </div>
                <div style={{
                  padding: '5px 14px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  background: session?.hasUnlimitedAccess || (session?.plan && session.plan !== 'free') ? 'var(--accent-soft)' : 'var(--glass-bg)',
                  color: session?.hasUnlimitedAccess || (session?.plan && session.plan !== 'free') ? 'var(--accent)' : 'var(--muted)',
                  border: `1px solid ${session?.hasUnlimitedAccess || (session?.plan && session.plan !== 'free') ? 'var(--accent-glow)' : 'var(--border)'}`,
                }}>
                  {session?.planLabel || 'Free'} Plan
                </div>
              </>
            )}
          </motion.div>

          {/* ── Billing Section ── */}
          <SectionHeader
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>}
            title="Billing"
            description="Plans, credits, top-ups, and subscription management"
            delay={0.08}
          />

          <div style={{ marginBottom: 32 }}>
            <BillingPanel />
          </div>

          {/* ── Agent Behavior Section ── */}
          <SectionHeader
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>}
            title="Agent Behavior"
            description="Control how AI agents run and display results"
            delay={0.1}
          />

          <div className="flex flex-col gap-3" style={{ marginBottom: 32 }}>
            <SettingRow
              delay={0.12}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              }
              title="Show Thought Process"
              description="Display the real-time stream output and reasoning of agents while they work. Disable for cleaner results."
            >
              <Toggle checked={settings.showThoughtProcess} onChange={v => update('showThoughtProcess', v)} />
            </SettingRow>

            <SettingRow
              delay={0.16}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                </svg>
              }
              title="Auto-scroll Stream"
              description="Automatically scroll to the latest output as agents stream their responses."
            >
              <Toggle checked={settings.streamAutoScroll} onChange={v => update('streamAutoScroll', v)} />
            </SettingRow>

            <SettingRow
              delay={0.2}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              }
              title="Confirm Before Running"
              description="Show a confirmation dialog before triggering an agent run."
            >
              <Toggle checked={settings.confirmBeforeRun} onChange={v => update('confirmBeforeRun', v)} />
            </SettingRow>

            <SettingRow
              delay={0.24}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              }
              title="Default Research Depth"
              description="Set the default research intensity for Research and Full Launch modules."
            >
              <div style={{ display: 'flex', gap: 4, background: 'var(--glass-bg)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
                {(['brief', 'medium', 'detailed'] as const).map(d => (
                  <motion.button
                    key={d}
                    onClick={() => update('defaultDepth', d)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'capitalize',
                      border: 'none',
                      cursor: 'pointer',
                      background: settings.defaultDepth === d ? 'var(--accent)' : 'transparent',
                      color: settings.defaultDepth === d ? '#fff' : 'var(--muted)',
                      transition: 'background 150ms, color 150ms',
                    }}
                  >
                    {d}
                  </motion.button>
                ))}
              </div>
            </SettingRow>

            <SettingRow
              delay={0.28}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              }
              title="Max Stream Lines"
              description="Limit the number of stream output lines displayed to improve performance."
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <motion.button
                  onClick={() => update('maxStreamLines', Math.max(100, settings.maxStreamLines - 100))}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  style={stepperBtnStyle}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </motion.button>
                <span style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text)',
                  minWidth: 36,
                  textAlign: 'center',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {settings.maxStreamLines}
                </span>
                <motion.button
                  onClick={() => update('maxStreamLines', Math.min(2000, settings.maxStreamLines + 100))}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  style={stepperBtnStyle}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </motion.button>
              </div>
            </SettingRow>
          </div>

          {/* ── Appearance Section ── */}
          <SectionHeader
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg>}
            title="Appearance"
            description="Choose a theme to personalize the look and feel of Forze"
            delay={0.3}
          />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.32 }}
            style={{
              padding: '20px',
              borderRadius: 16,
              background: 'var(--glass-bg)',
              border: '1px solid var(--border)',
              marginBottom: 32,
            }}
          >
            {mounted && (
              <ThemePicker currentTheme={currentTheme} onSelect={applyTheme} />
            )}
          </motion.div>

          {/* ── Display Section ── */}
          <SectionHeader
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg>}
            title="Display"
            description="Appearance and layout preferences"
            delay={0.42}
          />

          <div className="flex flex-col gap-3" style={{ marginBottom: 32 }}>
            <SettingRow
              delay={0.44}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              }
              title="Compact Mode"
              description="Reduce spacing and padding throughout the interface for denser information display."
            >
              <Toggle checked={settings.compactMode} onChange={v => update('compactMode', v)} />
            </SettingRow>

            <SettingRow
              delay={0.48}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              }
              title="Agent Notification Sounds"
              description="Play a subtle sound when an agent completes its run."
            >
              <Toggle checked={settings.agentSounds} onChange={v => update('agentSounds', v)} />
            </SettingRow>
          </div>

          {/* ── Danger Zone ── */}
          <SectionHeader
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e05252" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
            title="Danger Zone"
            description="Irreversible actions — proceed with caution"
            delay={0.4}
          />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.42 }}
            style={{
              padding: '20px 24px',
              borderRadius: 14,
              border: '1px solid rgba(220, 38, 38, 0.2)',
              background: 'rgba(220, 38, 38, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Reset All Settings</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Restore all settings to their default values.</div>
              </div>
              <motion.button
                onClick={() => {
                  if (confirm('Reset all settings to defaults?')) {
                    setSettings(DEFAULT_SETTINGS)
                    saveSettings(DEFAULT_SETTINGS)
                    setSaved(true)
                    setTimeout(() => setSaved(false), 2000)
                  }
                }}
                whileHover={{ scale: 1.03, background: 'rgba(220, 38, 38, 0.12)' }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: '8px 18px',
                  borderRadius: 10,
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  background: 'rgba(220, 38, 38, 0.06)',
                  color: '#e05252',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Reset
              </motion.button>
            </div>

            <div style={{ borderTop: '1px solid rgba(220, 38, 38, 0.12)' }} />

            <div className="flex items-center justify-between gap-4">
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Sign Out</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>End your current session and return to the sign-in page.</div>
              </div>
              <motion.button
                onClick={async () => {
                  const res = await fetch('/api/auth/signout', { method: 'POST' })
                  if (!res.ok) {
                    const err = await res.json().catch(() => null)
                    alert(err?.error || 'Unable to sign out. Please try again.')
                    return
                  }

                  router.replace('/signin')
                  router.refresh()
                }}
                whileHover={{ scale: 1.03, background: 'rgba(220, 38, 38, 0.12)' }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: '8px 18px',
                  borderRadius: 10,
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  background: 'rgba(220, 38, 38, 0.06)',
                  color: '#e05252',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Sign Out
              </motion.button>
            </div>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              marginTop: 40,
              padding: '16px 0',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <div style={{
              width: 14,
              height: 14,
              background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            }} />
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
              Forze v2 — Silicon Workforce
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// ─── Shared Styles ──────────────────────────────────────────────────────────────

const stepperBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--glass-bg)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text)',
}
