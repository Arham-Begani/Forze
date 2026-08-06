// app/dashboard/layout.tsx
//
// The dashboard shell used to be one big client component. It downloaded,
// hydrated, and only then fetched /api/bootstrap — holding the entire app at
// opacity 0 behind a full-screen loading overlay for the length of that round
// trip. Pages then fired their own fetches on top. Three stages before anything
// meaningful painted.
//
// The reads /api/bootstrap performs now happen here, during the server render,
// and are handed to the client shell as initial state. The endpoint itself is
// unchanged and still serves the fallback path in DashboardShellClient — so if
// anything below fails, the shell degrades to exactly its previous behaviour
// rather than rendering a broken dashboard.

import { getSession, isAdmin } from '@/lib/auth'
import { getBillingSnapshot } from '@/lib/billing-queries'
import { getProjectSummariesByUser, getVenturesByUser } from '@/lib/queries'
import { toVentureSummary } from '@/lib/venture-summary'
import { logWarn } from '@/lib/log'
import {
  DashboardShellClient,
  type DashboardShellInitialData,
} from '@/components/dashboard/DashboardShellClient'
import type { ReactNode } from 'react'

// Every dashboard route is per-user and reads cookies, so none of them can be
// prerendered. Declaring that explicitly stops Next from attempting a static
// pass whose only outcome was a DynamicServerError landing in the catch below.
export const dynamic = 'force-dynamic'

/**
 * Next signals control flow — redirect(), notFound(), and the dynamic-rendering
 * bailout — by throwing errors carrying a NEXT_ digest. Swallowing one would
 * break the framework, so they are rethrown; only genuine data failures fall
 * through to the fallback.
 */
function isNextControlFlowError(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest
  return typeof digest === 'string' && digest.startsWith('NEXT_')
}

// Best-effort by design. Any failure returns null, which puts the client shell
// on its fetch path — a slower load, never a blank one. This is the same
// fail-independently rule the shell already applied to /api/bootstrap.
async function loadShellData(): Promise<DashboardShellInitialData | null> {
  try {
    // The proxy has already established there is a user before any /dashboard
    // route renders; getSession() is cache()d, so this is not a second auth pass.
    const session = await getSession()
    if (!session) return null

    const [billing, projects, ventures] = await Promise.all([
      getBillingSnapshot(session.userId),
      getProjectSummariesByUser(session.userId),
      getVenturesByUser(session.userId),
    ])

    return {
      session: {
        userId: session.userId,
        email: session.email,
        name: session.name,
        plan: billing.planSlug,
        planLabel: billing.planLabel,
        creditsRemaining: billing.creditsRemaining,
        allowedModules: billing.allowedModules,
        nextRenewalAt: billing.nextRenewalAt,
        hasUnlimitedAccess: billing.hasUnlimitedAccess,
        isAdmin: isAdmin(session),
      },
      projects,
      ventures: ventures.map(toVentureSummary),
    }
  } catch (err) {
    if (isNextControlFlowError(err)) throw err
    logWarn('dashboard-layout', 'server shell read failed, falling back to client fetch', {
      message: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const initialData = await loadShellData()

  return <DashboardShellClient initialData={initialData}>{children}</DashboardShellClient>
}
