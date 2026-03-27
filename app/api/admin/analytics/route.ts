import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireAdmin, isAuthError } from '@/lib/auth'
import { hasUnlimitedBillingOverride } from '@/lib/billing'
import { createDb } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const REPORT_TIMEZONE = 'Asia/Kolkata'

type AnalyticsAccessMode = 'service_role' | 'session_fallback'

type QueryResult<T> = {
  data: T[] | null
  error: { message: string } | null
}

type UserRow = {
  id: string
  email: string | null
  name: string | null
  plan: string | null
  created_at: string | null
}

type ProjectRow = {
  id: string
  user_id: string | null
  name: string | null
  status: string | null
  created_at: string | null
}

type VentureRow = {
  id: string
  user_id: string | null
  project_id: string | null
  name: string | null
  created_at: string | null
}

type ConversationRow = {
  id: string
  venture_id: string | null
  module_id: string | null
  status: string | null
  created_at: string | null
}

type CohortRow = {
  id: string
  user_id: string | null
  status: string | null
  created_at: string | null
}

type SubscriptionRow = {
  id: string
  user_id: string | null
  plan_slug: string | null
  billing_period: string | null
  status: string | null
  credits_per_cycle: number | null
  current_period_end: string | null
  created_at: string | null
}

type PaymentRow = {
  id: string
  user_id: string | null
  kind: string | null
  plan_slug: string | null
  topup_slug: string | null
  amount_inr: number | null
  status: string | null
  created_at: string | null
}

type UsageLedgerRow = {
  id: string
  user_id: string | null
  module_id: string | null
  credits: number | null
  plan_slug: string | null
  created_at: string | null
}

type CreditLedgerRow = {
  id: string
  user_id: string | null
  kind: string | null
  credits: number | null
  created_at: string | null
}

type InvestorKitRow = {
  id: string
  venture_id: string | null
  user_id: string | null
  views: number | null
  is_active: boolean | null
  created_at: string | null
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE
    ?? process.env.SUPABASE_SERVICE_KEY
    ?? null
}

async function getAnalyticsDb(): Promise<{ db: any; accessMode: AnalyticsAccessMode }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = getServiceRoleKey()

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')

  if (!serviceRole) {
    return {
      db: await createDb(),
      accessMode: 'session_fallback',
    }
  }

  return {
    db: createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    accessMode: 'service_role',
  }
}

function unwrapRows<T>(label: string, result: QueryResult<T>): T[] {
  if (result.error) {
    throw new Error(`${label} query failed: ${result.error.message}`)
  }

  return result.data ?? []
}

function formatDateKey(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
}

function toDateKey(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  return formatDateKey(new Date(dateStr))
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function normalizePlan(plan: string | null | undefined): string {
  if (!plan) return 'free'
  return plan.trim().toLowerCase() || 'free'
}

function parseSubscriptionStatus(status: string | null | undefined) {
  switch (status) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'canceled':
    case 'expired':
    case 'pending':
      return status
    default:
      return 'pending'
  }
}

function isEntitledSubscription(subscription: SubscriptionRow, now = new Date()): boolean {
  const status = parseSubscriptionStatus(subscription.status)
  if (status === 'active' || status === 'trialing' || status === 'past_due') {
    return true
  }

  if (status !== 'canceled' || !subscription.current_period_end) {
    return false
  }

  return new Date(subscription.current_period_end) > now
}

function getEffectivePlan(user: UserRow, currentSubscription: SubscriptionRow | null): string {
  if (hasUnlimitedBillingOverride(user.email)) {
    return 'unlimited'
  }

  return normalizePlan(currentSubscription?.plan_slug ?? user.plan)
}

export async function GET() {
  try {
    await requireAdmin()
    const { db, accessMode } = await getAnalyticsDb()
    const warnings: string[] = []

    if (accessMode === 'session_fallback') {
      warnings.push('Platform-wide billing analytics are limited until SUPABASE_SERVICE_ROLE_KEY is configured in Vercel.')
    }

    const [
      usersRes,
      projectsRes,
      venturesRes,
      conversationsRes,
      cohortsRes,
      subscriptionsRes,
      paymentsRes,
      usageRes,
      creditLedgerRes,
      investorKitsRes,
    ] = await Promise.all([
      db.from('users').select('id, email, name, plan, created_at'),
      db.from('projects').select('id, user_id, name, status, created_at'),
      db.from('ventures').select('id, user_id, project_id, name, created_at'),
      db.from('conversations').select('id, venture_id, module_id, status, created_at'),
      db.from('cohorts').select('id, user_id, status, created_at'),
      accessMode === 'service_role'
        ? db.from('subscriptions').select('id, user_id, plan_slug, billing_period, status, credits_per_cycle, current_period_end, created_at')
        : Promise.resolve({ data: [], error: null }),
      accessMode === 'service_role'
        ? db.from('payments').select('id, user_id, kind, plan_slug, topup_slug, amount_inr, status, created_at')
        : Promise.resolve({ data: [], error: null }),
      accessMode === 'service_role'
        ? db.from('usage_ledger').select('id, user_id, module_id, credits, plan_slug, created_at')
        : Promise.resolve({ data: [], error: null }),
      accessMode === 'service_role'
        ? db.from('credit_ledger').select('id, user_id, kind, credits, created_at')
        : Promise.resolve({ data: [], error: null }),
      db.from('investor_kits').select('id, venture_id, user_id, views, is_active, created_at'),
    ])

    const users = unwrapRows<UserRow>('users', usersRes as QueryResult<UserRow>)
    const projects = unwrapRows<ProjectRow>('projects', projectsRes as QueryResult<ProjectRow>)
    const ventures = unwrapRows<VentureRow>('ventures', venturesRes as QueryResult<VentureRow>)
    const conversations = unwrapRows<ConversationRow>('conversations', conversationsRes as QueryResult<ConversationRow>)
    const cohorts = unwrapRows<CohortRow>('cohorts', cohortsRes as QueryResult<CohortRow>)
    const subscriptions = unwrapRows<SubscriptionRow>('subscriptions', subscriptionsRes as QueryResult<SubscriptionRow>)
    const payments = unwrapRows<PaymentRow>('payments', paymentsRes as QueryResult<PaymentRow>)
    const usage = unwrapRows<UsageLedgerRow>('usage_ledger', usageRes as QueryResult<UsageLedgerRow>)
    const creditLedger = unwrapRows<CreditLedgerRow>('credit_ledger', creditLedgerRes as QueryResult<CreditLedgerRow>)
    const investorKits = unwrapRows<InvestorKitRow>('investor_kits', investorKitsRes as QueryResult<InvestorKitRow>)

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const ventureById = new Map(ventures.map((venture) => [venture.id, venture]))

    const userSubscriptions = new Map<string, SubscriptionRow[]>()
    for (const subscription of subscriptions) {
      if (!subscription.user_id) continue
      const existing = userSubscriptions.get(subscription.user_id) ?? []
      existing.push(subscription)
      userSubscriptions.set(subscription.user_id, existing)
    }

    const currentSubscriptionByUser = new Map<string, SubscriptionRow>()
    for (const [userId, userRows] of userSubscriptions.entries()) {
      const currentSubscription = [...userRows]
        .sort((a, b) => {
          const aTime = a.current_period_end ? new Date(a.current_period_end).getTime() : 0
          const bTime = b.current_period_end ? new Date(b.current_period_end).getTime() : 0
          if (aTime !== bTime) return bTime - aTime
          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        })
        .find((subscription) => isEntitledSubscription(subscription, now))

      if (currentSubscription) {
        currentSubscriptionByUser.set(userId, currentSubscription)
      }
    }

    const creditBalanceByUser = new Map<string, number>()
    const creditEconomyByKind: Record<string, number> = {}
    for (const ledgerEntry of creditLedger) {
      if (ledgerEntry.user_id) {
        creditBalanceByUser.set(
          ledgerEntry.user_id,
          (creditBalanceByUser.get(ledgerEntry.user_id) ?? 0) + (ledgerEntry.credits ?? 0)
        )
      }

      const kind = ledgerEntry.kind ?? 'unknown'
      creditEconomyByKind[kind] = (creditEconomyByKind[kind] ?? 0) + (ledgerEntry.credits ?? 0)
    }

    const userRuns = new Map<string, number>()
    const recentActiveUsers7d = new Set<string>()
    const recentActiveUsers30d = new Set<string>()
    const dailyRunsByDate = new Map<string, number>()
    const dailyUsersByDate = new Map<string, Set<string>>()
    const moduleUsage: Record<string, { total: number; complete: number; failed: number; credits: number }> = {}

    for (const conversation of conversations) {
      const venture = conversation.venture_id ? ventureById.get(conversation.venture_id) : undefined
      const userId = venture?.user_id ?? null
      const createdAt = conversation.created_at ? new Date(conversation.created_at) : null
      const dateKey = toDateKey(conversation.created_at)
      const moduleId = conversation.module_id ?? 'unknown'

      moduleUsage[moduleId] ??= { total: 0, complete: 0, failed: 0, credits: 0 }
      moduleUsage[moduleId].total += 1
      if (conversation.status === 'complete') moduleUsage[moduleId].complete += 1
      if (conversation.status === 'failed') moduleUsage[moduleId].failed += 1

      if (userId) {
        userRuns.set(userId, (userRuns.get(userId) ?? 0) + 1)
        if (createdAt && createdAt >= sevenDaysAgo) recentActiveUsers7d.add(userId)
        if (createdAt && createdAt >= thirtyDaysAgo) recentActiveUsers30d.add(userId)
      }

      if (dateKey) {
        dailyRunsByDate.set(dateKey, (dailyRunsByDate.get(dateKey) ?? 0) + 1)
        if (userId) {
          const userSet = dailyUsersByDate.get(dateKey) ?? new Set<string>()
          userSet.add(userId)
          dailyUsersByDate.set(dateKey, userSet)
        }
      }
    }

    const ventureCountByUser = new Map<string, number>()
    for (const venture of ventures) {
      if (!venture.user_id) continue
      ventureCountByUser.set(venture.user_id, (ventureCountByUser.get(venture.user_id) ?? 0) + 1)
    }

    const dailyCreditsByDate = new Map<string, number>()
    for (const usageEntry of usage) {
      const dateKey = toDateKey(usageEntry.created_at)
      if (!dateKey) continue

      dailyCreditsByDate.set(dateKey, (dailyCreditsByDate.get(dateKey) ?? 0) + (usageEntry.credits ?? 0))
      if (usageEntry.module_id && moduleUsage[usageEntry.module_id]) {
        moduleUsage[usageEntry.module_id].credits += usageEntry.credits ?? 0
      }
    }

    const dailySignupsByDate = new Map<string, number>()
    for (const user of users) {
      const dateKey = toDateKey(user.created_at)
      if (!dateKey) continue
      dailySignupsByDate.set(dateKey, (dailySignupsByDate.get(dateKey) ?? 0) + 1)
    }

    const planDistribution: Record<string, number> = {}
    const topUsers = users
      .map((user) => {
        const effectivePlan = getEffectivePlan(user, currentSubscriptionByUser.get(user.id) ?? null)
        planDistribution[effectivePlan] = (planDistribution[effectivePlan] ?? 0) + 1

        return {
          id: user.id,
          email: user.email ?? '',
          name: user.name ?? '',
          plan: effectivePlan,
          createdAt: user.created_at ?? '',
          runs: userRuns.get(user.id) ?? 0,
          credits: effectivePlan === 'unlimited' ? 'Unlimited' : (creditBalanceByUser.get(user.id) ?? 0),
          ventures: ventureCountByUser.get(user.id) ?? 0,
        }
      })
      .sort((a, b) => {
        if (b.runs !== a.runs) return b.runs - a.runs
        if (b.ventures !== a.ventures) return b.ventures - a.ventures
        return b.createdAt.localeCompare(a.createdAt)
      })
      .slice(0, 20)

    const activeSubscriptions: Record<string, number> = {}
    for (const subscription of currentSubscriptionByUser.values()) {
      const planSlug = normalizePlan(subscription.plan_slug)
      activeSubscriptions[planSlug] = (activeSubscriptions[planSlug] ?? 0) + 1
    }

    const todayDateKey = formatDateKey(now)
    const dailyActivity: { date: string; runs: number; users: number; credits: number; signups: number }[] = []
    for (let index = 29; index >= 0; index -= 1) {
      const date = addDays(now, -index)
      const dateKey = formatDateKey(date)
      if (!dateKey) continue
      dailyActivity.push({
        date: dateKey,
        runs: dailyRunsByDate.get(dateKey) ?? 0,
        users: dailyUsersByDate.get(dateKey)?.size ?? 0,
        credits: dailyCreditsByDate.get(dateKey) ?? 0,
        signups: dailySignupsByDate.get(dateKey) ?? 0,
      })
    }

    const capturedPayments = payments.filter((payment) => payment.status === 'captured')
    const totalRevenue = capturedPayments.reduce((sum, payment) => sum + (payment.amount_inr ?? 0), 0)
    const revenue7d = capturedPayments
      .filter((payment) => payment.created_at && new Date(payment.created_at) >= sevenDaysAgo)
      .reduce((sum, payment) => sum + (payment.amount_inr ?? 0), 0)
    const revenue30d = capturedPayments
      .filter((payment) => payment.created_at && new Date(payment.created_at) >= thirtyDaysAgo)
      .reduce((sum, payment) => sum + (payment.amount_inr ?? 0), 0)

    const totalCreditsGranted = creditLedger
      .filter((entry) => (entry.credits ?? 0) > 0)
      .reduce((sum, entry) => sum + (entry.credits ?? 0), 0)
    const totalCreditsSpent = creditLedger
      .filter((entry) => (entry.credits ?? 0) < 0)
      .reduce((sum, entry) => sum + Math.abs(entry.credits ?? 0), 0)

    const thisWeekConversations = conversations.filter(
      (conversation) => conversation.created_at && new Date(conversation.created_at) >= sevenDaysAgo
    )
    const lastWeekConversations = conversations.filter((conversation) => {
      if (!conversation.created_at) return false
      const createdAt = new Date(conversation.created_at)
      return createdAt >= fourteenDaysAgo && createdAt < sevenDaysAgo
    })

    const thisWeekSignups = users.filter((user) => user.created_at && new Date(user.created_at) >= sevenDaysAgo).length
    const lastWeekSignups = users.filter((user) => {
      if (!user.created_at) return false
      const createdAt = new Date(user.created_at)
      return createdAt >= fourteenDaysAgo && createdAt < sevenDaysAgo
    }).length

    const usersById = new Map(users.map((user) => [user.id, user]))
    const recentPayments = [...payments]
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, 15)
      .map((payment) => ({
        kind: payment.kind ?? '',
        planSlug: payment.plan_slug ?? '',
        topupSlug: payment.topup_slug ?? '',
        amount: payment.amount_inr ?? 0,
        status: payment.status ?? '',
        userEmail: payment.user_id ? (usersById.get(payment.user_id)?.email ?? 'unknown') : 'unknown',
        createdAt: payment.created_at ?? '',
      }))

    return NextResponse.json(
      {
        platform: {
          totalUsers: users.length,
          activeUsers7d: recentActiveUsers7d.size,
          activeUsers30d: recentActiveUsers30d.size,
          newUsers7d: thisWeekSignups,
          newUsers30d: users.filter((user) => user.created_at && new Date(user.created_at) >= thirtyDaysAgo).length,
          totalVentures: ventures.length,
          totalProjects: projects.length,
          totalConversations: conversations.length,
          completedConversations: conversations.filter((conversation) => conversation.status === 'complete').length,
          failedConversations: conversations.filter((conversation) => conversation.status === 'failed').length,
          successRate: conversations.length > 0
            ? Math.round((conversations.filter((conversation) => conversation.status === 'complete').length / conversations.length) * 100)
            : 0,
          totalCohorts: cohorts.length,
          totalInvestorKitViews: investorKits.reduce((sum, kit) => sum + (kit.views ?? 0), 0),
          timezone: REPORT_TIMEZONE,
          todayDate: todayDateKey,
          accessMode,
        },
        revenue: {
          totalRevenue,
          revenue7d,
          revenue30d,
          paymentSuccessRate: payments.length > 0 ? Math.round((capturedPayments.length / payments.length) * 100) : 0,
          totalPayments: payments.length,
          capturedPayments: capturedPayments.length,
        },
        planDistribution,
        activeSubscriptions,
        moduleUsage,
        dailyActivity,
        topUsers,
        creditEconomy: {
          totalGranted: totalCreditsGranted,
          totalSpent: totalCreditsSpent,
          netBalance: totalCreditsGranted - totalCreditsSpent,
          byKind: creditEconomyByKind,
        },
        weeklyComparison: {
          thisWeek: { runs: thisWeekConversations.length, signups: thisWeekSignups },
          lastWeek: { runs: lastWeekConversations.length, signups: lastWeekSignups },
          runsDelta: thisWeekConversations.length - lastWeekConversations.length,
          signupsDelta: thisWeekSignups - lastWeekSignups,
        },
        recentPayments,
        warnings,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch (e) {
    if (isAuthError(e)) return (e as any).toResponse()
    console.error('Admin analytics error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load admin analytics' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
}
