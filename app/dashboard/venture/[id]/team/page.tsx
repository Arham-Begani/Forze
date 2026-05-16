"use client"

import React, { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, UserPlus, Users, Trash2, Mail, Shield, Copy, Check, AlertCircle } from 'lucide-react'

interface Invite {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
  inviteUrl?: string
  token?: string
}

export default function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  const ventureId = resolvedParams.id

  const [invites, setInvites] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('editor')
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)
  const [lastEmailSent, setLastEmailSent] = useState<boolean | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch(`/api/ventures/${ventureId}/invites`)
      if (res.ok) {
        const data = await res.json()
        setInvites(data.invites || [])
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Failed to load invites (${res.status})`)
      }
    } catch (err) {
      setError('Network error loading invites')
    } finally {
      setLoading(false)
    }
  }, [ventureId])

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setError('')
    setSuccessMsg('')
    setLastInviteUrl(null)
    setLastEmailSent(null)

    try {
      const res = await fetch(`/api/ventures/${ventureId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invite')
      }

      setLastInviteUrl(data.inviteUrl || null)
      setLastEmailSent(Boolean(data.emailSent))

      if (data.emailSent) {
        setSuccessMsg(`Invite emailed to ${email}.`)
      } else {
        setSuccessMsg(
          `Invite created. Email transport not configured — copy the link below and share it manually.`
        )
      }

      setEmail('')
      fetchInvites()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setInviting(false)
    }
  }

  async function handleRevoke(inviteId: string) {
    if (!confirm('Revoke this invite? The link will stop working immediately.')) return
    setError('')
    try {
      const res = await fetch(
        `/api/ventures/${ventureId}/invites?inviteId=${encodeURIComponent(inviteId)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to revoke invite')
      }
      setInvites(prev => prev.filter(i => i.id !== inviteId))
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(curr => (curr === key ? null : curr)), 1600)
    } catch {
      /* clipboard blocked — user can select manually */
    }
  }

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] p-4 sm:p-8">
      <div className="max-w-4xl mx-auto w-full">
        <button
          onClick={() => router.push(`/dashboard/venture/${ventureId}`)}
          className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Venture
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text)] flex items-center gap-3">
            <Users className="text-blue-500" />
            Team &amp; Collaborators
          </h1>
          <p className="text-[var(--muted)] mt-2">
            Invite teammates to collaborate on this venture. They&apos;ll receive an email with an
            accept link. Invited members use their own credits when running modules.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <div className="bg-[var(--glass-bg)] border border-[var(--border)] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
                <UserPlus size={18} />
                Invite Teammate
              </h2>

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text)] focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="colleague@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--muted)] mb-1">Role</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as 'admin' | 'editor' | 'viewer')}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text)] focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="admin">Admin — full access</option>
                    <option value="editor">Editor — run modules, edit</option>
                    <option value="viewer">Viewer — read only</option>
                  </select>
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {successMsg && (
                  <p className="text-green-500 text-sm bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                    {successMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <UserPlus size={16} />
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
              </form>

              {lastInviteUrl && (
                <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="text-xs font-medium text-[var(--muted)] mb-2 flex items-center gap-1">
                    <Mail size={12} /> Shareable invite link {lastEmailSent ? '(also emailed)' : '(email not sent — share manually)'}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={lastInviteUrl}
                      onFocus={e => e.currentTarget.select()}
                      className="flex-1 bg-transparent text-xs text-[var(--text)] outline-none truncate"
                    />
                    <button
                      onClick={() => copy(lastInviteUrl, 'last')}
                      className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--glass-bg-strong)] transition-colors"
                    >
                      {copiedKey === 'last' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedKey === 'last' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            <div className="bg-[var(--glass-bg)] border border-[var(--border)] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
                <Mail size={18} />
                Pending Invites
              </h2>

              {loading ? (
                <p className="text-[var(--muted)]">Loading…</p>
              ) : invites.length === 0 ? (
                <div className="text-center py-8 text-[var(--muted)] border-2 border-dashed border-[var(--border)] rounded-lg">
                  No pending invites.
                </div>
              ) : (
                <div className="space-y-3">
                  {invites.map(invite => (
                    <div
                      key={invite.id}
                      className="flex flex-col gap-3 p-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[var(--text)] font-medium truncate">{invite.email}</p>
                          <p className="text-xs text-[var(--muted)] capitalize flex items-center gap-1 mt-1">
                            <Shield size={12} /> {invite.role}
                            <span className="mx-1">•</span>
                            Expires {new Date(invite.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRevoke(invite.id)}
                          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={12} /> Revoke
                        </button>
                      </div>
                      {invite.inviteUrl && (
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={invite.inviteUrl}
                            onFocus={e => e.currentTarget.select()}
                            className="flex-1 bg-transparent text-xs text-[var(--muted)] outline-none truncate"
                          />
                          <button
                            onClick={() => copy(invite.inviteUrl!, invite.id)}
                            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--glass-bg-strong)] transition-colors"
                          >
                            {copiedKey === invite.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedKey === invite.id ? 'Copied' : 'Copy link'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
