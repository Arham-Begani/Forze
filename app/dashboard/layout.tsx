'use client'

import { useEffect, useState, useRef, useCallback, type ReactNode, type KeyboardEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { LoadingScreen } from '@/components/ui/LoadingScreen'

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
  { id: 'general',      label: 'General',      icon: '◉', accent: '#6B8F71' },
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
  const [appReady, setAppReady] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [expandedVentures, setExpandedVentures] = useState<Set<string>>(new Set())

  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const newProjectRef = useRef<HTMLInputElement>(null)
  const [showNewVenture, setShowNewVenture] = useState<string | null>(null)
  const [newVentureName, setNewVentureName] = useState('')
  const newVentureRef = useRef<HTMLInputElement>(null)

  // Rename state
  const [renamingProject, setRenamingProject] = useState<string | null>(null)
  const [renameProjectValue, setRenameProjectValue] = useState('')
  const renameProjectRef = useRef<HTMLInputElement>(null)
  const [renamingVenture, setRenamingVenture] = useState<string | null>(null)
  const [renameVentureValue, setRenameVentureValue] = useState('')
  const renameVentureRef = useRef<HTMLInputElement>(null)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dark, setDark] = useState(false)

  // ─── Dark mode ────────────────────────────────────────────────────────────
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

  // ─── Data loading ─────────────────────────────────────────────────────────
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

  // ─── Idea Guard Rail ──────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !projects.length || pathname === '/dashboard/greeting' || pathname === '/dashboard/new') return

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

  // ─── Custom events ────────────────────────────────────────────────────────
  useEffect(() => {
    function handleNewProject() { router.push('/dashboard/new') }
    function handleProjectUpdated(e: Event) {
      const { projectId, global_idea } = (e as CustomEvent).detail
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, global_idea } : p))
    }
    function handleVentureAdded(e: Event) {
      const venture = (e as CustomEvent).detail
      setVentures(prev => [venture, ...prev])
      setExpandedVentures(prev => new Set(prev).add(venture.id))
    }
    function handleRefreshProjects() {
      // Reload projects and ventures when a new project is created externally
      Promise.all([
        fetch('/api/projects').then(r => r.ok ? r.json() : []),
        fetch('/api/ventures').then(r => r.ok ? r.json() : []),
      ]).then(([projs, vents]) => {
        setProjects(projs)
        setVentures(vents)
      }).catch(() => {})
    }

    window.addEventListener('forge:new-project', handleNewProject)
    window.addEventListener('forge:project-updated', handleProjectUpdated)
    window.addEventListener('forge:venture-added', handleVentureAdded)
    window.addEventListener('forge:refresh-projects', handleRefreshProjects)
    return () => {
      window.removeEventListener('forge:new-project', handleNewProject)
      window.removeEventListener('forge:project-updated', handleProjectUpdated)
      window.removeEventListener('forge:venture-added', handleVentureAdded)
      window.removeEventListener('forge:refresh-projects', handleRefreshProjects)
    }
  }, [])

  useEffect(() => { if (showNewProject && newProjectRef.current) newProjectRef.current.focus() }, [showNewProject])
  useEffect(() => { if (showNewVenture && newVentureRef.current) newVentureRef.current.focus() }, [showNewVenture])
  useEffect(() => { if (renamingProject && renameProjectRef.current) { renameProjectRef.current.focus(); renameProjectRef.current.select() } }, [renamingProject])
  useEffect(() => { if (renamingVenture && renameVentureRef.current) { renameVentureRef.current.focus(); renameVentureRef.current.select() } }, [renamingVenture])

  // ─── Close mobile sidebar on route change ─────────────────────────────────
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // ─── CRUD handlers ────────────────────────────────────────────────────────
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

  async function handleDeleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this project and all its ventures?')) return
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== id))
        setVentures(prev => prev.filter(v => v.project_id !== id))
        if (pathname.includes(`/dashboard/project/${id}`) || pathname.includes(`/dashboard/greeting`)) {
          router.push('/dashboard')
        }
      }
    } catch(err) {
      console.error('Failed to delete project', err)
    }
  }

  async function handleDeleteVenture(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this venture?')) return
    try {
      const res = await fetch(`/api/ventures/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setVentures(prev => prev.filter(v => v.id !== id))
        if (pathname.includes(`/dashboard/venture/${id}`)) {
          router.push('/dashboard')
        }
      }
    } catch(err) {
      console.error('Failed to delete venture', err)
    }
  }

  // ─── Rename handlers ────────────────────────────────────────────────────────
  function startRenameProject(id: string, currentName: string, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingProject(id)
    setRenameProjectValue(currentName)
  }

  async function submitRenameProject() {
    const trimmed = renameProjectValue.trim()
    if (!trimmed || !renamingProject) { setRenamingProject(null); return }
    try {
      const res = await fetch(`/api/projects/${renamingProject}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (res.ok) {
        setProjects(prev => prev.map(p => p.id === renamingProject ? { ...p, name: trimmed } : p))
      }
    } catch (err) {
      console.error('Failed to rename project', err)
    } finally {
      setRenamingProject(null)
      setRenameProjectValue('')
    }
  }

  function startRenameVenture(id: string, currentName: string, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingVenture(id)
    setRenameVentureValue(currentName)
  }

  async function submitRenameVenture() {
    const trimmed = renameVentureValue.trim()
    if (!trimmed || !renamingVenture) { setRenamingVenture(null); return }
    try {
      const res = await fetch(`/api/ventures/${renamingVenture}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (res.ok) {
        setVentures(prev => prev.map(v => v.id === renamingVenture ? { ...v, name: trimmed } : v))
      }
    } catch (err) {
      console.error('Failed to rename venture', err)
    } finally {
      setRenamingVenture(null)
      setRenameVentureValue('')
    }
  }

  const handleLoadingComplete = useCallback(() => {
    setAppReady(true)
  }, [])

  const sidebarWidth = sidebarCollapsed ? 64 : 272

  return (
    <>
      {/* Loading Screen */}
      {!appReady && <LoadingScreen onComplete={handleLoadingComplete} minimumDuration={1400} />}

      <div className="flex h-screen overflow-hidden" style={{ opacity: appReady ? 1 : 0, transition: 'opacity 0.3s ease' }}>

        {/* ─── Mobile overlay ─── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(4px)',
                zIndex: 40,
              }}
              className="lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* ─── Sidebar ─── */}
        <motion.aside
          className="glass-sidebar"
          animate={{ width: sidebarWidth }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            zIndex: 50,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle top gradient shimmer */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 100,
            background: 'linear-gradient(180deg, var(--accent-soft) 0%, transparent 100%)',
            opacity: 0.3,
            pointerEvents: 'none',
            zIndex: 0,
          }} />

          {/* Header */}
          <div style={{
            height: 56,
            padding: sidebarCollapsed ? '0 12px' : '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'space-between',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            position: 'relative',
            zIndex: 1,
          }}>
            <div className="flex items-center gap-2.5" style={{ overflow: 'hidden' }}>
              <motion.div
                style={{
                  width: 22,
                  height: 22,
                  background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  flexShrink: 0,
                  boxShadow: '0 0 12px var(--accent-glow)',
                  cursor: 'pointer',
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                onClick={() => router.push('/dashboard')}
                role="button"
                aria-label="Go to dashboard"
                tabIndex={0}
              />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.div
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--text)',
                      letterSpacing: '-0.03em',
                      whiteSpace: 'nowrap',
                    }}>Forge</span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--accent)',
                      background: 'var(--accent-soft)',
                      padding: '2px 6px',
                      borderRadius: 5,
                      letterSpacing: '0.04em',
                      border: '1px solid var(--accent-glow)',
                      whiteSpace: 'nowrap',
                    }}>v2</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {!sidebarCollapsed && (
              <div className="flex items-center gap-1">
                {/* Collapse sidebar button */}
                <motion.button
                  onClick={() => setSidebarCollapsed(true)}
                  style={iconButtonStyle}
                  aria-label="Collapse sidebar"
                  whileHover={{ scale: 1.1, backgroundColor: 'var(--nav-active)' }}
                  whileTap={{ scale: 0.9 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" />
                  </svg>
                </motion.button>
                {/* Dark mode toggle */}
                <motion.button
                  onClick={toggleDark}
                  style={iconButtonStyle}
                  aria-label="Toggle dark mode"
                  whileHover={{ scale: 1.1, backgroundColor: 'var(--nav-active)' }}
                  whileTap={{ scale: 0.9 }}
                >
                  <AnimatePresence mode="wait">
                    {dark ? (
                      <motion.svg
                        key="sun"
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </motion.svg>
                    ) : (
                      <motion.svg
                        key="moon"
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </motion.svg>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            )}

            {sidebarCollapsed && (
              <motion.button
                onClick={() => setSidebarCollapsed(false)}
                style={{ ...iconButtonStyle, position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
                aria-label="Expand sidebar"
                whileHover={{ scale: 1.1, backgroundColor: 'var(--nav-active)' }}
                whileTap={{ scale: 0.9 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </motion.button>
            )}
          </div>

          {/* Scrollable content — only when expanded */}
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                className="flex-1 overflow-y-auto"
                style={{ padding: '12px 10px' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
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

                {/* Section Label + Manage Projects */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 8px 4px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', opacity: 0.5, textTransform: 'uppercase' }}>PROJECTS</span>
                  <motion.button
                    onClick={() => router.push('/dashboard/manage')}
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent-glow)',
                      borderRadius: 5,
                      padding: '2px 7px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      letterSpacing: '0.02em',
                    }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    Manage
                  </motion.button>
                </div>

                {/* Loading skeleton */}
                {loading && (
                  <div className="flex flex-col gap-2" style={{ padding: '0 4px' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ height: 28, padding: '0 8px', display: 'flex', alignItems: 'center' }}>
                        <div style={{ height: 10, borderRadius: 4, width: i === 1 ? '55%' : '70%' }} className="skeleton" />
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
                    variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
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
                          {renamingProject === proj.id ? (
                            <motion.input
                              ref={renameProjectRef}
                              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                              value={renameProjectValue}
                              onChange={e => setRenameProjectValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); submitRenameProject() }
                                else if (e.key === 'Escape') { setRenamingProject(null) }
                              }}
                              onBlur={() => submitRenameProject()}
                              style={{ ...newInputStyle, height: 32, fontSize: 12, margin: '2px 0' }}
                            />
                          ) : (
                          <motion.div
                            role="button"
                            tabIndex={0}
                            className="group"
                            onClick={() => toggleProject(proj.id)}
                            onKeyDown={e => e.key === 'Enter' && toggleProject(proj.id)}
                            whileHover={{ backgroundColor: 'var(--nav-active)', x: 1 }}
                            transition={{ duration: 0.12 }}
                            style={{
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
                              opacity: isOpen ? 1 : 0.82,
                            }}
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
                            <span style={{
                              flex: 1,
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>{proj.name}</span>
                            <span
                              className="group-hover:hidden"
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: 'var(--muted)',
                                background: 'var(--nav-active)',
                                padding: '1px 6px',
                                borderRadius: 6,
                                flexShrink: 0,
                                border: '1px solid var(--border)',
                                opacity: projVentures.length > 0 ? 1 : 0.4,
                              }}
                            >
                              {projVentures.length}
                            </span>
                            <button
                              onClick={(e) => startRenameProject(proj.id, proj.name, e)}
                              className="hidden group-hover:flex"
                              style={deleteButtonStyle}
                              title="Rename project"
                              aria-label={`Rename project ${proj.name}`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => handleDeleteProject(proj.id, e)}
                              className="hidden group-hover:flex"
                              style={deleteButtonStyle}
                              title="Delete project"
                              aria-label={`Delete project ${proj.name}`}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </motion.div>
                          )}

                          {/* Ventures under project */}
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 1,
                                  marginLeft: 14,
                                  marginTop: 2,
                                  paddingLeft: 10,
                                  borderLeft: '1px solid var(--border)',
                                  overflow: 'hidden',
                                }}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                              >
                                {projVentures.map(v => {
                                  const vOpen = expandedVentures.has(v.id)
                                  return (
                                    <div key={v.id} className="flex flex-col">
                                      {renamingVenture === v.id ? (
                                        <motion.input
                                          ref={renameVentureRef}
                                          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                          value={renameVentureValue}
                                          onChange={e => setRenameVentureValue(e.target.value)}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') { e.preventDefault(); submitRenameVenture() }
                                            else if (e.key === 'Escape') { setRenamingVenture(null) }
                                          }}
                                          onBlur={() => submitRenameVenture()}
                                          style={{ ...newInputStyle, height: 28, fontSize: 11, margin: '1px 0' }}
                                        />
                                      ) : (
                                      <motion.div
                                        role="button"
                                        tabIndex={0}
                                        className="group"
                                        onClick={() => toggleVenture(v.id)}
                                        onKeyDown={e => e.key === 'Enter' && toggleVenture(v.id)}
                                        whileHover={{ backgroundColor: 'var(--nav-active)' }}
                                        style={{
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
                                          opacity: vOpen ? 1 : 0.72,
                                        }}
                                      >
                                        <motion.svg
                                          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                          animate={{ rotate: vOpen ? 90 : 0 }}
                                          transition={{ duration: 0.18, ease: 'easeInOut' }}
                                          style={{ flexShrink: 0 }}
                                        >
                                          <polyline points="9 18 15 12 9 6" />
                                        </motion.svg>
                                        <span style={{
                                          flex: 1,
                                          fontSize: 12,
                                          fontWeight: 500,
                                          color: 'var(--text)',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}>{v.name}</span>
                                        <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }} className="group-hover:hidden">{formatDate(v.created_at)}</span>
                                        <button
                                          onClick={(e) => startRenameVenture(v.id, v.name, e)}
                                          className="hidden group-hover:flex"
                                          style={deleteButtonStyle}
                                          title="Rename venture"
                                          aria-label={`Rename venture ${v.name}`}
                                        >
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={(e) => handleDeleteVenture(v.id, e)}
                                          className="hidden group-hover:flex"
                                          style={deleteButtonStyle}
                                          title="Delete venture"
                                          aria-label={`Delete venture ${v.name}`}
                                        >
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                          </svg>
                                        </button>
                                      </motion.div>
                                      )}

                                      {/* Modules */}
                                      <AnimatePresence>
                                        {vOpen && (
                                          <motion.div
                                            style={{
                                              display: 'flex',
                                              flexDirection: 'column',
                                              gap: 1,
                                              marginLeft: 12,
                                              marginTop: 2,
                                              paddingLeft: 8,
                                              borderLeft: '1px solid var(--border)',
                                              overflow: 'hidden',
                                            }}
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.16 }}
                                          >
                                            {/* Master Dossier Link */}
                                            <motion.button
                                              initial={{ opacity: 0, x: -4 }}
                                              animate={{ opacity: 1, x: 0 }}
                                              whileHover={{ backgroundColor: 'var(--nav-active)', x: 1 }}
                                              onClick={() => router.push(`/dashboard/venture/${v.id}`)}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: '6px 8px',
                                                borderRadius: 6,
                                                border: 'none',
                                                cursor: 'pointer',
                                                width: '100%',
                                                textAlign: 'left',
                                                fontFamily: 'inherit',
                                                transition: 'background 150ms ease',
                                                background: pathname === `/dashboard/venture/${v.id}` ? 'var(--nav-active)' : 'transparent',
                                                borderLeft: pathname === `/dashboard/venture/${v.id}` ? '2px solid var(--accent)' : '2px solid transparent',
                                                marginBottom: 4,
                                              }}
                                            >
                                              <span style={{ color: 'var(--accent)', fontSize: 11, width: 14, textAlign: 'center' }}>★</span>
                                              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>Master Dossier</span>
                                            </motion.button>

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
                                                  aria-label={`Open ${m.label} module`}
                                                  aria-current={active ? 'page' : undefined}
                                                  style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    padding: '5px 8px',
                                                    borderRadius: 6,
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    fontFamily: 'inherit',
                                                    transition: 'background 150ms ease',
                                                    background: active ? `${m.accent}12` : 'transparent',
                                                    borderLeft: active ? `2px solid ${m.accent}` : '2px solid transparent',
                                                  }}
                                                >
                                                  <span style={{ color: m.accent, fontSize: 11, lineHeight: 1, width: 14, textAlign: 'center' as const }}>{m.icon}</span>
                                                  <span style={{ fontSize: 11.5, color: active ? 'var(--text)' : 'var(--text-soft)', fontWeight: active ? 600 : 500 }}>{m.label}</span>
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

                                {/* Venture creation removed — ventures are auto-created from greeting flow */}
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
                              <motion.div
                                role="button"
                                tabIndex={0}
                                className="group"
                                onClick={() => toggleVenture(v.id)}
                                onKeyDown={e => e.key === 'Enter' && toggleVenture(v.id)}
                                whileHover={{ backgroundColor: 'var(--nav-active)' }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '5px 8px',
                                  borderRadius: 6,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  width: '100%',
                                  textAlign: 'left',
                                  fontFamily: 'inherit',
                                  opacity: vOpen ? 1 : 0.72,
                                }}
                              >
                                <motion.svg
                                  width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                  animate={{ rotate: vOpen ? 90 : 0 }}
                                  transition={{ duration: 0.18 }}
                                  style={{ flexShrink: 0 }}
                                >
                                  <polyline points="9 18 15 12 9 6" />
                                </motion.svg>
                                <span style={{
                                  flex: 1,
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: 'var(--text)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>{v.name}</span>
                                <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }} className="group-hover:hidden">{formatDate(v.created_at)}</span>
                                <button
                                  onClick={(e) => startRenameVenture(v.id, v.name, e)}
                                  className="hidden group-hover:flex"
                                  style={deleteButtonStyle}
                                  title="Rename venture"
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => handleDeleteVenture(v.id, e)}
                                  className="hidden group-hover:flex"
                                  style={deleteButtonStyle}
                                  title="Delete venture"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </motion.div>
                              <AnimatePresence>
                                {vOpen && (
                                  <motion.div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 1,
                                      marginLeft: 12,
                                      marginTop: 2,
                                      paddingLeft: 8,
                                      borderLeft: '1px solid var(--border)',
                                      overflow: 'hidden',
                                    }}
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
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '5px 8px',
                                            borderRadius: 6,
                                            border: 'none',
                                            cursor: 'pointer',
                                            width: '100%',
                                            textAlign: 'left',
                                            fontFamily: 'inherit',
                                            transition: 'background 150ms ease',
                                            background: active ? `${m.accent}12` : 'transparent',
                                            borderLeft: active ? `2px solid ${m.accent}` : '2px solid transparent',
                                          }}
                                        >
                                          <span style={{ color: m.accent, fontSize: 11, lineHeight: 1, width: 14, textAlign: 'center' as const }}>{m.icon}</span>
                                          <span style={{ fontSize: 11.5, color: active ? 'var(--text)' : 'var(--text-soft)', fontWeight: active ? 600 : 500 }}>{m.label}</span>
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsed sidebar: quick nav icons */}
          {sidebarCollapsed && (
            <motion.div
              className="flex-1 overflow-y-auto flex flex-col items-center gap-1 py-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              {/* New project button */}
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: 'var(--accent-soft)' }}
                whileTap={{ scale: 0.9 }}
                onClick={() => { setSidebarCollapsed(false); setTimeout(() => setShowNewProject(true), 200) }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                  marginBottom: 8,
                }}
                title="New Project"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </motion.button>

              {/* Project icons */}
              {projects.slice(0, 8).map(proj => (
                <motion.button
                  key={proj.id}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setSidebarCollapsed(false); toggleProject(proj.id) }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--nav-active)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}
                  title={proj.name}
                >
                  {proj.icon}
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* Footer */}
          <div style={{
            padding: sidebarCollapsed ? '8px 6px 10px' : '8px 10px 10px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            {sidebarCollapsed ? (
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleDark}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--nav-active)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--muted)',
                  }}
                  title={dark ? 'Light mode' : 'Dark mode'}
                >
                  {dark ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5" /></svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                  )}
                </motion.button>
                <motion.div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-soft), var(--glass-bg))',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    border: '1.5px solid var(--accent-glow)',
                  }}
                  whileHover={{ scale: 1.05 }}
                >
                  {session ? getInitials(session.name || session.email) : '??'}
                </motion.div>
              </div>
            ) : (
              <motion.div
                className="flex items-center gap-3"
                style={{ padding: '6px 8px', borderRadius: 10 }}
                whileHover={{ backgroundColor: 'var(--nav-active)' }}
                transition={{ duration: 0.15 }}
              >
                <motion.div
                  style={{
                    width: 32,
                    height: 32,
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
                  }}
                  whileHover={{ scale: 1.05 }}
                >
                  {session ? getInitials(session.name || session.email) : '??'}
                </motion.div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{session?.name || session?.email || '...'}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent)' }}>
                    {session?.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                  </span>
                </div>
                <motion.button
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                  onClick={() => router.push('/dashboard/settings')}
                  aria-label="Settings"
                  style={{
                    padding: 4,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 6,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </motion.button>
              </motion.div>
            )}
          </div>
        </motion.aside>

        {/* ─── Mobile hamburger ─── */}
        <motion.button
          className="lg:hidden fixed top-3 left-3 z-30"
          onClick={() => setMobileOpen(true)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--glass-bg-strong)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text)',
            boxShadow: 'var(--shadow-sm)',
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </motion.button>

        {/* ─── Main Content ─── */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)', position: 'relative' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: '100%' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  )
}

// ─── Shared Styles ──────────────────────────────────────────────────────────────

const iconButtonStyle: React.CSSProperties = {
  padding: 6,
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: 'var(--muted)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  transition: 'background 150ms',
}

const deleteButtonStyle: React.CSSProperties = {
  padding: '2px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--muted)',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 4,
  marginLeft: 'auto',
}

const newProjectBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  width: '100%',
  height: 36,
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
  height: 36,
  borderRadius: 10,
  border: '1px solid var(--accent)',
  background: 'var(--glass-bg-strong)',
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
