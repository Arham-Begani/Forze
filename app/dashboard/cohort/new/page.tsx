'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface VariantDraft {
    name: string
    description: string
    targetAudience: string
    businessModel: string
    keyDifferentiator: string
}

type Mode = 'choose' | 'manual' | 'generate'

export default function NewCohortPage() {
    const router = useRouter()

    const [name, setName] = useState('')
    const [coreIdea, setCoreIdea] = useState('')
    const [mode, setMode] = useState<Mode>('choose')
    const [variants, setVariants] = useState<VariantDraft[]>([])
    const [generating, setGenerating] = useState(false)
    const [launching, setLaunching] = useState(false)
    const [cohortId, setCohortId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Manual mode: start with 2 empty variants
    function startManual() {
        setMode('manual')
        setVariants([
            { name: '', description: '', targetAudience: '', businessModel: '', keyDifferentiator: '' },
            { name: '', description: '', targetAudience: '', businessModel: '', keyDifferentiator: '' },
        ])
    }

    function addManualVariant() {
        if (variants.length < 3) {
            setVariants([...variants, { name: '', description: '', targetAudience: '', businessModel: '', keyDifferentiator: '' }])
        }
    }

    function updateVariant(index: number, field: keyof VariantDraft, value: string) {
        setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v))
    }

    // Create cohort and generate variants via AI
    async function handleGenerate() {
        if (!name.trim() || !coreIdea.trim()) {
            setError('Name and core idea are required')
            return
        }
        setError(null)
        setGenerating(true)

        try {
            // Create cohort first
            const createRes = await fetch('/api/cohorts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), coreIdea: coreIdea.trim() }),
            })
            if (!createRes.ok) throw new Error('Failed to create cohort')
            const cohort = await createRes.json()
            setCohortId(cohort.id)

            // Generate variants
            const genRes = await fetch(`/api/cohorts/${cohort.id}/generate-variants`, { method: 'POST' })
            if (!genRes.ok) throw new Error('Failed to start variant generation')

            const reader = genRes.body?.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    buffer += decoder.decode(value, { stream: true })

                    const lines = buffer.split('\n')
                    buffer = lines.pop() ?? ''

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6))
                                if (data.variants) {
                                    setVariants(data.variants)
                                    setMode('generate')
                                }
                            } catch {}
                        }
                    }
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Generation failed')
        } finally {
            setGenerating(false)
        }
    }

    // Launch all variants
    async function handleLaunch() {
        if (!name.trim() || !coreIdea.trim()) {
            setError('Name and core idea are required')
            return
        }
        setLaunching(true)
        setError(null)

        try {
            let finalCohortId = cohortId

            if (!finalCohortId) {
                // Create cohort + ventures from manual variants
                const createRes = await fetch('/api/cohorts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name.trim(), coreIdea: coreIdea.trim() }),
                })
                if (!createRes.ok) throw new Error('Failed to create cohort')
                const cohort = await createRes.json()
                finalCohortId = cohort.id

                // For manual mode, create ventures manually
                if (mode === 'manual') {
                    const ventureIds: string[] = []
                    for (const variant of variants) {
                        const res = await fetch('/api/ventures', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: `${name.trim()}: ${variant.name}` }),
                        })
                        if (res.ok) {
                            const venture = await res.json()
                            ventureIds.push(venture.id)
                        }
                    }

                    // Update cohort with variant IDs
                    // We need to call the update endpoint — for now, navigate to the cohort
                    // The launch route will handle orchestration
                }
            }

            // Navigate to cohort dashboard — launch will be triggered from there
            router.push(`/dashboard/cohort/${finalCohortId}`)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Launch failed')
            setLaunching(false)
        }
    }

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 14px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--input-bg)',
        color: 'var(--text)',
        fontSize: 14,
        fontFamily: 'inherit',
        outline: 'none',
    }

    const textareaStyle: React.CSSProperties = {
        ...inputStyle,
        minHeight: 100,
        resize: 'vertical' as const,
    }

    const cardStyle: React.CSSProperties = {
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 20,
    }

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    New Cohort
                </h1>
                <p style={{ fontSize: 14, color: 'var(--text-soft)', marginBottom: 32 }}>
                    Run 2-3 venture variants from the same idea, then compare them side-by-side.
                </p>
            </motion.div>

            {/* Core inputs */}
            <div style={{ ...cardStyle, marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 6 }}>
                    Cohort Name
                </label>
                <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. FeedFlow Variants"
                    style={inputStyle}
                />

                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 6, marginTop: 16 }}>
                    Core Idea
                </label>
                <textarea
                    value={coreIdea}
                    onChange={e => setCoreIdea(e.target.value)}
                    placeholder="Describe the core business idea. The AI will generate different approaches to it..."
                    style={textareaStyle}
                />
            </div>

            {/* Mode selection */}
            <AnimatePresence mode="wait">
                {mode === 'choose' && (
                    <motion.div
                        key="choose"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}
                    >
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={startManual}
                            style={{
                                ...cardStyle,
                                cursor: 'pointer',
                                textAlign: 'left' as const,
                                border: '1px solid var(--border)',
                            }}
                        >
                            <div style={{ fontSize: 20, marginBottom: 8 }}>&#9998;</div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                                Define variants manually
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                                Describe 2-3 variants yourself
                            </div>
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleGenerate}
                            disabled={generating}
                            style={{
                                ...cardStyle,
                                cursor: generating ? 'wait' : 'pointer',
                                textAlign: 'left' as const,
                                border: '1px solid var(--accent)',
                                opacity: generating ? 0.7 : 1,
                            }}
                        >
                            <div style={{ fontSize: 20, marginBottom: 8 }}>&#9733;</div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                                {generating ? 'Generating...' : 'Generate variants for me'}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                                AI suggests 2-3 different approaches
                            </div>
                        </motion.button>
                    </motion.div>
                )}

                {/* Variants display (manual or generated) */}
                {(mode === 'manual' || mode === 'generate') && variants.length > 0 && (
                    <motion.div
                        key="variants"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                                Variants ({variants.length})
                            </h2>
                            {variants.length < 3 && mode === 'manual' && (
                                <button
                                    onClick={addManualVariant}
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: 'var(--accent)',
                                        background: 'var(--accent-soft)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        padding: '4px 12px',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    + Add variant
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                            {variants.map((v, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    style={cardStyle}
                                >
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, letterSpacing: '0.05em' }}>
                                        VARIANT {i + 1}
                                    </div>

                                    <div style={{ display: 'grid', gap: 10 }}>
                                        <input
                                            value={v.name}
                                            onChange={e => updateVariant(i, 'name', e.target.value)}
                                            placeholder="Variant name (e.g. B2C Subscription)"
                                            style={inputStyle}
                                        />
                                        <textarea
                                            value={v.description}
                                            onChange={e => updateVariant(i, 'description', e.target.value)}
                                            placeholder="Description (2-3 sentences)"
                                            style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const }}
                                        />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                            <input
                                                value={v.targetAudience}
                                                onChange={e => updateVariant(i, 'targetAudience', e.target.value)}
                                                placeholder="Target audience"
                                                style={inputStyle}
                                            />
                                            <input
                                                value={v.businessModel}
                                                onChange={e => updateVariant(i, 'businessModel', e.target.value)}
                                                placeholder="Business model"
                                                style={inputStyle}
                                            />
                                        </div>
                                        <input
                                            value={v.keyDifferentiator}
                                            onChange={e => updateVariant(i, 'keyDifferentiator', e.target.value)}
                                            placeholder="Key differentiator"
                                            style={inputStyle}
                                        />
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Launch button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleLaunch}
                            disabled={launching || variants.some(v => !v.name.trim())}
                            style={{
                                width: '100%',
                                padding: '14px 24px',
                                borderRadius: 12,
                                border: 'none',
                                background: 'var(--accent)',
                                color: '#fff',
                                fontSize: 15,
                                fontWeight: 700,
                                cursor: launching ? 'wait' : 'pointer',
                                fontFamily: 'inherit',
                                opacity: launching || variants.some(v => !v.name.trim()) ? 0.6 : 1,
                            }}
                        >
                            {launching ? 'Creating Cohort...' : 'Launch All Variants'}
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error */}
            {error && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                        marginTop: 16,
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: 'rgba(224, 72, 72, 0.1)',
                        border: '1px solid rgba(224, 72, 72, 0.3)',
                        color: '#E04848',
                        fontSize: 13,
                    }}
                >
                    {error}
                </motion.div>
            )}
        </div>
    )
}
