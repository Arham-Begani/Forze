'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

interface KitData {
    executiveSummary: string
    pitchDeckOutline: Array<{ slide: string; content: string; speakerNotes: string }>
    onePageMemo: string
    askDetails: {
        suggestedRaise: string
        useOfFunds: string[]
        keyMilestones: string[]
    }
    dataRoomSections: string[]
}

interface VentureInfo {
    name: string
    brandName?: string
    tagline?: string
    brandColors?: any[]
}

export default function InvestorKitPage() {
    const params = useParams()
    const code = params.code as string

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [kitData, setKitData] = useState<KitData | null>(null)
    const [venture, setVenture] = useState<VentureInfo | null>(null)
    const [views, setViews] = useState(0)
    const [activeSection, setActiveSection] = useState<'summary' | 'deck' | 'memo' | 'ask'>('summary')

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/investor-kit/${code}`)
                if (!res.ok) {
                    const data = await res.json()
                    setError(data.error || 'Kit not found')
                    return
                }
                const data = await res.json()
                setKitData(data.kit.kitData as KitData)
                setVenture(data.venture)
                setViews(data.kit.views)
            } catch {
                setError('Failed to load investor kit')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [code])

    // Derive accent color from brand
    const accent = (() => {
        if (!venture?.brandColors) return '#C4975A'
        const colors = venture.brandColors
        if (Array.isArray(colors) && colors.length > 0) {
            const first = colors[0]
            if (typeof first === 'string') return first
            if (typeof first === 'object') return first.hex || first.code || '#C4975A'
        }
        return '#C4975A'
    })()

    if (loading) {
        return (
            <div style={pageStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e8e4dc', borderTopColor: '#C4975A', animation: 'spin 0.8s linear infinite' }} />
                    <p style={{ fontSize: 14, color: '#888' }}>Loading investor kit...</p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        )
    }

    if (error || !kitData) {
        return (
            <div style={pageStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{error || 'Kit not found'}</h2>
                    <p style={{ fontSize: 13, color: '#888' }}>This investor kit may have expired or been deactivated.</p>
                </div>
            </div>
        )
    }

    const ventureTitle = venture?.brandName || venture?.name || 'Venture'

    return (
        <div style={pageStyle}>
            {/* Header */}
            <header style={{
                padding: '16px clamp(16px, 4vw, 32px)',
                borderBottom: '1px solid #e8e4dc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                background: '#fff',
                position: 'sticky',
                top: 0,
                zIndex: 10,
            }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', letterSpacing: '-0.02em', margin: 0 }}>
                        {ventureTitle}
                    </h1>
                    {venture?.tagline && (
                        <p style={{ fontSize: 13, color: '#666', margin: '4px 0 0' }}>{venture.tagline}</p>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 11, color: '#999', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                        {views} view{views !== 1 ? 's' : ''}
                    </span>
                </div>
            </header>

            {/* Navigation tabs */}
            <nav style={{
                padding: '0 clamp(16px, 4vw, 32px)',
                borderBottom: '1px solid #e8e4dc',
                background: '#faf9f6',
                display: 'flex',
                gap: 0,
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
            }}>
                {([
                    ['summary', 'Executive Summary'],
                    ['deck', 'Pitch Deck'],
                    ['memo', 'Investment Memo'],
                    ['ask', 'The Ask'],
                ] as const).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setActiveSection(key)}
                        style={{
                            padding: '14px 20px',
                            fontSize: 13,
                            fontWeight: activeSection === key ? 700 : 500,
                            color: activeSection === key ? accent : '#666',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeSection === key ? `2px solid ${accent}` : '2px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            letterSpacing: '-0.01em',
                        }}
                    >
                        {label}
                    </button>
                ))}
            </nav>

            {/* Content */}
            <main style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 32px) 80px' }}>
                {activeSection === 'summary' && (
                    <section>
                        <h2 style={sectionTitleStyle}>Executive Summary</h2>
                        <div style={proseStyle}>
                            <ReactMarkdown>{kitData.executiveSummary}</ReactMarkdown>
                        </div>

                        {/* Data Room sections */}
                        {kitData.dataRoomSections.length > 0 && (
                            <div style={{ marginTop: 40 }}>
                                <h3 style={{ ...sectionTitleStyle, fontSize: 15 }}>Data Room Contents</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {kitData.dataRoomSections.map((section, i) => (
                                        <div key={i} style={{
                                            padding: '12px 16px',
                                            background: '#faf9f6',
                                            borderRadius: 8,
                                            border: '1px solid #e8e4dc',
                                            fontSize: 13,
                                            color: '#333',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                        }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                            </svg>
                                            {section}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {activeSection === 'deck' && (
                    <section>
                        <h2 style={sectionTitleStyle}>Pitch Deck Outline</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {kitData.pitchDeckOutline.map((slide, i) => (
                                <div key={i} style={{
                                    background: '#fff',
                                    borderRadius: 12,
                                    border: '1px solid #e8e4dc',
                                    overflow: 'hidden',
                                }}>
                                    <div style={{
                                        padding: '14px 20px',
                                        borderBottom: '1px solid #e8e4dc',
                                        background: '#faf9f6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                    }}>
                                        <span style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: 8,
                                            background: `${accent}18`,
                                            color: accent,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 12,
                                            fontWeight: 800,
                                            flexShrink: 0,
                                        }}>
                                            {i + 1}
                                        </span>
                                        <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{slide.slide}</span>
                                    </div>
                                    <div style={{ padding: '16px 20px' }}>
                                        <div style={proseStyle}>
                                            <ReactMarkdown>{slide.content}</ReactMarkdown>
                                        </div>
                                        <div style={{
                                            marginTop: 12,
                                            padding: '10px 14px',
                                            background: '#f8f7f4',
                                            borderRadius: 8,
                                            borderLeft: `3px solid ${accent}40`,
                                        }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Speaker Notes</div>
                                            <p style={{ fontSize: 12, color: '#666', lineHeight: 1.6, margin: 0 }}>{slide.speakerNotes}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {activeSection === 'memo' && (
                    <section>
                        <h2 style={sectionTitleStyle}>One-Page Investment Memo</h2>
                        <div style={{ ...proseStyle, background: '#fff', padding: 'clamp(16px, 4vw, 32px)', borderRadius: 12, border: '1px solid #e8e4dc' }}>
                            <ReactMarkdown>{kitData.onePageMemo}</ReactMarkdown>
                        </div>
                    </section>
                )}

                {activeSection === 'ask' && (
                    <section>
                        <h2 style={sectionTitleStyle}>The Ask</h2>

                        {/* Suggested Raise */}
                        <div style={{
                            textAlign: 'center',
                            padding: '40px 20px',
                            background: `${accent}08`,
                            borderRadius: 16,
                            border: `1px solid ${accent}20`,
                            marginBottom: 32,
                        }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Suggested Raise</div>
                            <div style={{ fontSize: 36, fontWeight: 800, color: '#111', letterSpacing: '-0.03em' }}>
                                {kitData.askDetails.suggestedRaise}
                            </div>
                        </div>

                        {/* Use of Funds */}
                        <div style={{ marginBottom: 32 }}>
                            <h3 style={{ ...sectionTitleStyle, fontSize: 15 }}>Use of Funds</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {kitData.askDetails.useOfFunds.map((item, i) => (
                                    <div key={i} style={{
                                        padding: '12px 16px',
                                        background: '#faf9f6',
                                        borderRadius: 8,
                                        border: '1px solid #e8e4dc',
                                        fontSize: 14,
                                        color: '#333',
                                        fontWeight: 500,
                                    }}>
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Key Milestones */}
                        <div>
                            <h3 style={{ ...sectionTitleStyle, fontSize: 15 }}>Key Milestones</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {kitData.askDetails.keyMilestones.map((milestone, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 12,
                                        padding: '12px 0',
                                        borderBottom: i < kitData.askDetails.keyMilestones.length - 1 ? '1px solid #e8e4dc' : 'none',
                                    }}>
                                        <div style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: '50%',
                                            background: `${accent}15`,
                                            border: `1.5px solid ${accent}30`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            marginTop: 1,
                                        }}>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </div>
                                        <p style={{ fontSize: 14, color: '#333', lineHeight: 1.5, margin: 0 }}>{milestone}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </main>

            {/* Footer */}
            <footer style={{
                padding: '20px clamp(16px, 4vw, 32px)',
                borderTop: '1px solid #e8e4dc',
                textAlign: 'center',
                background: '#faf9f6',
            }}>
                <p style={{ fontSize: 11, color: '#999', margin: 0 }}>
                    Powered by <span style={{ fontWeight: 700, color: '#C4975A' }}>Forge</span> — Autonomous Venture Orchestrator
                </p>
            </footer>
        </div>
    )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#faf9f6',
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#111',
}

const sectionTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 800,
    color: '#111',
    letterSpacing: '-0.02em',
    marginBottom: 20,
}

const proseStyle: React.CSSProperties = {
    fontSize: 14,
    lineHeight: 1.75,
    color: '#333',
}
