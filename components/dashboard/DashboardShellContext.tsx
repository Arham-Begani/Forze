'use client'

// Shared read model for the dashboard shell.
//
// The layout already loads session + projects + ventures in ONE request
// (/api/bootstrap — see that route's header for why it was consolidated). Every
// dashboard page then re-fetched /api/projects and /api/ventures for itself,
// so a single page view cost 3-4 HTTP requests, 3-4 requireAuth() round-trips
// and two identical passes over the same two tables.
//
// The layout now publishes what it already has through this context and pages
// read it instead. Nothing here fetches when a provider is present.
//
// Fallback: `useDashboardCollections` fetches for itself when there is NO
// provider above it (a page rendered outside the dashboard layout, or a future
// layout change). That keeps every page independently functional — no page can
// be broken by the shell, which is the same fail-independently rule the layout
// already follows for /api/bootstrap itself.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface DashboardSession {
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

export interface DashboardProject {
  id: string
  name: string
  description: string
  icon: string
  status: string
  global_idea: string | null
  created_at: string
  updated_at?: string
}

export interface DashboardVenture {
  id: string
  name: string
  project_id: string | null
  created_at: string
  completedModules: string[]
}

export interface DashboardShellValue {
  session: DashboardSession | null
  projects: DashboardProject[]
  ventures: DashboardVenture[]
  /** True until the shell's bootstrap request settles. */
  loading: boolean
}

// `null` means "no shell above me" — the signal to fall back to fetching.
const DashboardShellContext = createContext<DashboardShellValue | null>(null)

export function DashboardShellProvider({
  value,
  children,
}: {
  value: DashboardShellValue
  children: ReactNode
}) {
  return <DashboardShellContext.Provider value={value}>{children}</DashboardShellContext.Provider>
}

/** Ventures from the API may predate `completedModules`; never let it be undefined. */
export function normalizeVenture(
  venture: Omit<DashboardVenture, 'completedModules'> & { completedModules?: string[] }
): DashboardVenture {
  return {
    ...venture,
    completedModules: Array.isArray(venture.completedModules) ? venture.completedModules : [],
  }
}

/** Full shell value, or null when rendered outside the dashboard layout. */
export function useDashboardShell(): DashboardShellValue | null {
  return useContext(DashboardShellContext)
}

/**
 * Projects + ventures for a dashboard page. Free (no request) under the
 * dashboard layout; self-fetching anywhere else.
 */
export function useDashboardCollections(): {
  projects: DashboardProject[]
  ventures: DashboardVenture[]
  loading: boolean
} {
  const shell = useContext(DashboardShellContext)
  const hasShell = shell !== null

  const [fallback, setFallback] = useState<{
    projects: DashboardProject[]
    ventures: DashboardVenture[]
    loading: boolean
  }>({ projects: [], ventures: [], loading: !hasShell })

  useEffect(() => {
    // The shell has the data already — never spend a request.
    if (hasShell) return

    let cancelled = false
    async function loadDirect() {
      // Every hop guarded: a failed/garbage response degrades to an empty list
      // instead of throwing through a page that has no boundary of its own.
      const [projects, ventures] = await Promise.all([
        fetch('/api/projects')
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch('/api/ventures')
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ])
      if (cancelled) return
      setFallback({
        projects: Array.isArray(projects) ? projects : [],
        ventures: Array.isArray(ventures) ? ventures.map(normalizeVenture) : [],
        loading: false,
      })
    }
    loadDirect()

    return () => {
      cancelled = true
    }
  }, [hasShell])

  if (shell) {
    return { projects: shell.projects, ventures: shell.ventures, loading: shell.loading }
  }
  return fallback
}
