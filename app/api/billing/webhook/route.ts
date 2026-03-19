import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanPrice } from '@/lib/billing'
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
    }

    let userId = mergedNotes.userId as string | undefined
    if (!userId && subscription?.id) {
      const existingSubscription = await getSubscriptionByProviderSubscriptionId(subscription.id, admin)
      userId = existingSubscription?.user_id
    }

    if (eventType === 'payment.captured' && mergedNotes.type === 'topup' && userId && mergedNotes.topupSlug) {
      await finalizeTopupPurchase({
        userId,
        topupSlug: mergedNotes.topupSlug,
        providerPaymentId: payment.id,
        providerOrderId: payment.order_id ?? null,
        amountInr: Math.round((payment.amount ?? 0) / 100),
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
      await finalizeSubscriptionPurchase({
        userId,
        planSlug: mergedNotes.planSlug,
        billingPeriod: mergedNotes.billingPeriod,
        providerSubscriptionId: subscription.id,
        providerPlanId: subscription.plan_id ?? null,
        providerPaymentId: payment.id,
        providerOrderId: payment.order_id ?? null,
        amountInr: Math.round((payment.amount ?? getPlanPrice(mergedNotes.planSlug, mergedNotes.billingPeriod) * 100) / 100),
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
