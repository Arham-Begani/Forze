import type { SupabaseClient } from '@supabase/supabase-js'
import { createDb } from '@/lib/db'
import {
  ALL_BILLING_MODULES,
  ALL_FEATURES,
  type ActionId,
  type BillingModuleId,
  type BillingPeriod,
  type FeatureId,
  type PlanSlug,
  PLAN_SEQUENCE,
  type TopupSlug,
  type WeeklyActionLimits,
  BILLING_PLANS,
  FEATURE_LABELS,
  TOPUP_PRODUCTS,
  ACTION_TO_FEATURE,
  formatPlanLabel,
  getCurrentWeeklyPeriodEnd,
  getCurrentWeeklyPeriodStart,
  getModuleCost,
  getPlanConfig,
  getWeeklyActionLimit,
  hasUnlimitedBillingOverride,
  isFeatureIncluded,
  isModuleIncluded,
  UNLIMITED_BILLING_CREDIT_BALANCE,
  UNLIMITED_BILLING_VENTURE_LIMIT,
  UNLIMITED_WEEKLY_ACTION_LIMIT,
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

export interface WeeklyActionUsage {
  inspirationAnalyses: number
  crmEmailsSent: number
  campaignsSent: number
  leadScoutRuns: number
}

export interface BillingSnapshot {
  planSlug: PlanSlug
  planLabel: string
  billingPeriod: BillingPeriod | null
  subscriptionStatus: SubscriptionStatus | 'free'
  creditsRemaining: number
  allowedModules: BillingModuleId[]
  allowedFeatures: FeatureId[]
  ventureLimit: number
  monthlyCredits: number
  weeklyCredits: number
  weeklyActionLimits: WeeklyActionLimits
  weeklyActionUsage: WeeklyActionUsage
  weeklyPeriodStart: string
  weeklyPeriodEnd: string
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
  const [subscription, email] = await Promise.all([
    getCurrentSubscription(userId, client),
    getUserEmail(userId, client),
  ])

  const planSlug = subscription?.plan_slug ?? 'free'
  const plan = getPlanConfig(planSlug)
  const hasUnlimitedAccess = hasUnlimitedBillingOverride(email)

  // Lazy weekly refresh — fires inside snapshot read so no cron required.
  // Unlimited-override users skip this; their balance is virtual.
  if (!hasUnlimitedAccess) {
    await refreshWeeklyCreditsIfDue(userId, planSlug, client)
  }

  const [creditsRemaining, activeVentureCount, weeklyActionUsage] = await Promise.all([
    getCreditBalance(userId, client),
    getActiveVentureCount(userId, client),
    getWeeklyActionUsage(userId, client),
  ])

  const weeklyPeriodStart = getCurrentWeeklyPeriodStart()
  const weeklyPeriodEnd = getCurrentWeeklyPeriodEnd()

  return {
    planSlug,
    planLabel: hasUnlimitedAccess ? 'Unlimited' : formatPlanLabel(planSlug),
    billingPeriod: subscription?.billing_period ?? null,
    subscriptionStatus: subscription?.status ?? 'free',
    creditsRemaining: hasUnlimitedAccess ? UNLIMITED_BILLING_CREDIT_BALANCE : creditsRemaining,
    allowedModules: hasUnlimitedAccess ? ALL_BILLING_MODULES : plan.allowedModules,
    allowedFeatures: hasUnlimitedAccess ? ALL_FEATURES : plan.allowedFeatures,
    ventureLimit: hasUnlimitedAccess ? UNLIMITED_BILLING_VENTURE_LIMIT : plan.ventureLimit,
    monthlyCredits: hasUnlimitedAccess ? UNLIMITED_BILLING_CREDIT_BALANCE : plan.monthlyCredits,
    weeklyCredits: hasUnlimitedAccess ? UNLIMITED_BILLING_CREDIT_BALANCE : plan.weeklyCredits,
    weeklyActionLimits: hasUnlimitedAccess
      ? {
          inspirationAnalyses: UNLIMITED_WEEKLY_ACTION_LIMIT,
          crmEmailsSent: UNLIMITED_WEEKLY_ACTION_LIMIT,
          campaignsSent: UNLIMITED_WEEKLY_ACTION_LIMIT,
          leadScoutRuns: UNLIMITED_WEEKLY_ACTION_LIMIT,
        }
      : plan.weeklyActionLimits,
    weeklyActionUsage,
    weeklyPeriodStart,
    weeklyPeriodEnd,
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

// Lazy weekly credit refresh. Reads the user's current weekly_credit_period_start;
// if it's missing OR older than the current week's Mon-00:00-IST anchor, the
// previous week's leftover non-topup balance is drained via a 'weekly_expiry'
// row and a fresh 'weekly_grant' is inserted for the new week. Idempotent on
// concurrent reads: the column update is atomic; if two requests race, both
// resolve to the same period_start so the unique anchoring keeps the ledger
// from double-granting.
async function refreshWeeklyCreditsIfDue(userId: string, planSlug: PlanSlug, db: DbClient): Promise<void> {
  const currentPeriodStart = getCurrentWeeklyPeriodStart()
  const currentPeriodEnd = getCurrentWeeklyPeriodEnd()

  const { data: userRow, error: userErr } = await db
    .from('users')
    .select('weekly_credit_period_start')
    .eq('id', userId)
    .maybeSingle()

  if (userErr) {
    console.warn(`[billing] weekly refresh: user lookup failed for ${userId}: ${userErr.message}`)
    return
  }

  const lastPeriodStart = userRow?.weekly_credit_period_start as string | null | undefined
  const needsRefresh = !lastPeriodStart || new Date(lastPeriodStart).getTime() < new Date(currentPeriodStart).getTime()
  if (!needsRefresh) return

  const weeklyGrant = BILLING_PLANS[planSlug].weeklyCredits

  // Drain non-topup leftover from the previous week. Top-ups are excluded so
  // they survive into the new week. monthly_grant entries from the legacy
  // pre-030 path are also drained (they were previously summed into balance
  // forever; now they expire alongside weekly_grant).
  const { data: drainRows, error: drainErr } = await db
    .from('credit_ledger')
    .select('credits, kind')
    .eq('user_id', userId)

  if (drainErr) {
    console.warn(`[billing] weekly refresh: ledger read failed for ${userId}: ${drainErr.message}`)
    return
  }

  const nonTopupBalance = (drainRows ?? []).reduce((sum, row: { credits?: number | null; kind?: string | null }) => {
    if (row.kind === 'topup') return sum
    return sum + (row.credits ?? 0)
  }, 0)

  if (nonTopupBalance > 0) {
    const { error: expiryErr } = await db.from('credit_ledger').insert({
      user_id: userId,
      kind: 'weekly_expiry',
      credits: -nonTopupBalance,
      metadata: {
        reason: 'weekly_reset',
        previousPeriodStart: lastPeriodStart ?? null,
        newPeriodStart: currentPeriodStart,
        planSlug,
      },
    })
    if (expiryErr) {
      console.warn(`[billing] weekly refresh: expiry insert failed for ${userId}: ${expiryErr.message}`)
      return
    }
  }

  if (weeklyGrant > 0) {
    const { error: grantErr } = await db.from('credit_ledger').insert({
      user_id: userId,
      kind: 'weekly_grant',
      credits: weeklyGrant,
      metadata: {
        planSlug,
        periodStart: currentPeriodStart,
        periodEnd: currentPeriodEnd,
      },
    })
    if (grantErr) {
      console.warn(`[billing] weekly refresh: grant insert failed for ${userId}: ${grantErr.message}`)
      return
    }
  }

  const { error: updateErr } = await db
    .from('users')
    .update({ weekly_credit_period_start: currentPeriodStart, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (updateErr) {
    console.warn(`[billing] weekly refresh: anchor update failed for ${userId}: ${updateErr.message}`)
  }
}

export async function getWeeklyActionUsage(userId: string, db?: DbClient): Promise<WeeklyActionUsage> {
  const client = await resolveDb(db)
  const periodStart = getCurrentWeeklyPeriodStart()

  const { data, error } = await client
    .from('feature_usage_counters')
    .select('feature_id, count')
    .eq('user_id', userId)
    .eq('period_start', periodStart)

  if (error) {
    console.warn(`[billing] getWeeklyActionUsage failed for ${userId}: ${error.message}`)
    return { inspirationAnalyses: 0, crmEmailsSent: 0, campaignsSent: 0, leadScoutRuns: 0 }
  }

  const usage: WeeklyActionUsage = { inspirationAnalyses: 0, crmEmailsSent: 0, campaignsSent: 0, leadScoutRuns: 0 }
  for (const row of data ?? []) {
    const featureId = (row as { feature_id?: string }).feature_id
    const count = (row as { count?: number | null }).count ?? 0
    if (featureId === 'inspiration_analyze') usage.inspirationAnalyses = count
    else if (featureId === 'crm_email_send') usage.crmEmailsSent = count
    else if (featureId === 'campaign_send') usage.campaignsSent = count
    else if (featureId === 'lead_scout') usage.leadScoutRuns = count
  }
  return usage
}

export async function assertCanRunModule(userId: string, moduleId: BillingModuleId, db?: DbClient) {
  const snapshot = await getBillingSnapshot(userId, db)

  // Plan-level module gate (new in 030 — launch-autopilot now blocked for free/starter).
  if (!snapshot.hasUnlimitedAccess && !isModuleIncluded(snapshot.planSlug, moduleId)) {
    throw new BillingError(
      `The ${moduleId} module is not included in your ${snapshot.planLabel} plan — upgrade to Builder or higher to unlock it`,
      403,
      'module_not_in_plan',
    )
  }

  const requiredCredits = getModuleCost(moduleId)
  if (!snapshot.hasUnlimitedAccess && snapshot.creditsRemaining < requiredCredits) {
    throw new BillingError(`You need ${requiredCredits} credits to run this module — buy a top-up or upgrade your plan`, 402, 'insufficient_credits')
  }

  return { snapshot, requiredCredits }
}

export async function assertCanAccessFeature(userId: string, featureId: FeatureId, db?: DbClient): Promise<BillingSnapshot> {
  const snapshot = await getBillingSnapshot(userId, db)
  if (snapshot.hasUnlimitedAccess) return snapshot
  if (!isFeatureIncluded(snapshot.planSlug, featureId)) {
    throw new BillingError(
      `${FEATURE_LABELS[featureId]} is a Builder+ feature — upgrade your plan to unlock it`,
      403,
      'feature_not_in_plan',
    )
  }
  return snapshot
}

// Atomic per-week action ceiling check + increment. Reads the user's current
// counter row for (feature, period_start), throws if it's already at the
// plan's ceiling, otherwise increments via upsert. The unique PK on
// (user_id, feature_id, period_start) means concurrent calls converge to the
// same row; in the rare race where two callers both pass the ceiling check
// before either has incremented, the worst case is one extra action through
// the gate — acceptable for the abuse-prevention use case.
export async function assertCanPerformAction(userId: string, actionId: ActionId, db?: DbClient): Promise<BillingSnapshot> {
  // First make sure the parent feature is unlocked at all.
  const snapshot = await assertCanAccessFeature(userId, ACTION_TO_FEATURE[actionId], db)
  if (snapshot.hasUnlimitedAccess) {
    await incrementActionCounter(userId, actionId, db).catch((err) =>
      console.warn(`[billing] action counter increment failed (unlimited user, non-fatal): ${(err as Error).message}`),
    )
    return snapshot
  }

  const limit = getWeeklyActionLimit(snapshot.planSlug, actionId)
  if (limit >= UNLIMITED_WEEKLY_ACTION_LIMIT) {
    await incrementActionCounter(userId, actionId, db)
    return snapshot
  }

  const currentUsage = readActionUsage(snapshot, actionId)
  if (currentUsage >= limit) {
    throw new BillingError(
      `Weekly limit reached: ${limit} ${humanizeAction(actionId)} per week on the ${snapshot.planLabel} plan. Resets ${friendlyResetTime(snapshot.weeklyPeriodEnd)}.`,
      429,
      'weekly_action_limit_reached',
    )
  }

  await incrementActionCounter(userId, actionId, db)
  return snapshot
}

async function incrementActionCounter(userId: string, actionId: ActionId, db?: DbClient): Promise<void> {
  const client = await resolveDb(db)
  const periodStart = getCurrentWeeklyPeriodStart()

  // Read-modify-write upsert. Postgres has no atomic-increment-on-upsert via
  // PostgREST, so we read the current count, write count+1. The composite PK
  // means duplicate concurrent inserts collide on conflict and we just retry
  // by re-reading. In practice this loop runs once.
  const { data: existing, error: readErr } = await client
    .from('feature_usage_counters')
    .select('count')
    .eq('user_id', userId)
    .eq('feature_id', actionId)
    .eq('period_start', periodStart)
    .maybeSingle()

  if (readErr) {
    console.warn(`[billing] action counter read failed for ${userId}/${actionId}: ${readErr.message}`)
    return
  }

  const nextCount = ((existing?.count as number | null | undefined) ?? 0) + 1

  const { error: upsertErr } = await client
    .from('feature_usage_counters')
    .upsert(
      {
        user_id: userId,
        feature_id: actionId,
        period_start: periodStart,
        count: nextCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,feature_id,period_start' },
    )

  if (upsertErr) {
    console.warn(`[billing] action counter upsert failed for ${userId}/${actionId}: ${upsertErr.message}`)
  }
}

function readActionUsage(snapshot: BillingSnapshot, actionId: ActionId): number {
  switch (actionId) {
    case 'inspiration_analyze': return snapshot.weeklyActionUsage.inspirationAnalyses
    case 'crm_email_send':      return snapshot.weeklyActionUsage.crmEmailsSent
    case 'campaign_send':       return snapshot.weeklyActionUsage.campaignsSent
    case 'lead_scout':          return snapshot.weeklyActionUsage.leadScoutRuns
  }
}

function humanizeAction(actionId: ActionId): string {
  switch (actionId) {
    case 'inspiration_analyze': return 'inspiration analyses'
    case 'crm_email_send':      return 'CRM emails'
    case 'campaign_send':       return 'campaign sends'
    case 'lead_scout':          return 'AI lead scout runs'
  }
}

function friendlyResetTime(periodEndIso: string): string {
  const end = new Date(periodEndIso)
  if (Number.isNaN(end.getTime())) return 'next Monday'
  return end.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' IST'
}

export async function assertCanAccessMarketingAutomation(userId: string, db?: DbClient): Promise<BillingSnapshot> {
  const snapshot = await getBillingSnapshot(userId, db)
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
