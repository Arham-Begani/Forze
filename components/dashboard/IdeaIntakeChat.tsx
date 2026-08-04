'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ──────────────────────────────────────────────────────────────────────────────
// Idea intake interview.
//
// The founder's opening sentence seeds a short adaptive interview; the answers
// are synthesized into a structured brief. Nothing is persisted until the
// founder confirms — this component owns the whole transcript and hands the
// finished brief to `onComplete`.
//
// Robustness contract: every network result is guarded, and any failure lands
// the founder on the review step with a seed-only brief rather than trapping
// them. There is always a way forward.
// ──────────────────────────────────────────────────────────────────────────────

export interface IdeaBriefValue {
    version: number
    summary: string
    problem: string
    targetCustomer: string
    solution: string
    differentiator: string
    businessModel: string
    stage: 'idea' | 'prototype' | 'launched'
    keyFeatures: string[]
    openQuestions: string[]
    transcript: { q: string; a: string }[]
    updatedAt: string
}

interface InterviewOption {
    label: string
    description: string
    recommended?: boolean
}

interface InterviewQuestion {
    id: string
    category: string
    question: string
    options: InterviewOption[]
    allowFreeText: boolean
}

interface Answer {
    q: string
    a: string
    skipped?: boolean
}

interface Props {
    seed: string
    docNames?: string[]
    /** Called when the founder confirms. Receives the (possibly edited) brief. */
    onComplete: (brief: IdeaBriefValue, suggestedName: string | null) => void | Promise<void>
    onBack?: () => void
    /** Label for the final confirm button. */
    confirmLabel?: string
    /** Disables input while the parent is creating the venture. */
    busy?: boolean
}

type Bubble =
    | { kind: 'founder'; text: string }
    | { kind: 'forze'; text: string; category?: string }

const MAX_ANSWER_LEN = 1000

function seedBrief(seed: string): IdeaBriefValue {
    return {
        version: 1,
        summary: seed.slice(0, 900),
        problem: '',
        targetCustomer: '',
        solution: seed.slice(0, 600),
        differentiator: '',
        businessModel: '',
        stage: 'idea',
        keyFeatures: [],
        openQuestions: [],
        transcript: [],
        updatedAt: new Date().toISOString(),
    }
}

/** Coerce an untrusted API payload into a usable brief. Never throws. */
function coerceBrief(raw: unknown, seed: string): IdeaBriefValue {
    const fallback = seedBrief(seed)
    if (!raw || typeof raw !== 'object') return fallback
    const r = raw as Record<string, unknown>
    const str = (k: string, max: number, dflt = ''): string => {
        const v = r[k]
        return typeof v === 'string' && v.trim() ? v.slice(0, max) : dflt
    }
    const list = (k: string): string[] =>
        Array.isArray(r[k]) ? (r[k] as unknown[]).filter((x): x is string => typeof x === 'string') : []
    const stage = r.stage
    return {
        version: typeof r.version === 'number' ? r.version : 1,
        summary: str('summary', 900, fallback.summary),
        problem: str('problem', 600),
        targetCustomer: str('targetCustomer', 400),
        solution: str('solution', 600),
        differentiator: str('differentiator', 400),
        businessModel: str('businessModel', 400),
        stage: stage === 'prototype' || stage === 'launched' ? stage : 'idea',
        keyFeatures: list('keyFeatures').slice(0, 12),
        openQuestions: list('openQuestions').slice(0, 6),
        transcript: Array.isArray(r.transcript)
            ? (r.transcript as { q: string; a: string }[]).slice(0, 12)
            : [],
        updatedAt: new Date().toISOString(),
    }
}

export function IdeaIntakeChat({
    seed,
    docNames = [],
    onComplete,
    onBack,
    confirmLabel = 'Create my venture',
    busy = false,
}: Props) {
    const [bubbles, setBubbles] = useState<Bubble[]>([{ kind: 'founder', text: seed }])
    const [answers, setAnswers] = useState<Answer[]>([])
    const [question, setQuestion] = useState<InterviewQuestion | null>(null)
    const [thinking, setThinking] = useState(true)
    const [freeText, setFreeText] = useState('')
    const [brief, setBrief] = useState<IdeaBriefValue | null>(null)
    const [suggestedName, setSuggestedName] = useState<string | null>(null)
    const [degraded, setDegraded] = useState(false)
    const [notice, setNotice] = useState('')

    const scrollRef = useRef<HTMLDivElement>(null)
    // Guards against a late response from an abandoned turn overwriting state.
    const turnRef = useRef(0)

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
        })
    }, [])

    useEffect(scrollToBottom, [bubbles, question, brief, scrollToBottom])

    const runTurn = useCallback(
        async (nextAnswers: Answer[], finalize: boolean) => {
            const turn = ++turnRef.current
            setThinking(true)
            setQuestion(null)
            setNotice('')

            try {
                const res = await fetch('/api/idea/interview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ seed, answers: nextAnswers, docNames, finalize }),
                })

                if (turn !== turnRef.current) return // superseded

                if (res.status === 429) {
                    setNotice('Slow down a moment — too many questions too quickly.')
                    setBrief(coerceBrief(null, seed))
                    setDegraded(true)
                    return
                }

                const data = res.ok ? await res.json().catch(() => null) : null

                if (!data) {
                    setBrief(coerceBrief(null, seed))
                    setDegraded(true)
                    return
                }

                if (data.aiApplied === false) setDegraded(true)

                if (data.done) {
                    setBrief(coerceBrief(data.brief, seed))
                    setSuggestedName(typeof data.suggestedName === 'string' ? data.suggestedName : null)
                    return
                }

                const q = data.question
                if (!q || typeof q.question !== 'string') {
                    setBrief(coerceBrief(data.brief, seed))
                    setDegraded(true)
                    return
                }

                const safeQuestion: InterviewQuestion = {
                    id: typeof q.id === 'string' ? q.id : `q${nextAnswers.length + 1}`,
                    category: typeof q.category === 'string' ? q.category : '',
                    question: q.question,
                    options: Array.isArray(q.options)
                        ? q.options
                              .filter((o: unknown): o is InterviewOption =>
                                  !!o && typeof (o as InterviewOption).label === 'string'
                              )
                              .slice(0, 4)
                              .map((o: InterviewOption) => ({
                                  label: o.label,
                                  description: typeof o.description === 'string' ? o.description : '',
                                  recommended: o.recommended === true,
                              }))
                        : [],
                    allowFreeText: true,
                }

                setQuestion(safeQuestion)
                setBubbles(prev => [
                    ...prev,
                    { kind: 'forze', text: safeQuestion.question, category: safeQuestion.category },
                ])
            } catch {
                if (turn !== turnRef.current) return
                setBrief(coerceBrief(null, seed))
                setDegraded(true)
            } finally {
                if (turn === turnRef.current) setThinking(false)
            }
        },
        [seed, docNames]
    )

    // Kick off the first question on mount.
    useEffect(() => {
        void runTurn([], false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function submitAnswer(text: string, skipped = false) {
        if (!question || thinking) return
        const value = text.slice(0, MAX_ANSWER_LEN)
        const next = [...answers, { q: question.question, a: value, skipped }]
        setAnswers(next)
        setBubbles(prev => [...prev, { kind: 'founder', text: skipped ? 'Skip' : value }])
        setFreeText('')
        void runTurn(next, false)
    }

    function finishEarly() {
        if (thinking) return
        void runTurn(answers, true)
    }

    // ── Review step ───────────────────────────────────────────────────────────
    if (brief) {
        return (
            <ReviewStep
                brief={brief}
                suggestedName={suggestedName}
                degraded={degraded}
                busy={busy}
                confirmLabel={confirmLabel}
                onChange={setBrief}
                onConfirm={() => void onComplete(brief, suggestedName)}
                onBack={onBack}
            />
        )
    }

    // ── Interview step ────────────────────────────────────────────────────────
    return (
        <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
                ref={scrollRef}
                style={{
                    maxHeight: '46vh',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    paddingRight: 4,
                }}
                className="no-scrollbar"
            >
                {bubbles.map((b, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28 }}
                        style={{
                            alignSelf: b.kind === 'founder' ? 'flex-end' : 'flex-start',
                            maxWidth: '86%',
                        }}
                    >
                        {b.kind === 'forze' && b.category && (
                            <div
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    color: 'var(--accent)',
                                    marginBottom: 4,
                                }}
                            >
                                {b.category}
                            </div>
                        )}
                        <div
                            style={{
                                padding: '10px 14px',
                                borderRadius: 14,
                                fontSize: 14,
                                lineHeight: 1.55,
                                background:
                                    b.kind === 'founder' ? 'var(--accent-soft)' : 'var(--nav-active)',
                                border: `1px solid ${b.kind === 'founder' ? 'var(--accent-glow)' : 'var(--border)'}`,
                                color: 'var(--text)',
                                whiteSpace: 'pre-wrap',
                            }}
                        >
                            {b.text}
                        </div>
                    </motion.div>
                ))}

                {thinking && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px' }}
                    >
                        {[0, 1, 2].map(i => (
                            <motion.span
                                key={i}
                                style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }}
                                animate={{ opacity: [0.25, 1, 0.25] }}
                                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                            />
                        ))}
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Forze is thinking…</span>
                    </motion.div>
                )}
            </div>

            {notice && (
                <div style={{ fontSize: 12, color: '#e05252', textAlign: 'center' }}>{notice}</div>
            )}

            <AnimatePresence mode="wait">
                {question && !thinking && (
                    <motion.div
                        key={question.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25 }}
                        className="glass-card"
                        style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
                    >
                        {question.options.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {question.options.map((opt, i) => (
                                    <motion.button
                                        key={i}
                                        type="button"
                                        onClick={() => submitAnswer(opt.description ? `${opt.label} — ${opt.description}` : opt.label)}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        style={{
                                            flex: '1 1 220px',
                                            textAlign: 'left',
                                            padding: '10px 12px',
                                            borderRadius: 10,
                                            background: opt.recommended ? 'var(--accent-soft)' : 'var(--nav-active)',
                                            border: `1px solid ${opt.recommended ? 'var(--accent-glow)' : 'var(--border)'}`,
                                            cursor: 'pointer',
                                            fontFamily: 'inherit',
                                            color: 'var(--text)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                            <span style={{ fontSize: 13, fontWeight: 650 }}>{opt.label}</span>
                                            {opt.recommended && (
                                                <span
                                                    style={{
                                                        fontSize: 9,
                                                        fontWeight: 700,
                                                        letterSpacing: '0.06em',
                                                        color: 'var(--accent)',
                                                        border: '1px solid var(--accent-glow)',
                                                        borderRadius: 999,
                                                        padding: '1px 6px',
                                                    }}
                                                >
                                                    PICK
                                                </span>
                                            )}
                                        </div>
                                        {opt.description && (
                                            <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.45 }}>
                                                {opt.description}
                                            </div>
                                        )}
                                    </motion.button>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                            <textarea
                                value={freeText}
                                onChange={e => setFreeText(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        if (freeText.trim()) submitAnswer(freeText.trim())
                                    }
                                }}
                                placeholder="Or answer in your own words…"
                                maxLength={MAX_ANSWER_LEN}
                                rows={1}
                                style={{
                                    flex: 1,
                                    minHeight: 38,
                                    maxHeight: 110,
                                    resize: 'vertical',
                                    padding: '9px 12px',
                                    borderRadius: 10,
                                    background: 'var(--bg)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text)',
                                    fontSize: 13.5,
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                }}
                                aria-label="Answer in your own words"
                            />
                            <button
                                type="button"
                                onClick={() => freeText.trim() && submitAnswer(freeText.trim())}
                                disabled={!freeText.trim()}
                                style={{
                                    padding: '9px 16px',
                                    borderRadius: 10,
                                    border: 'none',
                                    background: freeText.trim()
                                        ? 'linear-gradient(135deg, var(--accent), #e8963a)'
                                        : 'var(--nav-active)',
                                    color: freeText.trim() ? '#fff' : 'var(--muted)',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: freeText.trim() ? 'pointer' : 'not-allowed',
                                    fontFamily: 'inherit',
                                }}
                            >
                                Send
                            </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button
                                type="button"
                                onClick={() => submitAnswer('', true)}
                                style={linkButtonStyle}
                            >
                                Skip this
                            </button>
                            <button type="button" onClick={finishEarly} style={linkButtonStyle}>
                                Skip to my venture →
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Review step ──────────────────────────────────────────────────────────────

function ReviewStep({
    brief,
    suggestedName,
    degraded,
    busy,
    confirmLabel,
    onChange,
    onConfirm,
    onBack,
}: {
    brief: IdeaBriefValue
    suggestedName: string | null
    degraded: boolean
    busy: boolean
    confirmLabel: string
    onChange: (b: IdeaBriefValue) => void
    onConfirm: () => void
    onBack?: () => void
}) {
    const rows: { label: string; key: keyof IdeaBriefValue }[] = [
        { label: 'Problem', key: 'problem' },
        { label: 'Customer', key: 'targetCustomer' },
        { label: 'Solution', key: 'solution' },
        { label: 'Edge', key: 'differentiator' },
        { label: 'Money', key: 'businessModel' },
    ]

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 12 }}
        >
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                    Here&apos;s your brief
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
                    {degraded
                        ? 'We captured what you told us. Edit anything before continuing.'
                        : 'Every agent will build from this. Edit anything that looks off.'}
                </div>
            </div>

            <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                    <FieldLabel>Summary</FieldLabel>
                    <textarea
                        value={brief.summary}
                        onChange={e => onChange({ ...brief, summary: e.target.value.slice(0, 900) })}
                        maxLength={900}
                        rows={4}
                        disabled={busy}
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
                        aria-label="Idea summary"
                    />
                    <div
                        style={{
                            fontSize: 10.5,
                            color: 'var(--muted)',
                            textAlign: 'right',
                            marginTop: 3,
                            fontFamily: "'JetBrains Mono', monospace",
                        }}
                    >
                        {brief.summary.length}/900
                    </div>
                </div>

                {rows.map(({ label, key }) => {
                    const value = brief[key]
                    if (typeof value !== 'string' || !value.trim()) return null
                    return (
                        <div key={key}>
                            <FieldLabel>{label}</FieldLabel>
                            <input
                                value={value}
                                onChange={e => onChange({ ...brief, [key]: e.target.value })}
                                disabled={busy}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: 9,
                                    background: 'var(--bg)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text)',
                                    fontSize: 13,
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                }}
                                aria-label={label}
                            />
                        </div>
                    )
                })}

                {brief.keyFeatures.length > 0 && (
                    <div>
                        <FieldLabel>Key features</FieldLabel>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {brief.keyFeatures.map((f, i) => (
                                <span
                                    key={i}
                                    style={{
                                        fontSize: 11.5,
                                        padding: '4px 10px',
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
                    </div>
                )}

                {brief.openQuestions.length > 0 && (
                    <div>
                        <FieldLabel>Still open</FieldLabel>
                        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {brief.openQuestions.map((q, i) => (
                                <li key={i} style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                                    {q}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {suggestedName && (
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        Suggested name: <strong style={{ color: 'var(--accent)' }}>{suggestedName}</strong>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                {onBack ? (
                    <button type="button" onClick={onBack} disabled={busy} style={linkButtonStyle}>
                        ← Start over
                    </button>
                ) : (
                    <span />
                )}
                <motion.button
                    type="button"
                    onClick={onConfirm}
                    disabled={busy || !brief.summary.trim()}
                    whileHover={!busy ? { scale: 1.03 } : {}}
                    whileTap={!busy ? { scale: 0.97 } : {}}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 22px',
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, var(--accent), #e8963a)',
                        border: 'none',
                        color: '#fff',
                        fontSize: 13.5,
                        fontWeight: 650,
                        cursor: busy ? 'wait' : 'pointer',
                        fontFamily: 'inherit',
                        boxShadow: '0 4px 14px var(--accent-glow)',
                        opacity: busy || !brief.summary.trim() ? 0.65 : 1,
                    }}
                >
                    {busy ? 'Creating…' : confirmLabel}
                </motion.button>
            </div>
        </motion.div>
    )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                marginBottom: 5,
            }}
        >
            {children}
        </div>
    )
}

const linkButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '4px 2px',
}
