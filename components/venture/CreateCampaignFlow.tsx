'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Send, Upload, CheckCircle, AlertCircle, Mail } from 'lucide-react'

interface CreateCampaignFlowProps {
  ventureId: string
  ventureName: string
  ventureDescription?: string
  onComplete: (campaignId: string) => void
  onCancel: () => void
}

interface FormData {
  name: string
  description: string
  csvText: string
  generatedSubject: string
  generatedBody: string
  subjectVariants: string[]
  bodyVariants: string[]
}

type Step = 1 | 2 | 3 | 4 | 5

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <React.Fragment key={step}>
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
              step < current
                ? 'bg-[var(--accent)] text-white'
                : step === current
                ? 'bg-[var(--accent)] text-white ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]'
                : 'bg-[var(--border)] text-[var(--muted)]'
            }`}
          >
            {step < current ? <CheckCircle size={14} /> : step}
          </div>
          {step < total && (
            <div className={`h-px flex-1 transition-all ${step < current ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// RFC-4180-ish line splitter: honors double-quoted fields so values like
// "Acme, Inc." survive as one column instead of being split on the comma.
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i += 1 } // escaped quote
        else inQuotes = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields.map((s) => s.trim())
}

function parseCSV(text: string): Array<{ first_name: string; email: string; company?: string; job_title?: string }> {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []

  // Check if first line looks like a header
  const firstLine = lines[0].toLowerCase()
  const hasHeader = firstLine.includes('email') || firstLine.includes('name')
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map((line) => {
    const parts = splitCsvLine(line)
    return {
      first_name: parts[0] || 'Friend',
      email: parts[1] ?? '',
      company: parts[2] || undefined,
      job_title: parts[3] || undefined,
    }
  }).filter((l) => l.email.includes('@'))
}

export function CreateCampaignFlow({
  ventureId,
  ventureName,
  ventureDescription,
  onComplete,
  onCancel,
}: CreateCampaignFlowProps) {
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendErrors, setSendErrors] = useState<string[]>([])
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [parsedLeads, setParsedLeads] = useState<ReturnType<typeof parseCSV>>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedBody, setSelectedBody] = useState('')
  type GmailUI = {
    connected: boolean
    email: string | null
    canSend: boolean
    state: 'not_connected' | 'active' | 'needs_reauth' | 'error' | 'disconnected'
    errorMessage: string | null
  }
  const [gmail, setGmail] = useState<GmailUI | null>(null)
  const [uploadSummary, setUploadSummary] = useState<{ created: number; duplicates: number; invalid: number } | null>(null)
  const [connectingGmail, setConnectingGmail] = useState(false)
  // Delivery settings — all executed by the outreach cron when deferred.
  const [sendMode, setSendMode] = useState<'all_now' | 'staggered'>('all_now')
  const [dailyCap, setDailyCap] = useState(50)
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledTime, setScheduledTime] = useState('') // datetime-local value
  const [enableFollowups, setEnableFollowups] = useState(true)
  const [followupDelayDays, setFollowupDelayDays] = useState(3)
  const [maxFollowups, setMaxFollowups] = useState(2)
  const [autoEnroll, setAutoEnroll] = useState(false)
  // Lead source: pasted/uploaded CSV, or the venture's own CRM pool
  // (landing-page captures) enrolled via /leads/from-crm.
  type CrmLeadRow = {
    id: string
    email: string
    name: string | null
    status: string
    source: string
    company: string | null
    alreadyEnrolled: boolean
  }
  const [leadSource, setLeadSource] = useState<'csv' | 'crm' | 'scout'>('csv')
  const [crmLeads, setCrmLeads] = useState<CrmLeadRow[] | null>(null)
  const [selectedCrmIds, setSelectedCrmIds] = useState<Set<string>>(new Set())

  // AI Lead Scout state — ICP draft (editable) then web-search candidates.
  type ScoutCandidate = {
    kind: 'person' | 'company' | 'community'
    name: string
    company: string | null
    role: string | null
    sourceUrl: string
    email: string | null
    whyRelevant: string
    confidence: 'high' | 'medium' | 'low'
  }
  const [icpText, setIcpText] = useState('')
  const [icpLoading, setIcpLoading] = useState(false)
  const [scouting, setScouting] = useState(false)
  const [scoutCandidates, setScoutCandidates] = useState<ScoutCandidate[] | null>(null)
  const [scoutSummary, setScoutSummary] = useState('')
  const [selectedScoutIdx, setSelectedScoutIdx] = useState<Set<number>>(new Set())

  const loadIcpDraft = async (cid: string) => {
    setIcpLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${cid}/scout-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'icp' }),
      })
      const d = await res.json().catch(() => ({})) as { icp?: string; error?: string }
      if (!res.ok) throw new Error(typeof d.error === 'string' ? d.error : 'Failed to draft your customer profile')
      setIcpText(d.icp ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to draft your customer profile')
    } finally {
      setIcpLoading(false)
    }
  }

  const runScout = async () => {
    if (!campaignId || icpText.trim().length < 40) {
      setError('Describe your ideal customer in at least a few sentences first.')
      return
    }
    setScouting(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/scout-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'scout', icp: icpText.trim() }),
      })
      const d = await res.json().catch(() => ({})) as {
        candidates?: ScoutCandidate[]
        searchSummary?: string
        error?: string
      }
      if (!res.ok) throw new Error(typeof d.error === 'string' ? d.error : 'Lead scout failed')
      const candidates = d.candidates ?? []
      setScoutCandidates(candidates)
      setScoutSummary(d.searchSummary ?? '')
      // Preselect only email-reachable candidates — the others can't receive
      // a campaign email and are shown as research targets.
      setSelectedScoutIdx(new Set(candidates.map((c, i) => (c.email ? i : -1)).filter((i) => i >= 0)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lead scout failed')
    } finally {
      setScouting(false)
    }
  }

  const loadCrmLeads = async (cid: string) => {
    setCrmLeads(null)
    try {
      const res = await fetch(`/api/campaigns/${cid}/leads/from-crm`)
      if (!res.ok) throw new Error('Failed to load your leads')
      const d = await res.json() as { leads: CrmLeadRow[] }
      const rows = d.leads ?? []
      setCrmLeads(rows)
      // Preselect everything not already in the campaign.
      setSelectedCrmIds(new Set(rows.filter((l) => !l.alreadyEnrolled).map((l) => l.id)))
    } catch (e) {
      setCrmLeads([])
      setError(e instanceof Error ? e.message : 'Failed to load your leads')
    }
  }
  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    csvText: '',
    generatedSubject: '',
    generatedBody: '',
    subjectVariants: [],
    bodyVariants: [],
  })

  const update = (key: keyof FormData, value: string | string[]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // Refresh Gmail status whenever we hit the review step so a just-completed
  // OAuth round-trip reflects without a full reload.
  useEffect(() => {
    if (step !== 5) return
    let cancelled = false
    const fallback: GmailUI = {
      connected: false, email: null, canSend: false,
      state: 'not_connected', errorMessage: null,
    }
    ;(async () => {
      try {
        const res = await fetch('/api/integrations/gmail')
        if (!res.ok) { if (!cancelled) setGmail(fallback); return }
        const d = await res.json() as GmailUI
        if (!cancelled) setGmail({
          connected: Boolean(d.connected),
          email: d.email ?? null,
          canSend: Boolean(d.canSend),
          state: d.state ?? (d.connected ? 'active' : 'not_connected'),
          errorMessage: d.errorMessage ?? null,
        })
      } catch {
        if (!cancelled) setGmail(fallback)
      }
    })()
    return () => { cancelled = true }
  }, [step])

  const handleConnectGmail = async () => {
    setConnectingGmail(true)
    setError(null)
    try {
      const res = await fetch('/api/integrations/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnTo: window.location.pathname }),
      })
      if (!res.ok) throw new Error('Failed to start Gmail connect')
      const { authUrl } = await res.json() as { authUrl: string }
      // Full-page redirect, NOT a popup. Google's OAuth pages set
      // Cross-Origin-Opener-Policy: same-origin, which severs the popup handle so
      // `popup.closed` can't be read ("COOP would block the window.closed call")
      // and the flow hangs. The callback returns the user here (returnTo) and the
      // on-mount status fetch reflects the new connection.
      window.location.href = authUrl
    } catch (e) {
      setConnectingGmail(false)
      setError(e instanceof Error ? e.message : 'Failed to connect Gmail')
    }
  }

  const handleStep1 = async () => {
    if (!form.name.trim()) { setError('Campaign name is required'); return }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venture_id: ventureId, name: form.name, description: form.description }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed to create campaign') }
      const { campaign } = await res.json() as { campaign: { id: string } }
      setCampaignId(campaign.id)
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create campaign')
    } finally {
      setLoading(false)
    }
  }

  const handleStep3 = () => {
    const parsed = parseCSV(form.csvText)
    if (parsed.length === 0) { setError('No valid leads found. Format: firstName,email,company'); return }
    setParsedLeads(parsed)
    setError(null)
    setStep(4)
  }

  const handleGenerateEmail = async () => {
    if (!campaignId) return
    setLoading(true)
    setError(null)
    try {
      const exampleLeads = parsedLeads.slice(0, 3).map((l) => ({
        firstName: l.first_name,
        company: l.company,
        jobTitle: l.job_title,
      }))

      // Zod requires ventureDescription.min(1). Parent passes '' when the venture
      // has no research.positioning, so use `||` not `??` and fall back through
      // name → a generic label that still satisfies the schema.
      const descFallback =
        (ventureDescription && ventureDescription.trim()) ||
        (ventureName && ventureName.trim()) ||
        'Early-stage venture'

      const res = await fetch(`/api/campaigns/${campaignId}/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ventureDescription: descFallback,
          targetAudience: (form.description && form.description.trim()) || 'business owners and decision makers',
          exampleLeads,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as {
          error?: string | { formErrors?: string[]; fieldErrors?: Record<string, string[]> }
        }
        // Zod .flatten() errors come back as { fieldErrors, formErrors }; stringify them.
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
      const { generated } = await res.json() as { generated: { subject_line: string; subject_line_variants: string[]; email_body: string; email_body_variants: string[] } }
      update('generatedSubject', generated.subject_line)
      update('generatedBody', generated.email_body)
      update('subjectVariants', generated.subject_line_variants)
      update('bodyVariants', generated.email_body_variants)
      setSelectedSubject(generated.subject_line)
      setSelectedBody(generated.email_body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Email generation failed')
    } finally {
      setLoading(false)
    }
  }

  const isDeferredSend = scheduleEnabled || sendMode === 'staggered'

  const handleSend = async () => {
    if (!campaignId) return
    if (!selectedSubject || !selectedBody) { setError('Please generate or write an email first'); return }
    if (!gmail?.connected) {
      setError('Connect your Gmail account before sending.')
      return
    }
    // Immediate blasts need send headroom right now; deferred sends are
    // executed by the cron, which checks the daily limit at send time.
    if (!isDeferredSend && !gmail.canSend) {
      setError('Gmail daily send limit reached — schedule the send or try tomorrow.')
      return
    }
    if (scheduleEnabled && !scheduledTime) {
      setError('Pick a date and time for the scheduled send.')
      return
    }
    setLoading(true)
    setError(null)
    setSendErrors([])
    try {
      // Upload/enroll leads first (both paths are idempotent server-side —
      // duplicate-email leads are de-duped by the UNIQUE index from
      // migration 016). Safe to retry.
      if (leadSource === 'crm') {
        const enrollRes = await fetch(`/api/campaigns/${campaignId}/leads/from-crm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadIds: [...selectedCrmIds] }),
        })
        if (!enrollRes.ok) {
          const d = await enrollRes.json().catch(() => ({}))
          throw new Error(typeof d.error === 'string' ? d.error : 'Failed to enroll leads')
        }
        const enrollBody = await enrollRes.json().catch(() => ({})) as {
          enrolled?: number
          duplicatesSkipped?: number
        }
        setUploadSummary({
          created: enrollBody.enrolled ?? 0,
          duplicates: enrollBody.duplicatesSkipped ?? 0,
          invalid: 0,
        })
      } else {
        const leadsRes = await fetch(`/api/campaigns/${campaignId}/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads: parsedLeads }),
        })
        if (!leadsRes.ok) {
          const d = await leadsRes.json().catch(() => ({}))
          throw new Error(typeof d.error === 'string' ? d.error : 'Failed to upload leads')
        }
        const leadsBody = await leadsRes.json().catch(() => ({})) as {
          leadsCreated?: number
          duplicatesSkipped?: number
          invalidEmails?: string[]
        }
        setUploadSummary({
          created: leadsBody.leadsCreated ?? 0,
          duplicates: leadsBody.duplicatesSkipped ?? 0,
          invalid: (leadsBody.invalidEmails ?? []).length,
        })
      }

      // Send campaign — deferred sends (schedule/drip) return 202 and are
      // executed by the outreach cron; immediate sends return counts.
      const sendRes = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectLineApproved: selectedSubject,
          emailBodyApproved: selectedBody,
          sendMode,
          ...(sendMode === 'staggered' ? { dailyCap } : {}),
          ...(scheduleEnabled && scheduledTime
            ? { scheduledTime: new Date(scheduledTime).toISOString() }
            : {}),
          enableFollowups,
          followupDelayHours: Math.max(1, followupDelayDays * 24),
          maxFollowups,
          autoEnroll,
        }),
      })

      const sendBody = await sendRes.json().catch(() => ({})) as {
        error?: string
        code?: string
        status?: string
        sentCount?: number
        failedCount?: number
        errors?: string[]
      }

      if (!sendRes.ok) {
        if (Array.isArray(sendBody.errors) && sendBody.errors.length > 0) {
          setSendErrors(sendBody.errors)
        }
        throw new Error(
          typeof sendBody.error === 'string'
            ? sendBody.error
            : 'Failed to send campaign'
        )
      }

      // Deferred: the cron owns delivery from here.
      if (sendBody.status === 'scheduled') {
        onComplete(campaignId)
        return
      }

      // 2xx with 0 sent shouldn't happen after the 502 change, but guard anyway.
      if ((sendBody.sentCount ?? 0) === 0) {
        if (Array.isArray(sendBody.errors)) setSendErrors(sendBody.errors)
        throw new Error('No emails were sent. See details below.')
      }

      onComplete(campaignId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send campaign')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={onCancel} className="text-[var(--muted)] hover:text-[var(--text)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">New Campaign</h2>
          <p className="text-sm text-[var(--muted)]">{ventureName}</p>
        </div>
      </div>

      <StepIndicator current={step} total={5} />

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>
      )}

      {/* Step 1: Name + Description */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="mb-1 text-base font-semibold text-[var(--text)]">Name your campaign</h3>
            <p className="text-sm text-[var(--muted)]">Give it a descriptive name so you can track it later</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">Campaign name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Gym Owners Q2 Outreach"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">Target audience (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="e.g. Independent gym owners with 1-5 locations looking to grow membership"
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none resize-none"
            />
          </div>
          <button
            onClick={handleStep1}
            disabled={loading || !form.name.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Data source */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="mb-1 text-base font-semibold text-[var(--text)]">Data source</h3>
            <p className="text-sm text-[var(--muted)]">How will you find your leads?</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { id: 'scout' as const, label: 'AI Lead Finder', desc: 'Forze searches the web for prospects matching your customer profile', available: true },
              { id: 'crm' as const, label: 'Your captured leads', desc: 'People who signed up on your landing page', available: true },
              { id: 'csv' as const, label: 'CSV Upload', desc: 'Paste or upload your own list', available: true },
              { id: 'linkedin' as const, label: 'LinkedIn', desc: 'Coming soon', available: false },
            ].map((source) => (
              <button
                key={source.id}
                disabled={!source.available}
                onClick={() => {
                  if (!source.available) return
                  if (source.id === 'crm') {
                    setLeadSource('crm')
                    if (campaignId) void loadCrmLeads(campaignId)
                  } else if (source.id === 'scout') {
                    setLeadSource('scout')
                    if (campaignId && !icpText && !icpLoading) void loadIcpDraft(campaignId)
                  } else {
                    setLeadSource('csv')
                  }
                  setStep(3)
                }}
                className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition-all ${
                  source.available
                    ? 'border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 cursor-pointer'
                    : 'border-[var(--border)] opacity-40 cursor-not-allowed'
                }`}
              >
                <span className="font-semibold text-[var(--text)]">{source.label}</span>
                <span className="text-xs text-[var(--muted)]">{source.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 (AI Lead Finder): ICP → web-search scout → candidate picker */}
      {step === 3 && leadSource === 'scout' && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="mb-1 text-base font-semibold text-[var(--text)]">AI Lead Finder</h3>
            <p className="text-sm text-[var(--muted)]">
              Confirm who you&apos;re looking for, then Forze searches the web for real prospects. Emails are only included when they&apos;re publicly listed — everything is marked unverified.
            </p>
          </div>

          {scoutCandidates === null ? (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">Your ideal customer</label>
                {icpLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-6 text-sm text-[var(--muted)]">
                    <Loader2 size={14} className="animate-spin" />
                    Drafting a customer profile from your venture…
                  </div>
                ) : (
                  <textarea
                    value={icpText}
                    onChange={(e) => setIcpText(e.target.value)}
                    rows={6}
                    placeholder="Who buys this? Their role, company type, the pain that makes them buy, and where they hang out online."
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none resize-y"
                  />
                )}
                <p className="mt-1 text-xs text-[var(--muted)]">Edit freely — the sharper the profile, the better the prospects. Each search uses one of your weekly Lead Scout runs.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--nav-active)] transition-colors"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
                <button
                  onClick={runScout}
                  disabled={scouting || icpLoading || icpText.trim().length < 40}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {scouting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {scouting ? 'Searching the web… (can take a minute)' : 'Find prospects'}
                </button>
              </div>
            </>
          ) : (
            <>
              {scoutSummary && (
                <p className="rounded-lg bg-[var(--sidebar)] px-3 py-2 text-xs text-[var(--text-soft)]">{scoutSummary}</p>
              )}
              {scoutCandidates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-[var(--muted)]">
                  No solid matches this run. Sharpen the profile and try again.
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
                  {scoutCandidates.map((c, i) => {
                    const selectable = Boolean(c.email)
                    const checked = selectedScoutIdx.has(i)
                    return (
                      <label
                        key={`${c.sourceUrl}-${i}`}
                        className={`flex items-start gap-3 px-3 py-2.5 text-sm ${selectable ? 'cursor-pointer hover:bg-[var(--nav-active)]' : ''}`}
                      >
                        <input
                          type="checkbox"
                          disabled={!selectable}
                          checked={checked}
                          onChange={() => {
                            setSelectedScoutIdx((prev) => {
                              const next = new Set(prev)
                              if (next.has(i)) next.delete(i)
                              else next.add(i)
                              return next
                            })
                          }}
                          className="mt-0.5 accent-[var(--accent)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-[var(--text)]">{c.name}</span>
                            {c.role && <span className="text-xs text-[var(--muted)]">· {c.role}</span>}
                            {c.company && c.company !== c.name && <span className="text-xs text-[var(--muted)]">· {c.company}</span>}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              c.confidence === 'high' ? 'bg-green-500/15 text-green-600 dark:text-green-400' :
                              c.confidence === 'medium' ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' :
                              'bg-[var(--border)] text-[var(--muted)]'
                            }`}>{c.confidence}</span>
                            {c.email ? (
                              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">unverified email</span>
                            ) : (
                              <span className="rounded-full bg-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--muted)]">no public email</span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--text-soft)]">{c.whyRelevant}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
                            {c.email && <span className="font-mono text-[var(--muted)]">{c.email}</span>}
                            <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline truncate max-w-[260px]">
                              {c.sourceUrl.replace(/^https?:\/\//, '').slice(0, 60)}
                            </a>
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setScoutCandidates(null); setSelectedScoutIdx(new Set()) }}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--nav-active)] transition-colors"
                >
                  <ArrowLeft size={14} />
                  Edit profile
                </button>
                <button
                  onClick={() => {
                    const selected = (scoutCandidates ?? []).filter((_, i) => selectedScoutIdx.has(i) && scoutCandidates![i].email)
                    if (selected.length === 0) { setError('Select at least one candidate with an email'); return }
                    setParsedLeads(selected.map((c) => ({
                      first_name: c.kind === 'person' ? c.name.split(/\s+/)[0] : c.name.slice(0, 60),
                      email: c.email as string,
                      company: c.company ?? (c.kind !== 'person' ? c.name : undefined),
                      job_title: c.role ?? undefined,
                    })))
                    setError(null)
                    setStep(4)
                  }}
                  disabled={[...selectedScoutIdx].filter((i) => scoutCandidates?.[i]?.email).length === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  <ArrowRight size={14} />
                  Continue ({[...selectedScoutIdx].filter((i) => scoutCandidates?.[i]?.email).length} leads)
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3 (CRM source): pick captured leads */}
      {step === 3 && leadSource === 'crm' && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="mb-1 text-base font-semibold text-[var(--text)]">Choose leads</h3>
            <p className="text-sm text-[var(--muted)]">
              Everyone your landing page captured. Selected leads get enrolled in this campaign — sends and replies update their CRM status automatically.
            </p>
          </div>

          {crmLeads === null ? (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
              <Loader2 size={14} className="animate-spin" />
              Loading your leads…
            </div>
          ) : crmLeads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-[var(--muted)]">
              No email leads captured yet. Ship your landing page and they&apos;ll appear here — or use CSV upload instead.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <span>{selectedCrmIds.size} of {crmLeads.filter((l) => !l.alreadyEnrolled).length} selectable leads chosen</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedCrmIds(new Set(crmLeads.filter((l) => !l.alreadyEnrolled).map((l) => l.id)))}
                    className="text-[var(--accent)] hover:underline"
                  >
                    Select all
                  </button>
                  <button onClick={() => setSelectedCrmIds(new Set())} className="hover:underline">
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
                {crmLeads.map((lead) => {
                  const checked = selectedCrmIds.has(lead.id)
                  return (
                    <label
                      key={lead.id}
                      className={`flex items-center gap-3 px-3 py-2.5 text-sm ${lead.alreadyEnrolled ? 'opacity-45' : 'cursor-pointer hover:bg-[var(--nav-active)]'}`}
                    >
                      <input
                        type="checkbox"
                        disabled={lead.alreadyEnrolled}
                        checked={checked && !lead.alreadyEnrolled}
                        onChange={() => {
                          setSelectedCrmIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(lead.id)) next.delete(lead.id)
                            else next.add(lead.id)
                            return next
                          })
                        }}
                        className="accent-[var(--accent)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[var(--text)]">{lead.name || lead.email}</span>
                        <span className="block truncate font-mono text-xs text-[var(--muted)]">{lead.email}</span>
                      </span>
                      <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-soft)]">
                        {lead.alreadyEnrolled ? 'enrolled' : lead.status}
                      </span>
                    </label>
                  )
                })}
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--nav-active)] transition-colors"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              onClick={() => {
                if (selectedCrmIds.size === 0) { setError('Select at least one lead'); return }
                const selected = (crmLeads ?? []).filter((l) => selectedCrmIds.has(l.id))
                setParsedLeads(selected.map((l) => ({
                  first_name: (l.name || l.email.split('@')[0] || 'Friend').split(/\s+/)[0],
                  email: l.email,
                  company: l.company ?? undefined,
                })))
                setError(null)
                setStep(4)
              }}
              disabled={selectedCrmIds.size === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <ArrowRight size={14} />
              Continue ({selectedCrmIds.size} leads)
            </button>
          </div>
        </div>
      )}

      {/* Step 3 (CSV source): Lead upload */}
      {step === 3 && leadSource === 'csv' && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="mb-1 text-base font-semibold text-[var(--text)]">Upload leads</h3>
            <p className="text-sm text-[var(--muted)]">
              Paste CSV data — one lead per line: <code className="rounded bg-[var(--border)] px-1 py-0.5 text-xs">firstName,email,company,jobTitle</code>
            </p>
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2.5 text-sm text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
            <Upload size={14} />
            Upload a .csv file
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => {
                  update('csvText', typeof reader.result === 'string' ? reader.result : '')
                }
                reader.readAsText(file)
                e.target.value = ''
              }}
            />
          </label>
          <textarea
            value={form.csvText}
            onChange={(e) => update('csvText', e.target.value)}
            placeholder={`firstName,email,company,jobTitle\nJohn,john@gymempire.com,Gym Empire,Owner\nSarah,sarah@fitnesshub.com,Fitness Hub,CMO`}
            rows={10}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 font-mono text-xs text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none resize-y"
          />
          {form.csvText && (
            <p className="text-xs text-[var(--muted)]">
              Parsed: {parseCSV(form.csvText).length} valid leads
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--nav-active)] transition-colors"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              onClick={handleStep3}
              disabled={!form.csvText.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Upload size={14} />
              Continue ({parseCSV(form.csvText).length} leads)
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Email generation */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="mb-1 text-base font-semibold text-[var(--text)]">Generate email</h3>
            <p className="text-sm text-[var(--muted)]">AI will write a personalized cold email based on your venture</p>
          </div>

          {!form.generatedSubject ? (
            <button
              onClick={handleGenerateEmail}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--accent)] py-8 text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {loading ? 'Generating...' : 'Generate Email with AI'}
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">Subject line</label>
                <input
                  type="text"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                />
                {form.subjectVariants.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {form.subjectVariants.map((v, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedSubject(v)}
                        className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                      >
                        Variant {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-soft)]">Email body</label>
                <textarea
                  value={selectedBody}
                  onChange={(e) => setSelectedBody(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none resize-y"
                />
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Use <code className="rounded bg-[var(--border)] px-1">{'{{firstName}}'}</code>,{' '}
                  <code className="rounded bg-[var(--border)] px-1">{'{{company}}'}</code> for personalization
                </p>
              </div>
              <button
                onClick={handleGenerateEmail}
                disabled={loading}
                className="flex items-center gap-1.5 self-start rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--nav-active)] disabled:opacity-50"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Regenerate
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--nav-active)] transition-colors"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              onClick={() => { if (selectedSubject && selectedBody) { setError(null); setStep(5) } else setError('Please generate an email first') }}
              disabled={!selectedSubject || !selectedBody}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <ArrowRight size={14} />
              Review & Send
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Review + Send */}
      {step === 5 && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="mb-1 text-base font-semibold text-[var(--text)]">Review & Send</h3>
            <p className="text-sm text-[var(--muted)]">Ready to send {parsedLeads.length} emails via Gmail</p>
          </div>

          {/* Gmail connection banner — blocks send when not connected. */}
          {gmail === null ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--muted)] flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Checking Gmail connection…
            </div>
          ) : gmail.state === 'needs_reauth' ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="mt-0.5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">Gmail needs to be reconnected</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Google no longer accepts your stored credentials{gmail.email ? ` for ${gmail.email}` : ''}. Reconnect to resume sending — your campaigns and leads are safe.
                  </p>
                </div>
              </div>
              <button
                onClick={handleConnectGmail}
                disabled={connectingGmail}
                className="self-start flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {connectingGmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                {connectingGmail ? 'Opening Google…' : 'Reconnect Gmail'}
              </button>
            </div>
          ) : !gmail.connected ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="mt-0.5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">Connect your Gmail to send</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Campaigns send from your Gmail address via OAuth. No emails will go out until you connect.
                  </p>
                </div>
              </div>
              <button
                onClick={handleConnectGmail}
                disabled={connectingGmail}
                className="self-start flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {connectingGmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                {connectingGmail ? 'Opening Google…' : 'Connect Gmail'}
              </button>
            </div>
          ) : gmail.state === 'error' ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 flex items-start gap-2 text-sm text-[var(--text-soft)]">
              <AlertCircle size={16} className="mt-0.5 text-red-500 shrink-0" />
              <div>
                <p className="font-medium text-[var(--text)]">Gmail integration error</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">{gmail.errorMessage ?? 'Unexpected error. Try reconnecting.'}</p>
              </div>
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

          {/* Delivery settings — schedule, pace, and follow-up sequence. All
              deferred work is executed by the outreach cron. */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
            <p className="text-sm font-semibold text-[var(--text)]">Delivery</p>

            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--muted)]">When</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setScheduleEnabled(false)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${!scheduleEnabled ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-soft)] hover:border-[var(--accent)]'}`}
                >
                  Send now
                </button>
                <button
                  onClick={() => setScheduleEnabled(true)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${scheduleEnabled ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-soft)] hover:border-[var(--accent)]'}`}
                >
                  Schedule
                </button>
                {scheduleEnabled && (
                  <input
                    type="datetime-local"
                    value={scheduledTime}
                    min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--muted)]">Pace</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setSendMode('all_now')}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${sendMode === 'all_now' ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-soft)] hover:border-[var(--accent)]'}`}
                >
                  All at once
                </button>
                <button
                  onClick={() => setSendMode('staggered')}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${sendMode === 'staggered' ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-soft)] hover:border-[var(--accent)]'}`}
                >
                  Drip daily
                </button>
                {sendMode === 'staggered' && (
                  <span className="flex items-center gap-1.5 text-xs text-[var(--text-soft)]">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={dailyCap}
                      onChange={(e) => setDailyCap(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                      className="w-16 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                    />
                    emails / day
                  </span>
                )}
              </div>
              {sendMode === 'staggered' && (
                <p className="text-[11px] text-[var(--muted)]">Dripping protects your Gmail reputation — recommended for lists over ~50.</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--muted)]">Follow-ups when there&apos;s no reply</p>
                <button
                  onClick={() => setEnableFollowups(!enableFollowups)}
                  role="switch"
                  aria-checked={enableFollowups}
                  className={`relative h-5 w-9 rounded-full transition-colors ${enableFollowups ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${enableFollowups ? 'translate-x-4.5 left-0.5' : 'left-0.5'}`} style={{ transform: enableFollowups ? 'translateX(16px)' : 'translateX(0)' }} />
                </button>
              </div>
              {enableFollowups && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-soft)]">
                  Wait
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={followupDelayDays}
                    onChange={(e) => setFollowupDelayDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                    className="w-14 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  day{followupDelayDays !== 1 ? 's' : ''}, send up to
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={maxFollowups}
                    onChange={(e) => setMaxFollowups(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                    className="w-14 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  follow-up{maxFollowups !== 1 ? 's' : ''}
                </div>
              )}
              {enableFollowups && (
                <p className="text-[11px] text-[var(--muted)]">
                  AI writes each touch in the same thread. A reply instantly stops that lead&apos;s sequence.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--muted)]">Auto-enroll new landing-page leads</p>
                <button
                  onClick={() => setAutoEnroll(!autoEnroll)}
                  role="switch"
                  aria-checked={autoEnroll}
                  className={`relative h-5 w-9 rounded-full transition-colors ${autoEnroll ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                >
                  <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: autoEnroll ? 'translateX(16px)' : 'translateX(0)' }} />
                </button>
              </div>
              {autoEnroll && (
                <p className="text-[11px] text-[var(--muted)]">
                  Everyone who signs up on your landing page from now on joins this campaign automatically and gets emailed on its schedule.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">Campaign</p>
              <p className="text-sm font-semibold text-[var(--text)]">{form.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">Leads</p>
              <p className="text-sm text-[var(--text)]">{parsedLeads.length} recipients</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">Subject</p>
              <p className="text-sm text-[var(--text)]">{selectedSubject}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">Preview</p>
              <p className="mt-1 rounded-lg bg-[var(--sidebar)] px-3 py-2 text-xs text-[var(--text-soft)] whitespace-pre-wrap line-clamp-4">
                {selectedBody.slice(0, 300)}{selectedBody.length > 300 ? '...' : ''}
              </p>
            </div>
          </div>

          {uploadSummary && (uploadSummary.duplicates > 0 || uploadSummary.invalid > 0) && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--sidebar)] p-3 text-xs text-[var(--text-soft)]">
              <p className="font-semibold text-[var(--text)] mb-1">Lead upload summary</p>
              <ul className="space-y-0.5">
                <li>Added: {uploadSummary.created}</li>
                {uploadSummary.duplicates > 0 && (
                  <li>Skipped duplicates: {uploadSummary.duplicates}</li>
                )}
                {uploadSummary.invalid > 0 && (
                  <li>Rejected invalid emails: {uploadSummary.invalid}</li>
                )}
              </ul>
            </div>
          )}

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
              onClick={() => setStep(4)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--nav-active)] transition-colors"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              onClick={handleSend}
              disabled={loading || !gmail?.connected || (!isDeferredSend && !gmail.canSend)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {loading
                ? (isDeferredSend ? 'Scheduling...' : 'Sending...')
                : isDeferredSend
                ? `Schedule Campaign (${parsedLeads.length} leads)`
                : `Send Campaign (${parsedLeads.length} emails)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
