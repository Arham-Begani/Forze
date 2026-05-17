import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAuthError } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { BILLING_PLANS, type BillingPeriod, type PlanSlug, PLAN_SEQUENCE } from '@/lib/billing'

const VALID_PERIODS: BillingPeriod[] = ['monthly', 'yearly']

function isPlanSlug(value: unknown): value is PlanSlug {
  return typeof value === 'string' && (PLAN_SEQUENCE as string[]).includes(value)
}

// ─── GET /api/admin/users/grant-plan?email=foo@bar.com ──────────────────────
// Looks up a user by email and returns their current active manual grants.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const email = (req.nextUrl.searchParams.get('email') ?? '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

    const db = createAdminClient()
    const { data: user, error: userError } = await db
      .from('users')
      .select('id, email, name, plan, created_at')
      .ilike('email', email)
      .maybeSingle()

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }
    if (!user) {
      return NextResponse.json({ user: null, grants: [] })
    }

    const { data: subs, error: subsError } = await db
      .from('subscriptions')
      .select('id, plan_slug, billing_period, status, provider, current_period_start, current_period_end, credits_per_cycle, created_at, canceled_at')
      .eq('user_id', user.id)
      .eq('provider', 'manual')
      .order('created_at', { ascending: false })

    if (subsError) {
      return NextResponse.json({ error: subsError.message }, { status: 500 })
    }

    return NextResponse.json({ user, grants: subs ?? [] })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── POST /api/admin/users/grant-plan ──────────────────────────────────────
// Body: { email, planSlug, billingPeriod, durationMonths }
// Creates a manual subscription + grants credits via credit_ledger.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin()
    const body = (await req.json().catch(() => ({}))) as {
      email?: unknown
      planSlug?: unknown
      billingPeriod?: unknown
      durationMonths?: unknown
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

    if (!isPlanSlug(body.planSlug)) {
      return NextResponse.json({ error: 'planSlug must be one of free/starter/builder/pro/studio' }, { status: 400 })
    }
    const planSlug = body.planSlug
    if (planSlug === 'free') {
      return NextResponse.json({ error: 'Cannot grant the free plan via this endpoint' }, { status: 400 })
    }

    const billingPeriod: BillingPeriod = VALID_PERIODS.includes(body.billingPeriod as BillingPeriod)
      ? (body.billingPeriod as BillingPeriod)
      : 'monthly'

    const months = Number(body.durationMonths)
    const durationMonths = Number.isFinite(months) && months > 0 && months <= 120 ? Math.floor(months) : 12

    const db = createAdminClient()

    const { data: user, error: userError } = await db
      .from('users')
      .select('id, email')
      .ilike('email', email)
      .maybeSingle()

    if (userError) return NextResponse.json({ error: userError.message }, { status: 500 })
    if (!user) return NextResponse.json({ error: 'User not found. They must sign up first.' }, { status: 404 })

    const plan = BILLING_PLANS[planSlug]
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + durationMonths)

    // Cancel any prior manual grant so the user only has one active comp at a time.
    const { error: cancelError } = await db
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('user_id', user.id)
      .eq('provider', 'manual')
      .eq('status', 'active')
    if (cancelError) {
      console.error('[admin/grant-plan] failed to cancel prior manual grants:', cancelError.message)
    }

    const { data: subData, error: subError } = await db
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_slug: planSlug,
        billing_period: billingPeriod,
        status: 'active',
        provider: 'manual',
        provider_subscription_id: `manual:${user.id}:${Date.now()}`,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        credits_per_cycle: plan.monthlyCredits,
        last_payment_at: now.toISOString(),
      })
      .select('id')
      .single()

    if (subError || !subData) {
      return NextResponse.json({ error: subError?.message ?? 'Failed to create subscription' }, { status: 500 })
    }

    const { error: ledgerError } = await db
      .from('credit_ledger')
      .insert({
        user_id: user.id,
        subscription_id: subData.id,
        payment_id: null,
        kind: 'manual_adjustment',
        credits: plan.monthlyCredits,
        metadata: {
          source: 'admin_grant',
          planSlug,
          billingPeriod,
          durationMonths,
          grantedBy: session.email,
        },
      })

    if (ledgerError) {
      // Roll back the subscription so we don't leave a half-applied grant.
      await db.from('subscriptions').delete().eq('id', subData.id)
      return NextResponse.json({ error: `credit grant failed: ${ledgerError.message}` }, { status: 500 })
    }

    await db.from('users').update({ plan: planSlug, updated_at: now.toISOString() }).eq('id', user.id)

    return NextResponse.json({
      success: true,
      userId: user.id,
      email: user.email,
      planSlug,
      billingPeriod,
      durationMonths,
      creditsGranted: plan.monthlyCredits,
      currentPeriodEnd: periodEnd.toISOString(),
    })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── DELETE /api/admin/users/grant-plan?subscriptionId=... ─────────────────
// Cancels a manual grant. If the user has no other active subscription,
// resets their users.plan to 'free'.
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()
    const subscriptionId = req.nextUrl.searchParams.get('subscriptionId') ?? ''
    if (!subscriptionId) return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 })

    const db = createAdminClient()
    const { data: sub, error: lookupError } = await db
      .from('subscriptions')
      .select('id, user_id, provider')
      .eq('id', subscriptionId)
      .maybeSingle()
    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
    if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    if (sub.provider !== 'manual') {
      return NextResponse.json({ error: 'Only manual grants can be revoked here' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { error: cancelError } = await db
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: now, current_period_end: now, updated_at: now })
      .eq('id', sub.id)
    if (cancelError) return NextResponse.json({ error: cancelError.message }, { status: 500 })

    // If no other active subs remain, demote the user back to free.
    const { data: stillActive } = await db
      .from('subscriptions')
      .select('id')
      .eq('user_id', sub.user_id)
      .eq('status', 'active')
      .limit(1)

    if (!stillActive || stillActive.length === 0) {
      await db.from('users').update({ plan: 'free', updated_at: now }).eq('id', sub.user_id)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
