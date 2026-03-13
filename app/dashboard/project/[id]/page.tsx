'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Project {
  id: string
  name: string
  description: string
  icon: string
  status: string
  created_at: string
  ventures: Venture[]
}

interface Venture {
  id: string
  name: string
  created_at: string
  context: Record<string, unknown>
}

const MODULES = [
  { id: 'full-launch', label: 'Full Launch', accent: '#C4975A', icon: '⬡' },
  { id: 'research', label: 'Research', accent: '#5A8C6E', icon: '◎' },
  { id: 'branding', label: 'Branding', accent: '#5A6E8C', icon: '◇' },
  { id: 'marketing', label: 'Marketing', accent: '#8C5A7A', icon: '▲' },
  { id: 'landing', label: 'Landing Page', accent: '#8C7A5A', icon: '▣' },
  { id: 'feasibility', label: 'Feasibility', accent: '#7A5A8C', icon: '◈' },
  { id: 'general', label: 'General', accent: '#6B8F71', icon: '◉' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [mounted, setMounted] = useState(false)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredVenture, setHoveredVenture] = useState<string | null>(null)

  // Rename project
  const [renamingProject, setRenamingProject] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  // Rename venture
  const [renamingVentureId, setRenamingVentureId] = useState<string | null>(null)
  const [renameVentureValue, setRenameVentureValue] = useState('')
  const renameVentureRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
    fetch(`/api/projects/${projectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setProject(data))
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { if (renamingProject && renameRef.current) { renameRef.current.focus(); renameRef.current.select() } }, [renamingProject])
  useEffect(() => { if (renamingVentureId && renameVentureRef.current) { renameVentureRef.current.focus(); renameVentureRef.current.select() } }, [renamingVentureId])

  async function submitRenameProject() {
    const trimmed = renameValue.trim()
    if (!trimmed || !project) { setRenamingProject(false); return }
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (res.ok) {
        setProject(prev => prev ? { ...prev, name: trimmed } : prev)
      }
    } catch (err) {
      console.error('Failed to rename project', err)
    } finally {
      setRenamingProject(false)
    }
  }

  async function submitRenameVenture() {
    const trimmed = renameVentureValue.trim()
    if (!trimmed || !renamingVentureId) { setRenamingVentureId(null); return }
    try {
      const res = await fetch(`/api/ventures/${renamingVentureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (res.ok) {
        setProject(prev => {
          if (!prev) return prev
          return { ...prev, ventures: prev.ventures.map(v => v.id === renamingVentureId ? { ...v, name: trimmed } : v) }
        })
      }
    } catch (err) {
      console.error('Failed to rename venture', err)
    } finally {
      setRenamingVentureId(null)
    }
  }

  async function handleDeleteVenture(ventureId: string) {
    if (!confirm('Delete this venture?')) return
    try {
      const res = await fetch(`/api/ventures/${ventureId}`, { method: 'DELETE' })
      if (res.ok) {
        setProject(prev => prev ? { ...prev, ventures: prev.ventures.filter(v => v.id !== ventureId) } : prev)
      }
    } catch (err) {
      console.error('Failed to delete venture', err)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function getCompletedModules(venture: Venture): string[] {
    const ctx = (venture.context || {}) as Record<string, unknown>
    return ['research', 'branding', 'marketing', 'landing', 'feasibility'].filter(
      k => ctx[k] !== null && ctx[k] !== undefined
    )
  }

  if (!mounted) {
    return (
      <div style={pageStyle}>
        <div style={contentStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 60 }}>
            <div style={{ width: 200, height: 18, borderRadius: 6 }} className="skeleton" />
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={contentStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 60 }}>
            <div style={{ width: 200, height: 18, borderRadius: 6 }} className="skeleton" />
            <div style={{ width: 300, height: 12, borderRadius: 6, opacity: 0.5 }} className="skeleton" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 32 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ height: 160, borderRadius: 16 }} className="skeleton" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div style={{ ...pageStyle, alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Project not found</p>
      </div>
    )
  }

  const ventures = project.ventures || []

  return (
    <div style={pageStyle}>
      <div style={contentStyle}>
        {/* Back link */}
        <motion.button
          onClick={() => router.push('/dashboard')}
          style={backBtnStyle}
          whileHover={{ x: -2 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>All Projects</span>
        </motion.button>

        {/* Header */}
        <motion.div
          style={headerStyle}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={projectIconStyle}>
              <span style={{ fontSize: 28 }}>{project.icon}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {renamingProject ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
                >
                  <input
                    ref={renameRef}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') submitRenameProject()
                      if (e.key === 'Escape') setRenamingProject(false)
                    }}
                    onBlur={() => submitRenameProject()}
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: 'var(--text)',
                      letterSpacing: '-0.03em',
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--accent)',
                      borderRadius: 10,
                      padding: '4px 12px',
                      outline: 'none',
                      fontFamily: 'inherit',
                      boxShadow: 'var(--shadow-input)',
                      width: '100%',
                      maxWidth: 360,
                    }}
                  />
                </motion.div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h1 style={titleStyle}>{project.name}</h1>
                  <motion.button
                    onClick={() => { setRenamingProject(true); setRenameValue(project.name) }}
                    style={{
                      padding: 4, border: 'none', background: 'transparent',
                      cursor: 'pointer', color: 'var(--muted)', borderRadius: 6,
                      display: 'flex', alignItems: 'center',
                    }}
                    whileHover={{ scale: 1.1, color: 'var(--accent)' }}
                    whileTap={{ scale: 0.9 }}
                    title="Rename project"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
                    </svg>
                  </motion.button>
                </div>
              )}
              {project.description && (
                <p style={descStyle}>{project.description}</p>
              )}
              <p style={metaStyle}>Created {formatDate(project.created_at)} · {ventures.length} venture{ventures.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </motion.div>

        {/* Venture grid */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={sectionTitle}>Ventures</h2>
        </div>

        <motion.div
          style={ventureGridStyle}
          initial="hidden" animate="show"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }}
        >
          {ventures.map(v => {
            const completed = getCompletedModules(v)
            const isHovered = hoveredVenture === v.id
            return (
              <motion.div
                key={v.id}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                }}
                className="glass-card"
                style={ventureCardStyle}
                onMouseEnter={() => setHoveredVenture(v.id)}
                onMouseLeave={() => setHoveredVenture(null)}
              >
                <div style={{ marginBottom: 14 }}>
                  {renamingVentureId === v.id ? (
                    <motion.input
                      ref={renameVentureRef}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      value={renameVentureValue}
                      onChange={e => setRenameVentureValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') submitRenameVenture()
                        if (e.key === 'Escape') setRenamingVentureId(null)
                      }}
                      onBlur={() => submitRenameVenture()}
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--text)',
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--accent)',
                        borderRadius: 8,
                        padding: '3px 10px',
                        outline: 'none',
                        fontFamily: 'inherit',
                        boxShadow: 'var(--shadow-input)',
                        width: '100%',
                        marginBottom: 4,
                      }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <h3 style={{ ...ventureNameStyle, margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</h3>
                      <motion.button
                        onClick={(e) => { e.stopPropagation(); setRenamingVentureId(v.id); setRenameVentureValue(v.name) }}
                        style={{ padding: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', borderRadius: 4, display: 'flex', alignItems: 'center', flexShrink: 0, opacity: isHovered ? 1 : 0, transition: 'opacity 150ms' }}
                        whileHover={{ scale: 1.1, color: 'var(--accent)' }}
                        whileTap={{ scale: 0.9 }}
                        title="Rename venture"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
                        </svg>
                      </motion.button>
                      <motion.button
                        onClick={(e) => { e.stopPropagation(); handleDeleteVenture(v.id) }}
                        style={{ padding: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', borderRadius: 4, display: 'flex', alignItems: 'center', flexShrink: 0, opacity: isHovered ? 1 : 0, transition: 'opacity 150ms' }}
                        whileHover={{ scale: 1.1, color: '#e05252' }}
                        whileTap={{ scale: 0.9 }}
                        title="Delete venture"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </motion.button>
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>{formatDate(v.created_at)}</p>
                </div>

                {/* Module grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
                  {MODULES.map(m => {
                    const done = completed.includes(m.id)
                    return (
                      <motion.button
                        key={m.id}
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => router.push(`/dashboard/venture/${v.id}/${m.id}`)}
                        style={{
                          ...moduleChipStyle,
                          background: done ? `${m.accent}18` : 'var(--nav-active)',
                          borderColor: isHovered ? `${m.accent}40` : 'transparent',
                          color: done ? m.accent : 'var(--muted)',
                        }}
                      >
                        <span style={{ fontSize: 10, lineHeight: 1 }}>{m.icon}</span>
                        <span style={{ fontSize: 9, fontWeight: 600 }}>{m.label.split(' ')[0]}</span>
                      </motion.button>
                    )
                  })}
                </div>

                {/* Progress bar */}
                <div style={{ background: 'var(--nav-active)', borderRadius: 4, height: 3, overflow: 'hidden' }}>
                  <motion.div
                    style={{ height: '100%', background: 'var(--accent)', borderRadius: 4 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(completed.length / 5) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{completed.length}/5 modules</span>
                  <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>
                    {completed.length === 5 ? '✓ Complete' : completed.length === 0 ? 'Not started' : 'In progress'}
                  </span>
                </div>
              </motion.div>
            )
          })}

          {/* Empty state */}
          {ventures.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={emptyVentureStyle}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'var(--accent-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                </svg>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No ventures yet</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 0, textAlign: 'center', maxWidth: 280 }}>
                Ventures are automatically created when you describe your idea. Head to the greeting page to get started.
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  padding: '32px 32px',
  display: 'flex',
  justifyContent: 'center',
}

const contentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 820,
  display: 'flex',
  flexDirection: 'column',
}

const backBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--muted)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: 0,
  marginBottom: 20,
}

const headerStyle: React.CSSProperties = {
  marginBottom: 32,
}

const projectIconStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 16,
  background: 'var(--nav-active)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--border)',
}

const titleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: 'var(--text)',
  margin: '0 0 2px',
  letterSpacing: '-0.03em',
}

const descStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-soft)',
  margin: '0 0 4px',
}

const metaStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--muted)',
  margin: 0,
}

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--text)',
  margin: 0,
  letterSpacing: '-0.01em',
}

const addBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 14px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(8px)',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const ventureInputStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--card-solid)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--text)',
  fontFamily: 'inherit',
  outline: 'none',
}

const createBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const ventureGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: 16,
}

const ventureCardStyle: React.CSSProperties = {
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
}

const ventureNameStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--text)',
  margin: '0 0 4px',
  letterSpacing: '-0.01em',
}

const moduleChipStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
  padding: '6px 4px',
  borderRadius: 8,
  border: '1px solid transparent',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 200ms, border-color 200ms',
}

const emptyVentureStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 40,
  borderRadius: 16,
  border: '1px dashed var(--border-strong)',
}
