export type BillingModuleId =
  | 'research'
  | 'branding'
  | 'marketing'
  | 'landing'
  | 'feasibility'
  | 'full-launch'
  | 'general'
  | 'shadow-board'
  | 'investor-kit'
  | 'launch-autopilot'
  | 'mvp-scalpel'

export type PlanSlug = 'free' | 'builder' | 'pro' | 'studio'
export type BillingPeriod = 'monthly' | 'yearly'
export type TopupSlug = 'topup-50' | 'topup-175'

export const ALL_BILLING_MODULES: BillingModuleId[] = [
  'research',
  'branding',
  'marketing',
  'landing',
  'feasibility',
  'full-launch',
  'general',
  'shadow-board',
  'investor-kit',
  'launch-autopilot',
  'mvp-scalpel',
]

export const UNLIMITED_BILLING_CREDIT_BALANCE = 1_000_000_000
export const UNLIMITED_BILLING_VENTURE_LIMIT = 1_000_000

const DEFAULT_UNLIMITED_BILLING_EMAILS: string[] = []

export interface BillingPlan {
  slug: PlanSlug
  label: string
  monthlyPriceInr: number
  yearlyPriceInr: number
  ventureLimit: number
  monthlyCredits: number
  allowedModules: BillingModuleId[]
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
  research: 'Research',
  branding: 'Branding',
  marketing: 'Marketing',
  landing: 'Landing Page',
  feasibility: 'Feasibility',
  'full-launch': 'Full Launch',
  general: 'Co-pilot',
  'shadow-board': 'Shadow Board',
  'investor-kit': 'Investor Kit',
  'launch-autopilot': 'Launch Autopilot',
  'mvp-scalpel': 'MVP Scalpel',
}

export const MODULE_CREDIT_COSTS: Record<BillingModuleId, number> = {
  general: 1,
  branding: 6,
  'mvp-scalpel': 6,
  research: 8,
  marketing: 8,
  'launch-autopilot': 8,
  landing: 10,
  'shadow-board': 10,
  'investor-kit': 10,
  feasibility: 12,
  'full-launch': 30,
}

const FREE_MODULES: BillingModuleId[] = ['general', 'research', 'branding']
const BUILDER_MODULES: BillingModuleId[] = [
  'general',
  'research',
  'branding',
  'marketing',
  'landing',
  'mvp-scalpel',
]

const PRO_MODULES: BillingModuleId[] = ALL_BILLING_MODULES

export const BILLING_PLANS: Record<PlanSlug, BillingPlan> = {
  free: {
    slug: 'free',
    label: 'Free',
    monthlyPriceInr: 0,
    yearlyPriceInr: 0,
    ventureLimit: 1,
    monthlyCredits: 20,
    allowedModules: FREE_MODULES,
    cta: 'Start free',
  },
  builder: {
    slug: 'builder',
    label: 'Builder',
    monthlyPriceInr: 999,
    yearlyPriceInr: 9990,
    ventureLimit: 2,
    monthlyCredits: 120,
    allowedModules: BUILDER_MODULES,
    cta: 'Upgrade to Builder',
  },
  pro: {
    slug: 'pro',
    label: 'Pro',
    monthlyPriceInr: 2499,
    yearlyPriceInr: 24990,
    ventureLimit: 5,
    monthlyCredits: 350,
    allowedModules: PRO_MODULES,
    cta: 'Go Pro',
    highlight: true,
  },
  studio: {
    slug: 'studio',
    label: 'Studio',
    monthlyPriceInr: 6999,
    yearlyPriceInr: 69990,
    ventureLimit: 15,
    monthlyCredits: 1200,
    allowedModules: PRO_MODULES,
    cta: 'Scale with Studio',
  },
}

export const TOPUP_PRODUCTS: Record<TopupSlug, TopupProduct> = {
  'topup-50': {
    slug: 'topup-50',
    label: '50 Credits',
    amountInr: 499,
    credits: 50,
  },
  'topup-175': {
    slug: 'topup-175',
    label: '175 Credits',
    amountInr: 1499,
    credits: 175,
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

export const PLAN_SEQUENCE: PlanSlug[] = ['free', 'builder', 'pro', 'studio']
export const TOPUP_SEQUENCE: TopupSlug[] = ['topup-50', 'topup-175']
