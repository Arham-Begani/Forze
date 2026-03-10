'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
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

// ─── Module data for cards ───────────────────────────────────────────────────

const MODULES = [
  { id: 'full-launch', label: 'Full Launch', accent: '#C4975A', icon: '⬡' },
  { id: 'research', label: 'Research', accent: '#5A8C6E', icon: '◎' },
  { id: 'branding', label: 'Branding', accent: '#5A6E8C', icon: '◇' },
  { id: 'marketing', label: 'Marketing', accent: '#8C5A7A', icon: '▲' },
  { id: 'landing', label: 'Landing Page', accent: '#8C7A5A', icon: '▣' },
  { id: 'feasibility', label: 'Feasibility', accent: '#7A5A8C', icon: '◈' },
]

const QUICK_ACTIONS = [
  { label: 'New Project', icon: '📁', action: 'new-project' },
  { label: 'Full Launch', icon: '🚀', action: 'full-launch' },
  { label: 'Research', icon: '🔍', action: 'research' },
  { label: 'Branding', icon: '🎨', action: 'branding' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()

  const [projects, setProjects] = useState<Project[]>([])
  const [ventures, setVentures] = useState<Venture[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredProject, setHoveredProject] = useState<string | null>(null)

  // ── Idea intake ─────────────────────────────────────────────────────────────
  const [idea, setIdea] = useState<string | null>(null)
  const [ideaInput, setIdeaInput] = useState('')
  const [ideaSubmitting, setIdeaSubmitting] = useState(false)
  const [ideaError, setIdeaError] = useState(false)

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

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={ambientBlob1} />
        <div style={ambientBlob2} />
        <div style={contentStyle}>
          {/* Skeleton Hero */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ width: 240, height: 38, borderRadius: 10, marginBottom: 10 }} className="skeleton" />
            <div style={{ width: 140, height: 16, borderRadius: 6, opacity: 0.5 }} className="skeleton" />
          </div>

          {/* Skeleton Quick Actions */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ width: 110, height: 38, borderRadius: 10 }} className="skeleton" />
            ))}
          </div>

          {/* Skeleton Stats Bar */}
          <div className="glass" style={{ ...statsBarStyle, border: 'none' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 28, borderRadius: 6 }} className="skeleton" />
                <div style={{ width: 60, height: 12, borderRadius: 4, opacity: 0.5 }} className="skeleton" />
              </div>
            ))}
          </div>

          {/* Skeleton Grid */}
          <div style={gridStyle}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="glass-card" style={{ ...projectCardStyle, border: 'none', shadow: 'none', pointerEvents: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13 }} className="skeleton" />
                  <div style={{ width: 40, height: 12, borderRadius: 4, opacity: 0.5 }} className="skeleton" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ width: '70%', height: 18, borderRadius: 6 }} className="skeleton" />
                  <div style={{ width: '90%', height: 14, borderRadius: 4, opacity: 0.5 }} className="skeleton" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                  <div style={{ width: 70, height: 12, borderRadius: 4 }} className="skeleton" />
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 4].map(j => (
                      <div key={j} style={{ width: 6, height: 6, borderRadius: '50%' }} className="skeleton" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Idea intake ─────────────────────────────────────────────────────────────
  if (idea === null) {
    return (
      <motion.div
        style={intakePageStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Ambient glow */}
        <div style={intakeGlow} />

        {/* Logo */}
        <motion.div
          style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <motion.div
            style={intakeHexStyle}
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          />
          <span style={intakeWordmarkStyle}>Forge</span>
        </motion.div>

        {/* Pill input */}
        <motion.div
          style={intakePillStyle}
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, type: 'spring', stiffness: 300, damping: 24 }}
        >
          {/* Left icon */}
          <div style={intakeIconWrapStyle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>

          {/* Input */}
          <input
            type="text"
            value={ideaInput}
            onChange={e => setIdeaInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleIdeaSubmit()}
            placeholder="What's your big idea?"
            style={intakeInputStyle}
            autoFocus
          />

          {/* Submit button */}
          <motion.button
            onClick={handleIdeaSubmit}
            disabled={!ideaInput.trim() || ideaSubmitting}
            whileHover={ideaInput.trim() && !ideaSubmitting ? { scale: 1.08 } : {}}
            whileTap={ideaInput.trim() && !ideaSubmitting ? { scale: 0.94 } : {}}
            style={{
              ...intakeSubmitStyle,
              background: ideaInput.trim() && !ideaSubmitting ? 'var(--accent)' : 'var(--border)',
              cursor: ideaInput.trim() && !ideaSubmitting ? 'pointer' : 'default',
            }}
          >
            {ideaSubmitting ? (
              <motion.div
                style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
            )}
          </motion.button>
        </motion.div>

        {/* Hint */}
        <motion.p
          style={intakeHintStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {ideaError
            ? 'Something went wrong. Please try again.'
            : 'Press Enter or click ↑ · Your AI workforce will handle the rest'}
        </motion.p>
      </motion.div>
    )
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!projects.length && !ventures.length) {
    return (
      <div style={pageStyle}>
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
              style={{ ...emptyHexStyle, position: 'relative', zIndex: 1, boxShadow: '0 8px 32px var(--accent-glow)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          <motion.h1
            className="gradient-text"
            style={{ fontSize: 28, fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.04em' }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          >
            Welcome to Forge
          </motion.h1>
          <motion.p
            style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 36px', textAlign: 'center', maxWidth: 360, lineHeight: 1.75 }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          >
            Your one-stop platform for building startups. Create a project to organize your ventures and let AI agents do the heavy lifting.
          </motion.p>
          <motion.button
            style={createProjectBtnStyle}
            whileHover={{ scale: 1.04, boxShadow: '0 8px 28px var(--accent-glow)' }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            onClick={() => window.dispatchEvent(new CustomEvent('forge:new-project'))}
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

  // ── Main dashboard ──────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <div style={pageStyle}>
      {/* Ambient background blobs */}
      <div style={ambientBlob1} />
      <div style={ambientBlob2} />

      <div style={contentStyle}>
        {/* Hero */}
        <motion.div
          style={heroStyle}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 style={heroHeadingStyle}>
            <span className="gradient-text">Command Center</span>
          </h1>
          <p style={heroSubStyle}>
            {projects.length} project{projects.length !== 1 ? 's' : ''} · {ventures.length} venture{ventures.length !== 1 ? 's' : ''}
          </p>
        </motion.div>

        {/* Quick actions */}
        <motion.div
          style={quickActionsStyle}
          initial="hidden" animate="show"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } }}
        >
          {QUICK_ACTIONS.map(a => (
            <motion.button
              key={a.action}
              variants={{ hidden: { opacity: 0, y: 10, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1 } }}
              whileHover={{ scale: 1.04, y: -1, boxShadow: 'var(--shadow-md)' }}
              whileTap={{ scale: 0.96 }}
              style={quickActionBtnStyle}
              onClick={() => {
                if (a.action === 'new-project') window.dispatchEvent(new CustomEvent('forge:new-project'))
              }}
            >
              <span style={{ fontSize: 15 }}>{a.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{a.label}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Stats bar */}
        <motion.div
          className="glass"
          style={statsBarStyle}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <StatItem label="Projects" value={projects.length} delay={0.2} />
          <div style={statDivider} />
          <StatItem label="Ventures" value={ventures.length} delay={0.28} />
          <div style={statDivider} />
          <StatItem label="Modules" value={MODULES.length} delay={0.36} />
          <div style={statDivider} />
          <StatItem label="AI Agents" value={6} delay={0.44} />
        </motion.div>

        {/* Project grid */}
        <motion.div
          style={gridStyle}
          initial="hidden" animate="show"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.09 } } }}
        >
          {projects.map(proj => {
            const ventureCount = getVentureCount(proj.id)
            const isHovered = hoveredProject === proj.id
            return (
              <motion.button
                key={proj.id}
                variants={{
                  hidden: { opacity: 0, y: 24, scale: 0.96 },
                  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 280, damping: 22 } }
                }}
                whileHover={{ scale: 1.025, y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(`/dashboard/project/${proj.id}`)}
                onMouseEnter={() => setHoveredProject(proj.id)}
                onMouseLeave={() => setHoveredProject(null)}
                className="glass-card"
                style={{
                  ...projectCardStyle,
                  borderColor: isHovered ? 'var(--accent-glow)' : 'var(--glass-border)',
                  boxShadow: isHovered ? 'var(--shadow-lg), 0 0 0 1px var(--accent-glow)' : 'var(--shadow-card)',
                }}
              >
                {/* Top accent bar */}
                <motion.div
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, var(--accent), #e8963a, transparent)',
                    borderRadius: '16px 16px 0 0',
                  }}
                  animate={{ opacity: isHovered ? 1 : 0 }}
                  transition={{ duration: 0.25 }}
                />

                {/* Hover glow layer */}
                <motion.div
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 16,
                    background: 'radial-gradient(circle at 50% 0%, var(--accent-soft) 0%, transparent 60%)',
                    pointerEvents: 'none',
                  }}
                  animate={{ opacity: isHovered ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                />

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, position: 'relative', zIndex: 1 }}>
                  <motion.div
                    style={{
                      ...projectIconWrap,
                      background: isHovered ? 'var(--accent-soft)' : 'var(--nav-active)',
                      boxShadow: isHovered ? '0 0 12px var(--accent-glow)' : 'none',
                    }}
                    animate={isHovered ? { scale: 1.08 } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <span style={{ fontSize: 22 }}>{proj.icon}</span>
                  </motion.div>
                  <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>{formatDate(proj.created_at)}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, position: 'relative', zIndex: 1 }}>
                  <span style={projectCardName}>{proj.name}</span>
                  {proj.description && (
                    <span style={projectCardDesc}>{proj.description}</span>
                  )}
                </div>

                {/* Bottom bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: ventureCount > 0 ? 'var(--accent)' : 'var(--border-strong)',
                      boxShadow: ventureCount > 0 ? '0 0 6px var(--accent-glow)' : 'none',
                    }} />
                    <span style={ventureCountStyle}>{ventureCount} venture{ventureCount !== 1 ? 's' : ''}</span>
                  </div>
                  {/* Module dots */}
                  <div style={{ display: 'flex', gap: 3 }}>
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
                </div>
              </motion.button>
            )
          })}

          {/* New project card */}
          <motion.button
            variants={{
              hidden: { opacity: 0, y: 24 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 22 } }
            }}
            whileHover={{ scale: 1.025, y: -3, borderColor: 'var(--accent)', boxShadow: 'var(--shadow-md)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.dispatchEvent(new CustomEvent('forge:new-project'))}
            style={newProjectCardStyle}
          >
            <motion.div
              style={newProjectIconWrap}
              whileHover={{ scale: 1.1, rotate: 90 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </motion.div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', marginTop: 2 }}>New Project</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>Start a new startup workspace</span>
          </motion.button>
        </motion.div>

        {/* Footer */}
        <motion.p
          style={footerTextStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35 }}
          transition={{ delay: 0.8 }}
        >
          Forge Autonomous Venture Orchestrator · v2.0.0
        </motion.p>
      </div>
    </div>
    </ErrorBoundary>
  )
}

// ─── Stat Item ───────────────────────────────────────────────────────────────

function StatItem({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
      <motion.span
        style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, type: 'spring', stiffness: 300, damping: 20 }}
      >
        {value}
      </motion.span>
      <motion.span
        style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.1 }}
      >
        {label}
      </motion.span>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  padding: '40px 32px',
  display: 'flex',
  justifyContent: 'center',
  position: 'relative',
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
  maxWidth: 840,
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  position: 'relative',
  zIndex: 1,
}

const loadingHexStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
  boxShadow: '0 8px 24px var(--accent-glow)',
}

const emptyHexStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
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

const heroStyle: React.CSSProperties = {
  marginBottom: 28,
}

const heroHeadingStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  color: 'var(--text)',
  margin: '0 0 6px',
  letterSpacing: '-0.04em',
}

const heroSubStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--muted)',
  margin: 0,
  letterSpacing: '0.01em',
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
  gap: 7,
  padding: '8px 16px',
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--glass-bg-strong)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'box-shadow 200ms, border-color 200ms, transform 150ms',
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
  height: 30,
  background: 'var(--border)',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))',
  gap: 16,
}

const projectCardStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  padding: 22,
  textAlign: 'left',
  fontFamily: 'inherit',
  cursor: 'pointer',
  overflow: 'hidden',
  minHeight: 176,
  transition: 'box-shadow 300ms ease, border-color 300ms ease',
}

const projectIconWrap: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 13,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 300ms ease, box-shadow 300ms ease',
}

const projectCardName: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--text)',
  letterSpacing: '-0.01em',
}

const projectCardDesc: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--muted)',
  lineHeight: 1.55,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
}

const ventureCountStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-soft)',
}

const newProjectCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 22,
  minHeight: 176,
  borderRadius: 16,
  border: '1.5px dashed var(--border-strong)',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'center',
  transition: 'border-color 300ms ease, box-shadow 300ms ease, transform 200ms ease',
}

const newProjectIconWrap: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 13,
  background: 'var(--accent-soft)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 10,
  transition: 'background 200ms ease',
}

const footerTextStyle: React.CSSProperties = {
  marginTop: 52,
  textAlign: 'center',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
}

// ─── Intake Styles ────────────────────────────────────────────────────────────

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
  width: 28,
  height: 28,
  background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
  flexShrink: 0,
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
  maxWidth: 660,
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
  fontSize: 16,
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
