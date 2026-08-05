import { describe, it, expect } from 'vitest'
import { getCompletedModules, toVentureSummary } from '@/lib/venture-summary'
import type { Venture } from '@/lib/queries'

const VENTURE = {
    id: 'v1',
    user_id: 'u1',
    project_id: 'p1',
    name: 'Acme',
    subdomain: 'acme',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-02T00:00:00.000Z',
    context: {
        research: null,
        branding: null,
        marketing: null,
        landing: { fullComponent: 'x'.repeat(30000) },
        feasibility: null,
        shadowBoard: { verdict: 'y'.repeat(5000) },
        investorKit: null,
        launchAutopilot: null,
        mvpScalpel: null,
    },
} as unknown as Venture

describe('getCompletedModules', () => {
    it('lists only the modules with non-null context', () => {
        expect(getCompletedModules(VENTURE.context as never)).toEqual(['landing', 'shadow-board'])
    })

    it('returns [] for null, undefined and empty context', () => {
        expect(getCompletedModules(null)).toEqual([])
        expect(getCompletedModules(undefined)).toEqual([])
        expect(getCompletedModules({})).toEqual([])
    })

    it('treats a legacy context with unknown keys as nothing completed', () => {
        expect(getCompletedModules({ somethingElse: { a: 1 } })).toEqual([])
    })
})

describe('toVentureSummary', () => {
    it('never leaks the context blob', () => {
        // context.landing.fullComponent is a whole generated React component.
        // Shipping it on every dashboard load is what this summary exists to stop.
        const summary = toVentureSummary(VENTURE)
        expect('context' in summary).toBe(false)
        expect(JSON.stringify(summary)).not.toContain('fullComponent')
        expect(JSON.stringify(summary).length).toBeLessThan(400)
    })

    it('keeps every field the dashboard actually renders', () => {
        const summary = toVentureSummary(VENTURE)
        expect(summary.id).toBe('v1')
        expect(summary.name).toBe('Acme')
        expect(summary.project_id).toBe('p1')
        expect(summary.subdomain).toBe('acme')
        expect(summary.created_at).toBe(VENTURE.created_at)
        expect(summary.completedModules).toEqual(['landing', 'shadow-board'])
    })

    it('survives a venture with no context at all', () => {
        const bare = { ...VENTURE, context: null } as unknown as Venture
        expect(toVentureSummary(bare).completedModules).toEqual([])
    })
})
