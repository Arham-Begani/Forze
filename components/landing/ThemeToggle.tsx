'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'Forze-dark-mode'

function readInitialDark(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
  } catch {
    // localStorage blocked (private mode, embedded iframe, etc.) — fall through
  }
  return false
}

function applyDark(next: boolean) {
  if (next) document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
}

export function ThemeToggle({ variant = 'compact' }: { variant?: 'compact' | 'wide' }) {
  const [mounted, setMounted] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const initial = readInitialDark()
    setDark(initial)
    applyDark(initial)
    setMounted(true)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    applyDark(next)
    try { window.localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* ignore */ }
  }

  if (variant === 'wide') {
    return (
      <button
        onClick={toggle}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          width: '100%',
          padding: '14px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'transparent',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          fontSize: '15px',
          fontWeight: 500,
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}
      >
        <span>{mounted && dark ? 'Light mode' : 'Dark mode'}</span>
        <ToggleIcon dark={mounted && dark} />
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      style={{
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        color: 'var(--text-soft)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        flexShrink: 0,
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
      <ToggleIcon dark={mounted && dark} />
    </button>
  )
}

function ToggleIcon({ dark }: { dark: boolean }) {
  return (
    <span style={{ position: 'relative', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Sun (visible in dark mode — tap to go light) */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: dark ? 1 : 0,
          transform: dark ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.6)',
          transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      {/* Moon (visible in light mode — tap to go dark) */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: dark ? 0 : 1,
          transform: dark ? 'rotate(90deg) scale(0.6)' : 'rotate(0deg) scale(1)',
          transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </span>
  )
}
