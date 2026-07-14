import type { BillingModuleId } from '@/lib/billing'

export type ScopeGuardModuleId = BillingModuleId

export interface ModuleScopeDefinition {
  id: ScopeGuardModuleId
  summary: string
  contextKey: string | null
  primaryDeliverables: string[]
  keywords: string[]
  editKeywords: string[]
  redirectPriority: BillingModuleId[]
}

export interface ScopeRefusalResult {
  kind: 'scope_refusal'
  moduleId: ScopeGuardModuleId
  blockedBy: 'deterministic' | 'classifier'
  confidence: number
  reason: string
  message: string
  suggestedModules: BillingModuleId[]
}

export const MODULE_SCOPE_REGISTRY: Record<ScopeGuardModuleId, ModuleScopeDefinition> = {
  landing: {
    id: 'landing',
    summary: 'landing page strategy, page copy, sitemap, UI structure, and live page components',
    contextKey: 'landing',
    primaryDeliverables: [
      'landing page',
      'hero section',
      'cta',
      'headline',
      'subheadline',
      'sitemap',
      'pricing section',
      'faq section',
      'landing page copy',
      'website',
      'wireframe',
      'component',
      'page design',
    ],
    keywords: [
      'landing',
      'page',
      'copy',
      'design',
      'site map',
      'hero',
      'pricing table',
      'web page',
    ],
    editKeywords: [
      'hero',
      'headline',
      'subheadline',
      'cta',
      'features',
      'pricing',
      'faq',
      'sitemap',
      'component',
      'seo metadata',
    ],
    redirectPriority: ['general', 'shadow-board'],
  },
  general: {
    id: 'general',
    summary: 'open-ended venture advice, discussion, and module recommendations',
    contextKey: null,
    primaryDeliverables: [],
    keywords: ['advice', 'brainstorm', 'help me think', 'cofounder', 'what should i do'],
    editKeywords: [],
    redirectPriority: ['landing', 'shadow-board', 'investor-kit'],
  },
  'shadow-board': {
    id: 'shadow-board',
    summary: 'brutal board-style feedback, pivots, synthetic user reactions, and survival scoring',
    contextKey: 'shadowBoard',
    primaryDeliverables: [
      'shadow board',
      'board review',
      'board meeting',
      'survival score',
      'strategic pivots',
      'synthetic user interviews',
      'brutal feedback',
    ],
    keywords: [
      'skeptic',
      'evangelist',
      'alchemist',
      'stress test',
      'board feedback',
      'pivots',
    ],
    editKeywords: [
      'survival score',
      'verdict',
      'board dialogue',
      'pivot',
      'feedback',
    ],
    redirectPriority: ['investor-kit', 'general'],
  },
  'investor-kit': {
    id: 'investor-kit',
    summary: 'investor-facing fundraising assets like pitch decks, memos, asks, and data room structure',
    contextKey: 'investorKit',
    primaryDeliverables: [
      'pitch deck',
      'investor deck',
      'investment memo',
      'one page memo',
      'executive summary',
      'fundraising',
      'raise amount',
      'use of funds',
      'data room',
    ],
    keywords: [
      'investor',
      'fundraise',
      'raise',
      'memo',
      'deck',
      'venture capital',
      'seed round',
    ],
    editKeywords: [
      'executive summary',
      'pitch deck',
      'memo',
      'ask',
      'milestones',
      'data room',
    ],
    redirectPriority: ['shadow-board', 'landing'],
  },
}

export function isScopeRefusalResult(value: unknown): value is ScopeRefusalResult {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<ScopeRefusalResult>
  return (
    candidate.kind === 'scope_refusal' &&
    typeof candidate.moduleId === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.reason === 'string' &&
    typeof candidate.confidence === 'number' &&
    Array.isArray(candidate.suggestedModules)
  )
}
