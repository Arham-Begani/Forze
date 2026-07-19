// app/api/analytics/route.ts
import { requireAuth, isAuthError } from '@/lib/auth'
import { createDb } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getCreditBalance, getCurrentSubscription, getRecentPayments } from '@/lib/billing-queries'
import { logError } from '@/lib/log'

export async function GET() {
    try {
        const session = await requireAuth()
        const db = await createDb()
        const userId = session.userId

        // Run all queries in parallel
        const [
            venturesRes,
            projectsRes,
            conversationsRes,
            cohortsRes,
            creditBalance,
            subscription,
            recentPayments,
            usageRes,
            creditLedgerRes,
            investorKitsRes,
        ] = await Promise.all([
            db.from('ventures').select('id, name, project_id, context, created_at').eq('user_id', userId),
            db.from('projects').select('id, name, status, created_at').eq('user_id', userId),
            db.from('conversations').select('id, venture_id, module_id, status, created_at, prompt').eq('venture_id', db.from('ventures').select('id').eq('user_id', userId)).order('created_at', { ascending: false }),
            db.from('cohorts').select('id, status, created_at').eq('user_id', userId),
            getCreditBalance(userId, db),
            getCurrentSubscription(userId, db),
            getRecentPayments(userId, 20, db),
            db.from('usage_ledger').select('module_id, credits, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
            db.from('credit_ledger').select('kind, credits, created_at, metadata').eq('user_id', userId).order('created_at', { ascending: false }),
            db.from('investor_kits').select('id, views, is_active, created_at').eq('user_id', userId),
        ])

        // Fetch conversations via venture IDs since there's no direct user_id on conversations
        const ventureIds = (venturesRes.data ?? []).map(v => v.id)
        let conversations: any[] = []
        if (ventureIds.length > 0) {
            const { data } = await db
                .from('conversations')
                .select('id, venture_id, module_id, status, created_at, prompt')
                .in('venture_id', ventureIds)
                .order('created_at', { ascending: false })
            conversations = data ?? []
        }

        const ventures = venturesRes.data ?? []
        const projects = projectsRes.data ?? []
        const cohorts = cohortsRes.data ?? []
        const usage = usageRes.data ?? []
        const creditLedger = creditLedgerRes.data ?? []
        const investorKits = investorKitsRes.data ?? []

        // ── Compute analytics ────────────────────────────────────────────

        // 1. Overview stats
        const totalVentures = ventures.length
        const totalProjects = projects.length
        const totalConversations = conversations.length
        const completedConversations = conversations.filter(c => c.status === 'complete').length
        const failedConversations = conversations.filter(c => c.status === 'failed').length
        const runningConversations = conversations.filter(c => c.status === 'running').length
        const successRate = totalConversations > 0 ? Math.round((completedConversations / totalConversations) * 100) : 0
        const totalCreditsUsed = usage.reduce((sum, u) => sum + (u.credits || 0), 0)
        const totalCohorts = cohorts.length
        const totalInvestorKitViews = investorKits.reduce((sum, k) => sum + (k.views || 0), 0)

        // 2. Module usage breakdown
        const moduleUsage: Record<string, { total: number; complete: number; failed: number; credits: number }> = {}
        for (const c of conversations) {
            if (!moduleUsage[c.module_id]) {
                moduleUsage[c.module_id] = { total: 0, complete: 0, failed: 0, credits: 0 }
            }
            moduleUsage[c.module_id].total++
            if (c.status === 'complete') moduleUsage[c.module_id].complete++
            if (c.status === 'failed') moduleUsage[c.module_id].failed++
        }
        for (const u of usage) {
            if (moduleUsage[u.module_id]) {
                moduleUsage[u.module_id].credits += u.credits || 0
            }
        }

        // 3. Activity over last 30 days (daily buckets)
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const dailyActivity: { date: string; runs: number; credits: number }[] = []
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
            const dateStr = d.toISOString().slice(0, 10)
            const dayConvs = conversations.filter(c => c.created_at?.slice(0, 10) === dateStr)
            const dayCredits = usage.filter(u => u.created_at?.slice(0, 10) === dateStr).reduce((s, u) => s + (u.credits || 0), 0)
            dailyActivity.push({ date: dateStr, runs: dayConvs.length, credits: dayCredits })
        }

        // 4. Venture health — top ventures by activity
        const ventureActivity = ventures.map(v => {
            const vConvs = conversations.filter(c => c.venture_id === v.id)
            const modulesUsed = new Set(vConvs.map(c => c.module_id))
            const context = (v.context || {}) as Record<string, unknown>
            const completedModules = ['research', 'branding', 'marketing', 'landing', 'feasibility', 'shadowBoard', 'investorKit', 'launchAutopilot', 'mvpScalpel']
                .filter(m => !!context[m])
            return {
                id: v.id,
                name: v.name,
                totalRuns: vConvs.length,
                successRate: vConvs.length > 0 ? Math.round((vConvs.filter(c => c.status === 'complete').length / vConvs.length) * 100) : 0,
                modulesUsed: modulesUsed.size,
                completedModules: completedModules.length,
                lastActivity: vConvs[0]?.created_at || v.created_at,
                createdAt: v.created_at,
            }
        }).sort((a, b) => b.totalRuns - a.totalRuns)

        // 5. Recent conversations (last 20)
        const recentRuns = conversations.slice(0, 20).map(c => ({
            id: c.id,
            moduleId: c.module_id,
            status: c.status,
            prompt: c.prompt?.slice(0, 80) || '',
            ventureName: ventures.find(v => v.id === c.venture_id)?.name || 'Unknown',
            createdAt: c.created_at,
        }))

        // 6. Credit flow (last 30 entries)
        const creditFlow = creditLedger.slice(0, 30).map(l => ({
            kind: l.kind,
            credits: l.credits,
            createdAt: l.created_at,
            metadata: l.metadata,
        }))

        // 7. Weekly comparison
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        const thisWeekConvs = conversations.filter(c => new Date(c.created_at) >= sevenDaysAgo)
        const lastWeekConvs = conversations.filter(c => {
            const d = new Date(c.created_at)
            return d >= fourteenDaysAgo && d < sevenDaysAgo
        })
        const thisWeekCredits = usage.filter(u => new Date(u.created_at) >= sevenDaysAgo).reduce((s, u) => s + (u.credits || 0), 0)
        const lastWeekCredits = usage.filter(u => {
            const d = new Date(u.created_at)
            return d >= fourteenDaysAgo && d < sevenDaysAgo
        }).reduce((s, u) => s + (u.credits || 0), 0)

        // 8. Payment summary
        const paymentSummary = {
            totalPayments: recentPayments.length,
            totalRevenue: recentPayments.filter(p => p.status === 'captured').reduce((s, p) => s + (p.amount_inr || 0), 0),
            recentPayments: recentPayments.slice(0, 10).map(p => ({
                kind: p.kind,
                planSlug: p.plan_slug,
                topupSlug: p.topup_slug,
                amount: p.amount_inr,
                status: p.status,
                createdAt: p.created_at,
            })),
        }

        return NextResponse.json({
            overview: {
                totalVentures,
                totalProjects,
                totalConversations,
                completedConversations,
                failedConversations,
                runningConversations,
                successRate,
                totalCreditsUsed,
                creditsRemaining: creditBalance,
                totalCohorts,
                totalInvestorKitViews,
            },
            subscription: subscription ? {
                planSlug: subscription.plan_slug,
                billingPeriod: subscription.billing_period,
                status: subscription.status,
                creditsPerCycle: subscription.credits_per_cycle,
                currentPeriodEnd: subscription.current_period_end,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
            } : null,
            moduleUsage,
            dailyActivity,
            ventureHealth: ventureActivity.slice(0, 10),
            recentRuns,
            creditFlow,
            weeklyComparison: {
                thisWeek: { runs: thisWeekConvs.length, credits: thisWeekCredits },
                lastWeek: { runs: lastWeekConvs.length, credits: lastWeekCredits },
                runsDelta: thisWeekConvs.length - lastWeekConvs.length,
                creditsDelta: thisWeekCredits - lastWeekCredits,
            },
            paymentSummary,
        })
    } catch (e) {
        if (isAuthError(e)) return (e as any).toResponse()
        logError('analytics', e, { msg: 'Analytics error' })
        return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
    }
}
