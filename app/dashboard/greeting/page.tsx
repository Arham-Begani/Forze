'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const SUGGESTIONS = [
  'An AI-powered meal planning app for busy professionals',
  'A marketplace connecting local farmers with restaurants',
  'A SaaS tool for managing freelance client contracts',
  'A platform for peer-to-peer language exchange',
]

function GreetingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [charCount, setCharCount] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [enhancing, setEnhancing] = useState(false)
  const [enhanced, setEnhanced] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!projectId) {
      router.replace('/dashboard')
      return
    }

    async function loadProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (res.ok) {
          const data = await res.json()
          setProjectName(data.name)
          if (data.global_idea) {
            router.replace(`/dashboard/project/${projectId}`)
          }
        } else {
          router.replace('/dashboard')
        }
      } catch (err) {
        console.error('Failed to load project:', err)
      }
    }
    loadProject()
  }, [projectId, router])

  useEffect(() => {
    setCharCount(idea.length)
    if (idea.length > 0) setShowSuggestions(false)
  }, [idea])

  async function handleSubmit() {
    if (!idea.trim() || loading) return
    setLoading(true)

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ global_idea: idea.trim() }),
      })

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('forge:project-updated', {
          detail: { projectId, global_idea: idea.trim() }
        }))

        try {
          const ventureRes = await fetch('/api/ventures', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: projectName ? `${projectName} - v1` : 'Initial Venture', projectId }),
          })

          if (ventureRes.ok) {
            const newVenture = await ventureRes.json()
            window.dispatchEvent(new CustomEvent('forge:venture-added', { detail: newVenture }))
          }
        } catch (err) {
          console.error('Failed to create initial venture:', err)
        }

        router.push(`/dashboard/project/${projectId}`)
      }
    } catch (err) {
      console.error('Failed to save idea:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }

  async function handleEnhance() {
    if (!idea.trim() || enhancing || idea.trim().length < 5) return
    setEnhancing(true)
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.enhanced) {
          setIdea(data.enhanced)
          setEnhanced(true)
          setTimeout(() => setEnhanced(false), 3000)
        }
      }
    } catch (err) {
      console.error('Failed to enhance:', err)
    } finally {
      setEnhancing(false)
    }
  }

  const canSubmit = idea.trim().length > 5

  return (
    <div className="ambient-page" style={containerStyle}>
      <div style={contentStyle}>
        {/* Header with logo + project context */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={headerWrap}
        >
          <motion.div
            style={logoHex}
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          />
          <div style={{ textAlign: 'center' }}>
            <h1 style={titleStyle}>
              Describe your vision
            </h1>
            {projectName && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 0.3 }}
                style={subtitleStyle}
              >
                for <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{projectName}</span>
              </motion.p>
            )}
          </div>
        </motion.div>

        {/* Input card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: '100%', maxWidth: 680 }}
        >
          <div
            className="glass-card"
            style={{
              ...inputCardStyle,
              borderColor: isFocused ? 'var(--accent-glow)' : 'var(--glass-border)',
              boxShadow: isFocused
                ? 'var(--shadow-lg), 0 0 0 2px var(--accent-glow)'
                : 'var(--shadow-md)',
            }}
          >
            {/* Gradient top accent */}
            <motion.div
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: 2,
                background: 'linear-gradient(90deg, var(--accent), #e8a04e, var(--accent))',
                backgroundSize: '200% 100%',
                borderRadius: '16px 16px 0 0',
              }}
              animate={isFocused ? { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] } : {}}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />

            <textarea
              ref={textareaRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your startup idea in detail — the problem it solves, who it's for, and what makes it unique..."
              style={textareaStyle}
              rows={5}
              maxLength={2000}
              aria-label="Describe your startup idea"
            />

            {/* Suggestions */}
            <AnimatePresence>
              {showSuggestions && idea.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden' }}
                >
                  <p style={suggestionLabel}>Try one of these</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                    {SUGGESTIONS.map((s, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.08 }}
                        onClick={() => { setIdea(s); textareaRef.current?.focus() }}
                        style={suggestionChipStyle}
                        whileHover={{ scale: 1.02, borderColor: 'var(--accent-glow)' }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {s}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action bar */}
            <div style={actionsBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11,
                  color: charCount > 1800 ? '#e05252' : 'var(--muted)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 500,
                  transition: 'color 200ms',
                }}>
                  {charCount}/2000
                </span>

                {/* AI Enhance button */}
                <AnimatePresence>
                  {idea.trim().length >= 5 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={handleEnhance}
                      disabled={enhancing}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 14px',
                        borderRadius: 20,
                        background: enhanced ? 'rgba(90, 140, 110, 0.12)' : 'var(--accent-soft)',
                        border: `1px solid ${enhanced ? 'rgba(90, 140, 110, 0.3)' : 'var(--accent-glow)'}`,
                        color: enhanced ? '#5A8C6E' : 'var(--accent)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: enhancing ? 'wait' : 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 200ms',
                      }}
                      whileHover={!enhancing ? { scale: 1.04, boxShadow: '0 2px 12px var(--accent-glow)' } : {}}
                      whileTap={!enhancing ? { scale: 0.96 } : {}}
                    >
                      {enhancing ? (
                        <>
                          <motion.div
                            style={{
                              width: 12, height: 12,
                              border: '2px solid var(--accent-glow)',
                              borderTopColor: 'var(--accent)',
                              borderRadius: '50%',
                            }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                          />
                          <span>Enhancing...</span>
                        </>
                      ) : enhanced ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Enhanced</span>
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                          </svg>
                          <span>Enhance with AI</span>
                        </>
                      )}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {canSubmit && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8, x: 12 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: 12 }}
                    onClick={handleSubmit}
                    disabled={loading}
                    style={submitBtnStyle}
                    whileHover={{ scale: 1.05, boxShadow: '0 6px 20px var(--accent-glow)' }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {loading ? (
                      <motion.div
                        style={{
                          width: 16, height: 16,
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#fff',
                          borderRadius: '50%',
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                      />
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Initialize</span>
                      </>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          <motion.p
            style={hintStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 0.8 }}
          >
            Press <kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>Enter</kbd> to initialize your vision
          </motion.p>
        </motion.div>

        {/* Bottom features */}
        <motion.div
          style={featuresRow}
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.6 } }
          }}
        >
          {[
            { icon: '◎', label: 'Market Research', desc: 'Real-time data' },
            { icon: '◇', label: 'Brand Identity', desc: 'Full brand bible' },
            { icon: '▣', label: 'Landing Page', desc: 'Live deployment' },
            { icon: '◈', label: 'Feasibility', desc: 'GO/NO-GO verdict' },
          ].map(f => (
            <motion.div
              key={f.label}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0 }
              }}
              style={featureItem}
            >
              <span style={{ fontSize: 16, color: 'var(--accent)' }}>{f.icon}</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{f.label}</p>
                <p style={{ fontSize: 10, color: 'var(--muted)', margin: 0 }}>{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

export default function GreetingPage() {
  return (
    <Suspense fallback={
      <div className="ambient-page" style={containerStyle}>
        <div className="spinner-lg" />
      </div>
    }>
      <GreetingContent />
    </Suspense>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  background: 'var(--bg)',
}

const contentStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  zIndex: 1,
  gap: 0,
}

const headerWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginBottom: 36,
  gap: 16,
}

const logoHex: React.CSSProperties = {
  width: 44,
  height: 44,
  background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
  boxShadow: '0 0 30px var(--accent-glow)',
}

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: '-0.04em',
  color: 'var(--text)',
  margin: 0,
  lineHeight: 1.2,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--muted)',
  margin: '6px 0 0',
}

const inputCardStyle: React.CSSProperties = {
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  position: 'relative',
  overflow: 'hidden',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 120,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--text)',
  fontSize: 15,
  lineHeight: 1.7,
  resize: 'none',
  fontFamily: 'inherit',
}

const suggestionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: '0 0 8px',
}

const suggestionChipStyle: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 20,
  border: '1px solid var(--border)',
  background: 'var(--glass-bg)',
  color: 'var(--text-soft)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'border-color 200ms, background 200ms',
  textAlign: 'left',
}

const actionsBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderTop: '1px solid var(--border)',
  paddingTop: 12,
}

const submitBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 20px',
  borderRadius: 12,
  background: 'linear-gradient(135deg, var(--accent), #e8963a)',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: '0 4px 14px var(--accent-glow)',
  transition: 'box-shadow 200ms',
}

const hintStyle: React.CSSProperties = {
  marginTop: 16,
  fontSize: 12,
  color: 'var(--muted)',
  textAlign: 'center',
}

const kbdStyle: React.CSSProperties = {
  background: 'var(--nav-active)',
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  fontFamily: 'system-ui',
  fontSize: 11,
}

const featuresRow: React.CSSProperties = {
  display: 'flex',
  gap: 24,
  marginTop: 48,
  flexWrap: 'wrap',
  justifyContent: 'center',
}

const featureItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 16px',
  borderRadius: 12,
  background: 'var(--glass-bg)',
  border: '1px solid var(--border)',
}
