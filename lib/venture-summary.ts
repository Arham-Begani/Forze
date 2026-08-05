import type { Venture } from '@/lib/queries'

const COMPLETED_MODULE_MAP = [
    { contextKey: 'landing', moduleId: 'landing' },
    { contextKey: 'shadowBoard', moduleId: 'shadow-board' },
    { contextKey: 'investorKit', moduleId: 'investor-kit' },
    { contextKey: 'launchAutopilot', moduleId: 'launch-autopilot' },
    { contextKey: 'mvpScalpel', moduleId: 'mvp-scalpel' },
] as const

export function getCompletedModules(context: Record<string, unknown> | null | undefined): string[] {
    if (!context) return []
    return COMPLETED_MODULE_MAP
        .filter(({ contextKey }) => context[contextKey] != null)
        .map(({ moduleId }) => moduleId)
}

export interface VentureSummary {
    id: string
    user_id: string
    project_id: string | null
    name: string
    subdomain: string | null
    created_at: string
    updated_at: string
    completedModules: string[]
}

export function toVentureSummary(venture: Venture): VentureSummary {
    return {
        id: venture.id,
        user_id: venture.user_id,
        project_id: venture.project_id,
        name: venture.name,
        subdomain: venture.subdomain,
        created_at: venture.created_at,
        updated_at: venture.updated_at,
        completedModules: getCompletedModules(
            venture.context as unknown as Record<string, unknown> | null | undefined
        ),
    }
}
