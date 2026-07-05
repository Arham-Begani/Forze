'use client'

import React, { useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { NavigationProgress } from '@/components/ui/NavigationProgress'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { PlatformFeedbackButton } from '@/components/ui/PlatformFeedbackButton'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SessionData {
  userId: string
  email: string
  name: string
  plan: string
  planLabel?: string
  creditsRemaining?: number
  allowedModules?: string[]
  hasUnlimitedAccess?: boolean
  isAdmin?: boolean
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
  completedModules: string[]
}

const MODULES = [
  { id: 'landing',      label: 'Landing Page', icon: '▣', accent: '#8C7A5A' },
  { id: 'shadow-board', label: 'Shadow Board', icon: '⚔', accent: '#E04848' },
  { id: 'general',      label: 'Co-pilot',     icon: '◉', accent: '#6B8F71' },
  { id: 'campaigns',    label: 'Campaigns',    icon: '✉', accent: '#C07A3A' },
  { id: 'crm',          label: 'CRM',          icon: '◐', accent: '#5A8C5A' },
] as const

const BUILD_MODULE_IDS = ['landing', 'shadow-board', 'general'] as const

// ─── Helpers ────────────────────────────────────────────────────────────────────

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

function normalizeVentureItem(venture: Omit<VentureItem, 'completedModules'> & { completedModules?: string[] }): VentureItem {
  return {
    ...venture,
    completedModules: Array.isArray(venture.completedModules) ? venture.completedModules : [],
  }
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </ToastProvider>
  )
}

function DashboardLayoutContent({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToast()

  const [session, setSession] = useState<SessionData | null>(null)
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [ventures, setVentures] = useState<VentureItem[]>([])
  const [loading, setLoading] = useState(true)
  const [appReady, setAppReady] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeVentureId, setActiveVentureId] = useState<string | null>(null)
  const [venturePickerOpen, setVenturePickerOpen] = useState(false)
  const venturePickerRef = useRef<HTMLDivElement>(null)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const userCollapsedRef = useRef(false) // tracks manual toggle, so the auto-blink below never fights it
  const [mobileOpen, setMobileOpen] = useState(false)
  // Project icon hover tooltip + context menu (portal-based so they escape overflow:hidden)
  const [projTooltip, setProjTooltip] = useState<{ id: string; name: string; top: number } | null>(null)
  const [projContextMenu, setProjContextMenu] = useState<{ id: string; name: string; x: number; y: number } | null>(null)
  const [dark, setDark] = useState(false)
  const [theme, setTheme] = useState('amber')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync active project/venture from current pathname
  useEffect(() => {
    if (!ventures.length) return
    const ventureMatch = pathname.match(/\/dashboard\/venture\/([^/]+)/)
    if (ventureMatch) {
      const ventureId = ventureMatch[1]
      const venture = ventures.find(v => v.id === ventureId)
      if (venture) {
        setActiveVentureId(ventureId)
        if (venture.project_id) setActiveProjectId(venture.project_id)
        return
      }
    }
    const projectMatch = pathname.match(/\/dashboard\/project\/([^/]+)/)
    if (projectMatch) setActiveProjectId(projectMatch[1])
  }, [pathname, ventures])

  // Close venture picker on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (venturePickerRef.current && !venturePickerRef.current.contains(e.target as Node)) {
        setVenturePickerOpen(false)
      }
    }
    if (venturePickerOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [venturePickerOpen])

  // Close project context menu on any click
  useEffect(() => {
    if (!projContextMenu) return
    function close() { setProjContextMenu(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [projContextMenu])

  // ─── Dark mode ────────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('Forze-dark-mode')
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
    localStorage.setItem('Forze-dark-mode', String(next))
    if (next) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }

  // ─── Theme ────────────────────────────────────────────────────────────────
  const THEME_IDS = ['amber', 'ocean', 'forest', 'rose', 'slate', 'violet']

  function applyTheme(id: string) {
    const root = document.documentElement
    THEME_IDS.forEach(t => root.classList.remove(`theme-${t}`))
    if (id !== 'amber') root.classList.add(`theme-${id}`)
    setTheme(id)
    localStorage.setItem('Forze-theme', id)
  }

  useEffect(() => {
    const stored = localStorage.getItem('Forze-theme') || 'amber'
    applyTheme(stored)
  }, [])

  useEffect(() => {
    function handleThemeChange(e: Event) {
      const { themeId } = (e as CustomEvent).detail
      applyTheme(themeId)
    }
    window.addEventListener('Forze:theme-changed', handleThemeChange)
    return () => window.removeEventListener('Forze:theme-changed', handleThemeChange)
  }, [])

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
        if (ventRes.ok) {
          const data = await ventRes.json()
          setVentures(data.map(normalizeVentureItem))
        }
      } catch (err) {
        console.error('Failed to load dashboard layout data:', err)
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

    let resolvedProjectId: string | null = null

    if (projectMatch) {
      resolvedProjectId = projectMatch[1]
    } else if (ventureMatch) {
      const ventureId = ventureMatch[1]
      const venture = ventures.find(v => v.id === ventureId)
      if (venture) resolvedProjectId = venture.project_id
    }

    if (resolvedProjectId) {
      const project = projects.find(p => p.id === resolvedProjectId)
      if (project && !project.global_idea) {
        router.replace(`/dashboard/greeting?projectId=${resolvedProjectId}`)
      }
    }
  }, [pathname, projects, ventures, loading, router])

  // ─── Custom events ────────────────────────────────────────────────────────
  useEffect(() => {
    function handleNewProject() { router.push('/dashboard/new') }
    function handleProjectUpdated(e: Event) {
      const { projectId, global_idea, icon } = (e as CustomEvent).detail
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, global_idea, ...(icon ? { icon } : {}) } : p))
    }
    function handleVentureAdded(e: Event) {
      const venture = normalizeVentureItem((e as CustomEvent).detail)
      setVentures(prev => [venture, ...prev])
      if (venture.project_id) setActiveProjectId(venture.project_id)
      setActiveVentureId(venture.id)
    }
    function handleRefreshProjects() {
      // Reload projects and ventures when a new project is created externally
      Promise.all([
        fetch('/api/projects').then(r => r.ok ? r.json() : []),
        fetch('/api/ventures').then(r => r.ok ? r.json() : []),
      ]).then(([projs, vents]) => {
        setProjects(projs)
        setVentures(vents.map(normalizeVentureItem))
      }).catch(() => {})
    }

    function handleCreditsChanged(e: Event) {
      const { creditsRemaining } = (e as CustomEvent).detail
      setSession(prev => prev ? { ...prev, creditsRemaining } : prev)
    }

    window.addEventListener('Forze:new-project', handleNewProject)
    window.addEventListener('Forze:project-updated', handleProjectUpdated)
    window.addEventListener('Forze:venture-added', handleVentureAdded)
    window.addEventListener('Forze:refresh-projects', handleRefreshProjects)
    window.addEventListener('Forze:credits-changed', handleCreditsChanged)
    return () => {
      window.removeEventListener('Forze:new-project', handleNewProject)
      window.removeEventListener('Forze:project-updated', handleProjectUpdated)
      window.removeEventListener('Forze:venture-added', handleVentureAdded)
      window.removeEventListener('Forze:refresh-projects', handleRefreshProjects)
      window.removeEventListener('Forze:credits-changed', handleCreditsChanged)
    }
  }, [router])

  // ─── Close mobile sidebar on route change ─────────────────────────────────
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // ─── Blink the sidebar closed/open when the active venture changes ────────
  const prevVentureIdRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevVentureIdRef.current
    prevVentureIdRef.current = activeVentureId
    console.log('[DEBUG blink effect]', { prev, activeVentureId, userCollapsed: userCollapsedRef.current })
    if (prev === null || prev === activeVentureId || !activeVentureId) return
    if (userCollapsedRef.current) return // don't fight a manually collapsed sidebar
    console.log('[DEBUG blink effect] TRIGGERING BLINK')
    setSidebarCollapsed(true)
    const timer = setTimeout(() => setSidebarCollapsed(false), 260)
    return () => clearTimeout(timer)
  }, [activeVentureId])

  // ─── CRUD handlers ────────────────────────────────────────────────────────

  function moduleHref(ventureId: string, moduleId: string): string {
    // Campaigns lives under its own section (list + detail pages) — not the
    // shared /[module] workspace used for agent runs.
    if (moduleId === 'campaigns') return `/dashboard/venture/${ventureId}/campaigns`
    if (moduleId === 'crm') return `/dashboard/venture/${ventureId}/crm`
    if (moduleId === 'testimonials') return `/dashboard/venture/${ventureId}/testimonials`
    if (moduleId === 'inspiration') return `/dashboard/venture/${ventureId}/inspiration`
    return `/dashboard/venture/${ventureId}/${moduleId}`
  }

  function isModuleActive(ventureId: string, moduleId: string): boolean {
    if (moduleId === 'campaigns') {
      return pathname.startsWith(`/dashboard/venture/${ventureId}/campaigns`)
    }
    if (moduleId === 'crm') {
      return pathname.startsWith(`/dashboard/venture/${ventureId}/crm`)
    }
    if (moduleId === 'testimonials') {
      return pathname.startsWith(`/dashboard/venture/${ventureId}/testimonials`)
    }
    if (moduleId === 'inspiration') {
      return pathname.startsWith(`/dashboard/venture/${ventureId}/inspiration`)
    }
    return pathname === `/dashboard/venture/${ventureId}/${moduleId}`
  }

  async function handleDeleteProject(id: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!confirm('Delete this project and all its ventures?')) return
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== id))
        setVentures(prev => prev.filter(v => v.project_id !== id))
        if (activeProjectId === id) { setActiveProjectId(null); setActiveVentureId(null) }
        if (pathname.includes(`/dashboard/project/${id}`) || pathname.includes(`/dashboard/greeting`)) {
          router.push('/dashboard')
        }
        toast.success('Project deleted')
      } else {
        toast.error('Something went wrong - please try again')
      }
    } catch(err) {
      console.error('Failed to delete project', err)
      toast.error('Something went wrong - please try again')
    }
  }

  const handleLoadingComplete = useCallback(() => {
    setAppReady(true)
  }, [])

  const sidebarWidth = sidebarCollapsed ? 52 : 272

  // Derived sidebar state
  const activeVenture = ventures.find(v => v.id === activeVentureId) ?? null
  const projectVentures = ventures.filter(v => v.project_id === activeProjectId)

  return (
    <>
      {/* Navigation Progress Bar */}
      <NavigationProgress />

      {/* Loading Screen */}
      {!appReady && <LoadingScreen onComplete={handleLoadingComplete} minimumDuration={800} />}

      <div className="flex h-[100dvh] overflow-hidden" style={{ opacity: appReady ? 1 : 0, transition: 'opacity 0.3s ease' }}>

        {/* ─── Mobile overlay ─── */}
        {mounted && (
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setMobileOpen(false)}
                className="mobile-overlay"
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(4px)',
                  zIndex: 40,
                }}
              />
            )}
          </AnimatePresence>
        )}

        {/* ─── Sidebar ─── */}
        {mounted ? (
          <motion.aside
            className={`glass-sidebar sidebar-desktop${mobileOpen ? ' mobile-open' : ''}`}
            animate={{ width: sidebarWidth }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{
              height: '100vh',
              display: 'flex',
              flexDirection: 'row',
              flexShrink: 0,
              zIndex: 50,
              overflow: 'hidden',
            }}
          >
          {/* ─── Left Rail (52px) ─── */}
          <div style={{
            width: 52,
            flexShrink: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRight: '1px solid var(--border)',
            background: 'var(--glass-bg)',
            position: 'relative',
            zIndex: 1,
          }}>
            {/* Logo + toggle */}
            <div style={{
              height: 56,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              borderBottom: '1px solid var(--border)',
              width: '100%',
              gap: 6,
            }}>
              <motion.div
                style={{
                  width: 22, height: 22,
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
            </div>

            {/* Sidebar open/close toggle — always visible */}
            <motion.button
              onClick={() => setSidebarCollapsed(v => {
                const next = !v
                userCollapsedRef.current = next
                return next
              })}
              style={{
                width: 36, height: 28,
                borderRadius: 7, border: 'none',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--muted)', flexShrink: 0, marginTop: 4,
              }}
              whileHover={{ scale: 1.1, backgroundColor: 'var(--nav-active)' }}
              whileTap={{ scale: 0.9 }}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <motion.svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                animate={{ rotate: sidebarCollapsed ? 0 : 180 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              >
                <polyline points="9 18 15 12 9 6" />
              </motion.svg>
            </motion.button>

            {/* Project icons */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '10px 0',
            }}>
              {/* New Project */}
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: 'var(--accent-soft)' }}
                whileTap={{ scale: 0.9 }}
                onClick={() => router.push('/dashboard/new')}
                style={{
                  width: 36, height: 36,
                  borderRadius: 10,
                  border: '1px dashed var(--border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--muted)',
                  marginBottom: 4,
                }}
                title="New Project"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </motion.button>

              {/* Loading skeletons */}
              {loading && [0, 1].map(i => (
                <div key={i} style={{ width: 36, height: 36, borderRadius: 10 }} className="skeleton" />
              ))}

              {/* Project icon buttons */}
              {!loading && projects.map(proj => {
                const isActive = activeProjectId === proj.id
                return (
                  <motion.button
                    key={proj.id}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onMouseEnter={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setProjTooltip({ id: proj.id, name: proj.name, top: rect.top + rect.height / 2 })
                    }}
                    onMouseLeave={() => setProjTooltip(null)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setProjTooltip(null)
                      setProjContextMenu({ id: proj.id, name: proj.name, x: e.clientX, y: e.clientY })
                    }}
                    onClick={() => {
                      if (!proj.global_idea) {
                        router.push(`/dashboard/greeting?projectId=${proj.id}`)
                      } else {
                        setActiveProjectId(proj.id)
                        const pVentures = ventures.filter(v => v.project_id === proj.id)
                        if (pVentures.length) {
                          const currentBelongs = pVentures.find(v => v.id === activeVentureId)
                          if (!currentBelongs) {
                            // Switching to a venture in a different project — navigate away
                            // from whatever module tab was open so it doesn't stay rendered
                            // for the wrong venture.
                            setActiveVentureId(pVentures[0].id)
                            router.push(`/dashboard/venture/${pVentures[0].id}`)
                          }
                        } else {
                          setActiveVentureId(null)
                          router.push(`/dashboard/project/${proj.id}`)
                        }
                      }
                    }}
                    style={{
                      width: 36, height: 36,
                      borderRadius: 10,
                      background: isActive ? 'var(--accent-soft)' : 'var(--nav-active)',
                      border: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16,
                      boxShadow: isActive ? '0 0 8px var(--accent-glow)' : 'none',
                      transition: 'border-color 150ms, box-shadow 150ms',
                    }}
                  >
                    {proj.icon}
                  </motion.button>
                )
              })}
            </div>

            {/* Left Rail Footer */}
            <div style={{
              padding: '8px 0 10px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              borderTop: '1px solid var(--border)',
              width: '100%',
            }}>
              {/* Dark mode toggle */}
              <motion.button
                onClick={toggleDark}
                style={{
                  width: 32, height: 32,
                  borderRadius: 8, border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--muted)',
                }}
                whileHover={{ scale: 1.1, backgroundColor: 'var(--nav-active)' }}
                title={dark ? 'Light mode' : 'Dark mode'}
              >
                {dark ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                )}
              </motion.button>
              {/* User avatar */}
              <motion.div
                style={{
                  width: 32, height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-soft), var(--glass-bg))',
                  color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  border: '1.5px solid var(--accent-glow)',
                  boxShadow: '0 0 8px var(--accent-glow)',
                  cursor: 'pointer',
                }}
                whileHover={{ scale: 1.05 }}
                onClick={() => router.push('/dashboard/settings')}
                title={session?.name || session?.email || 'Settings'}
              >
                {session ? getInitials(session.name || session.email) : '??'}
              </motion.div>
            </div>
          </div>

          {/* ─── Right Panel (220px) ─── */}
          <AnimatePresence initial={false}>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  width: 220, height: '100%',
                  display: 'flex', flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Right Panel Header: venture picker + collapse */}
                <div style={{
                  height: 56,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 10px',
                  borderBottom: '1px solid var(--border)',
                  flexShrink: 0,
                }}>
                  {/* Venture picker */}
                  <div ref={venturePickerRef} style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                    <motion.button
                      onClick={() => setVenturePickerOpen(v => !v)}
                      whileHover={{ backgroundColor: 'var(--nav-active)' }}
                      style={{
                        width: '100%',
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 8px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        overflow: 'hidden',
                      }}
                    >
                      <span style={{
                        flex: 1,
                        fontSize: 12, fontWeight: 600,
                        color: activeVenture ? 'var(--text)' : 'var(--muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textAlign: 'left',
                      }}>
                        {activeVenture?.name ?? (activeProjectId ? 'Select venture' : 'Select project')}
                      </span>
                      <motion.svg
                        width="10" height="10" viewBox="0 0 24 24" fill="none"
                        stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"
                        animate={{ rotate: venturePickerOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ flexShrink: 0 }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </motion.svg>
                    </motion.button>

                    <AnimatePresence>
                      {venturePickerOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0, right: 0,
                            zIndex: 100,
                            background: 'var(--glass-bg-strong)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            padding: 4,
                            boxShadow: 'var(--shadow-md)',
                            maxHeight: 240,
                            overflowY: 'auto',
                          }}
                        >
                          {projectVentures.length === 0 && (
                            <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--muted)' }}>
                              {activeProjectId ? 'No ventures yet' : 'Select a project first'}
                            </div>
                          )}
                          {projectVentures.map(v => (
                            <motion.button
                              key={v.id}
                              whileHover={{ backgroundColor: 'var(--nav-active)' }}
                              onClick={() => {
                                setActiveVentureId(v.id)
                                setVenturePickerOpen(false)
                                router.push(`/dashboard/venture/${v.id}`)
                              }}
                              style={{
                                width: '100%',
                                padding: '7px 10px',
                                borderRadius: 7, border: 'none',
                                background: v.id === activeVentureId ? 'var(--nav-active)' : 'transparent',
                                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                                display: 'flex', alignItems: 'center', gap: 6,
                              }}
                            >
                              {v.id === activeVentureId && (
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />
                              )}
                              <span style={{
                                fontSize: 12,
                                fontWeight: v.id === activeVentureId ? 600 : 400,
                                color: v.id === activeVentureId ? 'var(--text)' : 'var(--text-soft)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {v.name}
                              </span>
                            </motion.button>
                          ))}
                          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                          <motion.button
                            whileHover={{ backgroundColor: 'var(--nav-active)' }}
                            onClick={() => { setVenturePickerOpen(false); router.push('/dashboard/new') }}
                            style={{
                              width: '100%', padding: '7px 10px',
                              borderRadius: 7, border: 'none',
                              background: 'transparent', cursor: 'pointer',
                              textAlign: 'left', fontFamily: 'inherit',
                              display: 'flex', alignItems: 'center', gap: 6,
                              color: 'var(--accent)',
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>New Venture</span>
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                </div>

                {/* Scrollable module list */}
                <div className="flex-1 overflow-y-auto" style={{ padding: '8px 8px' }}>
                  {!activeVenture ? (
                    <div style={{ padding: '20px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                        {activeProjectId ? 'No ventures yet' : 'Select a project'}
                      </div>
                      {activeProjectId && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => router.push('/dashboard/new')}
                          style={{
                            fontSize: 12, color: 'var(--accent)',
                            background: 'var(--accent-soft)',
                            border: '1px solid var(--accent-glow)',
                            borderRadius: 8, padding: '6px 12px',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          + New Venture
                        </motion.button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Overview */}
                      <motion.button
                        whileHover={{ backgroundColor: 'var(--nav-active)', x: 1 }}
                        onClick={() => router.push(`/dashboard/venture/${activeVenture.id}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '0 8px', height: 36,
                          borderRadius: 7, border: 'none',
                          cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'inherit',
                          background: pathname === `/dashboard/venture/${activeVenture.id}` ? 'var(--nav-active)' : 'transparent',
                          borderLeft: pathname === `/dashboard/venture/${activeVenture.id}` ? '2px solid var(--accent)' : '2px solid transparent',
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ color: 'var(--accent)', fontSize: 12, width: 18, textAlign: 'center' }}>★</span>
                        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>Overview</span>
                      </motion.button>

                      {/* Top-level nav: Build modules (flat) / Outreach / CRM */}
                      {(() => {
                        const campaignsModule = MODULES.find(m => m.id === 'campaigns')!
                        const crmModule = MODULES.find(m => m.id === 'crm')!
                        const outreachActive = isModuleActive(activeVenture.id, 'campaigns')
                        const crmActive = isModuleActive(activeVenture.id, 'crm')

                        const sectionButtonStyle = (active: boolean, accent: string): React.CSSProperties => ({
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '0 8px', height: 38,
                          borderRadius: 8, border: 'none',
                          cursor: 'pointer', width: '100%', textAlign: 'left' as const, fontFamily: 'inherit',
                          background: active ? `${accent}12` : 'transparent',
                          borderLeft: active ? `2px solid ${accent}` : '2px solid transparent',
                        })

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 8 }}>
                            {/* Build modules — flat list, one click each */}
                            {BUILD_MODULE_IDS.map((id, idx) => {
                              const m = MODULES.find(mod => mod.id === id)!
                              const active = isModuleActive(activeVenture.id, m.id)
                              const completed = activeVenture.completedModules.includes(m.id)
                              return (
                                <motion.button
                                  key={m.id}
                                  initial={{ opacity: 0, x: -4 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.02 }}
                                  whileHover={{ backgroundColor: 'var(--nav-active)', x: 1 }}
                                  onClick={() => router.push(moduleHref(activeVenture.id, m.id))}
                                  aria-label={`Open ${m.label} module`}
                                  aria-current={active ? 'page' : undefined}
                                  style={sectionButtonStyle(active, m.accent)}
                                >
                                  <span style={{ color: m.accent, fontSize: 13, lineHeight: 1, width: 18, textAlign: 'center' as const, flexShrink: 0 }}>{m.icon}</span>
                                  <span style={{ fontSize: 13, color: active ? 'var(--text)' : 'var(--text-soft)', fontWeight: active ? 700 : 600 }}>{m.label}</span>
                                  {(completed || active) && (
                                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                      {completed && (
                                        <span
                                          aria-hidden="true"
                                          style={{
                                            width: 4, height: 4, borderRadius: '50%',
                                            background: '#5A8C6E',
                                            boxShadow: '0 0 6px rgba(90, 140, 110, 0.45)',
                                          }}
                                        />
                                      )}
                                      {active && (
                                        <motion.div
                                          layoutId="module-active-dot"
                                          style={{ width: 4, height: 4, borderRadius: '50%', background: m.accent }}
                                        />
                                      )}
                                    </span>
                                  )}
                                </motion.button>
                              )
                            })}

                            {/* Outreach — single button, routes to campaigns */}
                            <motion.button
                              whileHover={{ backgroundColor: 'var(--nav-active)', x: 1 }}
                              onClick={() => router.push(moduleHref(activeVenture.id, 'campaigns'))}
                              aria-label="Open Outreach"
                              aria-current={outreachActive ? 'page' : undefined}
                              style={sectionButtonStyle(outreachActive, campaignsModule.accent)}
                            >
                              <span style={{ color: campaignsModule.accent, fontSize: 13, lineHeight: 1, width: 18, textAlign: 'center', flexShrink: 0 }}>{campaignsModule.icon}</span>
                              <span style={{ fontSize: 13, color: outreachActive ? 'var(--text)' : 'var(--text-soft)', fontWeight: outreachActive ? 700 : 600 }}>Outreach</span>
                            </motion.button>

                            {/* CRM — single button, routes to /crm */}
                            <motion.button
                              whileHover={{ backgroundColor: 'var(--nav-active)', x: 1 }}
                              onClick={() => router.push(moduleHref(activeVenture.id, 'crm'))}
                              aria-label="Open CRM"
                              aria-current={crmActive ? 'page' : undefined}
                              style={sectionButtonStyle(crmActive, crmModule.accent)}
                            >
                              <span style={{ color: crmModule.accent, fontSize: 13, lineHeight: 1, width: 18, textAlign: 'center', flexShrink: 0 }}>{crmModule.icon}</span>
                              <span style={{ fontSize: 13, color: crmActive ? 'var(--text)' : 'var(--text-soft)', fontWeight: crmActive ? 700 : 600 }}>CRM</span>
                            </motion.button>

                            {/* Testimonials — sibling feature (not an agent module) */}
                            {(() => {
                              const testimonialsAccent = '#B86A8E'
                              const testimonialsActive = isModuleActive(activeVenture.id, 'testimonials')
                              return (
                                <motion.button
                                  whileHover={{ backgroundColor: 'var(--nav-active)', x: 1 }}
                                  onClick={() => router.push(moduleHref(activeVenture.id, 'testimonials'))}
                                  aria-label="Open Testimonials"
                                  aria-current={testimonialsActive ? 'page' : undefined}
                                  style={sectionButtonStyle(testimonialsActive, testimonialsAccent)}
                                >
                                  <span style={{ color: testimonialsAccent, fontSize: 13, lineHeight: 1, width: 18, textAlign: 'center', flexShrink: 0 }}>❝</span>
                                  <span style={{ fontSize: 13, color: testimonialsActive ? 'var(--text)' : 'var(--text-soft)', fontWeight: testimonialsActive ? 700 : 600 }}>Testimonials</span>
                                </motion.button>
                              )
                            })()}

                            {/* Generate from Inspiration — design-token extraction studio.
                                Lives in the BUILD section because the tokens it produces feed
                                the landing-page agent on the next run. */}
                            {(() => {
                              const inspirationAccent = '#9C7B5A'
                              const inspirationActive = isModuleActive(activeVenture.id, 'inspiration')
                              return (
                                <motion.button
                                  whileHover={{ backgroundColor: 'var(--nav-active)', x: 1 }}
                                  onClick={() => router.push(moduleHref(activeVenture.id, 'inspiration'))}
                                  aria-label="Open Inspiration Studio"
                                  aria-current={inspirationActive ? 'page' : undefined}
                                  style={sectionButtonStyle(inspirationActive, inspirationAccent)}
                                >
                                  <span style={{ color: inspirationAccent, fontSize: 13, lineHeight: 1, width: 18, textAlign: 'center', flexShrink: 0 }}>✦</span>
                                  <span style={{ fontSize: 13, color: inspirationActive ? 'var(--text)' : 'var(--text-soft)', fontWeight: inspirationActive ? 700 : 600 }}>Inspiration</span>
                                </motion.button>
                              )
                            })()}
                          </div>
                        )
                      })()}
                    </>
                  )}

                  {/* Manage + footer actions */}
                  <div style={{ padding: '8px 0 4px' }}>
                    <motion.button
                      onClick={() => router.push('/dashboard/manage')}
                      whileHover={{ backgroundColor: 'var(--nav-active)' }}
                      style={{
                        width: '100%', padding: '7px 8px',
                        borderRadius: 7, border: 'none',
                        background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 6,
                        color: 'var(--muted)', fontSize: 11, fontWeight: 500,
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      Manage Projects
                    </motion.button>
                    <PlatformFeedbackButton />
                  </div>

                  {/* Analytics + Settings */}
                  <div style={{ padding: '0 0 8px', display: 'flex', gap: 2 }}>
                    {session?.isAdmin && (
                      <motion.button
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => router.push('/dashboard/admin')}
                        aria-label="Admin Dashboard"
                        style={{ ...iconButtonStyle, flex: 1, justifyContent: 'center' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => router.push('/dashboard/analytics')}
                      aria-label="Analytics"
                      style={{ ...iconButtonStyle, flex: 1, justifyContent: 'center' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    </motion.button>
                    <motion.button
                      whileHover={{ rotate: 90, scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                      onClick={() => router.push('/dashboard/settings')}
                      aria-label="Settings"
                      style={{ ...iconButtonStyle, flex: 1, justifyContent: 'center' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.aside>
      ) : (
        <aside
          className="glass-sidebar sidebar-desktop"
          style={{
            width: sidebarCollapsed ? 52 : 272,
            height: '100vh',
            display: 'flex',
            flexDirection: 'row',
            flexShrink: 0,
            zIndex: 50,
            overflow: 'hidden',
            background: 'var(--glass-bg)',
            borderRight: '1px solid var(--border)',
          }}
        >
          <div style={{ width: 52, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border)' }}>
            <div style={{
              width: 22, height: 22,
              background: 'var(--accent)',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            }} />
          </div>
        </aside>
      )}

      {/* ─── Mobile hamburger ─── */}
      {mounted && !mobileOpen && (
        <motion.button
          className="mobile-hamburger"
          onClick={() => setMobileOpen(true)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--glass-bg-strong)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
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
      )}

        {/* ─── Main Content ─── */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)', position: 'relative' }}>
          {mounted ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ height: '100%' }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          ) : (
            children
          )}
        </main>
      </div>

      {/* ─── Project name tooltip (portal) ─── */}
      {mounted && projTooltip && sidebarCollapsed && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: 64,
            top: projTooltip.top - 16,
            zIndex: 9999,
            background: 'var(--glass-bg-strong, #1a1917)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {projTooltip.name}
        </div>,
        document.body
      )}

      {/* ─── Project context menu (portal) ─── */}
      {mounted && projContextMenu && typeof document !== 'undefined' && createPortal(
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.12 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: projContextMenu.x,
            top: projContextMenu.y,
            zIndex: 9999,
            background: 'var(--glass-bg-strong, #1a1917)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 4,
            minWidth: 160,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{
            padding: '6px 10px 4px',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--muted)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            borderBottom: '1px solid var(--border)',
            marginBottom: 4,
          }}>
            {projContextMenu.name}
          </div>
          <button
            onClick={() => { setProjContextMenu(null); handleDeleteProject(projContextMenu.id) }}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 7,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: '#E04848',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(224,72,72,0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete Project
          </button>
        </motion.div>,
        document.body
      )}
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

