'use client'

import { createClient } from '@/lib/supabase/client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type EmailOtpType = 'email' | 'signup' | 'magiclink' | 'recovery' | 'invite' | 'email_change'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const didRunRef = useRef(false)
  const [message, setMessage] = useState('Completing sign in...')
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading')

  useEffect(() => {
    if (didRunRef.current) return
    didRunRef.current = true

    let active = true

    async function finishAuth() {
      const supabase = createClient()
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type') as EmailOtpType | null
      const email = searchParams.get('email')
      const token = searchParams.get('token')

      try {
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          })
          if (error) throw error
        } else if (email && token) {
          const { error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'email',
          })
          if (error) throw error
        } else {
          await new Promise(resolve => setTimeout(resolve, 250))
          const { data, error } = await supabase.auth.getSession()
          if (error) throw error
          if (!data.session) {
            throw new Error('Missing auth token in callback URL')
          }
        }

        if (active) {
          setStatus('success')
          setMessage('You are signed in. Taking you to Forze...')
          router.replace('/dashboard')
          router.refresh()
        }
      } catch (error) {
        if (!active) return
        const rawMessage = error instanceof Error ? error.message : 'Unable to complete sign in'
        const errorMessage = isRateLimitError(rawMessage)
          ? 'That link was used too quickly or too many times. Please wait a minute and try the newest email link.'
          : rawMessage
        setStatus('error')
        setMessage(errorMessage)
      }
    }

    finishAuth()

    return () => {
      active = false
    }
  }, [router, searchParams])

  return <AuthCallbackShell message={message} status={status} />
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackShell message="Completing sign in..." status="loading" />}>
      <AuthCallbackContent />
    </Suspense>
  )
}

function AuthCallbackShell({
  message,
  status,
}: {
  message: string
  status: 'loading' | 'error' | 'success'
}) {
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        {status === 'loading' ? <div style={spinnerStyle} /> : <div style={statusBadgeStyle}>{status === 'success' ? 'Done' : 'Error'}</div>}
        <h1 style={titleStyle}>
          {status === 'error' ? 'Could not finish sign in' : status === 'success' ? 'Welcome back' : 'Authenticating'}
        </h1>
        <p style={subtitleStyle}>{message}</p>
        {status === 'error' ? (
          <div style={linkRowStyle}>
            <a href="/signin" style={linkStyle}>Try again</a>
            <a href="/signup" style={linkStyle}>Create account</a>
          </div>
        ) : (
          <a href="/dashboard" style={linkStyle}>Continue to dashboard</a>
        )}
      </div>
    </main>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: 'var(--bg)',
  padding: '24px',
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  padding: '32px 28px',
  borderRadius: 20,
  border: '1px solid var(--border)',
  background: 'var(--glass-bg-strong)',
  boxShadow: 'var(--shadow-lg)',
  textAlign: 'center',
}

const spinnerStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  margin: '0 auto 16px',
  borderRadius: '50%',
  border: '3px solid var(--border)',
  borderTopColor: 'var(--accent)',
  animation: 'spin-slow 0.8s linear infinite',
}

const statusBadgeStyle: React.CSSProperties = {
  width: 52,
  height: 52,
  margin: '0 auto 16px',
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  fontSize: 14,
  fontWeight: 700,
}

const titleStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--text)',
}

const subtitleStyle: React.CSSProperties = {
  margin: '0 0 18px',
  fontSize: 13,
  lineHeight: 1.6,
  color: 'var(--muted)',
}

const linkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
}

const linkRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  flexWrap: 'wrap',
}

function isRateLimitError(message: string): boolean {
  return /429|rate limit|too many requests|slow down/i.test(message)
}
