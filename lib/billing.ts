export type BillingModuleId =
  | 'landing'
  | 'general'
  | 'shadow-board'
  | 'investor-kit'
  | 'launch-autopilot'
  | 'mvp-scalpel'

export type PlanSlug = 'free' | 'starter' | 'builder' | 'pro' | 'studio'
export type BillingPeriod = 'monthly' | 'yearly'
export type TopupSlug = 'topup-50' | 'topup-175'

// Gated non-credit features (CRM read/list, inspiration analyze list, etc).
// Distinct from BillingModuleId because these aren't priced in credits — they
// have per-week action ceilings on top of plan-level access gating.
export type FeatureId = 'crm' | 'inspiration' | 'outreach'

// Action-counter keys. Each maps to a feature_usage_counters row keyed by
// (user_id, feature_id, period_start). The string values match the DB CHECK
// constraint in migration 030 (widened by 042 for lead_scout).
export type ActionId = 'inspiration_analyze' | 'crm_email_send' | 'campaign_send' | 'lead_scout'

export const ALL_BILLING_MODULES: BillingModuleId[] = [
  'landing',
  'general',
  'shadow-board',
  'investor-kit',
  'launch-autopilot',
  'mvp-scalpel',
]

export const ALL_FEATURES: FeatureId[] = ['crm', 'inspiration', 'outreach']

// Modules every plan gets (Free + Starter included). Excludes launch-autopilot
// because that's part of the Outreach feature gate (Builder+).
export const CORE_BILLING_MODULES: BillingModuleId[] = [
  'landing',
  'general',
  'shadow-board',
  'investor-kit',
  'mvp-scalpel',
]

export const UNLIMITED_BILLING_CREDIT_BALANCE = 1_000_000_000
export const UNLIMITED_BILLING_VENTURE_LIMIT = 1_000_000
export const UNLIMITED_WEEKLY_ACTION_LIMIT = 1_000_000

const DEFAULT_UNLIMITED_BILLING_EMAILS: string[] = []

// Per-week action ceilings on the un-credited gated surfaces. Independent
// of credit balance. UNLIMITED_WEEKLY_ACTION_LIMIT means "monitor but don't
// enforce". Set to 0 for plans that don't have the feature at all (they're
// blocked at the assertCanAccessFeature gate before this is consulted).
export interface WeeklyActionLimits {
  inspirationAnalyses: number
  crmEmailsSent: number
  campaignsSent: number
  // AI Lead Scout runs — each run is a web-search Gemini pass that returns a
  // batch of prospect candidates, so it's metered tightly.
  leadScoutRuns: number
}

export interface BillingPlan {
  slug: PlanSlug
  label: string
  monthlyPriceInr: number
  yearlyPriceInr: number
  ventureLimit: number
  monthlyCredits: number          // legacy display + razorpay subscription metadata
  weeklyCredits: number           // new: per-week grant inserted every Mon 00:00 IST
  allowedModules: BillingModuleId[]
  allowedFeatures: FeatureId[]
  weeklyActionLimits: WeeklyActionLimits
  cta: string
  highlight?: boolean
}

export interface TopupProduct {
  slug: TopupSlug
  label: string
  amountInr: number
  credits: number
}

export const BILLING_MODULE_LABELS: Record<BillingModuleId, string> = {
  landing: 'Landing Page',
  general: 'Co-pilot',
  'shadow-board': 'Shadow Board',
  'investor-kit': 'Investor Kit',
  'launch-autopilot': 'Launch Autopilot',
  'mvp-scalpel': 'MVP Scalpel',
}

export const MODULE_CREDIT_COSTS: Record<BillingModuleId, number> = {
  general: 1,
  'mvp-scalpel': 6,
  'launch-autopilot': 8,
  landing: 10,
  'shadow-board': 10,
  'investor-kit': 10,
}

export const BILLING_PLANS: Record<PlanSlug, BillingPlan> = {
  free: {
    slug: 'free',
    label: 'Free',
    monthlyPriceInr: 0,
    yearlyPriceInr: 0,
    ventureLimit: 1,
    monthlyCredits: 40,         // 10/wk * 4 weeks — kept for legacy display + razorpay
    weeklyCredits: 10,
    allowedModules: CORE_BILLING_MODULES, // no launch-autopilot
    allowedFeatures: [],                  // no CRM, inspiration, outreach
    weeklyActionLimits: {
      inspirationAnalyses: 0,
      crmEmailsSent: 0,
      campaignsSent: 0,
      leadScoutRuns: 0,
    },
    cta: 'Start free',
  },
  starter: {
    slug: 'starter',
    label: 'Starter',
    monthlyPriceInr: 299,
    yearlyPriceInr: 2990,
    ventureLimit: 2,
    monthlyCredits: 80,         // 20/wk * 4
    weeklyCredits: 20,
    allowedModules: CORE_BILLING_MODULES, // no launch-autopilot
    allowedFeatures: [],                  // no CRM, inspiration, outreach
    weeklyActionLimits: {
      inspirationAnalyses: 0,
      crmEmailsSent: 0,
      campaignsSent: 0,
      leadScoutRuns: 0,
    },
    cta: 'Get Started',
  },
  builder: {
    slug: 'builder',
    label: 'Builder',
    monthlyPriceInr: 899,
    yearlyPriceInr: 8990,
    ventureLimit: 5,
    monthlyCredits: 240,        // 60/wk * 4
    weeklyCredits: 60,
    allowedModules: ALL_BILLING_MODULES,
    allowedFeatures: ALL_FEATURES,
    weeklyActionLimits: {
      inspirationAnalyses: 20,
      crmEmailsSent: 50,
      campaignsSent: 3,
      leadScoutRuns: 2,
    },
    cta: 'Upgrade to Builder',
  },
  pro: {
    slug: 'pro',
    label: 'Pro',
    monthlyPriceInr: 2999,
    yearlyPriceInr: 29990,
    ventureLimit: 15,
    monthlyCredits: 1200,       // 300/wk * 4
    weeklyCredits: 300,
    allowedModules: ALL_BILLING_MODULES,
    allowedFeatures: ALL_FEATURES,
    weeklyActionLimits: {
      inspirationAnalyses: 75,
      crmEmailsSent: 250,
      campaignsSent: 15,
      leadScoutRuns: 10,
    },
    cta: 'Go Pro',
    highlight: true,
  },
  studio: {
    slug: 'studio',
    label: 'Studio',
    monthlyPriceInr: 7999,
    yearlyPriceInr: 79990,
    ventureLimit: UNLIMITED_BILLING_VENTURE_LIMIT,
    monthlyCredits: 2400,       // 600/wk * 4
    weeklyCredits: 600,
    allowedModules: ALL_BILLING_MODULES,
    allowedFeatures: ALL_FEATURES,
    weeklyActionLimits: {
      inspirationAnalyses: 300,
      crmEmailsSent: UNLIMITED_WEEKLY_ACTION_LIMIT,
      campaignsSent: UNLIMITED_WEEKLY_ACTION_LIMIT,
      leadScoutRuns: 30,
    },
    cta: 'Scale with Studio',
  },
}

export const FEATURE_LABELS: Record<FeatureId, string> = {
  crm: 'CRM',
  inspiration: 'Inspiration',
  outreach: 'Outreach',
}

export const ACTION_TO_FEATURE: Record<ActionId, FeatureId> = {
  inspiration_analyze: 'inspiration',
  crm_email_send: 'crm',
  campaign_send: 'outreach',
  lead_scout: 'outreach',
}

export const TOPUP_PRODUCTS: Record<TopupSlug, TopupProduct> = {
  'topup-50': {
    slug: 'topup-50',
    label: '60 Credits',
    amountInr: 499,
    credits: 60,
  },
  'topup-175': {
    slug: 'topup-175',
    label: '200 Credits',
    amountInr: 1499,
    credits: 200,
  },
}

export function getPlanConfig(planSlug: PlanSlug): BillingPlan {
  return BILLING_PLANS[planSlug]
}

export function getTopupConfig(topupSlug: TopupSlug): TopupProduct {
  return TOPUP_PRODUCTS[topupSlug]
}

export function getModuleCost(moduleId: BillingModuleId): number {
  return MODULE_CREDIT_COSTS[moduleId]
}

export function isModuleIncluded(planSlug: PlanSlug, moduleId: BillingModuleId): boolean {
  return BILLING_PLANS[planSlug].allowedModules.includes(moduleId)
}

export function isFeatureIncluded(planSlug: PlanSlug, featureId: FeatureId): boolean {
  return BILLING_PLANS[planSlug].allowedFeatures.includes(featureId)
}

export function getWeeklyActionLimit(planSlug: PlanSlug, actionId: ActionId): number {
  const limits = BILLING_PLANS[planSlug].weeklyActionLimits
  switch (actionId) {
    case 'inspiration_analyze':
      return limits.inspirationAnalyses
    case 'crm_email_send':
      return limits.crmEmailsSent
    case 'campaign_send':
      return limits.campaignsSent
    case 'lead_scout':
      return limits.leadScoutRuns
  }
}

export function getWeeklyCredits(planSlug: PlanSlug): number {
  return BILLING_PLANS[planSlug].weeklyCredits
}

// Mon 00:00 IST anchor for the week containing `now`. IST = UTC+5:30, no DST.
// Returned as a UTC ISO string so it's safe to compare with TIMESTAMPTZ rows.
export function getCurrentWeeklyPeriodStart(now: Date = new Date()): string {
  const IST_OFFSET_MIN = 5 * 60 + 30
  // Shift `now` into IST wall-clock space, snap to Monday 00:00, shift back.
  const istNow = new Date(now.getTime() + IST_OFFSET_MIN * 60 * 1000)
  const dayOfWeek = istNow.getUTCDay()           // 0 = Sun, 1 = Mon, ... in shifted clock
  const daysSinceMonday = (dayOfWeek + 6) % 7    // Mon=0, Tue=1, ..., Sun=6
  const istMondayMidnight = new Date(Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate() - daysSinceMonday,
    0, 0, 0, 0,
  ))
  // Shift the IST-midnight back into real UTC.
  const utcMondayMidnight = new Date(istMondayMidnight.getTime() - IST_OFFSET_MIN * 60 * 1000)
  return utcMondayMidnight.toISOString()
}

// End of the current weekly window — exactly +7 days from the start.
export function getCurrentWeeklyPeriodEnd(now: Date = new Date()): string {
  const startMs = new Date(getCurrentWeeklyPeriodStart(now)).getTime()
  return new Date(startMs + 7 * 24 * 60 * 60 * 1000).toISOString()
}

export function getPlanPrice(planSlug: PlanSlug, billingPeriod: BillingPeriod): number {
  const plan = getPlanConfig(planSlug)
  return billingPeriod === 'yearly' ? plan.yearlyPriceInr : plan.monthlyPriceInr
}

export function formatPlanLabel(planSlug: PlanSlug): string {
  return BILLING_PLANS[planSlug].label
}

export function getRazorpayPlanId(planSlug: Exclude<PlanSlug, 'free'>, billingPeriod: BillingPeriod): string | null {
  const envKey = `RAZORPAY_PLAN_${planSlug.toUpperCase()}_${billingPeriod.toUpperCase()}`
  return process.env[envKey] ?? null
}

export function getBillingPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID ?? null
}

export function hasUnlimitedBillingOverride(email: string | null | undefined): boolean {
  if (!email) return false

  const normalizedEmail = email.trim().toLowerCase()
  const configuredEmails = (process.env.FORZE_UNLIMITED_BILLING_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  return [...DEFAULT_UNLIMITED_BILLING_EMAILS, ...configuredEmails].includes(normalizedEmail)
}

export const PLAN_SEQUENCE: PlanSlug[] = ['free', 'starter', 'builder', 'pro', 'studio']
export const TOPUP_SEQUENCE: TopupSlug[] = ['topup-50', 'topup-175']
