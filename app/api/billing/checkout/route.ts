import { requireAuth, isAuthError } from '@/lib/auth'
import {
  type BillingPeriod,
  type PlanSlug,
  type TopupSlug,
  BILLING_PLANS,
  TOPUP_PRODUCTS,
  getBillingPublicKey,
  getPlanPrice,
  getRazorpayPlanId,
} from '@/lib/billing'
import {
  BillingError,
  createPendingSubscriptionRecord,
  ensureBillingCustomer,
  finalizeSubscriptionPurchase,
  finalizeTopupPurchase,
  getBillingSnapshot,
} from '@/lib/billing-queries'
import {
  createRazorpayOrder,
  createRazorpaySubscription,
  verifyRazorpayPaymentSignature,
} from '@/lib/razorpay'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const CreatePlanSchema = z.object({
  mode: z.literal('create'),
  kind: z.literal('plan'),
  planSlug: z.enum(['builder', 'pro', 'studio']),
  billingPeriod: z.enum(['monthly', 'yearly']),
})

const CreateTopupSchema = z.object({
  mode: z.literal('create'),
  kind: z.literal('topup'),
  topupSlug: z.enum(['topup-50', 'topup-175']),
})

const ConfirmPlanSchema = z.object({
  mode: z.literal('confirm'),
  kind: z.literal('plan'),
  planSlug: z.enum(['builder', 'pro', 'studio']),
  billingPeriod: z.enum(['monthly', 'yearly']),
  razorpayPaymentId: z.string().min(1),
  razorpaySubscriptionId: z.string().min(1),
  razorpaySignature: z.string().min(1),
})

const ConfirmTopupSchema = z.object({
  mode: z.literal('confirm'),
  kind: z.literal('topup'),
  topupSlug: z.enum(['topup-50', 'topup-175']),
  razorpayPaymentId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpaySignature: z.string().min(1),
})

const BodySchema = z.union([
  CreatePlanSchema,
  CreateTopupSchema,
  ConfirmPlanSchema,
  ConfirmTopupSchema,
])

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid billing request', details: parsed.error.flatten() }, { status: 400 })
    }

    const payload = parsed.data
    const publicKey = getBillingPublicKey()
    if (!publicKey) {
      return NextResponse.json({ error: 'Razorpay public key is not configured' }, { status: 500 })
    }

    if (payload.mode === 'create' && payload.kind === 'plan') {
      const snapshot = await getBillingSnapshot(session.userId)
      if (snapshot.hasUnlimitedAccess) {
        return NextResponse.json({ error: 'Unlimited owner access is already enabled for this account' }, { status: 403 })
      }

      const planId = getRazorpayPlanId(payload.planSlug, payload.billingPeriod)
      if (!planId) {
        return NextResponse.json(
          { error: `Razorpay plan id missing for ${payload.planSlug} ${payload.billingPeriod}` },
          { status: 500 }
        )
      }

      await ensureBillingCustomer(session.userId)

      const subscription = await createRazorpaySubscription({
        planId,
        notes: {
          type: 'subscription',
          userId: session.userId,
          planSlug: payload.planSlug,
          billingPeriod: payload.billingPeriod,
        },
      })

      await createPendingSubscriptionRecord({
        userId: session.userId,
        planSlug: payload.planSlug,
        billingPeriod: payload.billingPeriod,
        providerSubscriptionId: subscription.id,
        providerPlanId: subscription.plan_id,
      })

      return NextResponse.json({
        checkoutKind: 'plan',
        keyId: publicKey,
        subscriptionId: subscription.id,
        amountInr: getPlanPrice(payload.planSlug, payload.billingPeriod),
        plan: BILLING_PLANS[payload.planSlug],
        billingPeriod: payload.billingPeriod,
        prefill: {
          name: session.name,
          email: session.email,
        },
      })
    }

    if (payload.mode === 'create' && payload.kind === 'topup') {
      const snapshot = await getBillingSnapshot(session.userId)
      if (snapshot.hasUnlimitedAccess) {
        return NextResponse.json({ error: 'Unlimited owner access does not require top-ups' }, { status: 403 })
      }
      if (snapshot.planSlug === 'free') {
        return NextResponse.json({ error: 'Top-ups require an active paid plan' }, { status: 403 })
      }

      const topup = TOPUP_PRODUCTS[payload.topupSlug]
      const order = await createRazorpayOrder({
        amountInr: topup.amountInr,
        receipt: `topup_${session.userId}_${Date.now()}`,
        notes: {
          type: 'topup',
          userId: session.userId,
          topupSlug: payload.topupSlug,
        },
      })

      return NextResponse.json({
        checkoutKind: 'topup',
        keyId: publicKey,
        orderId: order.id,
        amountInr: topup.amountInr,
        topup,
        prefill: {
          name: session.name,
          email: session.email,
        },
      })
    }

    if (payload.mode === 'confirm' && payload.kind === 'plan') {
      const isValid = verifyRazorpayPaymentSignature({
        paymentId: payload.razorpayPaymentId,
        subscriptionId: payload.razorpaySubscriptionId,
        signature: payload.razorpaySignature,
      })
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid Razorpay signature' }, { status: 400 })
      }

      const result = await finalizeSubscriptionPurchase({
        userId: session.userId,
        planSlug: payload.planSlug,
        billingPeriod: payload.billingPeriod,
        providerSubscriptionId: payload.razorpaySubscriptionId,
        providerPlanId: getRazorpayPlanId(payload.planSlug, payload.billingPeriod),
        providerPaymentId: payload.razorpayPaymentId,
        providerSignature: payload.razorpaySignature,
        amountInr: getPlanPrice(payload.planSlug, payload.billingPeriod),
        rawPayload: payload,
      })

      return NextResponse.json(result)
    }

    const isValid = verifyRazorpayPaymentSignature({
      orderId: payload.razorpayOrderId,
      paymentId: payload.razorpayPaymentId,
      signature: payload.razorpaySignature,
    })
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Razorpay signature' }, { status: 400 })
    }

    const topup = TOPUP_PRODUCTS[payload.topupSlug]
    const result = await finalizeTopupPurchase({
      userId: session.userId,
      topupSlug: payload.topupSlug,
      providerPaymentId: payload.razorpayPaymentId,
      providerOrderId: payload.razorpayOrderId,
      providerSignature: payload.razorpaySignature,
      amountInr: topup.amountInr,
      rawPayload: payload,
    })

    return NextResponse.json(result)
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    if (e instanceof BillingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
    }
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
