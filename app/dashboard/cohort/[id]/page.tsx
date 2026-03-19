'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface Venture {
    id: string
    name: string
    context: Record<string, any>
}

interface CohortData {
    id: string
    name: string
    core_idea: string
    status: 'draft' | 'running' | 'comparing' | 'complete'
    variant_ids: string[]
    winner_id: string | null
    comparison: any | null
    ventures: Venture[]
}

interface AgentState {
    [variantId: string]: {
        status: 'waiting' | 'running' | 'complete' | 'failed'
        agents: { [agentId: string]: 'waiting' | 'running' | 'complete' | 'failed' }
    }
}

const STATUS_COLORS: Record<string, string> = {
    draft: '#a8a29e',
    running: '#C4975A',
    comparing: '#7A5A8C',
    complete: '#5A8C6E',
}

const AGENT_NAMES: Record<string, string> = {
    genesis: 'Genesis Engine',
    identity: 'Identity Architect',
    marketing: 'Content Factory',
    pipeline: 'Production Pipeline',
    feasibility: 'Deep Validation',
}

const RANK_COLORS = ['#C4975A', '#a8a29e', '#8C7A5A']
const RANK_LABELS = ['1st', '2nd', '3rd']

export default function CohortDashboardPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()

    const [cohort, setCohort] = useState<CohortData | null>(null)
    const [loading, setLoading] = useState(true)
    const [launching, setLaunching] = useState(false)
    const [agentStates, setAgentStates] = useState<AgentState>({})
    const [pickingWinner, setPickingWinner] = useState<string | null>(null)
    const streamRef = useRef<ReadableStreamDefaultReader | null>(null)

    const fetchCohort = useCallback(async () => {
        try {
            const res = await fetch(`/api/cohorts/${id}`)
            if (res.ok) {
                const data = await res.json()
                setCohort(data)
            }
        } catch (err) {
            console.error('Failed to load cohort:', err)
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => {
        fetchCohort()
    }, [fetchCohort])

    async function handleLaunch(strategy: 'sequential' | 'parallel' = 'sequential') {
        if (!cohort) return
        setLaunching(true)

        // Initialize agent states
        const initStates: AgentState = {}
        for (const v of cohort.ventures) {
            initStates[v.id] = {
                status: 'waiting',
                agents: { genesis: 'waiting', identity: 'waiting', marketing: 'waiting', pipeline: 'waiting', feasibility: 'waiting' },
            }
        }
        setAgentStates(initStates)

        try {
            const res = await fetch(`/api/cohorts/${id}/launch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategy }),
            })

            if (!res.ok || !res.body) throw new Error('Launch failed')

            const reader = res.body.getReader()
            streamRef.current = reader
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })

                const lines = buffer.split('\n')
                buffer = lines.pop() ?? ''

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    try {
                        const data = JSON.parse(line.slice(6))
                        handleSSEEvent(line.match(/^event: (\S+)/)?.[1] || '', data)
                    } catch {}
                }
            }

            // Refresh cohort data
            await fetchCohort()
        } catch (err) {
            console.error('Launch error:', err)
        } finally {
            setLaunching(false)
        }
    }

    function handleSSEEvent(event: string, data: any) {
        // Parse from combined event+data lines
        if (data.variantId && data.status && !data.agentId) {
            // variant-status
            setAgentStates(prev => ({
                ...prev,
                [data.variantId]: {
                    ...prev[data.variantId],
                    status: data.status,
                },
            }))
        }
        if (data.variantId && data.agentId && data.status) {
            // variant-agent-status
            setAgentStates(prev => ({
                ...prev,
                [data.variantId]: {
                    ...prev[data.variantId],
                    agents: {
                        ...prev[data.variantId]?.agents,
                        [data.agentId]: data.status,
                    },
                },
            }))
        }
    }

    async function handlePickWinner(winnerId: string) {
        setPickingWinner(winnerId)
        try {
            const res = await fetch(`/api/cohorts/${id}/pick-winner`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ winnerId }),
            })
            if (res.ok) {
                await fetchCohort()
            }
        } finally {
            setPickingWinner(null)
        }
    }

    if (loading) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                Loading cohort...
            </div>
        )
    }

    if (!cohort) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                Cohort not found.
            </div>
        )
    }

    const comparison = cohort.comparison as any

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>
                        {cohort.name}
                    </h1>
                    <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 6,
                        background: `${STATUS_COLORS[cohort.status]}20`,
                        color: STATUS_COLORS[cohort.status],
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}>
                        {cohort.status}
                    </span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-soft)', maxWidth: 600 }}>
                    {cohort.core_idea}
                </p>
            </motion.div>

            {/* Launch button (draft state) */}
            {cohort.status === 'draft' && cohort.ventures.length >= 2 && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleLaunch('sequential')}
                        disabled={launching}
                        style={{
                            padding: '12px 24px',
                            borderRadius: 10,
                            border: 'none',
                            background: 'var(--accent)',
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: launching ? 'wait' : 'pointer',
                            fontFamily: 'inherit',
                            opacity: launching ? 0.6 : 1,
                        }}
                    >
                        {launching ? 'Launching...' : 'Launch Sequential'}
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleLaunch('parallel')}
                        disabled={launching}
                        style={{
                            padding: '12px 24px',
                            borderRadius: 10,
                            border: '1px solid var(--accent)',
                            background: 'var(--accent-soft)',
                            color: 'var(--accent)',
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: launching ? 'wait' : 'pointer',
                            fontFamily: 'inherit',
                            opacity: launching ? 0.6 : 1,
                        }}
                    >
                        Launch Parallel
                    </motion.button>
                </div>
            )}

            {/* Variant Progress Cards */}
            {(cohort.status === 'running' || launching || cohort.status === 'draft') && cohort.ventures.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 16, textTransform: 'uppercase' }}>
                        Variants
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cohort.ventures.length, 3)}, 1fr)`, gap: 16 }}>
                        {cohort.ventures.map((venture) => {
                            const state = agentStates[venture.id]
                            const isWinner = cohort.winner_id === venture.id

                            return (
                                <motion.div
                                    key={venture.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{
                                        background: 'var(--card)',
                                        border: `1px solid ${isWinner ? '#C4975A' : 'var(--border)'}`,
                                        borderRadius: 14,
                                        padding: 18,
                                        opacity: cohort.winner_id && !isWinner ? 0.5 : 1,
                                        position: 'relative',
                                    }}
                                >
                                    {isWinner && (
                                        <div style={{
                                            position: 'absolute',
                                            top: -10,
                                            right: 12,
                                            fontSize: 20,
                                        }}>
                                            &#128081;
                                        </div>
                                    )}

                                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                                        {venture.name}
                                    </div>

                                    {/* Agent status rows */}
                                    {state && Object.entries(state.agents).map(([agentId, agentStatus]) => (
                                        <div
                                            key={agentId}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '6px 0',
                                                borderBottom: '1px solid var(--border)',
                                            }}
                                        >
                                            <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                                                {AGENT_NAMES[agentId] || agentId}
                                            </span>
                                            <span style={{
                                                fontSize: 10,
                                                fontWeight: 700,
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                background: agentStatus === 'complete' ? 'rgba(90, 140, 110, 0.15)' :
                                                    agentStatus === 'running' ? 'rgba(196, 151, 90, 0.15)' :
                                                        agentStatus === 'failed' ? 'rgba(224, 72, 72, 0.15)' : 'var(--nav-active)',
                                                color: agentStatus === 'complete' ? '#5A8C6E' :
                                                    agentStatus === 'running' ? '#C4975A' :
                                                        agentStatus === 'failed' ? '#E04848' : 'var(--muted)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                            }}>
                                                {agentStatus}
                                            </span>
                                        </div>
                                    ))}

                                    {/* Link to venture */}
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => router.push(`/dashboard/venture/${venture.id}/research`)}
                                        style={{
                                            marginTop: 12,
                                            width: '100%',
                                            padding: '8px',
                                            borderRadius: 8,
                                            border: '1px solid var(--border)',
                                            background: 'transparent',
                                            color: 'var(--text-soft)',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        View Venture
                                    </motion.button>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Comparison section */}
            {cohort.status === 'complete' && comparison && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 16, textTransform: 'uppercase' }}>
                        Comparison Matrix
                    </h2>

                    {/* Matrix table */}
                    {comparison.matrix && (
                        <div style={{
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: 14,
                            overflow: 'hidden',
                            marginBottom: 24,
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-soft)', fontWeight: 600 }}>
                                            Dimension
                                        </th>
                                        {comparison.matrix[0]?.variants?.map((v: any) => (
                                            <th key={v.variantName} style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text)', fontWeight: 600 }}>
                                                {v.variantName}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparison.matrix.map((dim: any, i: number) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '10px 16px', color: 'var(--text-soft)', fontWeight: 500 }}>
                                                {dim.dimension}
                                            </td>
                                            {dim.variants?.map((v: any) => {
                                                const isWinner = v.variantName === dim.winner
                                                return (
                                                    <td key={v.variantName} style={{
                                                        padding: '10px 16px',
                                                        textAlign: 'center',
                                                        background: isWinner ? 'rgba(90, 140, 110, 0.08)' : 'transparent',
                                                        color: isWinner ? '#5A8C6E' : 'var(--text)',
                                                        fontWeight: isWinner ? 600 : 400,
                                                    }}>
                                                        <div>{v.value}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Score: {v.score}/10</div>
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}

                                    {/* Overall scores row */}
                                    {comparison.overallScores && (
                                        <tr style={{ borderTop: '2px solid var(--border)' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                                                Overall Score
                                            </td>
                                            {comparison.overallScores
                                                .sort((a: any, b: any) => {
                                                    const firstVariants = comparison.matrix[0]?.variants || []
                                                    const aIdx = firstVariants.findIndex((v: any) => v.variantName === a.variantName)
                                                    const bIdx = firstVariants.findIndex((v: any) => v.variantName === b.variantName)
                                                    return aIdx - bIdx
                                                })
                                                .map((score: any) => (
                                                    <td key={score.variantName} style={{
                                                        padding: '12px 16px',
                                                        textAlign: 'center',
                                                        fontWeight: 700,
                                                    }}>
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '4px 12px',
                                                            borderRadius: 8,
                                                            background: `${RANK_COLORS[score.rank - 1] || 'var(--muted)'}20`,
                                                            color: RANK_COLORS[score.rank - 1] || 'var(--muted)',
                                                            fontSize: 14,
                                                        }}>
                                                            {score.score}/100 ({RANK_LABELS[score.rank - 1] || `${score.rank}th`})
                                                        </span>
                                                    </td>
                                                ))}
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Recommended Winner */}
                    {comparison.recommendedWinner && (
                        <div style={{
                            background: 'var(--card)',
                            border: '2px solid #5A8C6E',
                            borderRadius: 14,
                            padding: 20,
                            marginBottom: 16,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#5A8C6E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Recommended Winner
                                </span>
                                <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    background: comparison.recommendedWinner.confidence === 'high' ? 'rgba(90, 140, 110, 0.15)' :
                                        comparison.recommendedWinner.confidence === 'medium' ? 'rgba(196, 151, 90, 0.15)' : 'rgba(224, 72, 72, 0.15)',
                                    color: comparison.recommendedWinner.confidence === 'high' ? '#5A8C6E' :
                                        comparison.recommendedWinner.confidence === 'medium' ? '#C4975A' : '#E04848',
                                    textTransform: 'uppercase',
                                }}>
                                    {comparison.recommendedWinner.confidence} confidence
                                </span>
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                                {comparison.recommendedWinner.variantName}
                            </div>
                            <p style={{ fontSize: 14, color: 'var(--text-soft)', lineHeight: 1.6, marginBottom: 12 }}>
                                {comparison.recommendedWinner.rationale}
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div style={{ padding: 12, borderRadius: 10, background: 'rgba(90, 140, 110, 0.06)', border: '1px solid rgba(90, 140, 110, 0.15)' }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: '#5A8C6E', marginBottom: 4 }}>PRIMARY ADVANTAGE</div>
                                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{comparison.recommendedWinner.primaryAdvantage}</div>
                                </div>
                                <div style={{ padding: 12, borderRadius: 10, background: 'rgba(224, 72, 72, 0.06)', border: '1px solid rgba(224, 72, 72, 0.15)' }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: '#E04848', marginBottom: 4 }}>BIGGEST RISK</div>
                                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{comparison.recommendedWinner.biggestRisk}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Runner-up + Hybrid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        {comparison.runnerUpCase && (
                            <div style={{
                                background: 'var(--card)',
                                border: '1px solid var(--border)',
                                borderRadius: 14,
                                padding: 18,
                            }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Runner-up Case
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                                    {comparison.runnerUpCase.variantName}
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5 }}>
                                    {comparison.runnerUpCase.whenToChooseInstead}
                                </p>
                            </div>
                        )}

                        {comparison.hybridPossibility && (
                            <div style={{
                                background: 'var(--card)',
                                border: `1px solid ${comparison.hybridPossibility.possible ? 'var(--accent)' : 'var(--border)'}`,
                                borderRadius: 14,
                                padding: 18,
                            }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Hybrid Possibility
                                </div>
                                <div style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginBottom: 6,
                                    color: comparison.hybridPossibility.possible ? '#5A8C6E' : '#E04848',
                                }}>
                                    {comparison.hybridPossibility.possible ? 'Hybrid is possible' : 'Not recommended'}
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5 }}>
                                    {comparison.hybridPossibility.description}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Analysis notes */}
                    {comparison.analysisNotes && (
                        <div style={{
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: 14,
                            padding: 20,
                            marginBottom: 24,
                        }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Strategic Analysis
                            </div>
                            <div style={{
                                fontSize: 13,
                                color: 'var(--text-soft)',
                                lineHeight: 1.7,
                                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                                whiteSpace: 'pre-wrap',
                            }}>
                                {comparison.analysisNotes}
                            </div>
                        </div>
                    )}

                    {/* Pick Winner buttons */}
                    {!cohort.winner_id && (
                        <div style={{ marginBottom: 32 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
                                Pick Your Winner
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cohort.ventures.length}, 1fr)`, gap: 12 }}>
                                {cohort.ventures.map((v) => (
                                    <motion.button
                                        key={v.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handlePickWinner(v.id)}
                                        disabled={pickingWinner !== null}
                                        style={{
                                            padding: '12px 16px',
                                            borderRadius: 10,
                                            border: '1px solid var(--accent)',
                                            background: pickingWinner === v.id ? 'var(--accent)' : 'var(--accent-soft)',
                                            color: pickingWinner === v.id ? '#fff' : 'var(--accent)',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            cursor: pickingWinner ? 'wait' : 'pointer',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        {pickingWinner === v.id ? 'Picking...' : `Pick: ${v.name}`}
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Winner announced */}
                    {cohort.winner_id && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(196, 151, 90, 0.1), rgba(90, 140, 110, 0.1))',
                                border: '2px solid #C4975A',
                                borderRadius: 14,
                                padding: 20,
                                textAlign: 'center',
                                marginBottom: 24,
                            }}
                        >
                            <div style={{ fontSize: 28, marginBottom: 8 }}>&#128081;</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                                Winner: {cohort.ventures.find(v => v.id === cohort.winner_id)?.name || 'Selected'}
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => router.push(`/dashboard/venture/${cohort.winner_id}/research`)}
                                style={{
                                    marginTop: 12,
                                    padding: '10px 20px',
                                    borderRadius: 10,
                                    border: 'none',
                                    background: 'var(--accent)',
                                    color: '#fff',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                }}
                            >
                                View Winning Venture
                            </motion.button>
                        </motion.div>
                    )}
                </motion.div>
            )}
        </div>
    )
}
