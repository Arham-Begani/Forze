'use client'

// components/venture/InspirationStudio.tsx
//
// The "Generate from Inspiration" UI. One page, three states:
//
//   1. Empty   — URL inputs + analyze button, with history of past analyses.
//   2. Loading — phase indicators while capture + Gemini run.
//   3. Result  — editable DesignTokens panel + live preview + apply/regenerate.
//
// We intentionally do not split this into many sub-components: the studio is
// stateful enough that prop-drilling 6+ callbacks would obscure the flow.
// Everything lives in this file but is organised top-down — read it as a
// linear story.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type ColorWithConfidence = { hex: string; confidence: number; source?: string }

type DesignTokens = {
  colors: {
    primary: ColorWithConfidence
    secondary?: ColorWithConfidence
    accent?: ColorWithConfidence
    background: string
    surface: string
    text: string
    textSecondary: string
    error: string
    success: string
    neutral: Record<'50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900', string>
  }
  typography: {
    headingFamily: string
    bodyFamily: string
    sizes: {
      h1: { base: string; mobile?: string; confidence: number }
      h2: { base: string; mobile?: string; confidence: number }
      h3: { base: string; mobile?: string; confidence: number }
      base: { value: string; confidence: number }
      sm: { value: string; confidence: number }
      lg: { value: string; confidence: number }
    }
    weights: { light: number; normal: number; semibold: number; bold: number }
    lineHeights: { tight: string; normal: string; relaxed: string }
  }
  spacing: {
    unit: string
    scale: { xs: string; sm: string; md: string; lg: string; xl: string; xxl: string }
    sectionPadding: { x: string; y: string }
    containerMaxWidth: string
    gridGap: string
  }
  components: {
    button: {
      radius: { value: string; confidence: number }
      padding: { value: string; confidence: number }
      fontSize: string
      fontWeight: number
      shadow: string
    }
    card: {
      radius: { value: string; confidence: number }
      padding: { value: string; confidence: number }
      shadow: { sm: string; md: string; lg: string }
      borderWidth: string
      borderColor: string
    }
    input: {
      radius: { value: string; confidence: number }
      padding: string
      borderWidth: string
      borderColor: string
      focusOutlineColor: string
    }
  }
  responsive: { breakpoints: { mobile: string; tablet: string; desktop: string } }
  brand: { mood: string; personality: string }
  confidenceByCategory: { colors: number; typography: number; spacing: number; components: number; overall: number }
  sources: { primaryUrl: string; secondaryUrls: string[]; mergeStrategy: 'single' | 'multi-url' }
}

type AnalysisSummary = {
  id: string
  urls: string[]
  status: 'analyzing' | 'complete' | 'failed'
  mood: string | null
  confidence: Record<string, number>
  createdAt: string
  appliedAt: string | null
  captureTier: number | null
  hasTokens: boolean
  errorMessage: string | null
}

type Tab = 'colors' | 'typography' | 'spacing' | 'components' | 'preview'

interface Props {
  venture: { id: string; name: string }
  appliedTokens: unknown
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'colors', label: 'Colors' },
  { id: 'typography', label: 'Typography' },
  { id: 'spacing', label: 'Spacing' },
  { id: 'components', label: 'Components' },
  { id: 'preview', label: 'Preview' },
]

export function InspirationStudio({ venture, appliedTokens }: Props) {
  const router = useRouter()
  const [urls, setUrls] = useState<string[]>([''])
  const [analyzing, setAnalyzing] = useState(false)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<AnalysisSummary[]>([])
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null)
  const [tokens, setTokens] = useState<DesignTokens | null>(null)
  const [lockedPaths, setLockedPaths] = useState<string[]>([])
  const [adjustments, setAdjustments] = useState<Record<string, unknown>>({})
  const [tab, setTab] = useState<Tab>('colors')
  const [saving, setSaving] = useState(false)
  const [appliedAnalysisId, setAppliedAnalysisId] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<{ perVentureRemaining: number; perUserRemaining: number; allowed: boolean } | null>(null)
  // Generation progress (after Apply triggers a landing-page run)
  const [generating, setGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string | null>(null)
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null)

  const patchDebounceRef = useRef<number | null>(null)
  const pollAbortRef = useRef<{ aborted: boolean } | null>(null)

  // ── Initial history fetch ───────────────────────────────────────────────
  // If a previous session applied tokens, pick that row as the active one so
  // the "Remove from Landing" toggle and apply state work on page reload.
  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/ventures/${venture.id}/inspiration`)
      if (!res.ok) return
      const data = await res.json()
      const rows: AnalysisSummary[] = data.analyses ?? []
      setHistory(rows)
      setRateLimit(data.rateLimit ?? null)
      const appliedRow = rows.find((a) => a.appliedAt)
      if (appliedRow) {
        setAppliedAnalysisId(appliedRow.id)
        // Keep activeAnalysisId aligned with applied when nothing else is
        // selected — otherwise the apply/unapply controls disable themselves
        // even though there IS an applied row to act on.
        setActiveAnalysisId((prev) => prev ?? appliedRow.id)
      }
    } catch {
      // network — leave history empty
    }
  }, [venture.id])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  // If the venture already has applied tokens (set by a prior session), seed
  // the editor so the founder can keep tweaking without re-running vision.
  useEffect(() => {
    if (appliedTokens && !tokens) {
      try {
        setTokens(appliedTokens as DesignTokens)
        setTab('preview')
      } catch {
        // ignore — invalid shape on disk
      }
    }
  }, [appliedTokens, tokens])

  // Cancel any in-flight poll on unmount so we don't keep hammering /api after
  // the user navigates away mid-generation.
  useEffect(() => {
    return () => {
      if (pollAbortRef.current) pollAbortRef.current.aborted = true
    }
  }, [])

  // ── URL list management ─────────────────────────────────────────────────
  const updateUrlAt = (idx: number, val: string) => {
    setUrls((prev) => prev.map((u, i) => (i === idx ? val : u)))
  }
  const addUrl = () => setUrls((prev) => (prev.length >= 3 ? prev : [...prev, '']))
  const removeUrl = (idx: number) =>
    setUrls((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))

  // ── Analyze ─────────────────────────────────────────────────────────────
  const runAnalyze = async () => {
    const cleaned = urls.map((u) => u.trim()).filter(Boolean)
    if (cleaned.length === 0) {
      setError('Add at least one URL to analyze.')
      return
    }
    setError(null)
    setAnalyzing(true)
    setProgressMessage('Capturing site previews…')

    try {
      const res = await fetch(`/api/ventures/${venture.id}/inspiration/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: cleaned }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 429) {
          setError('Daily inspiration limit reached. Try again tomorrow.')
        } else if (res.status === 422 && Array.isArray(data?.failures)) {
          setError(
            `Could not capture any URLs: ${data.failures.map((f: { url: string; error: string }) => `${f.url} (${f.error})`).join('; ')}`,
          )
        } else {
          setError(data?.error ?? 'Inspiration analysis failed')
        }
        return
      }
      setActiveAnalysisId(data.analysisId)
      setTokens(data.tokens as DesignTokens)
      setLockedPaths([])
      setAdjustments({})
      setTab('colors')
      setRateLimit(data.rateLimit ?? null)
      await refreshHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
      setProgressMessage(null)
    }
  }

  // ── Token edits — debounced PATCH to persist ────────────────────────────
  const persistAdjustments = useCallback(
    (nextAdjustments: Record<string, unknown>, nextLocked: string[]) => {
      if (!activeAnalysisId) return
      if (patchDebounceRef.current) window.clearTimeout(patchDebounceRef.current)
      patchDebounceRef.current = window.setTimeout(async () => {
        try {
          const res = await fetch(`/api/ventures/${venture.id}/inspiration/${activeAnalysisId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adjustments: nextAdjustments, lockedPaths: nextLocked }),
          })
          if (res.ok) {
            const data = await res.json()
            if (data?.analysis?.tokens) setTokens(data.analysis.tokens as DesignTokens)
          }
        } catch {
          // Editor stays usable even if the persist fails — preview already updated locally.
        }
      }, 600)
    },
    [activeAnalysisId, venture.id],
  )

  const setTokenPath = (path: string, value: unknown) => {
    setTokens((prev) => (prev ? setAtPath(prev, path, value) : prev))
    setAdjustments((prev) => {
      const next = { ...prev, [path]: value }
      persistAdjustments(next, lockedPaths)
      return next
    })
  }

  const toggleLock = (path: string) => {
    setLockedPaths((prev) => {
      const exists = prev.includes(path)
      const next = exists ? prev.filter((p) => p !== path) : [...prev, path]
      persistAdjustments(adjustments, next)
      return next
    })
  }

  // ── Apply / unapply tokens to venture ───────────────────────────────────
  // Apply is a two-step flow:
  //   1. POST /apply  — writes tokens to venture.context.inspirationTokens
  //      and clears the existing landing page so the next run is a fresh
  //      generation (not a surgical edit-mode patch).
  //   2. POST /run    — kicks off the landing-page agent. We then poll the
  //      venture endpoint every 2.5s until context.landing.deploymentUrl
  //      shows up, at which point we surface a "View site" CTA.
  //
  // The whole flow surfaces errors aggressively — silent failures are how
  // the previous version was useless: the button "saved" but nothing visibly
  // happened, and there was no error path to surface why.
  const applyToVenture = async () => {
    if (!activeAnalysisId) {
      setError('No active analysis to apply. Pick one from history or run a new analysis first.')
      return
    }
    if (!tokens) {
      setError('Tokens are still loading.')
      return
    }
    setError(null)
    setSaving(true)
    setDeploymentUrl(null)
    setGenerationStatus(null)
    try {
      const applyRes = await fetch(
        `/api/ventures/${venture.id}/inspiration/${activeAnalysisId}/apply`,
        { method: 'POST' },
      )
      if (!applyRes.ok) {
        const errBody = await applyRes.json().catch(() => null)
        throw new Error(errBody?.error ?? `Apply failed (HTTP ${applyRes.status})`)
      }
      setAppliedAnalysisId(activeAnalysisId)
      await refreshHistory()

      // Kick off the landing-page generation. The pipeline agent reads
      // venture.context.inspirationTokens and applies the design briefing.
      setGenerating(true)
      setGenerationStatus('Briefing the landing-page agent…')
      const runRes = await fetch(`/api/ventures/${venture.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: 'landing',
          prompt: `Generate a landing page that adopts the applied inspiration design tokens and design briefing exactly. Match the inspiration's feel — surfaces, motion, density, gradient strategy — not just its colors.`,
        }),
      })
      if (!runRes.ok) {
        const errBody = await runRes.json().catch(() => null)
        throw new Error(
          errBody?.error
            ? `Landing run failed: ${errBody.error}`
            : `Landing run failed (HTTP ${runRes.status})`,
        )
      }
      const runData = await runRes.json()
      const conversationId: string | undefined = runData?.conversationId
      if (!conversationId) throw new Error('Landing run did not return a conversationId')

      setGenerationStatus('Generating landing page (this usually takes 30–60s)…')
      pollAbortRef.current = { aborted: false }
      const abortToken = pollAbortRef.current
      const deployed = await pollForDeployment(venture.id, abortToken, (msg) => {
        if (!abortToken.aborted) setGenerationStatus(msg)
      })
      if (abortToken.aborted) return
      if (deployed) {
        setDeploymentUrl(deployed)
        setGenerationStatus('Landing page generated.')
      } else {
        setGenerationStatus(
          'Generation finished but no deployment URL was returned. Open the Landing module to inspect.',
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed')
      setGenerationStatus(null)
    } finally {
      setSaving(false)
      setGenerating(false)
    }
  }

  const unapplyFromVenture = async () => {
    if (!appliedAnalysisId) return
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(
        `/api/ventures/${venture.id}/inspiration/${appliedAnalysisId}/apply`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error ?? `Unapply failed (HTTP ${res.status})`)
      }
      setAppliedAnalysisId(null)
      setDeploymentUrl(null)
      setGenerationStatus(null)
      await refreshHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unapply failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Load an analysis from history ───────────────────────────────────────
  const loadAnalysis = async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/ventures/${venture.id}/inspiration/${id}`)
      if (!res.ok) return
      const data = await res.json()
      const a = data.analysis
      setActiveAnalysisId(a.id)
      setTokens(a.tokens as DesignTokens)
      setAdjustments(a.userAdjustments ?? {})
      setLockedPaths(a.lockedPaths ?? [])
      setTab('preview')
    } catch {
      // ignore
    }
  }

  const deleteAnalysis = async (id: string) => {
    if (!confirm('Delete this inspiration analysis?')) return
    try {
      await fetch(`/api/ventures/${venture.id}/inspiration/${id}`, { method: 'DELETE' })
      if (activeAnalysisId === id) {
        setActiveAnalysisId(null)
        setTokens(null)
      }
      await refreshHistory()
    } catch {
      // ignore
    }
  }

  const downloadTokens = () => {
    if (!tokens) return
    const blob = new Blob([JSON.stringify(tokens, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forze-tokens-${venture.id.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isAppliedActive = activeAnalysisId !== null && activeAnalysisId === appliedAnalysisId

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          {venture.name}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '8px 0', color: 'var(--text)' }}>
          Generate from Inspiration
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-soft)', maxWidth: 720 }}>
          Paste 1–3 inspiration URLs. Forze captures a representative image of each, extracts a
          design-token system with confidence scores, and lets you refine the result before the
          landing-page agent applies it on your next generation.
        </p>
      </header>

      {/* URL input row */}
      <section
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {urls.map((u, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={u}
                onChange={(e) => updateUrlAt(idx, e.target.value)}
                placeholder={idx === 0 ? 'https://stripe.com' : 'https://… (optional)'}
                disabled={analyzing}
                style={inputStyle}
              />
              {urls.length > 1 && (
                <button
                  onClick={() => removeUrl(idx)}
                  disabled={analyzing}
                  style={ghostButtonStyle}
                  aria-label="Remove URL"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={addUrl}
              disabled={analyzing || urls.length >= 3}
              style={ghostButtonStyle}
            >
              + Add URL (max 3)
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {rateLimit && (
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {rateLimit.perVentureRemaining}/5 left today
                </span>
              )}
              <button
                onClick={runAnalyze}
                disabled={analyzing || (rateLimit ? !rateLimit.allowed : false)}
                style={primaryButtonStyle(analyzing)}
              >
                {analyzing ? (progressMessage ?? 'Analyzing…') : 'Validate & Analyze'}
              </button>
            </div>
          </div>
          {error && (
            <div style={{ background: '#dc262612', border: '1px solid #dc262630', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#dc2626' }}>
              {error}
            </div>
          )}
        </div>
      </section>

      {/* Token editor */}
      {tokens && (
        <section
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 0,
            marginBottom: 24,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                  color: tab === t.id ? 'var(--text)' : 'var(--text-soft)',
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 24 }}>
            {tab === 'colors' && (
              <ColorsTab
                tokens={tokens}
                lockedPaths={lockedPaths}
                onChange={setTokenPath}
                onToggleLock={toggleLock}
              />
            )}
            {tab === 'typography' && (
              <TypographyTab
                tokens={tokens}
                lockedPaths={lockedPaths}
                onChange={setTokenPath}
                onToggleLock={toggleLock}
              />
            )}
            {tab === 'spacing' && (
              <SpacingTab tokens={tokens} onChange={setTokenPath} />
            )}
            {tab === 'components' && (
              <ComponentsTab tokens={tokens} onChange={setTokenPath} />
            )}
            {tab === 'preview' && <PreviewTab tokens={tokens} ventureName={venture.name} />}
          </div>

          {/* Action bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 24px',
              borderTop: '1px solid var(--border)',
              background: 'var(--stream-bg)',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
              Overall confidence:{' '}
              <strong style={{ color: 'var(--text)' }}>
                {tokens.confidenceByCategory.overall}%
              </strong>
              {' · '}
              Mood: <strong style={{ color: 'var(--text)' }}>{tokens.brand.mood}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={downloadTokens} style={ghostButtonStyle}>
                Download JSON
              </button>
              {isAppliedActive ? (
                <button
                  onClick={unapplyFromVenture}
                  disabled={saving || generating}
                  style={{ ...ghostButtonStyle, color: '#dc2626', borderColor: '#dc262630' }}
                >
                  {saving ? 'Removing…' : 'Remove from Landing'}
                </button>
              ) : (
                <button
                  onClick={applyToVenture}
                  disabled={saving || generating || !activeAnalysisId}
                  style={primaryButtonStyle(saving || generating)}
                >
                  {generating
                    ? (generationStatus ?? 'Generating…')
                    : saving
                      ? 'Applying…'
                      : 'Apply & Generate Landing Page'}
                </button>
              )}
              <button
                onClick={() => router.push(`/dashboard/venture/${venture.id}/landing`)}
                style={ghostButtonStyle}
              >
                Open Landing Module →
              </button>
            </div>
          </div>

          {/* Apply + generation progress / result panel. Shown only while the
              flow is active or has just produced a deployment URL. */}
          {(generating || generationStatus || deploymentUrl) && (
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border)',
                background: deploymentUrl ? 'var(--accent-soft)' : 'var(--stream-bg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {generating && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      border: '2px solid var(--border)',
                      borderTopColor: 'var(--accent)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>
                    {generationStatus ?? 'Working…'}
                  </span>
                </div>
              )}
              {!generating && generationStatus && !deploymentUrl && (
                <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>{generationStatus}</div>
              )}
              {deploymentUrl && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>
                    <strong>✓ Landing page generated</strong> — your inspiration tokens are now live on this venture's site.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a
                      href={deploymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...primaryButtonStyle(false), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                    >
                      View Site →
                    </a>
                    <button
                      onClick={() => router.push(`/dashboard/venture/${venture.id}/landing`)}
                      style={ghostButtonStyle}
                    >
                      Edit in Landing Module
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
            History
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h) => (
              <div
                key={h.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 12,
                  border:
                    h.id === activeAnalysisId
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                  borderRadius: 8,
                  background:
                    h.id === activeAnalysisId ? 'var(--accent-soft)' : 'transparent',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {h.urls.join(', ')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    {new Date(h.createdAt).toLocaleString()} · {h.status}
                    {h.mood ? ` · ${h.mood}` : ''}
                    {h.appliedAt ? ' · applied' : ''}
                    {h.captureTier ? ` · tier ${h.captureTier}` : ''}
                  </div>
                  {h.status === 'failed' && h.errorMessage && (
                    <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{h.errorMessage}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {h.hasTokens && (
                    <button onClick={() => loadAnalysis(h.id)} style={ghostButtonStyle}>
                      Load
                    </button>
                  )}
                  <button
                    onClick={() => deleteAnalysis(h.id)}
                    style={{ ...ghostButtonStyle, color: '#dc2626', borderColor: '#dc262630' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Tabs
// ──────────────────────────────────────────────────────────────────────────────

function ColorsTab({
  tokens,
  lockedPaths,
  onChange,
  onToggleLock,
}: {
  tokens: DesignTokens
  lockedPaths: string[]
  onChange: (path: string, value: unknown) => void
  onToggleLock: (path: string) => void
}) {
  const swatches: Array<{ path: string; label: string; value: string; confidence?: number }> = [
    { path: 'colors.primary.hex', label: 'Primary', value: tokens.colors.primary.hex, confidence: tokens.colors.primary.confidence },
    { path: 'colors.secondary.hex', label: 'Secondary', value: tokens.colors.secondary?.hex ?? tokens.colors.primary.hex, confidence: tokens.colors.secondary?.confidence },
    { path: 'colors.accent.hex', label: 'Accent', value: tokens.colors.accent?.hex ?? tokens.colors.primary.hex, confidence: tokens.colors.accent?.confidence },
    { path: 'colors.background', label: 'Background', value: tokens.colors.background },
    { path: 'colors.surface', label: 'Surface', value: tokens.colors.surface },
    { path: 'colors.text', label: 'Text', value: tokens.colors.text },
    { path: 'colors.textSecondary', label: 'Text muted', value: tokens.colors.textSecondary },
    { path: 'colors.error', label: 'Error', value: tokens.colors.error },
    { path: 'colors.success', label: 'Success', value: tokens.colors.success },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {swatches.map((sw) => (
          <SwatchRow
            key={sw.path}
            path={sw.path}
            label={sw.label}
            value={sw.value}
            confidence={sw.confidence}
            locked={lockedPaths.includes(sw.path)}
            onChange={onChange}
            onToggleLock={onToggleLock}
          />
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 8 }}>Neutral scale</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['50','100','200','300','400','500','600','700','800','900'] as const).map((stop) => (
            <div key={stop} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <input
                type="color"
                value={tokens.colors.neutral[stop]}
                onChange={(e) => onChange(`colors.neutral.${stop}`, e.target.value)}
                style={{ width: 38, height: 38, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 0, background: 'transparent' }}
              />
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{stop}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SwatchRow({
  path,
  label,
  value,
  confidence,
  locked,
  onChange,
  onToggleLock,
}: {
  path: string
  label: string
  value: string
  confidence?: number
  locked: boolean
  onChange: (path: string, value: unknown) => void
  onToggleLock: (path: string) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
      <input
        type="color"
        value={normalizeHex(value)}
        onChange={(e) => onChange(path, e.target.value)}
        style={{ width: 44, height: 44, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 0, background: 'transparent' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        <input
          value={value}
          onChange={(e) => onChange(path, e.target.value)}
          style={{ ...miniInput, width: '100%' }}
          spellCheck={false}
        />
        {typeof confidence === 'number' && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{confidence}% confident</div>
        )}
      </div>
      <button
        aria-label={locked ? 'Unlock token' : 'Lock token'}
        onClick={() => onToggleLock(path)}
        style={{
          width: 28,
          height: 28,
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: locked ? 'var(--accent-soft)' : 'transparent',
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        {locked ? '🔒' : '🔓'}
      </button>
    </div>
  )
}

function TypographyTab({
  tokens,
  onChange,
}: {
  tokens: DesignTokens
  lockedPaths: string[]
  onChange: (path: string, value: unknown) => void
  onToggleLock: (path: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
      <FieldRow
        label="Heading font family"
        value={tokens.typography.headingFamily}
        onChange={(v) => onChange('typography.headingFamily', v)}
      />
      <FieldRow
        label="Body font family"
        value={tokens.typography.bodyFamily}
        onChange={(v) => onChange('typography.bodyFamily', v)}
      />
      <FieldRow
        label="H1 (desktop)"
        value={tokens.typography.sizes.h1.base}
        onChange={(v) => onChange('typography.sizes.h1.base', v)}
      />
      <FieldRow
        label="H1 (mobile)"
        value={tokens.typography.sizes.h1.mobile ?? ''}
        onChange={(v) => onChange('typography.sizes.h1.mobile', v)}
      />
      <FieldRow
        label="H2 (desktop)"
        value={tokens.typography.sizes.h2.base}
        onChange={(v) => onChange('typography.sizes.h2.base', v)}
      />
      <FieldRow
        label="Body size"
        value={tokens.typography.sizes.base.value}
        onChange={(v) => onChange('typography.sizes.base.value', v)}
      />
      <FieldRow
        label="Line height (normal)"
        value={tokens.typography.lineHeights.normal}
        onChange={(v) => onChange('typography.lineHeights.normal', v)}
      />
      <FieldRow
        label="Bold weight"
        value={String(tokens.typography.weights.bold)}
        onChange={(v) => onChange('typography.weights.bold', Number(v) || 700)}
      />
      <div style={{ gridColumn: '1 / -1', padding: 16, border: '1px dashed var(--border)', borderRadius: 8 }}>
        <h2
          style={{
            fontFamily: tokens.typography.headingFamily,
            fontSize: tokens.typography.sizes.h1.base,
            lineHeight: tokens.typography.lineHeights.tight,
            margin: 0,
            color: 'var(--text)',
            fontWeight: tokens.typography.weights.bold,
          }}
        >
          The quick brown fox
        </h2>
        <p
          style={{
            fontFamily: tokens.typography.bodyFamily,
            fontSize: tokens.typography.sizes.base.value,
            lineHeight: tokens.typography.lineHeights.relaxed,
            color: 'var(--text-soft)',
            margin: '8px 0 0',
          }}
        >
          The five boxing wizards jump quickly over the lazy dog — your body copy will look like this when rendered with these tokens.
        </p>
      </div>
    </div>
  )
}

function SpacingTab({
  tokens,
  onChange,
}: {
  tokens: DesignTokens
  onChange: (path: string, value: unknown) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
      <FieldRow
        label="Section padding (y)"
        value={tokens.spacing.sectionPadding.y}
        onChange={(v) => onChange('spacing.sectionPadding.y', v)}
      />
      <FieldRow
        label="Section padding (x)"
        value={tokens.spacing.sectionPadding.x}
        onChange={(v) => onChange('spacing.sectionPadding.x', v)}
      />
      <FieldRow
        label="Container max width"
        value={tokens.spacing.containerMaxWidth}
        onChange={(v) => onChange('spacing.containerMaxWidth', v)}
      />
      <FieldRow
        label="Grid gap"
        value={tokens.spacing.gridGap}
        onChange={(v) => onChange('spacing.gridGap', v)}
      />
      {(Object.keys(tokens.spacing.scale) as Array<keyof typeof tokens.spacing.scale>).map((key) => (
        <FieldRow
          key={key}
          label={`Scale ${key}`}
          value={tokens.spacing.scale[key]}
          onChange={(v) => onChange(`spacing.scale.${key}`, v)}
        />
      ))}
    </div>
  )
}

function ComponentsTab({
  tokens,
  onChange,
}: {
  tokens: DesignTokens
  onChange: (path: string, value: unknown) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
      <FieldRow
        label="Button radius"
        value={tokens.components.button.radius.value}
        onChange={(v) => onChange('components.button.radius.value', v)}
      />
      <FieldRow
        label="Button padding"
        value={tokens.components.button.padding.value}
        onChange={(v) => onChange('components.button.padding.value', v)}
      />
      <FieldRow
        label="Card radius"
        value={tokens.components.card.radius.value}
        onChange={(v) => onChange('components.card.radius.value', v)}
      />
      <FieldRow
        label="Card padding"
        value={tokens.components.card.padding.value}
        onChange={(v) => onChange('components.card.padding.value', v)}
      />
      <FieldRow
        label="Card shadow (md)"
        value={tokens.components.card.shadow.md}
        onChange={(v) => onChange('components.card.shadow.md', v)}
      />
      <FieldRow
        label="Input radius"
        value={tokens.components.input.radius.value}
        onChange={(v) => onChange('components.input.radius.value', v)}
      />
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap', padding: 16, border: '1px dashed var(--border)', borderRadius: 8 }}>
        <button
          style={{
            background: tokens.colors.primary.hex,
            color: '#fff',
            padding: tokens.components.button.padding.value,
            borderRadius: tokens.components.button.radius.value,
            border: 'none',
            fontWeight: tokens.components.button.fontWeight,
            fontSize: tokens.components.button.fontSize,
            boxShadow: tokens.components.button.shadow,
            cursor: 'pointer',
          }}
        >
          Primary button
        </button>
        <div
          style={{
            background: tokens.colors.surface,
            color: tokens.colors.text,
            padding: tokens.components.card.padding.value,
            borderRadius: tokens.components.card.radius.value,
            border: `${tokens.components.card.borderWidth} solid ${tokens.components.card.borderColor}`,
            boxShadow: tokens.components.card.shadow.md,
            minWidth: 220,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Card title</div>
          <div style={{ fontSize: 13, color: tokens.colors.textSecondary }}>
            This card uses your component tokens.
          </div>
        </div>
      </div>
    </div>
  )
}

function PreviewTab({ tokens, ventureName }: { tokens: DesignTokens; ventureName: string }) {
  const primary = tokens.colors.primary.hex
  const accent = tokens.colors.accent?.hex ?? tokens.colors.secondary?.hex ?? primary

  return (
    <div
      style={{
        background: tokens.colors.background,
        color: tokens.colors.text,
        fontFamily: tokens.typography.bodyFamily,
        borderRadius: tokens.components.card.radius.value,
        padding: tokens.spacing.sectionPadding.y + ' ' + tokens.spacing.sectionPadding.x,
        border: `1px solid ${tokens.components.card.borderColor}`,
      }}
    >
      <div style={{ maxWidth: tokens.spacing.containerMaxWidth, margin: '0 auto' }}>
        <div style={{ fontSize: 11, color: tokens.colors.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Inspiration preview · {tokens.brand.mood}
        </div>
        <h1
          style={{
            fontFamily: tokens.typography.headingFamily,
            fontSize: tokens.typography.sizes.h1.base,
            lineHeight: tokens.typography.lineHeights.tight,
            fontWeight: tokens.typography.weights.bold,
            margin: '8px 0 12px',
            color: tokens.colors.text,
          }}
        >
          {ventureName} — built on tokens you can trust.
        </h1>
        <p
          style={{
            fontSize: tokens.typography.sizes.lg.value,
            color: tokens.colors.textSecondary,
            lineHeight: tokens.typography.lineHeights.relaxed,
            maxWidth: 640,
          }}
        >
          This is what your landing page typography and color choices feel like. Use the editor to refine,
          then click <strong>Apply to Landing Page</strong> to lock them in for the next generation run.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button
            style={{
              background: primary,
              color: '#fff',
              padding: tokens.components.button.padding.value,
              borderRadius: tokens.components.button.radius.value,
              border: 'none',
              fontWeight: tokens.components.button.fontWeight,
              fontSize: tokens.components.button.fontSize,
              boxShadow: tokens.components.button.shadow,
              cursor: 'pointer',
            }}
          >
            Primary CTA
          </button>
          <button
            style={{
              background: 'transparent',
              color: tokens.colors.text,
              padding: tokens.components.button.padding.value,
              borderRadius: tokens.components.button.radius.value,
              border: `1px solid ${tokens.components.card.borderColor}`,
              fontWeight: tokens.components.button.fontWeight,
              fontSize: tokens.components.button.fontSize,
              cursor: 'pointer',
            }}
          >
            Secondary
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: tokens.spacing.gridGap, marginTop: 40 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: tokens.colors.surface,
                padding: tokens.components.card.padding.value,
                borderRadius: tokens.components.card.radius.value,
                border: `${tokens.components.card.borderWidth} solid ${tokens.components.card.borderColor}`,
                boxShadow: tokens.components.card.shadow.md,
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: accent, marginBottom: 12 }} />
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Feature {i}</div>
              <div style={{ fontSize: 13, color: tokens.colors.textSecondary, lineHeight: tokens.typography.lineHeights.normal }}>
                Cards rendered with your card radius, padding, and shadow tokens.
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Small UI atoms + shared style objects
// ──────────────────────────────────────────────────────────────────────────────

function FieldRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
        spellCheck={false}
      />
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  outline: 'none',
}

const miniInput: React.CSSProperties = {
  padding: '4px 6px',
  fontSize: 11,
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'monospace',
}

const ghostButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-soft)',
  cursor: 'pointer',
}

function primaryButtonStyle(isBusy: boolean): React.CSSProperties {
  return {
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 700,
    background: isBusy ? 'var(--muted)' : 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: isBusy ? 'wait' : 'pointer',
    opacity: isBusy ? 0.7 : 1,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function setAtPath<T>(target: T, path: string, value: unknown): T {
  const parts = path.split('.').filter(Boolean)
  if (parts.length === 0) return target
  const root: Record<string, unknown> = { ...(target as unknown as Record<string, unknown>) }
  let cursor = root
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    const next = cursor[key]
    cursor[key] = next && typeof next === 'object' && !Array.isArray(next) ? { ...(next as Record<string, unknown>) } : {}
    cursor = cursor[key] as Record<string, unknown>
  }
  cursor[parts[parts.length - 1]] = value
  return root as unknown as T
}

function normalizeHex(value: string): string {
  if (/^#([0-9a-fA-F]{6})$/.test(value)) return value
  if (/^#([0-9a-fA-F]{3})$/.test(value)) {
    const v = value.slice(1)
    return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`
  }
  if (/^#([0-9a-fA-F]{8})$/.test(value)) return value.slice(0, 7)
  return '#000000'
}

// Poll the venture endpoint until landing.deploymentUrl appears or we hit a
// generous timeout (90s — pipeline agents typically finish in 30–60s). The
// abortToken lets unmount cancel cleanly instead of leaking timers.
async function pollForDeployment(
  ventureId: string,
  abortToken: { aborted: boolean },
  onStatus: (msg: string) => void,
): Promise<string | null> {
  const startedAt = Date.now()
  const maxMs = 120_000
  const intervalMs = 2_500
  let attempts = 0

  while (!abortToken.aborted && Date.now() - startedAt < maxMs) {
    attempts += 1
    try {
      const res = await fetch(`/api/ventures/${ventureId}`)
      if (res.ok) {
        const data = await res.json()
        const landing = data?.venture?.context?.landing as
          | { deploymentUrl?: string; fullComponent?: string }
          | undefined
        if (landing?.deploymentUrl) return landing.deploymentUrl
        if (landing?.fullComponent && landing.fullComponent.length > 200) {
          // Pipeline finished but deployment URL not surfaced — fall back to
          // the venture's own subdomain via the preview route.
          return `/v/${ventureId}`
        }
      }
    } catch {
      // ignore transient network errors and keep polling
    }
    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    onStatus(`Generating landing page… ${elapsed}s elapsed (poll #${attempts})`)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return null
}

