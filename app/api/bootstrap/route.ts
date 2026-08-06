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
import { getProjectSummariesByUser, getVenturesByUser } from '@/lib/queries'
import { toVentureSummary } from '@/lib/venture-summary'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await requireAuth()

    // requireAuth already resolved the user; fan out the three reads in parallel.
    const [billing, projects, ventures] = await Promise.all([
      getBillingSnapshot(session.userId),
      getProjectSummariesByUser(session.userId),
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
      ventures: ventures.map(toVentureSummary),
    })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
