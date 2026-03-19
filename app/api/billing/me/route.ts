import { requireAuth, isAuthError } from '@/lib/auth'
import { PLAN_SEQUENCE, TOPUP_SEQUENCE, BILLING_PLANS, TOPUP_PRODUCTS } from '@/lib/billing'
import { getBillingSnapshot, getRecentPayments } from '@/lib/billing-queries'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await requireAuth()
    const [snapshot, payments] = await Promise.all([
      getBillingSnapshot(session.userId),
      getRecentPayments(session.userId, 12),
    ])

    return NextResponse.json({
      ...snapshot,
      plans: PLAN_SEQUENCE.map((slug) => BILLING_PLANS[slug]),
      topups: TOPUP_SEQUENCE.map((slug) => TOPUP_PRODUCTS[slug]),
      payments,
    })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
