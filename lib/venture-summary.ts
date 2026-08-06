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

export interface VentureDetail extends Omit<Venture, 'context'> {
    /** Live URL of the published landing page, or null if not deployed yet. */
    landingDeploymentUrl: string | null
    /** Whether the landing agent has produced a real component. */
    hasLandingComponent: boolean
}

/**
 * The venture detail shape sent to the client.
 *
 * `context` is dropped. context.landing.fullComponent is an entire generated
 * React component stored as a string, alongside the shadow-board transcript and
 * the investor kit — and the venture detail endpoint is hit on every module page
 * load. No client reads it; the two scalars below cover the only consumer that
 * ever wanted anything out of it (the inspiration studio's deployment poll).
 */
export function toVentureDetail(venture: Venture): VentureDetail {
    const { context, ...fields } = venture
    const landing = (context as unknown as Record<string, unknown> | null)?.landing as
        | { deploymentUrl?: unknown; fullComponent?: unknown }
        | undefined

    const deploymentUrl = landing?.deploymentUrl
    const fullComponent = landing?.fullComponent

    return {
        ...fields,
        landingDeploymentUrl:
            typeof deploymentUrl === 'string' && deploymentUrl ? deploymentUrl : null,
        hasLandingComponent: typeof fullComponent === 'string' && fullComponent.length > 200,
    }
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
