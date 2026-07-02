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
    redirectPriority: ['general', 'shadow-board', 'launch-autopilot'],
  },
  general: {
    id: 'general',
    summary: 'open-ended venture advice, discussion, and module recommendations',
    contextKey: null,
    primaryDeliverables: [],
    keywords: ['advice', 'brainstorm', 'help me think', 'cofounder', 'what should i do'],
    editKeywords: [],
    redirectPriority: ['landing', 'shadow-board', 'investor-kit', 'mvp-scalpel'],
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
    redirectPriority: ['mvp-scalpel', 'investor-kit', 'general'],
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
    redirectPriority: ['shadow-board', 'mvp-scalpel', 'landing'],
  },
  'launch-autopilot': {
    id: 'launch-autopilot',
    summary: 'a day-by-day launch calendar with paste-ready posts, outreach copy, and launch checklists',
    contextKey: 'launchAutopilot',
    primaryDeliverables: [
      'launch plan',
      'launch calendar',
      '14 day launch',
      '14-day launch',
      'product hunt',
      'cold outreach',
      'paste ready',
      'paste-ready',
      'launch checklist',
      'exact copy',
    ],
    keywords: [
      'launch execution',
      'daily launch',
      'outreach',
      'launch day',
      'comment replies',
      'micro influencers',
    ],
    editKeywords: [
      'launch plan',
      'day 1',
      'day 2',
      'task',
      'checklist',
      'channel',
      'copy',
      'week one goal',
      'week two goal',
    ],
    redirectPriority: ['landing', 'shadow-board', 'general'],
  },
  'mvp-scalpel': {
    id: 'mvp-scalpel',
    summary: 'scope-cutting, skeleton MVP definition, weekend build specs, and first-dollar plans',
    contextKey: 'mvpScalpel',
    primaryDeliverables: [
      'mvp spec',
      'skeleton mvp',
      'kill list',
      'scope creep',
      'feature cut',
      'weekend build',
      'weekend plan',
      'time to first dollar',
      'ship now',
    ],
    keywords: [
      'scope',
      'mvp',
      'cut features',
      'lean build',
      'weekend ship',
      'minimal product',
      'first dollar',
    ],
    editKeywords: [
      'kill list',
      'mvp',
      'weekend spec',
      'tech stack',
      'pages',
      'endpoints',
      'first dollar',
      'verdict',
    ],
    redirectPriority: ['landing', 'launch-autopilot', 'shadow-board'],
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
