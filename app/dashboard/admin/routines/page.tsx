'use client'

import { useState, type CSSProperties } from 'react'

interface DueRoutine {
  id: string
  name: string
  next_run_at: string
  last_run_at: string | null
  last_error: string | null
  status: string
}

interface PerRoutineResult {
  routineId: string
  name: string
  channel: string
  status: 'success' | 'failed' | 'skipped' | 'threw'
  errorMessage?: string
  durationMs: number
}

interface ActiveRoutine {
  id: string
  name: string
  channel: string
  status: string
  cadence: string
  send_hour: number
  send_minute: number
  timezone: string
  next_run_at: string
  last_run_at: string | null
  last_error: string | null
  run_count: number
  campaign_id: string | null
}

interface FireResponse {
  ok: boolean
  stage?: string
  error?: string
  serverNowUtc?: string
  summary?: {
    dueBeforeClaim: number
    claimed: number
    succeeded: number
    failed: number
    skipped: number
    durationMs: number
  }
  dueBeforeClaim?: DueRoutine[]
  allActive?: ActiveRoutine[]
  results?: PerRoutineResult[]
}

function formatRelative(iso: string, nowUtc: string | undefined): string {
  if (!iso || !nowUtc) return iso
  const diff = Date.parse(iso) - Date.parse(nowUtc)
  const abs = Math.abs(diff)
  const minutes = Math.round(abs / 60_000)
  const hours = Math.round(abs / 3_600_000)
  const days = Math.round(abs / 86_400_000)
  let rel: string
  if (abs < 60_000) rel = 'now'
  else if (minutes < 60) rel = `${minutes}m`
  else if (hours < 48) rel = `${hours}h`
  else rel = `${days}d`
  return diff < 0 ? `${rel} ago` : `in ${rel}`
}

export default function AdminRoutinesPage() {
  const [running, setRunning] = useState(false)
  const [response, setResponse] = useState<FireResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fire() {
    setRunning(true)
    setError(null)
    setResponse(null)
    try {
      const res = await fetch('/api/admin/routines/fire-due', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as FireResponse
      if (!res.ok && !data.ok) {
        setError(data.error || `HTTP ${res.status}`)
        setResponse(data)
        return
      }
      setResponse(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={eyebrowStyle}>Admin · Routines</div>
        <h1 style={titleStyle}>Fire due routines</h1>
        <p style={subtitleStyle}>
          Runs the exact same logic the hourly cron uses, but on-demand and with a verbose response so you can see
          how many routines are due, how many got claimed, and exactly why each one succeeded, failed, or threw.
          Useful when the dashboard shows &ldquo;next run was now&rdquo; and you want to know why nothing happened.
        </p>
      </header>

      <section style={panelStyle}>
        <button type="button" onClick={fire} disabled={running} style={primaryButtonStyle(running)}>
          {running ? 'Firing…' : 'Fire due routines now'}
        </button>

        {error && (
          <div style={errorStyle}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {response?.summary && (
          <div style={summaryGridStyle}>
            <Metric label="Due before claim" value={response.summary.dueBeforeClaim} />
            <Metric label="Claimed" value={response.summary.claimed} />
            <Metric label="Succeeded" value={response.summary.succeeded} tone="success" />
            <Metric label="Failed" value={response.summary.failed} tone={response.summary.failed > 0 ? 'error' : undefined} />
            <Metric label="Skipped" value={response.summary.skipped} />
            <Metric label="Duration" value={`${response.summary.durationMs}ms`} />
          </div>
        )}

        {response?.summary && response.summary.dueBeforeClaim === 0 && (
          <div style={infoStyle}>
            No routines are currently due. Either every active routine&apos;s <code>next_run_at</code> is still in the future, or there are no active routines at all. Check a routine&apos;s row in the dashboard for the exact value.
          </div>
        )}

        {response?.summary && response.summary.dueBeforeClaim > 0 && response.summary.claimed === 0 && (
          <div style={warnStyle}>
            <strong>Suspicious:</strong> {response.summary.dueBeforeClaim} routines were due, but the claim RPC returned zero. The <code>claim_due_routines</code> SQL function may not be installed in this DB, or the service-role grant on it is missing.
          </div>
        )}
      </section>

      {response?.allActive && response.allActive.length > 0 && (
        <section style={panelStyle}>
          <h2 style={panelTitleStyle}>All active / paused routines</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
            Server time (UTC): <code>{response.serverNowUtc}</code> · Your local time: <code>{new Date().toString()}</code>
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {response.allActive.map((r) => {
              const isPaused = r.status !== 'active'
              const isDue = !isPaused && Date.parse(r.next_run_at) <= Date.parse(response.serverNowUtc || new Date().toISOString())
              return (
                <div key={r.id} style={{ ...rowStyle, borderColor: isPaused ? '#fcd34d' : isDue ? '#86efac' : 'var(--border)' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                      {r.name}{' '}
                      <span style={{ color: 'var(--muted)', fontWeight: 600 }}>· {r.channel} · {r.cadence}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
                      <div>
                        <strong>Status:</strong>{' '}
                        <span style={{ color: isPaused ? '#92400e' : '#16a34a', fontWeight: 800 }}>{r.status}</span>
                        {isPaused && ' (will not fire — only active routines are picked up by cron)'}
                      </div>
                      <div>
                        <strong>Schedule:</strong> {String(r.send_hour).padStart(2, '0')}:{String(r.send_minute).padStart(2, '0')} <code>{r.timezone}</code> · {r.cadence}
                      </div>
                      <div>
                        <strong>next_run_at:</strong> <code>{r.next_run_at}</code>{' '}
                        <span style={{ color: isDue ? '#16a34a' : 'var(--muted)' }}>({formatRelative(r.next_run_at, response.serverNowUtc)})</span>
                      </div>
                      {r.last_run_at && (
                        <div>
                          <strong>last_run_at:</strong> <code>{r.last_run_at}</code> ({formatRelative(r.last_run_at, response.serverNowUtc)})
                        </div>
                      )}
                      <div>
                        <strong>run_count:</strong> {r.run_count}
                      </div>
                      {r.last_error && (
                        <div style={{ color: '#dc2626', marginTop: 4, fontWeight: 700 }}>
                          <strong>Last error:</strong> {r.last_error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {response?.dueBeforeClaim && response.dueBeforeClaim.length > 0 && (
        <section style={panelStyle}>
          <h2 style={panelTitleStyle}>Routines that were due</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {response.dueBeforeClaim.map((r) => (
              <div key={r.id} style={rowStyle}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    next_run_at: <code>{r.next_run_at}</code>
                    {r.last_run_at && ` · last_run_at: ${new Date(r.last_run_at).toLocaleString()}`}
                  </div>
                  {r.last_error && (
                    <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: 700 }}>
                      Last error: {r.last_error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {response?.results && response.results.length > 0 && (
        <section style={panelStyle}>
          <h2 style={panelTitleStyle}>Per-routine results</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {response.results.map((r) => (
              <div key={r.routineId} style={rowStyle}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                    {r.name} <span style={{ color: 'var(--muted)', fontWeight: 600 }}>· {r.channel}</span>
                  </div>
                  {r.errorMessage && (
                    <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: 700 }}>
                      {r.errorMessage}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {r.durationMs}ms
                  </div>
                </div>
                <StatusPill status={r.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      {response?.stage === 'claim' && (
        <section style={{ ...panelStyle, background: '#fef2f2', borderColor: '#fecaca' }}>
          <h2 style={{ ...panelTitleStyle, color: '#991b1b' }}>Claim stage failed</h2>
          <p style={{ fontSize: 13, color: '#991b1b', margin: 0 }}>
            The <code>claim_due_routines</code> Postgres function rejected the call. This usually means migration
            019/021 didn&apos;t run on this database, or the service role doesn&apos;t have <code>EXECUTE</code> on the function.
          </p>
        </section>
      )}
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: 'success' | 'error' }) {
  const color = tone === 'success' ? '#16a34a' : tone === 'error' ? '#dc2626' : 'var(--text)'
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--sidebar)' }}>
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{value}</div>
    </div>
  )
}

function StatusPill({ status }: { status: PerRoutineResult['status'] }) {
  const palette: Record<PerRoutineResult['status'], { fg: string; bg: string; border: string }> = {
    success: { fg: '#16a34a', bg: '#dcfce7', border: '#86efac' },
    failed: { fg: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    threw: { fg: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    skipped: { fg: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
  }
  const p = palette[status]
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: p.fg,
      background: p.bg,
      border: `1px solid ${p.border}`,
      padding: '4px 10px',
      borderRadius: 999,
      whiteSpace: 'nowrap',
    }}>{status}</span>
  )
}

const pageStyle: CSSProperties = {
  maxWidth: 880,
  margin: '0 auto',
  padding: '32px 20px 64px',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
}

const headerStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
const eyebrowStyle: CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: 0.7, textTransform: 'uppercase', color: 'var(--accent)' }
const titleStyle: CSSProperties = { margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.4 }
const subtitleStyle: CSSProperties = { margin: 0, fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6 }

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 20,
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'var(--card-solid)',
  boxShadow: '0 12px 32px rgba(0,0,0,0.04)',
}

const panelTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'var(--muted)',
}

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 10,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 14,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: 'none',
    borderRadius: 10,
    background: 'var(--accent)',
    color: '#fff',
    cursor: disabled ? 'wait' : 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 900,
    padding: '12px 18px',
    opacity: disabled ? 0.7 : 1,
    alignSelf: 'flex-start',
  }
}

const errorStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#991b1b',
  fontSize: 12,
  fontWeight: 600,
}

const infoStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--sidebar)',
  border: '1px solid var(--border)',
  color: 'var(--text-soft)',
  fontSize: 12,
  fontWeight: 600,
}

const warnStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  background: '#fef3c7',
  border: '1px solid #fcd34d',
  color: '#92400e',
  fontSize: 12,
  fontWeight: 600,
}
