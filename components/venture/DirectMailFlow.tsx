'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Loader2, Send, AlertCircle, CheckCircle, Mail, Sparkles } from 'lucide-react'
import { deriveFirstNameFromEmail } from '@/lib/auto-name'

interface DirectMailFlowProps {
  ventureId: string
  ventureName: string
  ventureDescription?: string
  onComplete: (campaignId: string) => void
  onCancel: () => void
}

type GmailUI = {
  connected: boolean
  email: string | null
  canSend: boolean
  state: 'not_connected' | 'active' | 'needs_reauth' | 'error' | 'disconnected'
  errorMessage: string | null
}

interface ParsedRecipient {
  email: string
  detected: string
  override: string
}

// Accepts commas, newlines, semicolons, or whitespace between emails. Keeps
// the flow forgiving so the operator can paste from any source (sheet, notes,
// chat) without reformatting.
function extractEmails(raw: string): string[] {
  if (!raw) return []
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

export function DirectMailFlow({
  ventureId,
  ventureName,
  ventureDescription,
  onComplete,
  onCancel,
}: DirectMailFlowProps) {
  const [name, setName] = useState('')
  const [rawEmails, setRawEmails] = useState('')
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('Hi {{firstName}},\n\n')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendErrors, setSendErrors] = useState<string[]>([])
  const [gmail, setGmail] = useState<GmailUI | null>(null)
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [showOverrides, setShowOverrides] = useState(false)
  const [generatingAi, setGeneratingAi] = useState(false)

  const recipients: ParsedRecipient[] = useMemo(() => {
    const emails = dedupe(extractEmails(rawEmails).map((e) => e.toLowerCase()))
    return emails.map((email) => {
      const detected = deriveFirstNameFromEmail(email)
      return { email, detected, override: overrides[email] ?? '' }
    })
  }, [rawEmails, overrides])

  const validCount = recipients.filter((r) => /.+@.+\..+/.test(r.email)).length

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/integrations/gmail')
        if (!res.ok) return
        const d = await res.json() as GmailUI
        if (!cancelled) {
          setGmail({
            connected: Boolean(d.connected),
            email: d.email ?? null,
            canSend: Boolean(d.canSend),
            state: d.state ?? (d.connected ? 'active' : 'not_connected'),
            errorMessage: d.errorMessage ?? null,
          })
        }
      } catch {
        // Non-fatal — banner below will show "not connected".
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleConnectGmail = async () => {
    setConnectingGmail(true)
    setError(null)
    try {
      const res = await fetch('/api/integrations/gmail', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to start Gmail connect')
      const { authUrl } = await res.json() as { authUrl: string }
      const popup = window.open(authUrl, 'gmail-oauth', 'width=500,height=700')
      if (!popup) { window.location.href = authUrl; return }
      const poll = window.setInterval(async () => {
        if (popup.closed) {
          window.clearInterval(poll)
          setConnectingGmail(false)
          try {
            const st = await fetch('/api/integrations/gmail')
            if (st.ok) {
              const d = await st.json() as GmailUI
              setGmail({
                connected: Boolean(d.connected),
                email: d.email ?? null,
                canSend: Boolean(d.canSend),
                state: d.state ?? (d.connected ? 'active' : 'not_connected'),
                errorMessage: d.errorMessage ?? null,
              })
            }
          } catch { /* non-fatal */ }
        }
      }, 500)
    } catch (e) {
      setConnectingGmail(false)
      setError(e instanceof Error ? e.message : 'Failed to connect Gmail')
    }
  }

  const handleGenerateWithAi = async () => {
    setGeneratingAi(true)
    setError(null)
    try {
      const exampleLeads = recipients.slice(0, 3).map((recipient) => ({
        firstName: recipient.override.trim() || recipient.detected || deriveFirstNameFromEmail(recipient.email),
      }))

      const descFallback =
        (ventureDescription && ventureDescription.trim()) ||
        (ventureName && ventureName.trim()) ||
        'Direct mail outreach'

      const res = await fetch(`/api/ventures/${ventureId}/direct-mail/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ventureDescription: descFallback,
          targetAudience: 'existing contacts, customers, and warm leads',
          exampleLeads,
        }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string | { formErrors?: string[]; fieldErrors?: Record<string, string[]> } }
        let msg = 'Failed to generate email'
        if (typeof d.error === 'string') {
          msg = d.error
        } else if (d.error) {
          msg =
            d.error.formErrors?.[0] ??
            Object.values(d.error.fieldErrors ?? {})[0]?.[0] ??
            msg
        }
        throw new Error(msg)
      }

      const { generated } = await res.json() as {
        generated: {
          subject_line: string
          subject_line_variants: string[]
          email_body: string
          email_body_variants: string[]
        }
      }

      setSubject(generated.subject_line)
      setBody(generated.email_body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate email')
    } finally {
      setGeneratingAi(false)
    }
  }

  const handleSend = async () => {
    setError(null)
    setSendErrors([])

    if (!name.trim()) { setError('Give this send a name so you can find it later'); return }
    if (validCount === 0) { setError('Add at least one valid email address'); return }
    if (!subject.trim()) { setError('Subject line is required'); return }
    if (!body.trim()) { setError('Email body is required'); return }
    if (!gmail?.connected || !gmail.canSend) {
      setError('Connect your Gmail account before sending')
      return
    }

    setLoading(true)
    try {
      // 1. Create the campaign with data_source='direct' so the list view can
      //    distinguish it from cold outreach.
      const createRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venture_id: ventureId,
          name: name.trim(),
          data_source: 'direct',
        }),
      })
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({}))
        throw new Error(typeof d.error === 'string' ? d.error : 'Failed to create campaign')
      }
      const { campaign } = await createRes.json() as { campaign: { id: string } }

      // 2. Upload recipients — server re-derives names for any blanks so the
      //    client-side preview and server state can't drift.
      const payloadRecipients = recipients
        .filter((r) => /.+@.+\..+/.test(r.email))
        .map((r) => ({
          email: r.email,
          ...(r.override.trim() ? { first_name: r.override.trim() } : {}),
        }))

      const leadsRes = await fetch(`/api/campaigns/${campaign.id}/direct-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: payloadRecipients }),
      })
      if (!leadsRes.ok) {
        const d = await leadsRes.json().catch(() => ({}))
        throw new Error(typeof d.error === 'string' ? d.error : 'Failed to add recipients')
      }

      // 3. Send via the same route cold campaigns use — tracking pixel,
      //    click-tracking links, and unsubscribe footer are injected there.
      const sendRes = await fetch(`/api/campaigns/${campaign.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectLineApproved: subject,
          emailBodyApproved: body,
          sendMode: 'all_now',
        }),
      })
      const sendBody = await sendRes.json().catch(() => ({})) as {
        error?: string
        sentCount?: number
        errors?: string[]
      }
      if (!sendRes.ok) {
        if (Array.isArray(sendBody.errors)) setSendErrors(sendBody.errors)
        throw new Error(typeof sendBody.error === 'string' ? sendBody.error : 'Failed to send')
      }
      if ((sendBody.sentCount ?? 0) === 0) {
        if (Array.isArray(sendBody.errors)) setSendErrors(sendBody.errors)
        throw new Error('No emails were sent — see details below')
      }

      onComplete(campaign.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const insertToken = (token: string) => {
    setBody((prev) => prev + token)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={onCancel} className="text-[var(--muted)] hover:text-[var(--text)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Direct Mail</h2>
          <p className="text-sm text-[var(--muted)]">{ventureName} — mail anyone, no cold-outreach assumptions</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>
      )}

      <div className="flex flex-col gap-5">
        {/* Gmail banner */}
        {gmail === null ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--muted)] flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Checking Gmail connection…
          </div>
        ) : gmail.state === 'needs_reauth' || !gmail.connected ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="mt-0.5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {gmail.state === 'needs_reauth' ? 'Gmail needs to be reconnected' : 'Connect your Gmail to send'}
                </p>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Emails are sent from your own Gmail address via OAuth. Nothing goes out until you connect.
                </p>
              </div>
            </div>
            <button
              onClick={handleConnectGmail}
              disabled={connectingGmail}
              className="self-start flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {connectingGmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              {connectingGmail ? 'Opening Google…' : (gmail.state === 'needs_reauth' ? 'Reconnect Gmail' : 'Connect Gmail')}
            </button>
          </div>
        ) : !gmail.canSend ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-center gap-2 text-sm text-[var(--text-soft)]">
            <AlertCircle size={16} className="text-amber-500 shrink-0" />
            Gmail is connected ({gmail.email}) but the daily send limit has been reached.
          </div>
        ) : (
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 flex items-center gap-2 text-sm text-[var(--text-soft)]">
            <CheckCircle size={16} className="text-green-500 shrink-0" />
            Sending from <span className="font-medium text-[var(--text)]">{gmail.email}</span>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">Send name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. April user update"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        {/* Recipients */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-sm font-medium text-[var(--text-soft)]">
              Recipients {validCount > 0 && (
                <span className="ml-1 text-xs font-normal text-[var(--muted)]">({validCount} detected)</span>
              )}
            </label>
            {recipients.length > 0 && (
              <button
                onClick={() => setShowOverrides((v) => !v)}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {showOverrides ? 'Hide names' : 'Review auto-detected names'}
              </button>
            )}
          </div>
          <textarea
            value={rawEmails}
            onChange={(e) => setRawEmails(e.target.value)}
            placeholder={'Paste emails — one per line, comma, or space separated.\nalex@example.com\njordan.park@acme.io\nsam_taylor+list@studio.co'}
            rows={6}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 font-mono text-xs text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none resize-y"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Names are detected automatically from the email — you only need to type the address.
          </p>

          {showOverrides && recipients.length > 0 && (
            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
              {recipients.map((r) => (
                <div key={r.email} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className="flex-1 font-mono text-[var(--text-soft)] truncate">{r.email}</span>
                  <span className="text-[var(--muted)]">→</span>
                  <input
                    type="text"
                    value={r.override || r.detected}
                    onChange={(e) => setOverrides((prev) => ({ ...prev, [r.email]: e.target.value }))}
                    className="w-32 rounded border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subject */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-[var(--text-soft)]">Subject line *</label>
            <button
              type="button"
              onClick={handleGenerateWithAi}
              disabled={generatingAi}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
            >
              {generatingAi ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generatingAi ? 'Generating...' : 'Generate with AI'}
            </button>
          </div>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. A quick update from the team"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        {/* Body */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">Message *</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none resize-y"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--muted)]">Insert:</span>
            <button
              type="button"
              onClick={() => insertToken('{{firstName}}')}
              className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <Sparkles size={10} className="inline mr-1" />{'{{firstName}}'}
            </button>
            <span className="text-xs text-[var(--muted)]">— replaced with the auto-detected (or overridden) name per recipient.</span>
          </div>
        </div>

        {sendErrors.length > 0 && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
            <p className="text-xs font-semibold text-red-500 mb-1.5">Send errors ({sendErrors.length})</p>
            <ul className="max-h-32 overflow-y-auto space-y-1 text-xs text-red-500/90 font-mono">
              {sendErrors.slice(0, 10).map((msg, i) => (
                <li key={i} className="truncate">{msg}</li>
              ))}
              {sendErrors.length > 10 && <li>…and {sendErrors.length - 10} more</li>}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--nav-active)] transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <button
            onClick={handleSend}
            disabled={loading || !gmail?.connected || !gmail.canSend || validCount === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {loading ? 'Sending...' : `Send to ${validCount || 0} recipient${validCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
