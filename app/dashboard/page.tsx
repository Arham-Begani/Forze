'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Project {
  id: string
  name: string
  description: string
  icon: string
  status: string
  created_at: string
  updated_at: string
}

interface Venture {
  id: string
  name: string
  project_id: string | null
  created_at: string
}

// ─── Module data ────────────────────────────────────────────────────────────

const MODULES = [
  { id: 'full-launch', label: 'Full Launch', accent: '#C4975A', icon: '⬡' },
  { id: 'research', label: 'Research', accent: '#5A8C6E', icon: '◎' },
  { id: 'branding', label: 'Branding', accent: '#5A6E8C', icon: '◇' },
  { id: 'marketing', label: 'Marketing', accent: '#8C5A7A', icon: '▲' },
  { id: 'landing', label: 'Landing Page', accent: '#8C7A5A', icon: '▣' },
  { id: 'feasibility', label: 'Feasibility', accent: '#7A5A8C', icon: '◈' },
  { id: 'general', label: 'General', accent: '#6B8F71', icon: '◉' },
]

const QUICK_ACTIONS = [
  { label: 'New Project', icon: '📁', action: 'new-project' },
  { label: 'Full Launch', icon: '🚀', action: 'full-launch' },
  { label: 'Research', icon: '🔍', action: 'research' },
  { label: 'Branding', icon: '🎨', action: 'branding' },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()

  const [projects, setProjects] = useState<Project[]>([])
  const [ventures, setVentures] = useState<Venture[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredProject, setHoveredProject] = useState<string | null>(null)

  // ── Idea intake ──────────────────────────────────────────────────────────
  const [idea, setIdea] = useState<string | null>(null)
  const [ideaInput, setIdeaInput] = useState('')
  const [ideaSubmitting, setIdeaSubmitting] = useState(false)
  const [ideaError, setIdeaError] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [enhanced, setEnhanced] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const [projRes, ventRes, ideaRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/ventures'),
          fetch('/api/user/idea'),
        ])
        if (projRes.ok) setProjects(await projRes.json())
        if (ventRes.ok) setVentures(await ventRes.json())
        const ideaData = ideaRes.ok ? await ideaRes.json() : null
        setIdea(ideaData?.idea ?? null)
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function getVentureCount(projectId: string) {
    return ventures.filter(v => v.project_id === projectId).length
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  async function handleIdeaSubmit() {
    const trimmed = ideaInput.trim()
    if (!trimmed || ideaSubmitting) return
    setIdeaSubmitting(true)
    setIdeaError(false)
    try {
      const res = await fetch('/api/user/idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: trimmed }),
      })
      if (res.ok) {
        setIdea(trimmed)
      } else {
        setIdeaError(true)
      }
    } catch {
      setIdeaError(true)
    } finally {
      setIdeaSubmitting(false)
    }
  }

  async function handleEnhance() {
    if (!ideaInput.trim() || enhancing || ideaInput.trim().length < 5) return
    setEnhancing(true)
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: ideaInput.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.enhanced) {
          setIdeaInput(data.enhanced)
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

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-responsive" style={pageStyle}>
        <div style={ambientBlob1} />
        <div style={ambientBlob2} />
        <div style={contentStyle}>
          {/* Skeleton Hero */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ width: 240, height: 38, borderRadius: 10, marginBottom: 10 }} className="skeleton" />
            <div style={{ width: 140, height: 16, borderRadius: 6, opacity: 0.5 }} className="skeleton" />
          </div>

          {/* Skeleton Quick Actions */}
          <div className="quick-actions-responsive" style={{ marginBottom: 20 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ width: 110, height: 38, borderRadius: 10 }} className="skeleton" />
            ))}
          </div>

          {/* Skeleton Stats Bar */}
          <div className="stats-responsive" style={{ display: 'flex', alignItems: 'center', padding: '16px 0', marginBottom: 48, borderBottom: '1px solid var(--border)' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6 }} className="skeleton" />
                <div style={{ width: 60, height: 12, borderRadius: 4, opacity: 0.5 }} className="skeleton" />
              </div>
            ))}
          </div>

          {/* Skeleton List (Minimalist) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="glass-card w-full" style={{ ...projectCardStyle, border: 'none', pointerEvents: 'none', padding: '24px 32px' }}>
                <div className="flex flex-col md:flex-row items-start md:items-center w-full justify-between">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14 }} className="skeleton" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ width: 140, height: 18, borderRadius: 6 }} className="skeleton" />
                      <div style={{ width: 200, height: 14, borderRadius: 4, opacity: 0.5 }} className="skeleton" />
                    </div>
                  </div>
                  <div className="flex w-full md:w-auto justify-between md:justify-end items-center gap-8 md:gap-32 mt-4 md:mt-0">
                    <div style={{ width: 80, height: 14, borderRadius: 4 }} className="skeleton" />
                    <div className="hidden md:flex" style={{ gap: 6 }}>
                      {[1, 2, 3, 4].map(j => (
                        <div key={j} style={{ width: 6, height: 6, borderRadius: '50%' }} className="skeleton" />
                      ))}
                    </div>
                    <div style={{ width: 60, height: 14, borderRadius: 4 }} className="skeleton" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Idea intake ─────────────────────────────────────────────────────────
  if (idea === null) {
    const canSubmitIdea = ideaInput.trim().length > 5 && !ideaSubmitting
    const canEnhance = ideaInput.trim().length >= 5 && !enhancing && !ideaSubmitting

    return (
      <motion.div
        style={intakePageStyle}
        initial={mounted ? { opacity: 0 } : false}
        animate={mounted ? { opacity: 1 } : false}
        transition={{ duration: 0.5 }}
      >
        {/* Ambient glow */}
        <div style={intakeGlow} />

        {/* Logo */}
        <motion.div
          style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 52 }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <motion.div
            style={intakeHexStyle}
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          />
          <span style={intakeWordmarkStyle}>Forze</span>
        </motion.div>

        {/* Heading */}
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.03em', textAlign: 'center' }}
        >
          What do you want to build?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.25 }}
          style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 32px', textAlign: 'center', maxWidth: 420 }}
        >
          Tell us your big idea and our AI workforce will handle the rest.
        </motion.p>

        {/* Input card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, type: 'spring', stiffness: 300, damping: 24 }}
          style={{ width: '100%', maxWidth: 620 }}
        >
          <div
            className="glass-card"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              position: 'relative',
              overflow: 'hidden',
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
              animate={ideaInput.trim() ? { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] } : {}}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />

            <textarea
              value={ideaInput}
              onChange={e => setIdeaInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleIdeaSubmit()
              }}
              placeholder="Describe your startup idea in detail — the problem it solves, who it's for, and what makes it unique..."
              style={{
                width: '100%',
                minHeight: 100,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: 15,
                lineHeight: 1.7,
                resize: 'none',
                fontFamily: 'inherit',
              }}
              autoFocus
              maxLength={2000}
              aria-label="Describe your startup idea"
            />

            {/* Action bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--border)',
              paddingTop: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11,
                  color: ideaInput.length > 1800 ? '#e05252' : 'var(--muted)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 500,
                  transition: 'color 200ms',
                }}>
                  {ideaInput.length}/2000
                </span>

                {/* AI Enhance button */}
                <AnimatePresence>
                  {mounted && ideaInput.trim().length >= 5 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={handleEnhance}
                      disabled={!canEnhance}
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
                      whileHover={canEnhance ? { scale: 1.04, boxShadow: '0 2px 12px var(--accent-glow)' } : {}}
                      whileTap={canEnhance ? { scale: 0.96 } : {}}
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
                {mounted && canSubmitIdea && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8, x: 12 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: 12 }}
                    onClick={handleIdeaSubmit}
                    disabled={ideaSubmitting}
                    style={{
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
                    }}
                    whileHover={{ scale: 1.05, boxShadow: '0 6px 20px var(--accent-glow)' }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {ideaSubmitting ? (
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

          {/* Hint */}
          <motion.p
            style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', textAlign: 'center', opacity: 0.5 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {ideaError
              ? <span style={{ color: '#e05252', opacity: 1 }}>Something went wrong. Please try again.</span>
              : <>Press <kbd style={{ background: 'var(--nav-active)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', fontFamily: 'system-ui', fontSize: 11 }}>Ctrl</kbd> + <kbd style={{ background: 'var(--nav-active)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', fontFamily: 'system-ui', fontSize: 11 }}>Enter</kbd> to initialize your vision</>
            }
          </motion.p>
        </motion.div>
      </motion.div>
    )
  }

  // ── Empty state ────────────────────────────────────────────────────────
  if (!projects.length) {
    return (
      <div className="page-responsive" style={pageStyle}>
        <div style={ambientBlob1} />
        <div style={ambientBlob2} />
        <motion.div
          style={{ ...contentStyle, alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 100px)' }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Animated hex with glow */}
          <div style={{ position: 'relative', marginBottom: 32 }}>
            <motion.div
              style={{ position: 'absolute', top: '50%', left: '50%', width: 120, height: 120, background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)', filter: 'blur(30px)', opacity: 0.25, transform: 'translate(-50%, -50%)', borderRadius: '50%' }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.25, 0.4, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              style={{ width: 48, height: 48, background: 'linear-gradient(135deg, var(--accent), #e8a04e)', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', position: 'relative', zIndex: 1, boxShadow: '0 8px 32px var(--accent-glow)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          <motion.h1
            className="gradient-text"
            style={{ fontSize: 28, fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.04em' }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          >
            Welcome to Forze
          </motion.h1>
          <motion.p
            style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 36px', textAlign: 'center', maxWidth: 360, lineHeight: 1.75 }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          >
            Create a project to organize your ventures and let AI agents do the heavy lifting.
          </motion.p>
          <motion.button
            style={createProjectBtnStyle}
            whileHover={{ scale: 1.04, boxShadow: '0 8px 28px var(--accent-glow)' }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            onClick={() => router.push('/dashboard/new')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Your First Project
          </motion.button>
        </motion.div>
      </div>
    )
  }

  // ── Main dashboard ────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <div className="page-responsive" style={pageStyle}>
        <div style={ambientBlob1} />
        <div style={ambientBlob2} />

        <div style={contentStyle}>
          {/* Hero */}
          <motion.div
            style={heroStyle}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="heading-responsive" style={{ fontWeight: 800, color: 'var(--text)', margin: '0 0 6px', letterSpacing: '-0.04em' }}>
              <span className="gradient-text">Command Center</span>
            </h1>
            <p style={heroSubStyle}>
              {projects.length} project{projects.length !== 1 ? 's' : ''} · {ventures.length} venture{ventures.length !== 1 ? 's' : ''}
            </p>
          </motion.div>

          {/* Quick actions */}
          <motion.div
            className="quick-actions-responsive"
            style={{ marginBottom: 20 }}
            initial="hidden" animate="show"
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }}
          >
            {QUICK_ACTIONS.map(a => (
              <motion.button
                key={a.action}
                variants={{ hidden: { opacity: 0, y: 10, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1 } }}
                whileHover={{ scale: 1.02, backgroundColor: 'var(--glass-bg)' }}
                whileTap={{ scale: 0.98 }}
                style={quickActionBtnStyle}
                onClick={() => {
                  if (a.action === 'new-project') {
                    router.push('/dashboard/new')
                    return
                  }

                  const latest = ventures[0]
                  if (latest) {
                    router.push(`/dashboard/venture/${latest.id}/${a.action}`)
                    return
                  }

                  router.push('/dashboard/new')
                }}
              >
                <span style={{ fontSize: 15 }}>{a.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{a.label}</span>
              </motion.button>
            ))}
          </motion.div>

          {/* Stats bar (Minimalist) */}
          <motion.div
            className="stats-responsive"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '16px 0', 
              marginBottom: 48, 
              borderBottom: '1px solid var(--border)' 
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <StatItem label="Projects" value={projects.length} delay={0.15} />
            <div className="stat-divider" style={statDivider} />
            <StatItem label="Ventures" value={ventures.length} delay={0.2} />
            <div className="stat-divider" style={statDivider} />
            <StatItem label="Modules" value={MODULES.length} delay={0.25} />
            <div className="stat-divider" style={statDivider} />
            <StatItem label="AI Agents" value={6} delay={0.3} />
          </motion.div>

          {/* Project list (Minimalist Workspace) */}
          <motion.div
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
            initial="hidden" animate="show"
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } }}
          >
            {projects.map(proj => {
              const ventureCount = getVentureCount(proj.id)
              const isHovered = hoveredProject === proj.id
              return (
                <motion.button
                  key={proj.id}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 22 } }
                  }}
                  whileHover={{ scale: 1.01, x: 4 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => router.push(`/dashboard/project/${proj.id}`)}
                  onMouseEnter={() => setHoveredProject(proj.id)}
                  onMouseLeave={() => setHoveredProject(null)}
                  className="glass-card w-full"
                  style={{
                    ...projectCardStyle,
                    borderColor: isHovered ? 'var(--accent-glow)' : 'var(--glass-border)',
                    boxShadow: isHovered ? 'var(--shadow-md), 0 0 0 1px var(--accent-glow)' : 'var(--shadow-xs)',
                  }}
                >
                  {/* Left Accent Strip (Minimalist) */}
                  <motion.div
                    style={{
                      position: 'absolute', top: 0, bottom: 0, left: 0, width: 3,
                      background: 'var(--accent)',
                      borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
                    }}
                    animate={{ opacity: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                  />

                  {/* Hover glow layer */}
                  <motion.div
                    style={{
                      position: 'absolute', inset: 0, borderRadius: 16,
                      background: 'radial-gradient(circle at 10% 50%, var(--accent-soft) 0%, transparent 40%)',
                      pointerEvents: 'none',
                    }}
                    animate={{ opacity: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                  />

                  <div className="flex flex-col md:flex-row items-start md:items-center w-full justify-between" style={{ zIndex: 1, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flex: 1 }}>
                      <motion.div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 14,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isHovered ? 'var(--accent-soft)' : 'var(--nav-active)',
                          boxShadow: isHovered ? '0 0 16px var(--accent-glow)' : 'none',
                          transition: 'background 300ms ease, box-shadow 300ms ease',
                          flexShrink: 0,
                        }}
                        animate={isHovered ? { scale: 1.05 } : { scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        <span style={{ fontSize: 24 }}>{proj.icon}</span>
                      </motion.div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, overflow: 'hidden' }}>
                        <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.01em' }}>{proj.name}</span>
                        {proj.description && (
                          <span style={{ fontSize: 14, color: 'var(--muted)', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proj.description}</span>
                        )}
                      </div>
                    </div>

                    {/* Right Side Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginTop: '16px', flexShrink: 0 }} className="md:mt-0 md:ml-4 w-full md:w-auto justify-between md:justify-end">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: ventureCount > 0 ? 'var(--accent)' : 'var(--border-strong)',
                          boxShadow: ventureCount > 0 ? '0 0 8px var(--accent-glow)' : 'none',
                        }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-soft)' }}>{ventureCount} venture{ventureCount !== 1 ? 's' : ''}</span>
                      </div>

                      <div className="hidden md:flex" style={{ gap: 6 }}>
                        {MODULES.map((m, idx) => (
                          <motion.div
                            key={m.id}
                            style={{ width: 6, height: 6, borderRadius: '50%' }}
                            animate={{
                              background: isHovered ? m.accent : 'var(--border-strong)',
                              boxShadow: isHovered ? `0 0 4px ${m.accent}80` : 'none',
                            }}
                            transition={{ delay: isHovered ? idx * 0.04 : 0, duration: 0.25 }}
                          />
                        ))}
                      </div>

                      <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, minWidth: 60, textAlign: 'right' }}>{formatDate(proj.created_at)}</span>
                    </div>
                  </div>
                </motion.button>
              )
            })}

            {/* New project card */}
            <motion.button
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 22 } }
              }}
              whileHover={{ scale: 1.01, borderColor: 'var(--accent)', boxShadow: 'var(--shadow-sm)' }}
              whileTap={{ scale: 0.99 }}
              onClick={() => router.push('/dashboard/new')}
              style={newProjectCardStyle}
              className="flex-col md:flex-row"
            >
              <motion.div
                style={{
                  width: 44, height: 44, borderRadius: 13,
                  background: 'var(--accent-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                whileHover={{ scale: 1.1, rotate: 90 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </motion.div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.01em' }}>New Project</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Start a new workspace</span>
              </div>
            </motion.button>
          </motion.div>

          {/* Footer */}
          <motion.p
            style={footerTextStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 0.6 }}
          >
            Forze Autonomous Venture Orchestrator · v2.0.0
          </motion.p>
        </div>
      </div>
    </ErrorBoundary>
  )
}

// ─── Stat Item ──────────────────────────────────────────────────────────────

function StatItem({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'center' }}>
      <motion.span
        style={{ fontSize: 24, fontWeight: 400, color: 'var(--text)', letterSpacing: '-0.02em' }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, type: 'spring', stiffness: 300, damping: 20 }}
      >
        {value}
      </motion.span>
      <motion.span
        style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', letterSpacing: '0.04em' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.1 }}
      >
        {label}
      </motion.span>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  position: 'relative',
  paddingTop: '80px',
  paddingBottom: '80px',
  paddingLeft: '32px',
  paddingRight: '32px',
}

const ambientBlob1: React.CSSProperties = {
  position: 'fixed',
  width: 400,
  height: 400,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(192,122,58,0.12) 0%, transparent 70%)',
  filter: 'blur(70px)',
  top: -100,
  right: -50,
  pointerEvents: 'none',
  zIndex: 0,
  animation: 'blob-float 16s ease-in-out infinite',
}

const ambientBlob2: React.CSSProperties = {
  position: 'fixed',
  width: 360,
  height: 360,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(90,110,140,0.1) 0%, transparent 70%)',
  filter: 'blur(80px)',
  bottom: -80,
  left: '20%',
  pointerEvents: 'none',
  zIndex: 0,
  animation: 'blob-float 20s ease-in-out infinite reverse',
}

const contentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 1040,
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  position: 'relative',
  zIndex: 1,
}

const heroStyle: React.CSSProperties = {
  marginBottom: 48,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
}

const heroHeadingStyle: React.CSSProperties = {
  fontSize: 42,
  fontWeight: 400,
  color: 'var(--text)',
  margin: '0 0 12px',
  letterSpacing: '-0.03em',
}

const heroSubStyle: React.CSSProperties = {
  fontSize: 15,
  color: 'var(--muted)',
  margin: 0,
  letterSpacing: '0.01em',
  fontWeight: 400,
}

const quickActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginBottom: 20,
  flexWrap: 'wrap',
}

const quickActionBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 16px',
  borderRadius: 8,
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 200ms, transform 150ms',
}

const statsBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '18px 0',
  borderRadius: 16,
  marginBottom: 28,
  boxShadow: 'var(--shadow-sm)',
}

const statDivider: React.CSSProperties = {
  width: 1,
  height: 24,
  background: 'var(--border)',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(248px, 100%), 1fr))',
  gap: 16,
}

const projectCardStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '24px 32px',
  textAlign: 'left',
  fontFamily: 'inherit',
  cursor: 'pointer',
  overflow: 'hidden',
  background: 'var(--glass-bg)',
  border: '1px solid var(--glass-border)',
  borderRadius: 16,
  transition: 'all 300ms ease',
}

const createProjectBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 28px',
  borderRadius: 14,
  border: '1px solid var(--accent-glow)',
  background: 'linear-gradient(135deg, var(--accent), #e8963a)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  boxShadow: '0 4px 16px var(--accent-glow)',
  letterSpacing: '0.01em',
}

const newProjectCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  padding: '24px 32px',
  borderRadius: 16,
  border: '1px dashed var(--border-strong)',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'center',
  transition: 'all 300ms ease',
}

const footerTextStyle: React.CSSProperties = {
  marginTop: 52,
  textAlign: 'center',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
}

// ─── Intake Styles ──────────────────────────────────────────────────────────

const intakePageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg)',
  position: 'relative',
  overflow: 'hidden',
  padding: '0 24px',
}

const intakeGlow: React.CSSProperties = {
  position: 'absolute',
  top: '30%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 600,
  height: 400,
  background: 'radial-gradient(ellipse, var(--accent-glow) 0%, transparent 65%)',
  filter: 'blur(60px)',
  opacity: 0.35,
  pointerEvents: 'none',
}

const intakeHexStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
  flexShrink: 0,
  boxShadow: '0 0 20px var(--accent-glow)',
}

const intakeWordmarkStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  color: 'var(--text)',
  letterSpacing: '-0.04em',
}

const intakePillStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  maxWidth: 620,
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid var(--glass-border)',
  borderRadius: 999,
  padding: '10px 10px 10px 20px',
  boxShadow: 'var(--shadow-lg), 0 0 40px var(--accent-glow)',
}

const intakeIconWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  opacity: 0.5,
}

const intakeInputStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontSize: 15,
  color: 'var(--text)',
  fontFamily: 'inherit',
  letterSpacing: '-0.01em',
}

const intakeSubmitStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: '50%',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'background 200ms ease',
}

const intakeHintStyle: React.CSSProperties = {
  marginTop: 20,
  fontSize: 12,
  color: 'var(--muted)',
  letterSpacing: '0.01em',
  textAlign: 'center',
}
