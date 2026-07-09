// app/api/bootstrap/route.ts
// Consolidated dashboard bootstrap: session + projects + ventures in ONE request.
//
// The dashboard layout previously fired /api/auth/session, /api/projects and
// /api/ventures in parallel — three separate HTTP requests that EACH ran
// requireAuth() (a Supabase Auth round-trip) and each passed through the proxy's
// getUser(). Besides the latency, those concurrent auth calls raced on refresh-
// token rotation, which is what produced bursts of "refresh_token_not_found".
// Collapsing them into one request means one auth pass and no self-inflicted race.
//
// The response mirrors the exact shapes the three endpoints returned, so the
// client can consume it identically. The layout keeps the three-fetch path as a
// fallback, so if this endpoint ever fails nothing regresses.
import { requireAuth, isAdmin, isAuthError } from '@/lib/auth'
import { getBillingSnapshot } from '@/lib/billing-queries'
import { getProjectsByUser, getVenturesByUser } from '@/lib/queries'
import { NextResponse } from 'next/server'

const COMPLETED_MODULE_MAP = [
  { contextKey: 'landing', moduleId: 'landing' },
  { contextKey: 'shadowBoard', moduleId: 'shadow-board' },
  { contextKey: 'investorKit', moduleId: 'investor-kit' },
  { contextKey: 'launchAutopilot', moduleId: 'launch-autopilot' },
  { contextKey: 'mvpScalpel', moduleId: 'mvp-scalpel' },
] as const

function getCompletedModules(context: Record<string, unknown> | null | undefined): string[] {
  if (!context) return []
  return COMPLETED_MODULE_MAP
    .filter(({ contextKey }) => context[contextKey] != null)
    .map(({ moduleId }) => moduleId)
}

export async function GET() {
  try {
    const session = await requireAuth()

    // requireAuth already resolved the user; fan out the three reads in parallel.
    const [billing, projects, ventures] = await Promise.all([
      getBillingSnapshot(session.userId),
      getProjectsByUser(session.userId),
      getVenturesByUser(session.userId),
    ])

    return NextResponse.json({
      session: {
        userId: session.userId,
        email: session.email,
        name: session.name,
        plan: billing.planSlug,
        planLabel: billing.planLabel,
        creditsRemaining: billing.creditsRemaining,
        allowedModules: billing.allowedModules,
        ventureLimit: billing.ventureLimit,
        activeVentureCount: billing.activeVentureCount,
        nextRenewalAt: billing.nextRenewalAt,
        hasUnlimitedAccess: billing.hasUnlimitedAccess,
        isAdmin: isAdmin(session),
      },
      projects,
      ventures: ventures.map((venture) => ({
        ...venture,
        completedModules: getCompletedModules(
          venture.context as unknown as Record<string, unknown> | null | undefined
        ),
      })),
    })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
