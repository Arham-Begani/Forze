import { describe, it, expect } from 'vitest'
import { getCompletedModules, toVentureDetail, toVentureSummary } from '@/lib/venture-summary'
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

describe('toVentureDetail', () => {
    it('never leaks the context blob', () => {
        // Same contract as toVentureSummary, for the DETAIL endpoint — which the
        // module page hits on every load and which used to spread the whole row.
        const detail = toVentureDetail(VENTURE)
        expect('context' in detail).toBe(false)
        expect(JSON.stringify(detail)).not.toContain('fullComponent')
        expect(JSON.stringify(detail)).not.toContain('verdict')
    })

    it('keeps every field the venture pages actually render', () => {
        const detail = toVentureDetail(VENTURE)
        expect(detail.id).toBe('v1')
        expect(detail.name).toBe('Acme')
        expect(detail.project_id).toBe('p1')
        expect(detail.subdomain).toBe('acme')
        expect(detail.user_id).toBe('u1')
        expect(detail.updated_at).toBe(VENTURE.updated_at)
    })

    it('surfaces a real landing component as a boolean, not the component', () => {
        const detail = toVentureDetail(VENTURE)
        expect(detail.hasLandingComponent).toBe(true)
        expect(detail.landingDeploymentUrl).toBeNull()
    })

    it('surfaces the deployment url when the landing page is live', () => {
        const deployed = {
            ...VENTURE,
            context: { landing: { deploymentUrl: 'https://acme.forze.in', fullComponent: 'x' } },
        } as unknown as Venture
        expect(toVentureDetail(deployed).landingDeploymentUrl).toBe('https://acme.forze.in')
    })

    it('treats a stub component as not built', () => {
        // The inspiration poll's 200-char floor: an empty-ish placeholder must
        // not read as a finished landing page.
        const stub = { ...VENTURE, context: { landing: { fullComponent: 'x'.repeat(50) } } } as unknown as Venture
        expect(toVentureDetail(stub).hasLandingComponent).toBe(false)
    })

    it('survives null, empty and malformed context', () => {
        for (const context of [null, {}, { landing: null }, { landing: { deploymentUrl: 42 } }]) {
            const v = { ...VENTURE, context } as unknown as Venture
            const detail = toVentureDetail(v)
            expect(detail.landingDeploymentUrl).toBeNull()
            expect(detail.hasLandingComponent).toBe(false)
        }
    })
})
