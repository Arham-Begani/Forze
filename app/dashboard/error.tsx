'use client'

// Route-level error boundary for the entire /dashboard segment.
//
// Next.js renders this in place of a crashed page WITHOUT unmounting the
// dashboard layout — so the sidebar, venture switcher and navigation keep
// working while only the broken feature shows a recoverable card. This is the
// safety net behind the "one feature failing must never take the app down" rule
// in CLAUDE.md: an unexpected throw in any module/page degrades to this instead
// of a white screen.

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface for logs/monitoring; never swallow silently.
    console.error('[dashboard] feature error boundary caught:', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          textAlign: 'center',
          background: 'var(--card-solid, var(--glass-bg))',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '32px 28px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            margin: '0 auto 18px',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
          This feature hit a snag
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 22px' }}>
          Something went wrong loading this part of the workspace. The rest of Forze is
          still working — try again, or head back to your dashboard.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{
              padding: '9px 18px',
              borderRadius: 9,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Try again
          </button>
          <a
            href="/dashboard"
            style={{
              padding: '9px 18px',
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Back to dashboard
          </a>
        </div>

        {error?.digest && (
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 18, fontFamily: 'var(--font-mono, monospace)' }}>
            Ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
