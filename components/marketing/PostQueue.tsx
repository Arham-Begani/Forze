'use client'

import { useMemo, useState } from 'react'
import type { MarketingAsset, SocialProvider } from '@/lib/marketing.shared'
import { buttonStyle, sectionLabelStyle } from './styles'

// A week view of everything scheduled across providers. Scheduling used to be
// a bare datetime-local input per draft, so there was no way to see that three
// posts were stacked on one afternoon and nothing was queued for the next week.

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Rules of thumb, not learned from this account's data. The copy below says so
// rather than implying these came from the founder's own analytics.
const SUGGESTED_SLOTS: Record<SocialProvider, string> = {
  instagram: 'Weekday late mornings and early evenings tend to land best.',
  linkedin: 'Tuesday to Thursday, 8-10am in your audience’s timezone.',
  youtube: 'Thursday and Friday afternoons, ahead of weekend watch time.',
}

const PROVIDER_COLORS: Record<SocialProvider, string> = {
  instagram: '#B26F95',
  linkedin: '#2563eb',
  youtube: '#dc2626',
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfWeek(date: Date): Date {
  const next = startOfDay(date)
  next.setDate(next.getDate() - next.getDay())
  return next
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function PostQueue({
  assets,
  onRescheduled,
}: {
  assets: MarketingAsset[]
  onRescheduled: (asset: MarketingAsset) => void
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropDay, setDropDay] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const scheduled = useMemo(
    () =>
      assets
        .filter((asset) => asset.status === 'scheduled' && asset.scheduled_for)
        .map((asset) => ({ asset, when: new Date(asset.scheduled_for as string) }))
        .filter((entry) => !Number.isNaN(entry.when.getTime()))
        .sort((a, b) => a.when.getTime() - b.when.getTime()),
    [assets]
  )

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS)),
    [weekStart]
  )

  // Anything queued outside the visible week still needs to be discoverable,
  // otherwise the calendar quietly under-reports what is scheduled.
  const outsideWeek = scheduled.filter(
    (entry) => entry.when < days[0] || entry.when >= new Date(days[6].getTime() + DAY_MS)
  )

  async function reschedule(asset: MarketingAsset, targetDay: Date) {
    const current = new Date(asset.scheduled_for as string)
    const next = new Date(targetDay)
    // Keep the time of day the founder already chose; dragging changes the
    // date only.
    next.setHours(current.getHours(), current.getMinutes(), 0, 0)

    if (next.getTime() <= Date.now()) {
      setError('Pick a future day — that slot has already passed.')
      return
    }

    setBusyId(asset.id)
    setError(null)
    try {
      const response = await fetch(
        `/api/ventures/${asset.venture_id}/marketing/assets/${asset.id}/schedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledFor: next.toISOString() }),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to reschedule')
      onRescheduled(data.asset as MarketingAsset)
    } catch (rescheduleError) {
      setError(rescheduleError instanceof Error ? rescheduleError.message : 'Failed to reschedule')
    } finally {
      setBusyId(null)
    }
  }

  const today = new Date()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={sectionLabelStyle}>Queue</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {scheduled.length} post{scheduled.length === 1 ? '' : 's'} scheduled
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * DAY_MS))}
            style={buttonStyle('secondary')}
          >
            ‹ Prev
          </button>
          <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))} style={buttonStyle('secondary')}>
            This week
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * DAY_MS))}
            style={buttonStyle('secondary')}
          >
            Next ›
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: '#dc2626', lineHeight: 1.5 }}>{error}</div>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 8,
        }}
      >
        {days.map((day, dayIndex) => {
          const entries = scheduled.filter((entry) => sameDay(entry.when, day))
          const isToday = sameDay(day, today)
          const isDropTarget = dropDay === dayIndex

          return (
            <div
              key={day.toISOString()}
              onDragOver={(event) => {
                if (!dragId) return
                event.preventDefault()
                setDropDay(dayIndex)
              }}
              onDragLeave={() => setDropDay((prev) => (prev === dayIndex ? null : prev))}
              onDrop={(event) => {
                event.preventDefault()
                setDropDay(null)
                const asset = scheduled.find((entry) => entry.asset.id === dragId)?.asset
                setDragId(null)
                if (asset) void reschedule(asset, day)
              }}
              style={{
                border: `1px ${isDropTarget ? 'dashed' : 'solid'} ${isDropTarget ? 'var(--accent)' : 'var(--border)'}`,
                background: isDropTarget ? 'var(--nav-active)' : 'var(--sidebar)',
                borderRadius: 12,
                padding: 8,
                minHeight: 110,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: isToday ? 'var(--accent)' : 'var(--muted)' }}>
                  {DAY_NAMES[day.getDay()]}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{day.getDate()}</span>
              </div>

              {entries.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.7 }}>—</div>
              ) : (
                entries.map(({ asset, when }) => (
                  <div
                    key={asset.id}
                    draggable={busyId !== asset.id}
                    onDragStart={() => setDragId(asset.id)}
                    onDragEnd={() => { setDragId(null); setDropDay(null) }}
                    title={asset.title}
                    style={{
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${PROVIDER_COLORS[asset.provider]}`,
                      background: 'var(--bg)',
                      borderRadius: 8,
                      padding: '6px 7px',
                      cursor: busyId === asset.id ? 'progress' : 'grab',
                      opacity: busyId === asset.id ? 0.5 : 1,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 800, color: PROVIDER_COLORS[asset.provider] }}>
                      {when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text)',
                        lineHeight: 1.35,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {asset.title || asset.body.slice(0, 60)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>

      {outsideWeek.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
          {outsideWeek.length} more scheduled outside this week — the soonest is{' '}
          {outsideWeek[0].when.toLocaleString()}.
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
        Drag a post to another day to move it — the time of day stays as you set it.
        {' '}General timing guidance (not measured from your account):{' '}
        {Object.entries(SUGGESTED_SLOTS)
          .map(([provider, hint]) => `${provider} — ${hint}`)
          .join(' ')}
      </div>
    </div>
  )
}
