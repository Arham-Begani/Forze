'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ──────────────────────────────────────────────────────────────────────────────
// The living idea.
//
// Shows the current structured brief and lets the founder log what changed.
// Each update folds into the brief, bumps the project's idea version, and
// records which modules the change invalidates.
//
// Robustness contract: this panel is fully self-contained. A failed fetch, a
// missing migration, or a malformed payload renders an inline empty/error state
// — it must never throw during render and take the project page down with it.
// ──────────────────────────────────────────────────────────────────────────────

interface Brief {
    version: number
    summary: string
    problem: string
    targetCustomer: string
    solution: string
    differentiator: string
    businessModel: string
    stage: string
    keyFeatures: string[]
    openQuestions: string[]
}

interface IdeaUpdateRow {
    id: string
    kind: string
    raw_text: string
    ai_summary: string | null
    impact: { modules?: string[]; rationale?: string } | null
    brief_version: number
    created_at: string
}

interface Props {
    projectId: string
    /** Falls back to this when no structured brief exists yet (legacy projects). */
    fallbackSummary?: string | null
}

const KIND_LABELS: Record<string, string> = {
    feature: 'New feature',
    pivot: 'Pivot',
    scope: 'Scope',
    audience: 'Audience',
    tweak: 'Tweak',
    other: 'Update',
}

const MODULE_LABELS: Record<string, string> = {
    landing: 'Landing Page',
    'shadow-board': 'Shadow Board',
    'investor-kit': 'Investor Kit',
}

/** Defensive: the API is trusted, but a stale deploy or bad row must not crash. */
function coerceBrief(raw: unknown): Brief | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const str = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '')
    const list = (k: string) =>
        Array.isArray(r[k]) ? (r[k] as unknown[]).filter((x): x is string => typeof x === 'string') : []
    const summary = str('summary')
    if (!summary) return null
    return {
        version: typeof r.version === 'number' ? r.version : 1,
        summary,
        problem: str('problem'),
        targetCustomer: str('targetCustomer'),
        solution: str('solution'),
        differentiator: str('differentiator'),
        businessModel: str('businessModel'),
        stage: str('stage') || 'idea',
        keyFeatures: list('keyFeatures'),
        openQuestions: list('openQuestions'),
    }
}

function coerceUpdates(raw: unknown): IdeaUpdateRow[] {
    if (!Array.isArray(raw)) return []
    return raw.filter(
        (u): u is IdeaUpdateRow =>
            !!u && typeof u === 'object' && typeof (u as IdeaUpdateRow).id === 'string'
    )
}

function formatWhen(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function IdeaPanel({ projectId, fallbackSummary }: Props) {
    const [brief, setBrief] = useState<Brief | null>(null)
    const [summary, setSummary] = useState('')
    const [version, setVersion] = useState(1)
    const [updates, setUpdates] = useState<IdeaUpdateRow[]>([])
    const [loading, setLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)

    const [composerOpen, setComposerOpen] = useState(false)
    const [draft, setDraft] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [flash, setFlash] = useState('')
    const [expanded, setExpanded] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/projects/${projectId}/idea`)
            if (!res.ok) throw new Error('load failed')
            const data = await res.json().catch(() => null)
            if (!data) throw new Error('bad payload')
            setBrief(coerceBrief(data.brief))
            setSummary(typeof data.summary === 'string' ? data.summary : '')
            setVersion(typeof data.version === 'number' ? data.version : 1)
            setUpdates(coerceUpdates(data.updates))
            setLoadFailed(false)
        } catch {
            setLoadFailed(true)
        } finally {
            setLoading(false)
        }
    }, [projectId])

    useEffect(() => {
        void load()
    }, [load])

    async function submitUpdate() {
        const text = draft.trim()
        if (!text || saving) return
        setSaving(true)
        setError('')
        try {
            const res = await fetch(`/api/projects/${projectId}/idea`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            })

            if (res.status === 429) {
                setError('Too many updates in the last hour. Try again shortly.')
                return
            }
            if (!res.ok) {
                setError('Could not save that update. Please try again.')
                return
            }

            const data = await res.json().catch(() => null)
            if (!data) {
                setError('Could not save that update. Please try again.')
                return
            }

            const nextBrief = coerceBrief(data.brief)
            if (nextBrief) setBrief(nextBrief)
            if (typeof data.summary === 'string') setSummary(data.summary)
            if (typeof data.version === 'number') setVersion(data.version)
            if (data.update) setUpdates(prev => [data.update as IdeaUpdateRow, ...prev])

            const impacted: string[] = Array.isArray(data.impactedModules) ? data.impactedModules : []
            setFlash(
                impacted.length > 0
                    ? `Logged. ${impacted.map(m => MODULE_LABELS[m] ?? m).join(' and ')} ${impacted.length > 1 ? 'are' : 'is'} now marked outdated.`
                    : 'Logged. Future runs will use the updated idea.'
            )
            setDraft('')
            setComposerOpen(false)
            setTimeout(() => setFlash(''), 6000)
        } catch {
            setError('Could not save that update. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    const displaySummary = brief?.summary || summary || fallbackSummary || ''

    const rows: { label: string; value: string }[] = brief
        ? [
              { label: 'Problem', value: brief.problem },
              { label: 'Customer', value: brief.targetCustomer },
              { label: 'Solution', value: brief.solution },
              { label: 'Edge', value: brief.differentiator },
              { label: 'Money', value: brief.businessModel },
          ].filter(r => r.value.trim())
        : []

    if (loading) {
        return (
            <div className="glass-card" style={{ padding: 18, marginBottom: 28 }}>
                <div className="skeleton" style={{ width: 120, height: 13, borderRadius: 6, marginBottom: 12 }} />
                <div className="skeleton" style={{ width: '100%', height: 11, borderRadius: 6, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: '70%', height: 11, borderRadius: 6 }} />
            </div>
        )
    }

    // Nothing to show and nothing to load — stay out of the way rather than
    // rendering an empty shell on a legacy project with no idea at all.
    if (loadFailed && !displaySummary) return null

    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-card"
            style={{ padding: 18, marginBottom: 28 }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                        The Idea
                    </span>
                    <span
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            fontFamily: "'JetBrains Mono', monospace",
                            color: 'var(--accent)',
                            border: '1px solid var(--accent-glow)',
                            background: 'var(--accent-soft)',
                            borderRadius: 999,
                            padding: '1px 7px',
                        }}
                        title="Every idea update bumps this version. Modules built on an older version get flagged."
                    >
                        v{version}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={() => { setComposerOpen(o => !o); setError('') }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 13px',
                        borderRadius: 9,
                        background: composerOpen ? 'var(--nav-active)' : 'var(--accent-soft)',
                        border: `1px solid ${composerOpen ? 'var(--border)' : 'var(--accent-glow)'}`,
                        color: composerOpen ? 'var(--muted)' : 'var(--accent)',
                        fontSize: 12,
                        fontWeight: 650,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        flexShrink: 0,
                    }}
                >
                    {composerOpen ? 'Cancel' : '+ Log an update'}
                </button>
            </div>

            {/* Composer */}
            <AnimatePresence>
                {composerOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22 }}
                        style={{ overflow: 'hidden', marginBottom: 14 }}
                    >
                        <textarea
                            value={draft}
                            onChange={e => setDraft(e.target.value.slice(0, 2000))}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submitUpdate()
                            }}
                            placeholder="What changed? e.g. “We're adding a B2B tier for agencies” or “Dropping the marketplace, going pure SaaS.”"
                            rows={3}
                            autoFocus
                            disabled={saving}
                            maxLength={2000}
                            style={{
                                width: '100%',
                                resize: 'vertical',
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: 'var(--bg)',
                                border: '1px solid var(--border)',
                                color: 'var(--text)',
                                fontSize: 13.5,
                                lineHeight: 1.6,
                                fontFamily: 'inherit',
                                outline: 'none',
                            }}
                            aria-label="Describe what changed about your idea"
                        />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                Forze folds this into your brief and flags what it invalidates.
                            </span>
                            <button
                                type="button"
                                onClick={() => void submitUpdate()}
                                disabled={!draft.trim() || saving}
                                style={{
                                    padding: '7px 16px',
                                    borderRadius: 9,
                                    border: 'none',
                                    background: draft.trim() && !saving
                                        ? 'linear-gradient(135deg, var(--accent), #e8963a)'
                                        : 'var(--nav-active)',
                                    color: draft.trim() && !saving ? '#fff' : 'var(--muted)',
                                    fontSize: 12.5,
                                    fontWeight: 650,
                                    cursor: draft.trim() && !saving ? 'pointer' : 'not-allowed',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {saving ? 'Saving…' : 'Save update'}
                            </button>
                        </div>
                        {error && (
                            <p style={{ fontSize: 11.5, color: '#e05252', margin: '8px 0 0' }}>{error}</p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {flash && (
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                        fontSize: 12,
                        color: 'var(--accent)',
                        margin: '0 0 12px',
                        padding: '7px 11px',
                        borderRadius: 8,
                        background: 'var(--accent-soft)',
                        border: '1px solid var(--accent-glow)',
                    }}
                >
                    {flash}
                </motion.p>
            )}

            {/* Current brief */}
            {displaySummary ? (
                <p style={{ fontSize: 13.5, lineHeight: 1.68, color: 'var(--text-soft)', margin: 0 }}>
                    {displaySummary}
                </p>
            ) : (
                <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0, fontStyle: 'italic' }}>
                    No idea recorded for this project yet.
                </p>
            )}

            {(rows.length > 0 || (brief?.keyFeatures.length ?? 0) > 0) && (
                <>
                    <button
                        type="button"
                        onClick={() => setExpanded(e => !e)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent)',
                            fontSize: 11.5,
                            fontWeight: 650,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            padding: '10px 0 0',
                        }}
                    >
                        {expanded ? 'Hide breakdown' : 'Show breakdown'}
                    </button>

                    <AnimatePresence>
                        {expanded && brief && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.22 }}
                                style={{ overflow: 'hidden' }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 12 }}>
                                    {rows.map(r => (
                                        <div key={r.label} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                                            <span
                                                style={{
                                                    fontSize: 9.5,
                                                    fontWeight: 700,
                                                    letterSpacing: '0.08em',
                                                    textTransform: 'uppercase',
                                                    color: 'var(--muted)',
                                                    minWidth: 68,
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {r.label}
                                            </span>
                                            <span style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55 }}>
                                                {r.value}
                                            </span>
                                        </div>
                                    ))}

                                    {brief.keyFeatures.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
                                            {brief.keyFeatures.map((f, i) => (
                                                <span
                                                    key={i}
                                                    style={{
                                                        fontSize: 11,
                                                        padding: '3px 9px',
                                                        borderRadius: 999,
                                                        background: 'var(--nav-active)',
                                                        border: '1px solid var(--border)',
                                                        color: 'var(--text-soft)',
                                                    }}
                                                >
                                                    {f}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}

            {/* Changelog */}
            {updates.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    <div
                        style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'var(--muted)',
                            marginBottom: 10,
                        }}
                    >
                        How it has changed
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {updates.slice(0, 8).map(u => {
                            const modules = Array.isArray(u.impact?.modules) ? u.impact!.modules! : []
                            return (
                                <div key={u.id} style={{ display: 'flex', gap: 10 }}>
                                    <div
                                        style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: '50%',
                                            background: 'var(--accent)',
                                            marginTop: 6,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>
                                                {u.ai_summary || u.raw_text}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 9.5,
                                                    fontWeight: 700,
                                                    letterSpacing: '0.05em',
                                                    textTransform: 'uppercase',
                                                    color: 'var(--muted)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 999,
                                                    padding: '1px 7px',
                                                }}
                                            >
                                                {KIND_LABELS[u.kind] ?? u.kind}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                            v{u.brief_version} · {formatWhen(u.created_at)}
                                            {modules.length > 0 && (
                                                <> · affected {modules.map(m => MODULE_LABELS[m] ?? m).join(', ')}</>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </motion.section>
    )
}
