"use client"

import React, { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react'

export default function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params)
  const token = resolvedParams.token
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviteInfo, setInviteInfo] = useState<{ venture: { name: string }, role: string } | null>(null)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    async function verifyInvite() {
      try {
        const res = await fetch(`/api/invites/${token}`)
        const data = await res.json()
        if (res.ok) {
          setInviteInfo(data.invite)
        } else {
          // If unauthorized, redirect to login with callback
          if (res.status === 401) {
             router.push(`/signin?next=/invite/${token}`)
             return
          }
          setError(data.error || 'Invalid invite')
        }
      } catch (err: any) {
        setError('Failed to verify invite.')
      } finally {
        setLoading(false)
      }
    }
    verifyInvite()
  }, [token, router])

  async function handleAccept() {
    setAccepting(true)
    try {
      const res = await fetch(`/api/invites/${token}`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        router.push(`/dashboard/venture/${data.ventureId}`)
      } else {
        if (res.status === 401) {
           router.push(`/signin?next=/invite/${token}`)
           return
        }
        setError(data.error || 'Failed to accept invite')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-[var(--glass-bg)] border border-[var(--border)] rounded-2xl p-8 text-center shadow-xl"
      >
        {error ? (
          <div className="flex flex-col items-center">
            <XCircle className="text-red-500 w-16 h-16 mb-4" />
            <h1 className="text-2xl font-bold text-[var(--text)] mb-2">Invalid Invite</h1>
            <p className="text-[var(--muted)] mb-6">{error}</p>
            <button 
              onClick={() => router.push('/dashboard')}
              className="bg-[var(--nav-active)] border border-[var(--border)] text-[var(--text)] px-6 py-2 rounded-lg hover:bg-[var(--glass-bg-strong)] transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        ) : inviteInfo ? (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text)] mb-2">You've been invited!</h1>
            <p className="text-[var(--muted)] mb-8">
              You've been invited to collaborate on <strong className="text-[var(--text)]">{inviteInfo.venture.name}</strong> as an <strong className="text-[var(--text)] capitalize">{inviteInfo.role}</strong>.
            </p>
            
            <div className="w-full space-y-3">
              <button 
                onClick={handleAccept}
                disabled={accepting}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {accepting ? 'Accepting...' : 'Accept Invitation'}
                <ArrowRight size={18} />
              </button>
              <button 
                onClick={() => router.push('/dashboard')}
                className="w-full bg-transparent text-[var(--muted)] hover:text-[var(--text)] font-medium px-6 py-3 rounded-xl transition-colors"
              >
                Decline & Go to Dashboard
              </button>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  )
}