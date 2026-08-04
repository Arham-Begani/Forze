'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import type { Routine } from '@/lib/schemas/routine'

interface AutopilotDashboardProps {
  ventureId: string
  ventureName: string
}

interface CalendarStatusPayload {
  connected: boolean
  email: string | null
  state: 'not_connected' | 'active' | 'needs_reauth' | 'error' | 'disconnected'
  errorMessage: string | null
}

interface SettingsPayload {
  location: string | null
  default_approval_window_hours: number
  event_radar_enabled: boolean
  max_comment_replies_per_run: number
}

interface EventRow {
  id: string
  name: string
  url: string | null
  starts_at: string | null
  city: string | null
  venue: string | null
  format: string
  price_note: string | null
  why_relevant: string | null
  score: number
  conflicts: unknown
  status: string
}

interface SuggestionRow {
  id: string
  kind: string
  channel: string | null
  title: string
  body: string
  target_url: string | null
  context: Record<string, unknown>
  created_at: string
}

interface AgendaPayload {
  calendarConnected: boolean
  calendarError: string | null
  week: Array<{
    title: string
    start: string | null
    end: string | null
    allDay: boolean
    location: string | null
    isForzeCreated: boolean
  }>
  pendingApproval: Array<{
    assetId: string
    provider: string
    title: string
    publishAt: string | null
  }>
  newLeads: number
  unansweredReplies: number
}

interface AutopilotPayload {
  calendar: CalendarStatusPayload | null
  settings: SettingsPayload
  events: EventRow[]
  suggestions: SuggestionRow[]
  agenda: AgendaPayload | null
  summary: string | null
}

const ACCENT = '#C4975A'

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 16,
  background: 'var(--surface, transparent)',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--text-soft)',
  fontWeight: 700,
  marginBottom: 12,
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: ACCENT,
  borderColor: ACCENT,
  color: '#111',
  fontWeight: 700,
}

class SectionBoundary extends React.Component<
  { label: string; children: React.ReactNode },
  { failed: boolean }
> {
  constructor(props: { label: string; children: React.ReactNode }) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div style={{ ...cardStyle, color: 'var(--text-soft)', fontSize: 13 }}>
          {this.props.label} could not be displayed. The rest of Autopilot is unaffected.
        </div>
      )
    }
    return this.props.children
  }
}

function formatDateTime(value: string | null, allDay = false): string {
  if (!value) return 'No date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date'
  if (allDay) {
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  }
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCountdown(target: string | null, now: number): string {
  if (!target) return 'no scheduled time'
  const ms = new Date(target).getTime() - now
  if (!Number.isFinite(ms)) return 'no scheduled time'
  if (ms <= 0) return 'publishing now'
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  if (hours > 0) return `publishes in ${hours}h ${minutes}m`
  return `publishes in ${minutes}m`
}

function conflictCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

export function AutopilotDashboard({ ventureId, ventureName }: AutopilotDashboardProps) {
  const [data, setData] = useState<AutopilotPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [routines, setRoutines] = useState<Routine[]>([])
  const [routinesError, setRoutinesError] = useState<string | null>(null)

  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch(`/api/ventures/${ventureId}/autopilot`)
      if (res.status === 403) {
        setLoadError('Autopilot is available on Builder and above.')
        return
      }
      if (!res.ok) {
        setLoadError('Could not load Autopilot.')
        return
      }
      const payload = (await res.json().catch(() => null)) as AutopilotPayload | null
      if (!payload) {
        setLoadError('Could not read the Autopilot response.')
        return
      }
      setData(payload)
    } catch {
      setLoadError('Network error while loading Autopilot.')
    } finally {
      setLoading(false)
    }
  }, [ventureId])

  const loadRoutines = useCallback(async () => {
    setRoutinesError(null)
    try {
      const res = await fetch(`/api/ventures/${ventureId}/routines`)
      if (!res.ok) {
        setRoutinesError('Could not load routines.')
        return
      }
      const payload = (await res.json().catch(() => null)) as { routines?: Routine[] } | null
      setRoutines(payload?.routines ?? [])
    } catch {
      setRoutinesError('Network error while loading routines.')
    }
  }, [ventureId])

  useEffect(() => {
    void load()
    void loadRoutines()
  }, [load, loadRoutines])

  const connectCalendar = async () => {
    try {
      const res = await fetch('/api/integrations/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnTo: `/dashboard/venture/${ventureId}/autopilot` }),
      })
      const payload = (await res.json().catch(() => null)) as { authUrl?: string } | null
      if (payload?.authUrl) window.location.href = payload.authUrl
    } catch {
      setLoadError('Could not start the Google Calendar connection.')
    }
  }

  const scanEvents = async () => {
    setScanning(true)
    setScanError(null)
    try {
      const res = await fetch(`/api/ventures/${ventureId}/autopilot/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: unknown } | null
        setScanError(
          typeof payload?.error === 'string' ? payload.error : 'Event scan failed. Try again later.'
        )
        return
      }
      const payload = (await res.json().catch(() => null)) as { events?: EventRow[] } | null
      if (payload?.events) {
        setData((prev) => (prev ? { ...prev, events: payload.events ?? [] } : prev))
      }
    } catch {
      setScanError('Network error during the event scan.')
    } finally {
      setScanning(false)
    }
  }

  const actOnEvent = async (eventId: string, action: 'save' | 'dismiss' | 'add_to_calendar') => {
    setBusyId(eventId)
    try {
      const res = await fetch(`/api/ventures/${ventureId}/autopilot/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: unknown } | null
        setScanError(
          typeof payload?.error === 'string' ? payload.error : 'That action did not go through.'
        )
        return
      }
      if (action === 'dismiss') {
        setData((prev) =>
          prev ? { ...prev, events: prev.events.filter((row) => row.id !== eventId) } : prev
        )
      } else {
        await load()
      }
    } catch {
      setScanError('Network error.')
    } finally {
      setBusyId(null)
    }
  }

  const resolveSuggestion = async (actionId: string, status: 'done' | 'dismissed') => {
    setBusyId(actionId)
    setData((prev) =>
      prev ? { ...prev, suggestions: prev.suggestions.filter((row) => row.id !== actionId) } : prev
    )
    try {
      await fetch(`/api/ventures/${ventureId}/autopilot/suggestions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    } catch {
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const escalations = useMemo(
    () => (data?.suggestions ?? []).filter((row) => row.kind === 'comment_escalation'),
    [data]
  )
  const commentIdeas = useMemo(
    () => (data?.suggestions ?? []).filter((row) => row.kind === 'comment_suggestion'),
    [data]
  )
  const pending = data?.agenda?.pendingApproval ?? []

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-soft)' }}>Loading Autopilot...</div>
  }

  if (loadError && !data) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Autopilot</h1>
        <p style={{ color: 'var(--text-soft)', fontSize: 14 }}>{loadError}</p>
      </div>
    )
  }

  const calendarConnected = data?.calendar?.connected === true

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1080 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Autopilot</h1>
        <p style={{ color: 'var(--text-soft)', fontSize: 14, marginTop: 6 }}>
          {data?.summary
            ? data.summary
            : `What ${ventureName} is doing this week, and what needs you.`}
        </p>
      </header>

      <SectionBoundary label="Needs you now">
        <section>
          <div style={sectionTitleStyle}>Needs you now</div>
          {pending.length === 0 && escalations.length === 0 ? (
            <div style={{ ...cardStyle, color: 'var(--text-soft)', fontSize: 13 }}>
              Nothing is waiting on you. Scheduled posts appear here during their veto window.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.map((item) => (
                <div key={item.assetId} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                        {item.provider} · {formatCountdown(item.publishAt, now)}
                      </div>
                    </div>
                    <a
                      href={`/dashboard/venture/${ventureId}/campaigns`}
                      style={{ ...buttonStyle, textDecoration: 'none', whiteSpace: 'nowrap' }}
                    >
                      Review
                    </a>
                  </div>
                </div>
              ))}
              {escalations.map((item) => (
                <div key={item.id} style={cardStyle}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 6 }}>
                    {item.body}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {item.target_url && (
                      <a
                        href={item.target_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...buttonStyle, textDecoration: 'none' }}
                      >
                        Open post
                      </a>
                    )}
                    <button
                      style={buttonStyle}
                      disabled={busyId === item.id}
                      onClick={() => void resolveSuggestion(item.id, 'done')}
                    >
                      Handled
                    </button>
                    <button
                      style={buttonStyle}
                      disabled={busyId === item.id}
                      onClick={() => void resolveSuggestion(item.id, 'dismissed')}
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </SectionBoundary>

      <SectionBoundary label="This week">
        <section>
          <div style={sectionTitleStyle}>This week</div>
          {!calendarConnected ? (
            <div style={cardStyle}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                {data?.calendar?.state === 'needs_reauth'
                  ? 'Google Calendar needs to be reconnected.'
                  : 'Connect Google Calendar so Autopilot can plan around your week.'}
              </div>
              <button style={primaryButtonStyle} onClick={() => void connectCalendar()}>
                {data?.calendar?.state === 'needs_reauth' ? 'Reconnect' : 'Connect Google Calendar'}
              </button>
            </div>
          ) : (data?.agenda?.week ?? []).length === 0 ? (
            <div style={{ ...cardStyle, color: 'var(--text-soft)', fontSize: 13 }}>
              Nothing on your calendar for the next seven days.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(data?.agenda?.week ?? []).map((entry, index) => (
                <div
                  key={`${entry.title}-${entry.start}-${index}`}
                  style={{ ...cardStyle, padding: 12, display: 'flex', gap: 12 }}
                >
                  <div style={{ fontSize: 12, color: 'var(--text-soft)', minWidth: 150 }}>
                    {formatDateTime(entry.start, entry.allDay)}
                  </div>
                  <div style={{ fontSize: 14 }}>
                    {entry.title}
                    {entry.isForzeCreated && (
                      <span style={{ color: ACCENT, fontSize: 11, marginLeft: 8 }}>added by Forze</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </SectionBoundary>

      <SectionBoundary label="Events">
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={sectionTitleStyle}>Events worth your time</div>
            <button style={buttonStyle} disabled={scanning} onClick={() => void scanEvents()}>
              {scanning ? 'Scanning…' : 'Scan for events'}
            </button>
          </div>
          {scanError && (
            <div style={{ fontSize: 13, color: '#E04848', marginBottom: 10 }}>{scanError}</div>
          )}
          {(data?.events ?? []).length === 0 ? (
            <div style={{ ...cardStyle, color: 'var(--text-soft)', fontSize: 13 }}>
              No events yet. Run a scan to find conferences, meetups and demo days near you.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(data?.events ?? []).map((event) => {
                const clashes = conflictCount(event.conflicts)
                return (
                  <div key={event.id} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{event.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                          {formatDateTime(event.starts_at)}
                          {event.city ? ` · ${event.city}` : ''}
                          {event.price_note ? ` · ${event.price_note}` : ''}
                        </div>
                        {event.why_relevant && (
                          <div style={{ fontSize: 13, marginTop: 8 }}>{event.why_relevant}</div>
                        )}
                        {clashes > 0 && (
                          <div style={{ fontSize: 12, color: '#E0A048', marginTop: 8 }}>
                            Clashes with {clashes} thing{clashes === 1 ? '' : 's'} on your calendar
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-soft)', whiteSpace: 'nowrap' }}>
                        {event.score}/100
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      {event.url && (
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...buttonStyle, textDecoration: 'none' }}
                        >
                          View source
                        </a>
                      )}
                      {event.status !== 'added_to_calendar' && calendarConnected && (
                        <button
                          style={buttonStyle}
                          disabled={busyId === event.id || !event.starts_at}
                          onClick={() => void actOnEvent(event.id, 'add_to_calendar')}
                        >
                          Add to calendar
                        </button>
                      )}
                      {event.status === 'added_to_calendar' && (
                        <span style={{ fontSize: 12, color: ACCENT, alignSelf: 'center' }}>
                          On your calendar
                        </span>
                      )}
                      <button
                        style={buttonStyle}
                        disabled={busyId === event.id}
                        onClick={() => void actOnEvent(event.id, 'dismiss')}
                      >
                        Not for me
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </SectionBoundary>

      <SectionBoundary label="Comment ideas">
        <section>
          <div style={sectionTitleStyle}>Comment ideas</div>
          {commentIdeas.length === 0 ? (
            <div style={{ ...cardStyle, color: 'var(--text-soft)', fontSize: 13 }}>
              No drafted comments right now. A comment-suggestions routine fills this weekly.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {commentIdeas.map((item) => (
                <div key={item.id} style={cardStyle}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</div>
                  <div
                    style={{
                      fontSize: 13,
                      marginTop: 8,
                      padding: 10,
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {item.body}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button
                      style={buttonStyle}
                      onClick={() => void navigator.clipboard?.writeText(item.body)}
                    >
                      Copy comment
                    </button>
                    {item.target_url && (
                      <a
                        href={item.target_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...primaryButtonStyle, textDecoration: 'none' }}
                      >
                        Open discussion
                      </a>
                    )}
                    <button
                      style={buttonStyle}
                      disabled={busyId === item.id}
                      onClick={() => void resolveSuggestion(item.id, 'done')}
                    >
                      Posted
                    </button>
                    <button
                      style={buttonStyle}
                      disabled={busyId === item.id}
                      onClick={() => void resolveSuggestion(item.id, 'dismissed')}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </SectionBoundary>

      <SectionBoundary label="Running">
        <section>
          <div style={sectionTitleStyle}>Running</div>
          {routinesError ? (
            <div style={{ ...cardStyle, color: 'var(--text-soft)', fontSize: 13 }}>
              {routinesError}
            </div>
          ) : routines.length === 0 ? (
            <div style={{ ...cardStyle, color: 'var(--text-soft)', fontSize: 13 }}>
              No routines yet. Create them in Outreach to put Autopilot to work.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {routines.map((routine) => (
                <div key={routine.id} style={{ ...cardStyle, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{routine.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                        {routine.channel} · {routine.cadence} · next {formatDateTime(routine.next_run_at)}
                      </div>
                      {routine.last_error && (
                        <div style={{ fontSize: 12, color: '#E04848', marginTop: 6 }}>
                          {routine.last_error}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{routine.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </SectionBoundary>
    </div>
  )
}
