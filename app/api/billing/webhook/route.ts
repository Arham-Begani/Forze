import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanPrice, TOPUP_PRODUCTS, type TopupSlug, type PlanSlug, type BillingPeriod } from '@/lib/billing'
import {
  cancelSubscriptionAtPeriodEnd,
  finalizeSubscriptionPurchase,
  finalizeTopupPurchase,
  getSubscriptionByProviderSubscriptionId,
  hasProcessedWebhookEvent,
  recordWebhookEvent,
} from '@/lib/billing-queries'
import { hashWebhookPayload, verifyRazorpayWebhookSignature } from '@/lib/razorpay'

function toIsoFromUnix(value: unknown): string | null {
  if (typeof value !== 'number') return null
  return new Date(value * 1000).toISOString()
}

function validatePaymentAmount(
  actualAmountPaise: number,
  expectedAmountInr: number
): boolean {
  // Allow 1-rupee deviation due to rounding
  const actualInr = Math.round(actualAmountPaise / 100)
  return Math.abs(actualInr - expectedAmountInr) <= 1
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 })
  }

  try {
    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
    }

    const event = JSON.parse(rawBody) as Record<string, any>
    const eventType = String(event.event ?? 'unknown')
    const eventId = request.headers.get('x-razorpay-event-id') ?? hashWebhookPayload(rawBody)
    const admin = createAdminClient()

    if (await hasProcessedWebhookEvent(eventId, admin)) {
      return NextResponse.json({ ok: true, duplicate: true })
    }

    await recordWebhookEvent({ eventId, eventType, payload: event }, admin)

    const payment = event.payload?.payment?.entity ?? null
    const subscription = event.payload?.subscription?.entity ?? null
    const mergedNotes = {
      ...(subscription?.notes ?? {}),
      ...(payment?.notes ?? {}),
    } as Record<string, unknown>

    let userId = mergedNotes.userId as string | undefined
    if (!userId && subscription?.id) {
      const existingSubscription = await getSubscriptionByProviderSubscriptionId(subscription.id, admin)
      userId = existingSubscription?.user_id
    }

    if (eventType === 'payment.captured' && mergedNotes.type === 'topup' && userId && mergedNotes.topupSlug) {
      const topupSlug = String(mergedNotes.topupSlug) as TopupSlug
      const topup = TOPUP_PRODUCTS[topupSlug]
      if (!topup || !validatePaymentAmount(payment.amount ?? 0, topup.amountInr)) {
        console.warn(`[Webhook] Topup amount mismatch or invalid topup: ${payment?.id} - expected ${topup?.amountInr}INR, got ${payment?.amount}paise`)
        return NextResponse.json({ error: 'Payment amount validation failed' }, { status: 400 })
      }
      await finalizeTopupPurchase({
        userId,
        topupSlug,
        providerPaymentId: payment.id,
        providerOrderId: payment.order_id ?? null,
        amountInr: topup.amountInr,
        rawPayload: event,
      }, admin)
    }

    if (
      (eventType === 'subscription.charged' || eventType === 'payment.captured') &&
      mergedNotes.type === 'subscription' &&
      userId &&
      mergedNotes.planSlug &&
      mergedNotes.billingPeriod &&
      subscription?.id &&
      payment?.id
    ) {
      const planSlug = String(mergedNotes.planSlug) as PlanSlug
      const billingPeriod = String(mergedNotes.billingPeriod) as BillingPeriod
      const expectedAmountInr = getPlanPrice(planSlug, billingPeriod)
      if (!validatePaymentAmount(payment.amount ?? 0, expectedAmountInr)) {
        console.warn(`[Webhook] Subscription amount mismatch: ${subscription.id} - expected ${expectedAmountInr}INR, got ${payment?.amount}paise`)
        return NextResponse.json({ error: 'Payment amount validation failed' }, { status: 400 })
      }
      await finalizeSubscriptionPurchase({
        userId,
        planSlug: planSlug as Exclude<typeof planSlug, 'free'>,
        billingPeriod,
        providerSubscriptionId: subscription.id,
        providerPlanId: subscription.plan_id ?? null,
        providerPaymentId: payment.id,
        providerOrderId: payment.order_id ?? null,
        amountInr: expectedAmountInr,
        rawPayload: event,
        currentPeriodStart: toIsoFromUnix(subscription.current_start),
        currentPeriodEnd: toIsoFromUnix(subscription.current_end),
      }, admin)
    }

    if (eventType === 'subscription.cancelled' && userId && subscription?.id) {
      await cancelSubscriptionAtPeriodEnd(userId, subscription.id, admin)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
