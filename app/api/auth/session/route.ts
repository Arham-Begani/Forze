// app/api/auth/session/route.ts
import { getSession } from '@/lib/auth'
import { getBillingSnapshot } from '@/lib/billing-queries'
import { NextResponse } from 'next/server'

export async function GET() {
    const session = await getSession()

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const billing = await getBillingSnapshot(session.userId)

    return NextResponse.json({
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
    })
}
