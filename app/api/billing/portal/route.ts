import { requireAuth, isAuthError } from '@/lib/auth'
import { BillingError, cancelSubscriptionAtPeriodEnd, getBillingSnapshot, getCurrentSubscription } from '@/lib/billing-queries'
import { cancelRazorpaySubscription } from '@/lib/razorpay'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const BodySchema = z.object({
  action: z.enum(['overview', 'cancel']).default('overview'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json().catch(() => ({}))
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid billing portal request' }, { status: 400 })
    }

    const { action } = parsed.data
    if (action === 'overview') {
      const snapshot = await getBillingSnapshot(session.userId)
      return NextResponse.json({
        mode: 'app',
        snapshot,
        manageUrl: '/dashboard/settings#billing',
      })
    }

    const subscription = await getCurrentSubscription(session.userId)
    if (!subscription || !subscription.provider_subscription_id || subscription.plan_slug === 'free') {
      throw new BillingError('No active paid subscription to cancel', 400, 'no_active_subscription')
    }

    await cancelRazorpaySubscription(subscription.provider_subscription_id)
    await cancelSubscriptionAtPeriodEnd(session.userId, subscription.provider_subscription_id)

    return NextResponse.json({
      mode: 'app',
      canceled: true,
      snapshot: await getBillingSnapshot(session.userId),
    })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    if (e instanceof BillingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
    }
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
