'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  Routine,
  RoutineCadence,
  RoutineChannel,
} from '@/lib/schemas/routine'
import { TIMEZONE_OPTIONS } from '@/lib/schemas/routine'
import type { Campaign } from '@/lib/schemas/campaign'

interface RoutinesPanelProps {
  ventureId: string
  // Pre-loaded by the parent page; lets the create form's campaign picker
  // populate without an extra round-trip.
  campaigns: Campaign[]
}

const CADENCE_LABEL: Record<RoutineCadence, string> = {
  every_3_days: 'Every 3 days',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

const CHANNEL_LABEL: Record<RoutineChannel, string> = {
  gmail: 'Gmail',
  instagram: 'Instagram',
}

export function RoutinesPanel({ ventureId, campaigns }: RoutinesPanelProps) {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'create'>('list')

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/ventures/${ventureId}/routines`)
      if (!res.ok) {
        setError('Failed to load routines')
        return
      }
      const data = (await res.json()) as { routines: Routine[] }
      setRoutines(data.routines ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [ventureId])

  useEffect(() => {
    void load()
  }, [load])

  const onCreated = (created: Routine) => {
    setRoutines((prev) => [created, ...prev])
    setView('list')
  }

  const onTogglePause = async (routine: Routine) => {
    const target = routine.status === 'active' ? 'paused' : 'active'
    // Optimistic flip — revert if the PATCH fails.
    setRoutines((prev) =>
      prev.map((r) => (r.id === routine.id ? { ...r, status: target } : r))
    )
    try {
      const res = await fetch(
        `/api/ventures/${ventureId}/routines/${routine.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: target }),
        }
      )
      if (!res.ok) throw new Error('patch failed')
      const data = (await res.json()) as { routine: Routine }
      setRoutines((prev) =>
        prev.map((r) => (r.id === routine.id ? data.routine : r))
      )
    } catch {
      setRoutines((prev) =>
        prev.map((r) => (r.id === routine.id ? routine : r))
      )
    }
  }

  const onDelete = async (routine: Routine) => {
    if (!confirm(`Delete routine "${routine.name}"? Past runs are kept.`)) return
    const prev = routines
    setRoutines((p) => p.filter((r) => r.id !== routine.id))
    try {
      const res = await fetch(
        `/api/ventures/${ventureId}/routines/${routine.id}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('delete failed')
    } catch {
      setRoutines(prev)
    }
  }

  if (loading) {
    return <RoutinesSkeleton />
  }

  if (view === 'create') {
    return (
      <CreateRoutineForm
        ventureId={ventureId}
        campaigns={campaigns}
        onCreated={onCreated}
        onCancel={() => setView('list')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Routines</h2>
          <p className="text-sm text-[var(--muted)]">
            Auto-fire emails or social posts on a fixed cadence — content is generated fresh from this venture every run.
          </p>
        </div>
        <button
          onClick={() => setView('create')}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          New routine
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--text-soft)]">
          {error}
        </div>
      )}

      {routines.length === 0 ? (
        <EmptyState onCreate={() => setView('create')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--sidebar)]">
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-soft)]">Routine</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-soft)]">Channel</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-soft)]">Cadence</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-soft)]">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-soft)]">Next run</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--text-soft)]">Runs</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--text-soft)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {routines.map((r) => (
                <RoutineRow
                  key={r.id}
                  routine={r}
                  onTogglePause={() => onTogglePause(r)}
                  onDelete={() => onDelete(r)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RoutineRow({
  routine,
  onTogglePause,
  onDelete,
}: {
  routine: Routine
  onTogglePause: () => void
  onDelete: () => void
}) {
  const isActive = routine.status === 'active'
  return (
    <tr className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--nav-active)]">
      <td className="px-4 py-3">
        <div className="font-medium text-[var(--text)]">{routine.name}</div>
        {routine.last_error && (
          <div className="mt-1 max-w-xs truncate text-xs text-red-500" title={routine.last_error}>
            ⚠ {routine.last_error}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--text-soft)]">{CHANNEL_LABEL[routine.channel]}</td>
      <td className="px-4 py-3 text-[var(--text-soft)]">{CADENCE_LABEL[routine.cadence]}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
            isActive
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-[var(--border)] text-[var(--text-soft)]'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isActive ? 'bg-green-500' : 'bg-[var(--muted)]'
            }`}
          />
          {isActive ? 'Active' : routine.status === 'paused' ? 'Paused' : 'Archived'}
        </span>
      </td>
      <td className="px-4 py-3 text-[var(--text-soft)]">{formatRelative(routine.next_run_at)}</td>
      <td className="px-4 py-3 text-right font-mono text-[var(--text-soft)]">{routine.run_count}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onTogglePause}
            className="text-xs font-medium text-[var(--text-soft)] hover:text-[var(--accent)]"
          >
            {isActive ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={onDelete}
            className="text-xs font-medium text-[var(--muted)] hover:text-red-500"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
      <p className="text-sm font-medium text-[var(--text-soft)]">No routines yet</p>
      <p className="max-w-md text-xs text-[var(--muted)]">
        Set a cadence and Forze will auto-generate fresh outreach from this venture's context — no manual sends, no approvals.
      </p>
      <button
        onClick={onCreate}
        className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
      >
        Create first routine
      </button>
    </div>
  )
}

// ─── Create form ─────────────────────────────────────────────────────────────

function CreateRoutineForm({
  ventureId,
  campaigns,
  onCreated,
  onCancel,
}: {
  ventureId: string
  campaigns: Campaign[]
  onCreated: (r: Routine) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<RoutineChannel>('gmail')
  const [cadence, setCadence] = useState<RoutineCadence>('weekly')
  const [campaignId, setCampaignId] = useState<string>('')
  const [angleHint, setAngleHint] = useState('')
  // Stored as "HH:MM" string so the native <input type="time"> binds cleanly.
  // Default 09:00 — most outreach lands well in the morning.
  const [sendTime, setSendTime] = useState<string>('09:00')
  // Default to the browser's IANA timezone; fall back to UTC if Intl can't
  // tell us. The user can override via the dropdown.
  const [timezone, setTimezone] = useState<string>(() => {
    if (typeof Intl !== 'undefined') {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      } catch {
        return 'UTC'
      }
    }
    return 'UTC'
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If the auto-detected tz isn't in the curated dropdown, surface it as an
  // extra option so the user keeps the value they're already on instead of
  // being silently switched to UTC.
  const timezoneOptions = useMemo(() => {
    if (TIMEZONE_OPTIONS.some((o) => o.value === timezone)) return TIMEZONE_OPTIONS
    return [{ value: timezone, label: `${timezone} (auto-detected)` }, ...TIMEZONE_OPTIONS]
  }, [timezone])

  // Filter to non-archived, non-direct campaigns — direct mail is one-off
  // and doesn't fit the recurring model.
  const eligibleCampaigns = useMemo(
    () =>
      campaigns.filter(
        (c) => c.status !== 'archived' && c.data_source !== 'direct'
      ),
    [campaigns]
  )

  // Default the campaign picker to the first eligible campaign once we know
  // the user picked the gmail channel and we have options.
  useEffect(() => {
    if (channel === 'gmail' && !campaignId && eligibleCampaigns.length > 0) {
      setCampaignId(eligibleCampaigns[0].id)
    }
  }, [channel, campaignId, eligibleCampaigns])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required')
      return
    }
    if (channel === 'gmail' && !campaignId) {
      setError('Pick a campaign for the Gmail routine to send to')
      return
    }

    const [hourPart, minutePart] = sendTime.split(':')
    const sendHour = Math.max(0, Math.min(23, Number(hourPart) || 0))
    const sendMinute = Math.max(0, Math.min(59, Number(minutePart) || 0))

    setSubmitting(true)
    try {
      const res = await fetch(`/api/ventures/${ventureId}/routines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          channel,
          cadence,
          campaign_id: channel === 'gmail' ? campaignId : null,
          angle_hint: angleHint.trim() || null,
          send_hour: sendHour,
          send_minute: sendMinute,
          timezone,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const message =
          (body && typeof body.error === 'string' && body.error) ||
          'Failed to create routine'
        setError(message)
        return
      }
      const data = (await res.json()) as { routine: Routine }
      onCreated(data.routine)
    } catch {
      setError('Network error — try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <button
          type="button"
          onClick={onCancel}
          className="mb-3 text-sm text-[var(--text-soft)] hover:text-[var(--accent)]"
        >
          ← Back to routines
        </button>
        <h2 className="text-lg font-semibold text-[var(--text)]">New routine</h2>
        <p className="text-sm text-[var(--muted)]">
          Pick a channel and cadence — content is auto-generated from this venture each fire.
        </p>
      </div>

      <Field label="Routine name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Weekly drip — investor list"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          maxLength={120}
          required
        />
      </Field>

      <Field label="Channel">
        <div className="flex gap-2">
          <ChannelChip
            active={channel === 'gmail'}
            onClick={() => setChannel('gmail')}
            label="Gmail"
            sub="Sends one personalized email per fire to a campaign's leads."
          />
          <ChannelChip
            active={channel === 'instagram'}
            onClick={() => setChannel('instagram')}
            label="Instagram"
            sub="Queues a fresh feed post via your connected IG account."
          />
        </div>
      </Field>

      {channel === 'gmail' && (
        <Field label="Linked campaign">
          {eligibleCampaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted)]">
              No eligible campaigns in this venture yet — create one in the Cold Outreach tab first.
            </div>
          ) : (
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            >
              {eligibleCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <Field label="Cadence">
        <div className="flex gap-2">
          {(['every_3_days', 'weekly', 'monthly'] as RoutineCadence[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCadence(c)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                cadence === c
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-soft)] hover:text-[var(--text)]'
              }`}
            >
              {CADENCE_LABEL[c]}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="Send time"
        hint="Routines fire at this exact time each cadence, in the timezone you pick below."
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <input
            type="time"
            step={60}
            value={sendTime}
            onChange={(e) => setSendTime(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] sm:w-40"
            required
          />
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] sm:flex-1"
          >
            {timezoneOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </Field>

      <Field
        label="Creative direction (optional)"
        hint="Free-text hint for the AI — angle, tone, theme. e.g. 'Lead with the latency problem.'"
      >
        <textarea
          value={angleHint}
          onChange={(e) => setAngleHint(e.target.value)}
          rows={3}
          maxLength={400}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
      </Field>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-soft)] hover:text-[var(--text)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || (channel === 'gmail' && eligibleCampaigns.length === 0)}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create routine'}
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
    </label>
  )
}

function ChannelChip({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean
  onClick: () => void
  label: string
  sub: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
          : 'border-[var(--border)] hover:border-[var(--text-soft)]'
      }`}
    >
      <span
        className={`text-sm font-semibold ${
          active ? 'text-[var(--accent)]' : 'text-[var(--text)]'
        }`}
      >
        {label}
      </span>
      <span className="text-xs text-[var(--muted)]">{sub}</span>
    </button>
  )
}

function RoutinesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-28 rounded bg-[var(--border)] animate-pulse" />
          <div className="h-3 w-64 rounded bg-[var(--border)]/60 animate-pulse" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-[var(--border)] animate-pulse" />
      </div>
      <div className="rounded-xl border border-[var(--border)]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--border)] last:border-0 px-4 py-4"
          >
            <div className="h-4 flex-1 rounded bg-[var(--border)]/60 animate-pulse" />
            <div className="h-4 w-20 rounded bg-[var(--border)]/60 animate-pulse" />
            <div className="h-4 w-20 rounded bg-[var(--border)]/60 animate-pulse" />
            <div className="h-4 w-12 rounded bg-[var(--border)]/60 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  try {
    const target = new Date(iso).getTime()
    const now = Date.now()
    const diffMs = target - now
    const abs = Math.abs(diffMs)
    const minutes = Math.round(abs / 60_000)
    const hours = Math.round(abs / 3_600_000)
    const days = Math.round(abs / 86_400_000)

    const future = diffMs > 0
    if (minutes < 1) return 'now'
    if (minutes < 60) return future ? `in ${minutes}m` : `${minutes}m ago`
    if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`
    if (days < 60) return future ? `in ${days}d` : `${days}d ago`
    const months = Math.round(days / 30)
    return future ? `in ${months}mo` : `${months}mo ago`
  } catch {
    return iso
  }
}
