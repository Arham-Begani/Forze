'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'

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

interface InterviewQuestion {
    id: string
    category: string
    question: string
    suggestion: string
}

interface Answer {
    q: string
    a: string
    skipped?: boolean
}

interface Props {
    seed?: string
    docNames?: string[]
    onComplete: (brief: IdeaBriefValue, suggestedName: string | null) => void | Promise<void>
    onBack?: () => void
    confirmLabel?: string
    busy?: boolean
    openingLine?: string
    placeholder?: string
    attachSlot?: React.ReactNode
    onSeedCaptured?: (seed: string) => void
}

type Bubble =
    | { kind: 'founder'; text: string }
    | { kind: 'forze'; text: string; category?: string }

const MAX_ANSWER_LEN = 1000
const MIN_SEED_LEN = 6
const MONO = "'JetBrains Mono', ui-monospace, monospace"

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

function HexMark({ size = 20, spinning = false }: { size?: number; spinning?: boolean }) {
    return (
        <motion.div
            animate={spinning ? { rotate: 360 } : { rotate: 0 }}
            transition={spinning ? { duration: 3.5, repeat: Infinity, ease: 'linear' } : { duration: 0.4 }}
            style={{
                width: size,
                height: size,
                flexShrink: 0,
                background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                boxShadow: '0 0 14px var(--accent-glow)',
            }}
        />
    )
}

export function IdeaIntakeChat({
    seed: seedProp,
    docNames = [],
    onComplete,
    onBack,
    confirmLabel = 'Create my venture',
    busy = false,
    openingLine = 'What do you want to build? Give me a sentence or two — I’ll ask the rest.',
    placeholder = 'Describe your idea…',
    attachSlot,
    onSeedCaptured,
}: Props) {
    const hasInitialSeed = !!seedProp && seedProp.trim().length >= MIN_SEED_LEN
    const [seed, setSeed] = useState(hasInitialSeed ? seedProp!.trim() : '')
    const [bubbles, setBubbles] = useState<Bubble[]>(
        hasInitialSeed
            ? [{ kind: 'founder', text: seedProp!.trim() }]
            : [{ kind: 'forze', text: openingLine }]
    )
    const [answers, setAnswers] = useState<Answer[]>([])
    const [question, setQuestion] = useState<InterviewQuestion | null>(null)
    const [thinking, setThinking] = useState(hasInitialSeed)
    const [freeText, setFreeText] = useState('')
    const [brief, setBrief] = useState<IdeaBriefValue | null>(null)
    const [suggestedName, setSuggestedName] = useState<string | null>(null)
    const [degraded, setDegraded] = useState(false)
    const [notice, setNotice] = useState('')
    const [totalSteps, setTotalSteps] = useState(8)

    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const turnRef = useRef(0)
    const awaitingSeed = !seed

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
        })
    }, [])

    useEffect(scrollToBottom, [bubbles, question, brief, thinking, scrollToBottom])

    useEffect(() => {
        if (question && !thinking) inputRef.current?.focus()
    }, [question, thinking])

    const runTurn = useCallback(
        async (activeSeed: string, nextAnswers: Answer[], finalize: boolean) => {
            const turn = ++turnRef.current
            setThinking(true)
            setQuestion(null)
            setNotice('')

            try {
                const res = await fetch('/api/idea/interview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ seed: activeSeed, answers: nextAnswers, docNames, finalize }),
                })

                if (turn !== turnRef.current) return

                if (res.status === 429) {
                    setNotice('Slow down a moment — too many questions too quickly.')
                    setBrief(coerceBrief(null, activeSeed))
                    setDegraded(true)
                    return
                }

                const data = res.ok ? await res.json().catch(() => null) : null

                if (!data) {
                    setBrief(coerceBrief(null, activeSeed))
                    setDegraded(true)
                    return
                }

                if (typeof data.progress?.max === 'number') setTotalSteps(data.progress.max)
                if (data.aiApplied === false) setDegraded(true)

                if (data.done) {
                    setBrief(coerceBrief(data.brief, activeSeed))
                    setSuggestedName(typeof data.suggestedName === 'string' ? data.suggestedName : null)
                    return
                }

                const q = data.question
                if (!q || typeof q.question !== 'string') {
                    setBrief(coerceBrief(data.brief, activeSeed))
                    setDegraded(true)
                    return
                }

                const safeQuestion: InterviewQuestion = {
                    id: typeof q.id === 'string' ? q.id : `q${nextAnswers.length + 1}`,
                    category: typeof q.category === 'string' ? q.category : '',
                    question: q.question,
                    suggestion: typeof q.suggestion === 'string' ? q.suggestion.slice(0, 240) : '',
                }

                setQuestion(safeQuestion)
                setBubbles(prev => [
                    ...prev,
                    { kind: 'forze', text: safeQuestion.question, category: safeQuestion.category },
                ])
            } catch {
                if (turn !== turnRef.current) return
                setBrief(coerceBrief(null, activeSeed))
                setDegraded(true)
            } finally {
                if (turn === turnRef.current) setThinking(false)
            }
        },
        [docNames]
    )

    useEffect(() => {
        if (hasInitialSeed) void runTurn(seedProp!.trim(), [], false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function submitSeed(text: string) {
        const value = text.trim().slice(0, 2000)
        if (value.length < MIN_SEED_LEN || thinking) return
        setSeed(value)
        setBubbles(prev => [...prev, { kind: 'founder', text: value }])
        setFreeText('')
        onSeedCaptured?.(value)
        void runTurn(value, [], false)
    }

    function submitAnswer(text: string, skipped = false) {
        if (!question || thinking) return
        const value = text.slice(0, MAX_ANSWER_LEN)
        const next = [...answers, { q: question.question, a: value, skipped }]
        setAnswers(next)
        setBubbles(prev => [...prev, { kind: 'founder', text: skipped ? 'Skip' : value }])
        setFreeText('')
        void runTurn(seed, next, false)
    }

    function finishEarly() {
        if (thinking) return
        void runTurn(seed, answers, true)
    }

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

    const answered = answers.length
    const suggestion = question?.suggestion?.trim() ?? ''
    const canSendFree = freeText.trim().length >= (awaitingSeed ? MIN_SEED_LEN : 1)
    const composerOpen = (awaitingSeed || !!question) && !thinking

    return (
        <div style={{ width: '100%', maxWidth: 660, position: 'relative' }}>
            <motion.div
                aria-hidden
                animate={{ opacity: thinking ? 0.5 : 0.28 }}
                transition={{ duration: 0.8 }}
                style={{
                    position: 'absolute',
                    inset: '-14% -8% 20%',
                    background: 'radial-gradient(ellipse at 50% 0%, var(--accent-glow) 0%, transparent 70%)',
                    filter: 'blur(48px)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />

            <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="glass-card"
                style={{
                    position: 'relative',
                    zIndex: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'var(--shadow-lg)',
                }}
            >
                <motion.div
                    aria-hidden
                    style={{
                        height: 2,
                        background: 'linear-gradient(90deg, transparent, var(--accent), #e8a04e, var(--accent), transparent)',
                        backgroundSize: '200% 100%',
                    }}
                    animate={thinking ? { backgroundPosition: ['0% 50%', '200% 50%'] } : { backgroundPosition: '100% 50%' }}
                    transition={thinking ? { duration: 1.6, repeat: Infinity, ease: 'linear' } : { duration: 0.6 }}
                />

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 14,
                        padding: '13px 18px',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--glass-bg-strong)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <HexMark size={18} spinning={thinking} />
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                                Idea interview
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.35 }}>
                                {thinking ? 'Forze is thinking…' : awaitingSeed ? 'Tell me the idea' : 'Answer or skip — nothing is saved yet'}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: 3 }} aria-hidden>
                            {Array.from({ length: totalSteps }).map((_, i) => (
                                <motion.span
                                    key={i}
                                    initial={false}
                                    animate={{
                                        background: i < answered ? 'var(--accent)' : 'var(--border-strong)',
                                        opacity: i < answered ? 1 : 0.45,
                                    }}
                                    transition={{ duration: 0.35, delay: i < answered ? i * 0.03 : 0 }}
                                    style={{ width: 12, height: 3, borderRadius: 2, display: 'block' }}
                                />
                            ))}
                        </div>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.02em' }}>
                            {String(answered).padStart(2, '0')}/{String(totalSteps).padStart(2, '0')}
                        </span>
                    </div>
                </div>

                <div
                    ref={scrollRef}
                    className="no-scrollbar"
                    style={{
                        maxHeight: '42vh',
                        minHeight: 132,
                        overflowY: 'auto',
                        padding: '18px 18px 6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                    }}
                >
                    {bubbles.map((b, i) =>
                        b.kind === 'forze' ? (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                style={{ display: 'flex', gap: 10, alignItems: 'flex-start', maxWidth: '92%' }}
                            >
                                <div style={{ paddingTop: 3 }}>
                                    <HexMark size={15} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    {b.category && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 7,
                                                marginBottom: 5,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontFamily: MONO,
                                                    fontSize: 9,
                                                    fontWeight: 700,
                                                    letterSpacing: '0.14em',
                                                    textTransform: 'uppercase',
                                                    color: 'var(--accent)',
                                                }}
                                            >
                                                {b.category}
                                            </span>
                                            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            padding: '11px 15px',
                                            borderRadius: '4px 14px 14px 14px',
                                            fontSize: 14.5,
                                            lineHeight: 1.6,
                                            background: 'var(--bg-deep)',
                                            border: '1px solid var(--border)',
                                            color: 'var(--text)',
                                            whiteSpace: 'pre-wrap',
                                        }}
                                    >
                                        {b.text}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                style={{ alignSelf: 'flex-end', maxWidth: '84%' }}
                            >
                                <div
                                    style={{
                                        padding: '10px 15px',
                                        borderRadius: '14px 4px 14px 14px',
                                        fontSize: 14,
                                        lineHeight: 1.55,
                                        background: 'var(--accent-soft)',
                                        border: '1px solid var(--accent-glow)',
                                        color: 'var(--text)',
                                        whiteSpace: 'pre-wrap',
                                    }}
                                >
                                    {b.text}
                                </div>
                            </motion.div>
                        )
                    )}

                    {thinking && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{ display: 'flex', gap: 10, alignItems: 'center' }}
                        >
                            <HexMark size={15} spinning />
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '11px 16px',
                                    borderRadius: '4px 14px 14px 14px',
                                    background: 'var(--bg-deep)',
                                    border: '1px solid var(--border)',
                                }}
                            >
                                {[0, 1, 2].map(i => (
                                    <motion.span
                                        key={i}
                                        style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }}
                                        animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
                                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.16 }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>

                {notice && (
                    <div
                        style={{
                            margin: '0 18px 10px',
                            padding: '8px 12px',
                            borderRadius: 9,
                            fontSize: 12,
                            color: '#e05252',
                            background: 'rgba(224,82,82,0.08)',
                            border: '1px solid rgba(224,82,82,0.25)',
                        }}
                    >
                        {notice}
                    </div>
                )}

                <div style={{ padding: '12px 18px 14px' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: 8,
                            padding: 6,
                            borderRadius: 13,
                            background: 'var(--bg)',
                            border: `1px solid ${composerOpen ? 'var(--border-strong)' : 'var(--border)'}`,
                            transition: 'border-color 200ms',
                            opacity: composerOpen ? 1 : 0.55,
                        }}
                    >
                        <textarea
                            ref={inputRef}
                            value={freeText}
                            onChange={e => setFreeText(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Tab' && suggestion && !freeText.trim()) {
                                    e.preventDefault()
                                    setFreeText(suggestion)
                                    return
                                }
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    if (!canSendFree) return
                                    if (awaitingSeed) submitSeed(freeText)
                                    else submitAnswer(freeText.trim())
                                }
                            }}
                            placeholder={awaitingSeed ? placeholder : suggestion || 'Answer in your own words…'}
                            maxLength={awaitingSeed ? 2000 : MAX_ANSWER_LEN}
                            rows={awaitingSeed || suggestion ? 3 : 1}
                            disabled={!composerOpen}
                            autoFocus={awaitingSeed}
                            style={{
                                flex: 1,
                                minHeight: awaitingSeed || suggestion ? 62 : 34,
                                maxHeight: 150,
                                resize: 'none',
                                padding: '8px 10px',
                                borderRadius: 9,
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text)',
                                fontSize: 14,
                                lineHeight: 1.6,
                                fontFamily: 'inherit',
                                outline: 'none',
                            }}
                            aria-label={awaitingSeed ? 'Describe your idea' : 'Answer in your own words'}
                        />
                        <motion.button
                            type="button"
                            onClick={() => {
                                if (!canSendFree) return
                                if (awaitingSeed) submitSeed(freeText)
                                else submitAnswer(freeText.trim())
                            }}
                            disabled={!canSendFree || !composerOpen}
                            whileHover={canSendFree && composerOpen ? { scale: 1.05 } : {}}
                            whileTap={canSendFree && composerOpen ? { scale: 0.95 } : {}}
                            style={{
                                width: 34,
                                height: 34,
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 9,
                                border: 'none',
                                background: canSendFree && composerOpen
                                    ? 'linear-gradient(135deg, var(--accent), #e8963a)'
                                    : 'var(--nav-active)',
                                color: canSendFree && composerOpen ? '#fff' : 'var(--muted)',
                                cursor: canSendFree && composerOpen ? 'pointer' : 'not-allowed',
                                boxShadow: canSendFree && composerOpen ? '0 3px 12px var(--accent-glow)' : 'none',
                                transition: 'background 200ms, box-shadow 200ms',
                            }}
                            aria-label="Send"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </motion.button>
                    </div>

                    {attachSlot && <div style={{ marginTop: 9 }}>{attachSlot}</div>}

                    {!awaitingSeed && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginTop: 10,
                                gap: 12,
                                flexWrap: 'wrap',
                            }}
                        >
                            {suggestion && !freeText.trim() && composerOpen ? (
                                <button
                                    type="button"
                                    onClick={() => setFreeText(suggestion)}
                                    style={{ ...quietButton, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)' }}
                                >
                                    <kbd
                                        style={{
                                            fontFamily: MONO,
                                            fontSize: 9,
                                            fontWeight: 700,
                                            padding: '2px 5px',
                                            borderRadius: 4,
                                            border: '1px solid var(--accent-glow)',
                                            background: 'var(--accent-soft)',
                                            lineHeight: 1,
                                        }}
                                    >
                                        Tab
                                    </kbd>
                                    use this answer
                                </button>
                            ) : (
                                <button type="button" onClick={() => submitAnswer('', true)} disabled={!composerOpen} style={quietButton}>
                                    Skip this question
                                </button>
                            )}
                            <button type="button" onClick={finishEarly} disabled={thinking} style={{ ...quietButton, color: 'var(--accent)' }}>
                                I’m done — build it →
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    )
}

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
    const filled = rows.filter(r => typeof brief[r.key] === 'string' && (brief[r.key] as string).trim())

    return (
        <div style={{ width: '100%', maxWidth: 660, position: 'relative' }}>
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: '-12% -8% 24%',
                    background: 'radial-gradient(ellipse at 50% 0%, var(--accent-glow) 0%, transparent 70%)',
                    filter: 'blur(48px)',
                    opacity: 0.32,
                    pointerEvents: 'none',
                }}
            />

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="glass-card"
                style={{ position: 'relative', zIndex: 1, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}
            >
                <div
                    aria-hidden
                    style={{
                        height: 2,
                        background: 'linear-gradient(90deg, transparent, var(--accent), #e8a04e, var(--accent), transparent)',
                    }}
                />

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        padding: '15px 20px',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--glass-bg-strong)',
                    }}
                >
                    <HexMark size={20} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                            Your brief
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                            {degraded
                                ? 'Captured from what you told us — edit anything.'
                                : 'Every agent builds from this. Edit anything that looks off.'}
                        </div>
                    </div>
                    {suggestedName && (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                                Name
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.01em' }}>
                                {suggestedName}
                            </div>
                        </div>
                    )}
                </div>

                <div className="no-scrollbar" style={{ maxHeight: '52vh', overflowY: 'auto', padding: '18px 20px' }}>
                    <FieldLabel>Summary</FieldLabel>
                    <textarea
                        value={brief.summary}
                        onChange={e => onChange({ ...brief, summary: e.target.value.slice(0, 900) })}
                        maxLength={900}
                        rows={6}
                        disabled={busy}
                        style={{
                            width: '100%',
                            resize: 'vertical',
                            padding: '12px 14px',
                            borderRadius: 11,
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                            fontSize: 14,
                            lineHeight: 1.7,
                            fontFamily: 'inherit',
                            outline: 'none',
                            display: 'block',
                        }}
                        aria-label="Idea summary"
                    />
                    <div
                        style={{
                            fontFamily: MONO,
                            fontSize: 9.5,
                            color: brief.summary.length > 850 ? '#e05252' : 'var(--muted)',
                            textAlign: 'right',
                            marginTop: 5,
                        }}
                    >
                        {brief.summary.length}/900
                    </div>

                    {filled.length > 0 && (
                        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column' }}>
                            {filled.map(({ label, key }, i) => (
                                <div
                                    key={key}
                                    style={{
                                        display: 'flex',
                                        gap: 12,
                                        alignItems: 'flex-start',
                                        padding: '10px 0',
                                        borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                                    }}
                                >
                                    <span
                                        style={{
                                            fontFamily: MONO,
                                            fontSize: 9,
                                            fontWeight: 700,
                                            letterSpacing: '0.12em',
                                            textTransform: 'uppercase',
                                            color: 'var(--muted)',
                                            width: 74,
                                            flexShrink: 0,
                                            paddingTop: 7,
                                        }}
                                    >
                                        {label}
                                    </span>
                                    <textarea
                                        value={brief[key] as string}
                                        onChange={e => onChange({ ...brief, [key]: e.target.value })}
                                        disabled={busy}
                                        rows={2}
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            padding: '5px 9px',
                                            borderRadius: 8,
                                            background: 'transparent',
                                            border: '1px solid transparent',
                                            color: 'var(--text-soft)',
                                            fontSize: 13,
                                            lineHeight: 1.55,
                                            fontFamily: 'inherit',
                                            outline: 'none',
                                            resize: 'vertical',
                                            transition: 'background 160ms, border-color 160ms',
                                        }}
                                        onFocus={e => {
                                            e.currentTarget.style.background = 'var(--bg)'
                                            e.currentTarget.style.borderColor = 'var(--border-strong)'
                                        }}
                                        onBlur={e => {
                                            e.currentTarget.style.background = 'transparent'
                                            e.currentTarget.style.borderColor = 'transparent'
                                        }}
                                        aria-label={label}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {brief.keyFeatures.length > 0 && (
                        <div style={{ marginTop: 18 }}>
                            <FieldLabel>Key features</FieldLabel>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {brief.keyFeatures.map((f, i) => (
                                    <span
                                        key={i}
                                        style={{
                                            fontSize: 11.5,
                                            padding: '4px 11px',
                                            borderRadius: 999,
                                            background: 'var(--glass-bg-strong)',
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
                        <div style={{ marginTop: 18 }}>
                            <FieldLabel>Still open</FieldLabel>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {brief.openQuestions.map((q, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                                        <span
                                            style={{
                                                width: 4,
                                                height: 4,
                                                borderRadius: '50%',
                                                background: 'var(--accent)',
                                                marginTop: 7,
                                                flexShrink: 0,
                                                opacity: 0.7,
                                            }}
                                        />
                                        <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{q}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '13px 20px',
                        borderTop: '1px solid var(--border)',
                        background: 'var(--glass-bg-strong)',
                    }}
                >
                    {onBack ? (
                        <button type="button" onClick={onBack} disabled={busy} style={quietButton}>
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
                            gap: 9,
                            padding: '10px 22px',
                            borderRadius: 11,
                            background: 'linear-gradient(135deg, var(--accent), #e8963a)',
                            border: 'none',
                            color: '#fff',
                            fontSize: 13.5,
                            fontWeight: 650,
                            cursor: busy ? 'wait' : 'pointer',
                            fontFamily: 'inherit',
                            boxShadow: '0 4px 16px var(--accent-glow)',
                            opacity: busy || !brief.summary.trim() ? 0.6 : 1,
                        }}
                    >
                        {busy ? (
                            <>
                                <motion.span
                                    style={{
                                        width: 13,
                                        height: 13,
                                        border: '2px solid rgba(255,255,255,0.35)',
                                        borderTopColor: '#fff',
                                        borderRadius: '50%',
                                    }}
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                                />
                                Creating…
                            </>
                        ) : (
                            confirmLabel
                        )}
                    </motion.button>
                </div>
            </motion.div>
        </div>
    )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                marginBottom: 7,
            }}
        >
            {children}
        </div>
    )
}

const quietButton: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    fontSize: 11.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '4px 2px',
}
