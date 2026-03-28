import type { SupabaseClient } from '@supabase/supabase-js'
import { createDb } from '@/lib/db'
import {
  ALL_BILLING_MODULES,
  type BillingModuleId,
  type BillingPeriod,
  type PlanSlug,
  PLAN_SEQUENCE,
  type TopupSlug,
  BILLING_PLANS,
  TOPUP_PRODUCTS,
  formatPlanLabel,
  getModuleCost,
  getPlanConfig,
  hasUnlimitedBillingOverride,
  UNLIMITED_BILLING_CREDIT_BALANCE,
  UNLIMITED_BILLING_VENTURE_LIMIT,
} from '@/lib/billing'

type DbClient = SupabaseClient<any, any, any>

export type SubscriptionStatus = 'pending' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'

export interface BillingSubscription {
  id: string
  user_id: string
  plan_slug: PlanSlug
  billing_period: BillingPeriod
  status: SubscriptionStatus
  provider: string
  provider_subscription_id: string | null
  provider_plan_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  last_payment_at: string | null
  credits_per_cycle: number
  created_at: string
  updated_at: string
}

export interface BillingPayment {
  id: string
  user_id: string
  subscription_id: string | null
  provider: string
  kind: 'subscription' | 'topup'
  plan_slug: PlanSlug | null
  topup_slug: TopupSlug | null
  provider_order_id: string | null
  provider_payment_id: string | null
  provider_signature: string | null
  amount_inr: number
  currency: string
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded'
  raw_payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BillingSnapshot {
  planSlug: PlanSlug
  planLabel: string
  billingPeriod: BillingPeriod | null
  subscriptionStatus: SubscriptionStatus | 'free'
  creditsRemaining: number
  allowedModules: BillingModuleId[]
  ventureLimit: number
  monthlyCredits: number
  activeVentureCount: number
  canCreateVenture: boolean
  nextRenewalAt: string | null
  currentSubscriptionId: string | null
  cancelAtPeriodEnd: boolean
  hasUnlimitedAccess: boolean
}

export class BillingError extends Error {
  status: number
  code: string

  constructor(message: string, status = 400, code = 'billing_error') {
    super(message)
    this.name = 'BillingError'
    this.status = status
    this.code = code
  }
}

async function resolveDb(db?: DbClient): Promise<DbClient> {
  return db ?? (await createDb())
}

async function getUserEmail(userId: string, db: DbClient): Promise<string | null> {
  const { data, error } = await db
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.warn(`[billing] Failed to resolve email for ${userId}: ${error.message}`)
    return null
  }

  return typeof data?.email === 'string' ? data.email : null
}

function addBillingPeriod(dateIso: string, period: BillingPeriod): string {
  const date = new Date(dateIso)
  if (period === 'yearly') {
    date.setFullYear(date.getFullYear() + 1)
  } else {
    date.setMonth(date.getMonth() + 1)
  }
  return date.toISOString()
}

function parseSubscriptionStatus(raw: string | null | undefined): SubscriptionStatus {
  switch (raw) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'canceled':
    case 'expired':
    case 'pending':
      return raw
    default:
      return 'pending'
  }
}

function isSubscriptionEntitled(subscription: BillingSubscription, now = new Date()): boolean {
  const status = parseSubscriptionStatus(subscription.status)
  if (status === 'active' || status === 'trialing' || status === 'past_due') {
    return true
  }

  if (status !== 'canceled' || !subscription.current_period_end) {
    return false
  }

  return new Date(subscription.current_period_end) > now
}

export async function syncUserPlan(userId: string, planSlug: PlanSlug, db?: DbClient): Promise<void> {
  const client = await resolveDb(db)
  const { error } = await client.from('users').update({ plan: planSlug }).eq('id', userId)
  if (error) throw new Error(`syncUserPlan failed: ${error.message}`)
}

export async function getActiveVentureCount(userId: string, db?: DbClient): Promise<number> {
  const client = await resolveDb(db)
  const { count, error } = await client
    .from('ventures')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) throw new Error(`getActiveVentureCount failed: ${error.message}`)
  return count ?? 0
}

export async function getCurrentSubscription(userId: string, db?: DbClient): Promise<BillingSubscription | null> {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('current_period_end', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getCurrentSubscription failed: ${error.message}`)

  const now = new Date()
  const subscriptions = (data ?? []) as BillingSubscription[]
  for (const subscription of subscriptions) {
    if (isSubscriptionEntitled(subscription, now)) {
      return { ...subscription, status: parseSubscriptionStatus(subscription.status) }
    }
  }

  return null
}

export async function getCreditBalance(userId: string, db?: DbClient): Promise<number> {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('credit_ledger')
    .select('credits')
    .eq('user_id', userId)

  if (error) throw new Error(`getCreditBalance failed: ${error.message}`)
  return (data ?? []).reduce((sum, entry: { credits?: number | null }) => sum + (entry.credits ?? 0), 0)
}

export async function getRecentPayments(userId: string, limit = 12, db?: DbClient): Promise<BillingPayment[]> {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getRecentPayments failed: ${error.message}`)
  return (data ?? []) as BillingPayment[]
}

export async function getBillingSnapshot(userId: string, db?: DbClient): Promise<BillingSnapshot> {
  const client = await resolveDb(db)
  const [subscription, creditsRemaining, activeVentureCount, email] = await Promise.all([
    getCurrentSubscription(userId, client),
    getCreditBalance(userId, client),
    getActiveVentureCount(userId, client),
    getUserEmail(userId, client),
  ])

  const planSlug = subscription?.plan_slug ?? 'free'
  const plan = getPlanConfig(planSlug)
  const hasUnlimitedAccess = hasUnlimitedBillingOverride(email)

  // Auto-grant free tier credits to new free users who have zero balance
  let finalCredits = creditsRemaining
  if (planSlug === 'free' && !hasUnlimitedAccess && creditsRemaining === 0) {
    await grantFreeCreditsIfNeeded(userId, client)
    // Re-fetch balance after potential grant
    finalCredits = await getCreditBalance(userId, client)
  }

  return {
    planSlug,
    planLabel: hasUnlimitedAccess ? 'Unlimited' : formatPlanLabel(planSlug),
    billingPeriod: subscription?.billing_period ?? null,
    subscriptionStatus: subscription?.status ?? 'free',
    creditsRemaining: hasUnlimitedAccess ? UNLIMITED_BILLING_CREDIT_BALANCE : finalCredits,
    allowedModules: hasUnlimitedAccess ? ALL_BILLING_MODULES : plan.allowedModules,
    ventureLimit: hasUnlimitedAccess ? UNLIMITED_BILLING_VENTURE_LIMIT : plan.ventureLimit,
    monthlyCredits: hasUnlimitedAccess ? UNLIMITED_BILLING_CREDIT_BALANCE : plan.monthlyCredits,
    activeVentureCount,
    canCreateVenture: hasUnlimitedAccess ? true : activeVentureCount < plan.ventureLimit,
    nextRenewalAt: subscription?.current_period_end ?? null,
    currentSubscriptionId: subscription?.id ?? null,
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
    hasUnlimitedAccess,
  }
}

export async function ensureBillingCustomer(userId: string, providerCustomerId?: string | null, db?: DbClient) {
  const client = await resolveDb(db)
  const payload = {
    user_id: userId,
    provider: 'razorpay',
    provider_customer_id: providerCustomerId ?? null,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await client
    .from('billing_customers')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) throw new Error(`ensureBillingCustomer failed: ${error.message}`)
  return data
}

export async function createPendingSubscriptionRecord(input: {
  userId: string
  planSlug: Exclude<PlanSlug, 'free'>
  billingPeriod: BillingPeriod
  providerSubscriptionId: string
  providerPlanId: string
}, db?: DbClient) {
  const client = await resolveDb(db)
  const plan = getPlanConfig(input.planSlug)
  const payload = {
    user_id: input.userId,
    plan_slug: input.planSlug,
    billing_period: input.billingPeriod,
    status: 'pending',
    provider: 'razorpay',
    provider_subscription_id: input.providerSubscriptionId,
    provider_plan_id: input.providerPlanId,
    credits_per_cycle: plan.monthlyCredits,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await client
    .from('subscriptions')
    .upsert(payload, { onConflict: 'provider_subscription_id' })
    .select()
    .single()

  if (error) throw new Error(`createPendingSubscriptionRecord failed: ${error.message}`)
  return data as BillingSubscription
}

async function expireOtherSubscriptions(userId: string, keepSubscriptionId: string, db: DbClient) {
  const { error } = await db
    .from('subscriptions')
    .update({ status: 'expired', cancel_at_period_end: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .neq('id', keepSubscriptionId)
    .in('status', ['pending', 'trialing', 'active', 'past_due'])

  if (error) throw new Error(`expireOtherSubscriptions failed: ${error.message}`)
}

export async function finalizeSubscriptionPurchase(input: {
  userId: string
  planSlug: Exclude<PlanSlug, 'free'>
  billingPeriod: BillingPeriod
  providerSubscriptionId: string
  providerPlanId?: string | null
  providerPaymentId: string
  providerSignature?: string | null
  providerOrderId?: string | null
  amountInr: number
  rawPayload: Record<string, unknown>
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
}, db?: DbClient) {
  const client = await resolveDb(db)
  const existingPayment = await getPaymentByProviderPaymentId(input.providerPaymentId, client)
  if (existingPayment) {
    return {
      duplicate: true,
      payment: existingPayment,
      snapshot: await getBillingSnapshot(input.userId, client),
    }
  }

  const nowIso = new Date().toISOString()
  const plan = getPlanConfig(input.planSlug)
  const currentPeriodStart = input.currentPeriodStart ?? nowIso
  const currentPeriodEnd = input.currentPeriodEnd ?? addBillingPeriod(currentPeriodStart, input.billingPeriod)

  const existingSubscription = await getSubscriptionByProviderSubscriptionId(input.providerSubscriptionId, client)
  const subscriptionPayload = {
    user_id: input.userId,
    plan_slug: input.planSlug,
    billing_period: input.billingPeriod,
    status: 'active',
    provider: 'razorpay',
    provider_subscription_id: input.providerSubscriptionId,
    provider_plan_id: input.providerPlanId ?? null,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: false,
    canceled_at: null,
    last_payment_at: nowIso,
    credits_per_cycle: plan.monthlyCredits,
    updated_at: nowIso,
  }

  const { data: subscriptionData, error: subscriptionError } = await client
    .from('subscriptions')
    .upsert(subscriptionPayload, { onConflict: 'provider_subscription_id' })
    .select()
    .single()

  if (subscriptionError) throw new Error(`finalizeSubscriptionPurchase subscription failed: ${subscriptionError.message}`)
  const subscription = subscriptionData as BillingSubscription

  await expireOtherSubscriptions(input.userId, subscription.id, client)

  const { data: paymentData, error: paymentError } = await client
    .from('payments')
    .insert({
      user_id: input.userId,
      subscription_id: subscription.id,
      provider: 'razorpay',
      kind: 'subscription',
      plan_slug: input.planSlug,
      provider_order_id: input.providerOrderId ?? null,
      provider_payment_id: input.providerPaymentId,
      provider_signature: input.providerSignature ?? null,
      amount_inr: input.amountInr,
      currency: 'INR',
      status: 'captured',
      raw_payload: input.rawPayload,
    })
    .select()
    .single()

  if (paymentError) throw new Error(`finalizeSubscriptionPurchase payment failed: ${paymentError.message}`)
  const payment = paymentData as BillingPayment

  await grantCreditsIfNeeded({
    userId: input.userId,
    subscriptionId: subscription.id,
    paymentId: payment.id,
    credits: plan.monthlyCredits,
    kind: 'monthly_grant',
    metadata: {
      planSlug: input.planSlug,
      billingPeriod: input.billingPeriod,
      providerSubscriptionId: input.providerSubscriptionId,
    },
  }, client)

  await syncUserPlan(input.userId, input.planSlug, client)

  return {
    duplicate: false,
    payment,
    subscription,
    snapshot: await getBillingSnapshot(input.userId, client),
  }
}

export async function finalizeTopupPurchase(input: {
  userId: string
  topupSlug: TopupSlug
  providerPaymentId: string
  providerOrderId?: string | null
  providerSignature?: string | null
  amountInr: number
  rawPayload: Record<string, unknown>
}, db?: DbClient) {
  const client = await resolveDb(db)
  const existingPayment = await getPaymentByProviderPaymentId(input.providerPaymentId, client)
  if (existingPayment) {
    return {
      duplicate: true,
      payment: existingPayment,
      snapshot: await getBillingSnapshot(input.userId, client),
    }
  }

  const topup = TOPUP_PRODUCTS[input.topupSlug]
  const currentSubscription = await getCurrentSubscription(input.userId, client)

  const { data: paymentData, error: paymentError } = await client
    .from('payments')
    .insert({
      user_id: input.userId,
      subscription_id: currentSubscription?.id ?? null,
      provider: 'razorpay',
      kind: 'topup',
      topup_slug: input.topupSlug,
      provider_order_id: input.providerOrderId ?? null,
      provider_payment_id: input.providerPaymentId,
      provider_signature: input.providerSignature ?? null,
      amount_inr: input.amountInr,
      currency: 'INR',
      status: 'captured',
      raw_payload: input.rawPayload,
    })
    .select()
    .single()

  if (paymentError) throw new Error(`finalizeTopupPurchase payment failed: ${paymentError.message}`)
  const payment = paymentData as BillingPayment

  await grantCreditsIfNeeded({
    userId: input.userId,
    subscriptionId: currentSubscription?.id ?? null,
    paymentId: payment.id,
    credits: topup.credits,
    kind: 'topup',
    metadata: {
      topupSlug: input.topupSlug,
    },
  }, client)

  return {
    duplicate: false,
    payment,
    snapshot: await getBillingSnapshot(input.userId, client),
  }
}

async function grantCreditsIfNeeded(input: {
  userId: string
  subscriptionId: string | null
  paymentId: string
  credits: number
  kind: 'monthly_grant' | 'topup'
  metadata: Record<string, unknown>
}, db: DbClient) {
  const { data: existing } = await db
    .from('credit_ledger')
    .select('id')
    .eq('payment_id', input.paymentId)
    .eq('kind', input.kind)
    .maybeSingle()

  if (existing) return

  const { error } = await db.from('credit_ledger').insert({
    user_id: input.userId,
    subscription_id: input.subscriptionId,
    payment_id: input.paymentId,
    kind: input.kind,
    credits: input.credits,
    metadata: input.metadata,
  })

  if (error) throw new Error(`grantCreditsIfNeeded failed: ${error.message}`)
}

// Auto-grant free tier credits to users who have never received any credits.
// Free users don't go through a purchase flow, so they never trigger grantCreditsIfNeeded.
// This runs lazily inside getBillingSnapshot() on first access.
async function grantFreeCreditsIfNeeded(userId: string, db: DbClient): Promise<void> {
  // Check if this user has ANY credit_ledger entries at all
  const { count, error: countError } = await db
    .from('credit_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (countError || (count ?? 0) > 0) return // Already has ledger entries, skip

  const freeCredits = BILLING_PLANS.free.monthlyCredits
  if (freeCredits <= 0) return

  // Use 'manual_adjustment' kind (allowed by DB CHECK constraint) with metadata
  // to identify this as a free tier grant
  const { error } = await db.from('credit_ledger').insert({
    user_id: userId,
    kind: 'manual_adjustment',
    credits: freeCredits,
    metadata: { reason: 'free_tier_initial_grant', planSlug: 'free' },
  })

  if (error) {
    console.warn(`[billing] Free credit grant failed for ${userId}: ${error.message}`)
  }
}

export async function assertCanRunModule(userId: string, moduleId: BillingModuleId, db?: DbClient) {
  const snapshot = await getBillingSnapshot(userId, db)
  if (!snapshot.allowedModules.includes(moduleId)) {
    throw new BillingError(`${BILLING_PLANS[snapshot.planSlug].label} plan does not include ${moduleId}`, 403, 'module_locked')
  }

  const requiredCredits = getModuleCost(moduleId)
  if (!snapshot.hasUnlimitedAccess && snapshot.creditsRemaining < requiredCredits) {
    throw new BillingError(`You need ${requiredCredits} credits to run this module`, 402, 'insufficient_credits')
  }

  return { snapshot, requiredCredits }
}

export async function assertCanAccessMarketingAutomation(userId: string, db?: DbClient): Promise<BillingSnapshot> {
  const snapshot = await getBillingSnapshot(userId, db)
  if (snapshot.hasUnlimitedAccess) return snapshot

  const currentPlanIndex = PLAN_SEQUENCE.indexOf(snapshot.planSlug)
  const minimumPlanIndex = PLAN_SEQUENCE.indexOf('builder')

  if (currentPlanIndex === -1 || currentPlanIndex < minimumPlanIndex) {
    throw new BillingError('Connected channels are available on Builder and higher plans', 403, 'marketing_automation_locked')
  }

  return snapshot
}

// ── HTTP-level rate limiter ────────────────────────────────────────────────
// Counts usage_charges in the last hour (server-side, DB-backed — works on
// Vercel Edge/serverless where in-memory state doesn't persist).
// Unlimited users are exempt. Continuation runs are exempt (no charge recorded).
export async function assertHourlyRateLimit(userId: string, snapshot: BillingSnapshot, db?: DbClient): Promise<void> {
  if (snapshot.hasUnlimitedAccess) return

  const client = db ?? await createDb()
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const limit = Math.max(1, Number(process.env.RATE_LIMIT_RUNS_PER_HOUR ?? 10))

  const { count, error } = await client
    .from('usage_charges')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart)

  if (error) return // fail open — don't block users if DB check fails

  if ((count ?? 0) >= limit) {
    throw new BillingError(
      `Rate limit reached: maximum ${limit} module runs per hour. Try again shortly.`,
      429,
      'rate_limit_exceeded'
    )
  }
}

export async function assertCanCreateVenture(userId: string, db?: DbClient) {
  const snapshot = await getBillingSnapshot(userId, db)
  if (snapshot.hasUnlimitedAccess) {
    return snapshot
  }
  if (!snapshot.canCreateVenture) {
    throw new BillingError(
      `${snapshot.planLabel} plan allows ${snapshot.ventureLimit} active venture${snapshot.ventureLimit === 1 ? '' : 's'}`,
      403,
      'venture_limit_reached'
    )
  }
  return snapshot
}

export async function recordUsageCharge(input: {
  userId: string
  conversationId: string
  moduleId: BillingModuleId
  snapshot: BillingSnapshot
}, db?: DbClient) {
  if (input.snapshot.hasUnlimitedAccess) {
    return
  }

  const client = await resolveDb(db)
  const requiredCredits = getModuleCost(input.moduleId)
  const existingUsage = await client
    .from('usage_ledger')
    .select('id')
    .eq('conversation_id', input.conversationId)
    .maybeSingle()

  if (existingUsage.data) return

  const { error: usageError } = await client.from('usage_ledger').insert({
    user_id: input.userId,
    subscription_id: input.snapshot.currentSubscriptionId,
    conversation_id: input.conversationId,
    module_id: input.moduleId,
    credits: requiredCredits,
    plan_slug: input.snapshot.planSlug,
  })

  if (usageError) throw new Error(`recordUsageCharge usage_ledger failed: ${usageError.message}`)

  const { error: ledgerError } = await client.from('credit_ledger').insert({
    user_id: input.userId,
    subscription_id: input.snapshot.currentSubscriptionId,
    conversation_id: input.conversationId,
    kind: 'usage',
    credits: -requiredCredits,
    metadata: {
      moduleId: input.moduleId,
      planSlug: input.snapshot.planSlug,
    },
  })

  if (ledgerError) throw new Error(`recordUsageCharge credit_ledger failed: ${ledgerError.message}`)
}

export async function getPaymentByProviderPaymentId(providerPaymentId: string, db?: DbClient): Promise<BillingPayment | null> {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('payments')
    .select('*')
    .eq('provider_payment_id', providerPaymentId)
    .maybeSingle()

  if (error) throw new Error(`getPaymentByProviderPaymentId failed: ${error.message}`)
  return (data as BillingPayment | null) ?? null
}

export async function getSubscriptionByProviderSubscriptionId(providerSubscriptionId: string, db?: DbClient): Promise<BillingSubscription | null> {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('subscriptions')
    .select('*')
    .eq('provider_subscription_id', providerSubscriptionId)
    .maybeSingle()

  if (error) throw new Error(`getSubscriptionByProviderSubscriptionId failed: ${error.message}`)
  return (data as BillingSubscription | null) ?? null
}

export async function hasProcessedWebhookEvent(eventId: string, db?: DbClient): Promise<boolean> {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle()

  if (error) throw new Error(`hasProcessedWebhookEvent failed: ${error.message}`)
  return !!data
}

export async function recordWebhookEvent(input: {
  eventId: string
  eventType: string
  payload: Record<string, unknown>
}, db?: DbClient) {
  const client = await resolveDb(db)
  const { error } = await client.from('webhook_events').insert({
    provider: 'razorpay',
    event_id: input.eventId,
    event_type: input.eventType,
    payload: input.payload,
  })

  if (error) throw new Error(`recordWebhookEvent failed: ${error.message}`)
}

export async function cancelSubscriptionAtPeriodEnd(
  userId: string,
  providerSubscriptionId: string,
  db?: DbClient
) {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('subscriptions')
    .update({
      status: 'canceled',
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider_subscription_id', providerSubscriptionId)
    .select()
    .single()

  if (error) throw new Error(`cancelSubscriptionAtPeriodEnd failed: ${error.message}`)
  return data as BillingSubscription
}
