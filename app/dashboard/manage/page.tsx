'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Project {
  id: string
  name: string
  description: string
  icon: string
  status: string
  global_idea: string | null
  created_at: string
  ventures?: Venture[]
}

interface Venture {
  id: string
  name: string
  project_id: string | null
  created_at: string
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: '#5A8C6E' },
  { value: 'paused', label: 'Paused', color: '#C4975A' },
  { value: 'archived', label: 'Archived', color: '#8C5A7A' },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ManageProjectsPage() {
  const router = useRouter()

  const [mounted, setMounted] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [ventures, setVentures] = useState<Venture[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  // Expanded project (to show ventures inline)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Rename venture state
  const [renamingVentureId, setRenamingVentureId] = useState<string | null>(null)
  const [renameVentureValue, setRenameVentureValue] = useState('')
  const renameVentureRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
    async function load() {
      try {
        const [projRes, ventRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/ventures'),
        ])
        if (projRes.ok) setProjects(await projRes.json())
        if (ventRes.ok) setVentures(await ventRes.json())
      } catch (err) {
        console.error('Failed to load manage page data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (renamingId && renameRef.current) { renameRef.current.focus(); renameRef.current.select() }
  }, [renamingId])

  useEffect(() => {
    if (renamingVentureId && renameVentureRef.current) { renameVentureRef.current.focus(); renameVentureRef.current.select() }
  }, [renamingVentureId])

  function getVenturesForProject(projectId: string) {
    return ventures.filter(v => v.project_id === projectId)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async function submitRename() {
    const trimmed = renameValue.trim()
    if (!trimmed || !renamingId) { setRenamingId(null); return }
    try {
      const res = await fetch(`/api/projects/${renamingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (res.ok) {
        setProjects(prev => prev.map(p => p.id === renamingId ? { ...p, name: trimmed } : p))
      }
    } catch (err) {
      console.error('Failed to rename project', err)
    } finally {
      setRenamingId(null)
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
        setVentures(prev => prev.map(v => v.id === renamingVentureId ? { ...v, name: trimmed } : v))
      }
    } catch (err) {
      console.error('Failed to rename venture', err)
    } finally {
      setRenamingVentureId(null)
    }
  }

  async function handleDeleteProject(id: string) {
    if (!confirm('Delete this project and all its ventures? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== id))
        setVentures(prev => prev.filter(v => v.project_id !== id))
        if (expandedId === id) setExpandedId(null)
      }
    } catch (err) {
      console.error('Failed to delete project', err)
    }
  }

  async function handleDeleteVenture(id: string) {
    if (!confirm('Delete this venture?')) return
    try {
      const res = await fetch(`/api/ventures/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setVentures(prev => prev.filter(v => v.id !== id))
      }
    } catch (err) {
      console.error('Failed to delete venture', err)
    }
  }

  async function handleStatusChange(projectId: string, status: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status } : p))
      }
    } catch (err) {
      console.error('Failed to update status', err)
    }
  }

  // ─── Filter ────────────────────────────────────────────────────────────────

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!mounted) return (
    <div style={pageStyle}>
      <div style={contentStyle}>
        <div style={{ height: 40, width: 100, borderRadius: 8, background: 'var(--glass-bg)', marginBottom: 20 }} />
        <div style={{ height: 60, width: '100%', borderRadius: 12, background: 'var(--glass-bg)', marginBottom: 28 }} />
      </div>
    </div>
  )

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
          <span>Dashboard</span>
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 28 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--accent-glow)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
                Manage Projects
              </h1>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
                {projects.length} project{projects.length !== 1 ? 's' : ''} · {ventures.length} venture{ventures.length !== 1 ? 's' : ''} total
              </p>
            </div>
          </div>
        </motion.div>

        {/* Search bar */}
        {mounted && (
          <div style={searchWrapStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={searchInputStyle}
            />
            {search && (
              <motion.button
                onClick={() => setSearch('')}
                style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
                whileHover={{ scale: 1.1 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </motion.button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 80, borderRadius: 14 }} className="skeleton" />
            ))}
          </div>
        )}

        {/* Project list */}
        {!loading && (
          <motion.div
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            initial="hidden" animate="show"
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }}
          >
            {mounted && filtered.map(project => {
              const pVentures = getVenturesForProject(project.id)
              const isExpanded = expandedId === project.id
              const statusInfo = STATUS_OPTIONS.find(s => s.value === project.status) || STATUS_OPTIONS[0]

              return (
                <motion.div
                  key={project.id}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                  }}
                >
                  <div className="glass-card" style={projectCardStyle}>
                    {/* Main row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Icon */}
                      <div
                        style={{
                          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                          background: 'var(--nav-active)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid var(--border)',
                          fontSize: 20,
                        }}
                      >
                        {project.icon}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {renamingId === project.id ? (
                          <input
                            ref={renameRef}
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') submitRename()
                              if (e.key === 'Escape') setRenamingId(null)
                            }}
                            onBlur={() => submitRename()}
                            style={renameInputStyle}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <span
                              style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', letterSpacing: '-0.01em' }}
                              onClick={() => router.push(`/dashboard/project/${project.id}`)}
                            >
                              {project.name}
                            </span>
                            <span
                              style={{
                                fontSize: 9, fontWeight: 600,
                                color: statusInfo.color,
                                background: `${statusInfo.color}18`,
                                padding: '1px 7px',
                                borderRadius: 4,
                                letterSpacing: '0.03em',
                                textTransform: 'uppercase',
                              }}
                            >
                              {statusInfo.label}
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
                          <span>{formatDate(project.created_at)}</span>
                          <span style={{ opacity: 0.3 }}>·</span>
                          <span>{pVentures.length} venture{pVentures.length !== 1 ? 's' : ''}</span>
                          {project.global_idea && (
                            <>
                              <span style={{ opacity: 0.3 }}>·</span>
                              <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {project.global_idea}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {/* Expand ventures */}
                        <motion.button
                          onClick={() => setExpandedId(isExpanded ? null : project.id)}
                          style={iconBtnStyle}
                          whileHover={{ scale: 1.1, background: 'var(--nav-active)' }}
                          whileTap={{ scale: 0.9 }}
                          title={isExpanded ? 'Collapse ventures' : 'Show ventures'}
                        >
                          <motion.svg
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </motion.svg>
                        </motion.button>

                        {/* Status dropdown */}
                        <select
                          value={project.status || 'active'}
                          onChange={e => handleStatusChange(project.id, e.target.value)}
                          style={selectStyle}
                          title="Change status"
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>

                        {/* Rename */}
                        <motion.button
                          onClick={() => { setRenamingId(project.id); setRenameValue(project.name) }}
                          style={iconBtnStyle}
                          whileHover={{ scale: 1.1, color: 'var(--accent)' }}
                          whileTap={{ scale: 0.9 }}
                          title="Rename"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
                          </svg>
                        </motion.button>

                        {/* Open */}
                        <motion.button
                          onClick={() => router.push(`/dashboard/project/${project.id}`)}
                          style={iconBtnStyle}
                          whileHover={{ scale: 1.1, color: 'var(--accent)' }}
                          whileTap={{ scale: 0.9 }}
                          title="Open project"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </motion.button>

                        {/* Delete */}
                        <motion.button
                          onClick={() => handleDeleteProject(project.id)}
                          style={{ ...iconBtnStyle, color: 'var(--muted)' }}
                          whileHover={{ scale: 1.1, color: '#e05252' }}
                          whileTap={{ scale: 0.9 }}
                          title="Delete project"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </motion.button>
                      </div>
                    </div>

                    {/* Expanded ventures */}
                    <AnimatePresence>
                      {mounted && isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{ paddingTop: 12, marginTop: 12, borderTop: '1px solid var(--border)' }}>
                            {pVentures.length === 0 ? (
                              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, padding: '4px 0' }}>
                                No ventures in this project yet.
                              </p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {pVentures.map(v => (
                                  <div
                                    key={v.id}
                                    style={ventureRowStyle}
                                  >
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', opacity: 0.5, flexShrink: 0 }} />
                                    {renamingVentureId === v.id ? (
                                      <input
                                        ref={renameVentureRef}
                                        value={renameVentureValue}
                                        onChange={e => setRenameVentureValue(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') submitRenameVenture()
                                          if (e.key === 'Escape') setRenamingVentureId(null)
                                        }}
                                        onBlur={() => submitRenameVenture()}
                                        style={{ ...renameInputStyle, fontSize: 12, padding: '2px 8px' }}
                                      />
                                    ) : (
                                      <>
                                        <span
                                          style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                          onClick={() => router.push(`/dashboard/venture/${v.id}/full-launch`)}
                                        >
                                          {v.name}
                                        </span>
                                        <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                                          {formatDate(v.created_at)}
                                        </span>
                                        <motion.button
                                          onClick={() => { setRenamingVentureId(v.id); setRenameVentureValue(v.name) }}
                                          style={{ ...iconBtnSmall }}
                                          whileHover={{ scale: 1.1, color: 'var(--accent)' }}
                                          whileTap={{ scale: 0.9 }}
                                          title="Rename venture"
                                        >
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
                                          </svg>
                                        </motion.button>
                                        <motion.button
                                          onClick={() => handleDeleteVenture(v.id)}
                                          style={{ ...iconBtnSmall, color: 'var(--muted)' }}
                                          whileHover={{ scale: 1.1, color: '#e05252' }}
                                          whileTap={{ scale: 0.9 }}
                                          title="Delete venture"
                                        >
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                          </svg>
                                        </motion.button>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )
            })}

            {/* Empty states */}
            {!loading && filtered.length === 0 && search && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={emptyStyle}
              >
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                  No projects matching &ldquo;{search}&rdquo;
                </p>
              </motion.div>
            )}

            {!loading && projects.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={emptyStyle}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: 'var(--accent-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                  </svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>No projects yet</p>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, textAlign: 'center', maxWidth: 300 }}>
                  Create your first project from the sidebar to get started with Forge.
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  padding: '32px 32px',
  display: 'flex',
  justifyContent: 'center',
}

const contentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 780,
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

const searchWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  borderRadius: 10,
  background: 'var(--glass-bg)',
  border: '1px solid var(--border)',
  marginBottom: 20,
}

const searchInputStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontSize: 13,
  color: 'var(--text)',
  fontFamily: 'inherit',
}

const projectCardStyle: React.CSSProperties = {
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
}

const renameInputStyle: React.CSSProperties = {
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
  maxWidth: 280,
}

const iconBtnStyle: React.CSSProperties = {
  padding: 6,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--muted)',
  borderRadius: 7,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const iconBtnSmall: React.CSSProperties = {
  padding: 3,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--muted)',
  borderRadius: 5,
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
}

const selectStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-soft)',
  background: 'var(--nav-active)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '3px 6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  outline: 'none',
}

const ventureRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 8px',
  borderRadius: 8,
  transition: 'background 150ms',
}

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 40,
  borderRadius: 16,
  border: '1px dashed var(--border-strong)',
}
