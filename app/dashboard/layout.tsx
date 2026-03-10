'use client'

import { useEffect, useState, useRef, type ReactNode, type KeyboardEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SessionData {
  userId: string
  email: string
  name: string
  plan: string
}

interface ProjectItem {
  id: string
  name: string
  description: string
  icon: string
  status: string
  global_idea: string | null
  created_at: string
}

interface VentureItem {
  id: string
  name: string
  project_id: string | null
  created_at: string
}

const MODULES = [
  { id: 'full-launch',  label: 'Full Launch',  icon: '⬡', accent: '#C4975A' },
  { id: 'research',     label: 'Research',     icon: '◎', accent: '#5A8C6E' },
  { id: 'branding',     label: 'Branding',     icon: '◇', accent: '#5A6E8C' },
  { id: 'marketing',    label: 'Marketing',    icon: '▲', accent: '#8C5A7A' },
  { id: 'landing',      label: 'Landing Page', icon: '▣', accent: '#8C7A5A' },
  { id: 'feasibility',  label: 'Feasibility',  icon: '◈', accent: '#7A5A8C' },
] as const

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ─── Layout ─────────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [session, setSession] = useState<SessionData | null>(null)
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [ventures, setVentures] = useState<VentureItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [expandedVentures, setExpandedVentures] = useState<Set<string>>(new Set())

  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const newProjectRef = useRef<HTMLInputElement>(null)
  const [showNewVenture, setShowNewVenture] = useState<string | null>(null)
  const [newVentureName, setNewVentureName] = useState('')
  const newVentureRef = useRef<HTMLInputElement>(null)

  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('forge-dark-mode')
    if (stored === 'true') {
      setDark(true)
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  function toggleDark() {
    const next = !dark
    setDark(next)
    localStorage.setItem('forge-dark-mode', String(next))
    if (next) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }

  useEffect(() => {
    async function load() {
      try {
        const [sessRes, projRes, ventRes] = await Promise.all([
          fetch('/api/auth/session'),
          fetch('/api/projects'),
          fetch('/api/ventures'),
        ])
        if (sessRes.ok) setSession(await sessRes.json())
        if (projRes.ok) setProjects(await projRes.json())
        if (ventRes.ok) setVentures(await ventRes.json())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ─── Idea Guard Rail ────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !projects.length || pathname === '/dashboard/greeting') return

    // Identify active project ID from pathname
    const projectMatch = pathname.match(/\/dashboard\/project\/([^\/]+)/)
    const ventureMatch = pathname.match(/\/dashboard\/venture\/([^\/]+)/)
    
    let activeProjectId: string | null = null
    
    if (projectMatch) {
      activeProjectId = projectMatch[1]
    } else if (ventureMatch) {
      const ventureId = ventureMatch[1]
      const venture = ventures.find(v => v.id === ventureId)
      if (venture) activeProjectId = venture.project_id
    }

    if (activeProjectId) {
      const project = projects.find(p => p.id === activeProjectId)
      if (project && !project.global_idea) {
        router.replace(`/dashboard/greeting?projectId=${activeProjectId}`)
      }
    }
  }, [pathname, projects, ventures, loading, router])

  // Listen for forge:new-project events from dashboard buttons
  useEffect(() => {
    function handleNewProject() { setShowNewProject(true) }
    window.addEventListener('forge:new-project', handleNewProject)
    return () => window.removeEventListener('forge:new-project', handleNewProject)
  }, [])

  useEffect(() => { if (showNewProject && newProjectRef.current) newProjectRef.current.focus() }, [showNewProject])
  useEffect(() => { if (showNewVenture && newVentureRef.current) newVentureRef.current.focus() }, [showNewVenture])

  async function submitNewProject() {
    const trimmed = newProjectName.trim()
    if (!trimmed) { setShowNewProject(false); setNewProjectName(''); return }
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (res.ok) {
        const project: ProjectItem = await res.json()
        setProjects(prev => [project, ...prev])
        setExpandedProjects(prev => new Set(prev).add(project.id))
        // Navigate to greeting page so user can describe their idea
        router.push(`/dashboard/greeting?projectId=${project.id}`)
      } else {
        const err = await res.json()
        alert(`Error creating project: ${err.error || 'Unknown error'}`)
      }
    } catch (e) {
      alert(`Network error creating project: ${e}`)
    } finally {
      setShowNewProject(false)
      setNewProjectName('')
    }
  }

  async function submitNewVenture(projectId: string) {
    const trimmed = newVentureName.trim()
    if (!trimmed) { setShowNewVenture(null); setNewVentureName(''); return }
    try {
      const res = await fetch('/api/ventures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, projectId }),
      })
      if (res.ok) {
        const venture: VentureItem = await res.json()
        setVentures(prev => [venture, ...prev])
        setExpandedVentures(prev => new Set(prev).add(venture.id))
      } else {
        const err = await res.json()
        alert(`Error creating venture: ${err.error || 'Unknown error'}`)
      }
    } catch (e) {
      alert(`Network error creating venture: ${e}`)
    } finally {
      setShowNewVenture(null)
      setNewVentureName('')
    }
  }

  function handleProjectKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); submitNewProject() }
    else if (e.key === 'Escape') { setShowNewProject(false); setNewProjectName('') }
  }

  function handleVentureKeyDown(e: KeyboardEvent<HTMLInputElement>, projectId: string) {
    if (e.key === 'Enter') { e.preventDefault(); submitNewVenture(projectId) }
    else if (e.key === 'Escape') { setShowNewVenture(null); setNewVentureName('') }
  }

  function toggleProject(id: string) {
    setExpandedProjects(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleVenture(id: string) {
    setExpandedVentures(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function isModuleActive(ventureId: string, moduleId: string): boolean {
    return pathname === `/dashboard/venture/${ventureId}/${moduleId}`
  }

  function getVenturesForProject(projectId: string) {
    return ventures.filter(v => v.project_id === projectId)
  }

  const unlinkedVentures = ventures.filter(v => !v.project_id)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ─── Sidebar ─── */}
      <aside className="glass-sidebar" style={sidebarStyle}>

        {/* Subtle top gradient shimmer */}
        <div style={sidebarTopGlowStyle} />

        {/* Header */}
        <div style={headerStyle}>
          <div className="flex items-center gap-2.5">
            <motion.div
              style={hexStyle}
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
            />
            <span style={wordmarkStyle}>Forge</span>
            <motion.span
              style={versionBadge}
              whileHover={{ scale: 1.05 }}
            >
              v2
            </motion.span>
          </div>
          <motion.button
            onClick={toggleDark}
            style={toggleBtnStyle}
            aria-label="Toggle dark mode"
            whileHover={{ scale: 1.12, backgroundColor: 'var(--nav-active)' }}
            whileTap={{ scale: 0.9 }}
          >
            <AnimatePresence mode="wait">
              {dark ? (
                <motion.svg
                  key="sun"
                  width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </motion.svg>
              ) : (
                <motion.svg
                  key="moon"
                  width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </motion.svg>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '12px 10px' }}>
          {/* New Project button */}
          <AnimatePresence mode="wait">
            {showNewProject ? (
              <motion.input
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                ref={newProjectRef}
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={handleProjectKeyDown}
                onBlur={() => submitNewProject()}
                placeholder="Project name..."
                style={newInputStyle}
              />
            ) : (
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                whileHover={{ scale: 1.01, boxShadow: 'var(--shadow-sm)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowNewProject(true)}
                style={newProjectBtnStyle}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>New Project</span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Section Label */}
          <p style={sectionLabelStyle}>PROJECTS</p>

          {/* Loading skeleton */}
          {loading && (
            <div className="flex flex-col gap-2" style={{ padding: '0 4px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={skeletonRowStyle}>
                  <div style={{ ...skeletonBarStyle, width: i === 1 ? '55%' : '70%' }} className="skeleton" />
                </div>
              ))}
            </div>
          )}

          {/* Projects list */}
          {!loading && (
            <motion.div
              className="flex flex-col gap-0.5"
              initial="hidden"
              animate="show"
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
            >
              {projects.map(proj => {
                const isOpen = expandedProjects.has(proj.id)
                const projVentures = getVenturesForProject(proj.id)
                return (
                  <motion.div
                    key={proj.id}
                    className="flex flex-col"
                    variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                  >
                    {/* Project row */}
                    <motion.button
                      onClick={() => toggleProject(proj.id)}
                      whileHover={{ backgroundColor: 'var(--nav-active)', x: 1 }}
                      transition={{ duration: 0.15 }}
                      style={{ ...projectRowStyle, opacity: isOpen ? 1 : 0.82 }}
                    >
                      <motion.svg
                        width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        animate={{ rotate: isOpen ? 90 : 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        style={{ flexShrink: 0 }}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </motion.svg>
                      <span style={{ fontSize: 14, lineHeight: 1 }}>{proj.icon}</span>
                      <span style={projectNameStyle}>{proj.name}</span>
                      <motion.span
                        style={countBadgeStyle}
                        animate={{ opacity: projVentures.length > 0 ? 1 : 0.4 }}
                      >
                        {projVentures.length}
                      </motion.span>
                    </motion.button>

                    {/* Ventures under project */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          style={ventureContainerStyle}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        >
                          {projVentures.map(v => {
                            const vOpen = expandedVentures.has(v.id)
                            return (
                              <div key={v.id} className="flex flex-col">
                                <motion.button
                                  onClick={() => toggleVenture(v.id)}
                                  whileHover={{ backgroundColor: 'var(--nav-active)' }}
                                  style={{ ...ventureRowStyle, opacity: vOpen ? 1 : 0.72 }}
                                >
                                  <motion.svg
                                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                    animate={{ rotate: vOpen ? 90 : 0 }}
                                    transition={{ duration: 0.18, ease: 'easeInOut' }}
                                    style={{ flexShrink: 0 }}
                                  >
                                    <polyline points="9 18 15 12 9 6" />
                                  </motion.svg>
                                  <span style={ventureNameStyle}>{v.name}</span>
                                  <span style={ventureDateStyle}>{formatDate(v.created_at)}</span>
                                </motion.button>

                                {/* Modules */}
                                <AnimatePresence>
                                  {vOpen && (
                                    <motion.div
                                      style={moduleContainerStyle}
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.16 }}
                                    >
                                      {MODULES.map((m, idx) => {
                                        const active = isModuleActive(v.id, m.id)
                                        return (
                                          <motion.button
                                            key={m.id}
                                            initial={{ opacity: 0, x: -4 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            whileHover={{ backgroundColor: 'var(--nav-active)', x: 1 }}
                                            onClick={() => router.push(`/dashboard/venture/${v.id}/${m.id}`)}
                                            style={{
                                              ...moduleRowStyle,
                                              background: active ? `${m.accent}12` : 'transparent',
                                              borderLeft: active ? `2px solid ${m.accent}` : '2px solid transparent',
                                            }}
                                          >
                                            <span style={{ color: m.accent, fontSize: 11, lineHeight: 1, width: 14, textAlign: 'center' as const }}>{m.icon}</span>
                                            <span style={{ ...moduleLabelStyle, color: active ? 'var(--text)' : 'var(--text-soft)', fontWeight: active ? 600 : 500 }}>{m.label}</span>
                                            {active && (
                                              <motion.div
                                                layoutId="module-active-dot"
                                                style={{ width: 4, height: 4, borderRadius: '50%', background: m.accent, marginLeft: 'auto', flexShrink: 0 }}
                                              />
                                            )}
                                          </motion.button>
                                        )
                                      })}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )
                          })}

                          {/* Add venture inline */}
                          {showNewVenture === proj.id ? (
                            <motion.input
                              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                              ref={newVentureRef}
                              value={newVentureName}
                              onChange={e => setNewVentureName(e.target.value)}
                              onKeyDown={e => handleVentureKeyDown(e, proj.id)}
                              onBlur={() => submitNewVenture(proj.id)}
                              placeholder="Venture name..."
                              style={{ ...newInputStyle, marginLeft: 8, marginTop: 4, fontSize: 12 }}
                            />
                          ) : (
                            <motion.button
                              whileHover={{ opacity: 1 }}
                              onClick={() => setShowNewVenture(proj.id)}
                              style={addVentureBtnStyle}
                            >
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                              <span>Add venture</span>
                            </motion.button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}

              {/* Unlinked ventures (legacy) */}
              {unlinkedVentures.length > 0 && (
                <>
                  <p style={{ ...sectionLabelStyle, paddingTop: 14 }}>VENTURES</p>
                  {unlinkedVentures.map(v => {
                    const vOpen = expandedVentures.has(v.id)
                    return (
                      <div key={v.id} className="flex flex-col">
                        <motion.button
                          onClick={() => toggleVenture(v.id)}
                          whileHover={{ backgroundColor: 'var(--nav-active)' }}
                          style={{ ...ventureRowStyle, opacity: vOpen ? 1 : 0.72, paddingLeft: 8 }}
                        >
                          <motion.svg
                            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            animate={{ rotate: vOpen ? 90 : 0 }}
                            transition={{ duration: 0.18, ease: 'easeInOut' }}
                            style={{ flexShrink: 0 }}
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </motion.svg>
                          <span style={ventureNameStyle}>{v.name}</span>
                          <span style={ventureDateStyle}>{formatDate(v.created_at)}</span>
                        </motion.button>
                        <AnimatePresence>
                          {vOpen && (
                            <motion.div
                              style={moduleContainerStyle}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              {MODULES.map(m => {
                                const active = isModuleActive(v.id, m.id)
                                return (
                                  <motion.button
                                    key={m.id}
                                    whileHover={{ backgroundColor: 'var(--nav-active)' }}
                                    onClick={() => router.push(`/dashboard/venture/${v.id}/${m.id}`)}
                                    style={{
                                      ...moduleRowStyle,
                                      background: active ? `${m.accent}12` : 'transparent',
                                      borderLeft: active ? `2px solid ${m.accent}` : '2px solid transparent',
                                    }}
                                  >
                                    <span style={{ color: m.accent, fontSize: 11, lineHeight: 1, width: 14, textAlign: 'center' as const }}>{m.icon}</span>
                                    <span style={{ ...moduleLabelStyle, color: active ? 'var(--text)' : 'var(--text-soft)', fontWeight: active ? 600 : 500 }}>{m.label}</span>
                                  </motion.button>
                                )
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </>
              )}
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <motion.div
            className="flex items-center gap-3"
            style={{ padding: '6px 8px', borderRadius: 10 }}
            whileHover={{ backgroundColor: 'var(--nav-active)' }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              style={avatarStyle}
              whileHover={{ scale: 1.05 }}
            >
              {session ? getInitials(session.name || session.email) : '??'}
            </motion.div>
            <div className="flex flex-col flex-1 min-w-0">
              <span style={userNameStyle}>{session?.name || session?.email || '...'}</span>
              <span style={planBadgeStyle}>
                {session?.plan === 'pro' ? '✦ Pro' : 'Free Plan'}
              </span>
            </div>
            <motion.button
              whileHover={{ rotate: 90, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 200, damping: 10 }}
              onClick={() => router.push('/dashboard/settings')}
              aria-label="Settings"
              style={gearBtnStyle}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </motion.button>
          </motion.div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)', position: 'relative' }}>
        {children}
      </main>
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const sidebarStyle: React.CSSProperties = {
  width: 264,
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  zIndex: 10,
  position: 'relative',
}

const sidebarTopGlowStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 120,
  background: 'linear-gradient(180deg, var(--accent-soft) 0%, transparent 100%)',
  opacity: 0.4,
  pointerEvents: 'none',
  zIndex: 0,
}

const headerStyle: React.CSSProperties = {
  height: 52,
  padding: '0 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
  position: 'relative',
  zIndex: 1,
}

const hexStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
  flexShrink: 0,
  boxShadow: '0 0 8px var(--accent-glow)',
}

const wordmarkStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--text)',
  letterSpacing: '-0.03em',
}

const versionBadge: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: 'var(--accent)',
  background: 'var(--accent-soft)',
  padding: '2px 6px',
  borderRadius: 5,
  letterSpacing: '0.04em',
  border: '1px solid var(--accent-glow)',
}

const toggleBtnStyle: React.CSSProperties = {
  padding: 7,
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: 'var(--muted)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  transition: 'background 150ms',
}

const newProjectBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  width: '100%',
  height: 34,
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(12px)',
  boxShadow: 'var(--shadow-xs)',
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'box-shadow 200ms, border-color 200ms',
}

const newInputStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  borderRadius: 10,
  border: '1px solid var(--accent)',
  background: 'var(--card-solid)',
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'inherit',
  padding: '0 12px',
  outline: 'none',
  boxShadow: 'var(--shadow-input)',
}

const sectionLabelStyle: React.CSSProperties = {
  padding: '14px 8px 4px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.1em',
  color: 'var(--muted)',
  opacity: 0.5,
  textTransform: 'uppercase',
  margin: 0,
}

const skeletonRowStyle: React.CSSProperties = {
  height: 28,
  padding: '0 8px',
  display: 'flex',
  alignItems: 'center',
}

const skeletonBarStyle: React.CSSProperties = {
  height: 10,
  borderRadius: 4,
}

const projectRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 8px',
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  fontFamily: 'inherit',
}

const projectNameStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const countBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--muted)',
  background: 'var(--nav-active)',
  padding: '1px 6px',
  borderRadius: 6,
  flexShrink: 0,
  border: '1px solid var(--border)',
}

const ventureContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  marginLeft: 14,
  marginTop: 2,
  paddingLeft: 10,
  borderLeft: '1px solid var(--border)',
  overflow: 'hidden',
}

const ventureRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 6px',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  fontFamily: 'inherit',
}

const ventureNameStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const ventureDateStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--muted)',
  flexShrink: 0,
}

const moduleContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  marginLeft: 12,
  marginTop: 2,
  paddingLeft: 8,
  borderLeft: '1px solid var(--border)',
  overflow: 'hidden',
}

const moduleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  fontFamily: 'inherit',
  transition: 'background 150ms ease',
}

const moduleLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-soft)',
}

const addVentureBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 6px',
  marginTop: 2,
  marginLeft: 4,
  borderRadius: 5,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 10,
  fontWeight: 500,
  color: 'var(--muted)',
  opacity: 0.55,
}

const footerStyle: React.CSSProperties = {
  padding: '8px 10px 10px',
  borderTop: '1px solid var(--border)',
  flexShrink: 0,
}

const avatarStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, var(--accent-soft), var(--glass-bg))',
  color: 'var(--accent)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 700,
  flexShrink: 0,
  border: '1.5px solid var(--accent-glow)',
  boxShadow: '0 0 8px var(--accent-glow)',
}

const userNameStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const planBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: 'var(--accent)',
}

const gearBtnStyle: React.CSSProperties = {
  padding: 4,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  borderRadius: 6,
}
