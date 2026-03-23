import { z } from 'zod'
import { BILLING_MODULE_LABELS, type BillingModuleId } from '@/lib/billing'
import { extractJSON, getFlashModel, withTimeout } from '@/lib/gemini'
import {
  MODULE_SCOPE_REGISTRY,
  type ScopeGuardModuleId,
  type ScopeRefusalResult,
} from '@/lib/module-scope.shared'

interface ScopeMatch {
  moduleId: BillingModuleId
  score: number
  deliverableHits: string[]
  keywordHits: string[]
}

interface PromptFeatures {
  normalized: string
  tokenCount: number
  hasTaskIntent: boolean
  hasCreationIntent: boolean
  hasPlanningIntent: boolean
  hasAnalysisIntent: boolean
  hasEditIntent: boolean
  hasBroadLaunchIntent: boolean
}

interface EvaluateModuleScopeOptions {
  moduleId: ScopeGuardModuleId
  prompt: string
  context?: Record<string, unknown>
  isContinuation?: boolean
  mode?: 'run' | 'preflight'
}

interface AllowedScopeDecision {
  allowed: true
}

interface BlockedScopeDecision {
  allowed: false
  refusal: ScopeRefusalResult
}

export type ModuleScopeDecision = AllowedScopeDecision | BlockedScopeDecision

const CREATION_PATTERNS = [
  'build',
  'create',
  'generate',
  'write',
  'draft',
  'design',
  'make',
  'produce',
  'craft',
  'develop',
  'spin up',
]

const PLANNING_PATTERNS = [
  'plan',
  'calendar',
  'schedule',
  'strategy',
  'strategize',
  'roadmap',
  'outline',
]

const DIRECT_REQUEST_PATTERNS = [
  'can you',
  'could you',
  'help me',
  'i need',
  'i want',
  'show me',
  'give me',
  'please',
]

const ANALYSIS_PATTERNS = [
  'research',
  'analyze',
  'analyse',
  'assess',
  'evaluate',
  'validate',
  'compare',
  'investigate',
  'review',
  'study',
]

const EDIT_PATTERNS = [
  'change',
  'update',
  'edit',
  'revise',
  'tweak',
  'adjust',
  'shorten',
  'expand',
  'refine',
  'replace',
  'swap',
  'rework',
  'rewrite',
  'reword',
  'fix',
  'add',
  'remove',
  'make it',
  'make the',
  'use ',
]

const CLASSIFIER_SCHEMA = z.object({
  blocked: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  betterFitModules: z.array(z.custom<BillingModuleId>()).max(3).default([]),
})

function normalizePrompt(prompt: string): string {
  return ` ${prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `
}

function containsPhrase(normalized: string, phrase: string): boolean {
  return normalized.includes(normalizePrompt(phrase))
}

function getPromptFeatures(prompt: string): PromptFeatures {
  const normalized = normalizePrompt(prompt)
  const tokenCount = normalized.trim().split(/\s+/).filter(Boolean).length

  const hasCreationIntent = CREATION_PATTERNS.some((pattern) => containsPhrase(normalized, pattern))
  const hasPlanningIntent = PLANNING_PATTERNS.some((pattern) => containsPhrase(normalized, pattern))
  const hasDirectRequest = DIRECT_REQUEST_PATTERNS.some((pattern) => containsPhrase(normalized, pattern))
  const hasAnalysisIntent = ANALYSIS_PATTERNS.some((pattern) => containsPhrase(normalized, pattern))
  const hasEditIntent = EDIT_PATTERNS.some((pattern) => containsPhrase(normalized, pattern))
  const hasBroadLaunchIntent =
    containsPhrase(normalized, 'launch this venture') ||
    containsPhrase(normalized, 'full launch') ||
    containsPhrase(normalized, 'complete venture') ||
    containsPhrase(normalized, 'complete package') ||
    containsPhrase(normalized, 'run all agents') ||
    containsPhrase(normalized, 'end to end')

  return {
    normalized,
    tokenCount,
    hasTaskIntent: hasCreationIntent || hasPlanningIntent || hasDirectRequest || tokenCount <= 6,
    hasCreationIntent,
    hasPlanningIntent,
    hasAnalysisIntent,
    hasEditIntent,
    hasBroadLaunchIntent,
  }
}

function scoreModule(moduleId: BillingModuleId, features: PromptFeatures): ScopeMatch {
  const definition = MODULE_SCOPE_REGISTRY[moduleId]
  const deliverableHits = definition.primaryDeliverables.filter((phrase) => containsPhrase(features.normalized, phrase))
  const keywordHits = definition.keywords.filter((phrase) => containsPhrase(features.normalized, phrase))

  let score = deliverableHits.length * 4 + keywordHits.length * 2

  if (deliverableHits.length > 0 && features.hasTaskIntent) score += 3
  if (moduleId === 'research' && features.hasAnalysisIntent && (deliverableHits.length > 0 || keywordHits.length > 0)) {
    score += 2
  }
  if (moduleId === 'full-launch' && features.hasBroadLaunchIntent) {
    score += 6
  }

  return {
    moduleId,
    score,
    deliverableHits,
    keywordHits,
  }
}

function getAllMatches(features: PromptFeatures): ScopeMatch[] {
  return (Object.keys(MODULE_SCOPE_REGISTRY) as ScopeGuardModuleId[])
    .map((moduleId) => scoreModule(moduleId, features))
    .sort((left, right) => right.score - left.score)
}

function hasExistingOutput(moduleId: ScopeGuardModuleId, context: Record<string, unknown> | undefined): boolean {
  if (!context) return false

  const contextKey = MODULE_SCOPE_REGISTRY[moduleId].contextKey
  if (!contextKey) return false

  const value = context[contextKey]
  if (!value || typeof value !== 'object') return false

  return Object.keys(value as Record<string, unknown>).length > 0
}

function shouldAllowEditBypass(
  moduleId: ScopeGuardModuleId,
  features: PromptFeatures,
  context: Record<string, unknown> | undefined,
  strongestForeign: ScopeMatch | undefined
): boolean {
  if (!features.hasEditIntent) return false
  if (!hasExistingOutput(moduleId, context)) return false
  if (!strongestForeign) return true

  return !(strongestForeign.score >= 7 && strongestForeign.deliverableHits.length > 0)
}

function sortSuggestions(selectedModule: ScopeGuardModuleId, matches: ScopeMatch[]): BillingModuleId[] {
  const priority = MODULE_SCOPE_REGISTRY[selectedModule].redirectPriority
  const unique = new Map<BillingModuleId, ScopeMatch>()

  for (const match of matches) {
    if (match.moduleId === selectedModule || match.moduleId === 'general' || match.score <= 0) continue
    if (!unique.has(match.moduleId)) {
      unique.set(match.moduleId, match)
    }
  }

  return [...unique.values()]
    .sort((left, right) => {
      const leftPriority = priority.indexOf(left.moduleId)
      const rightPriority = priority.indexOf(right.moduleId)
      const normalizedLeftPriority = leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority
      const normalizedRightPriority = rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority

      if (normalizedLeftPriority !== normalizedRightPriority) {
        return normalizedLeftPriority - normalizedRightPriority
      }

      return right.score - left.score
    })
    .slice(0, 3)
    .map((match) => match.moduleId)
}

function formatModuleList(moduleIds: BillingModuleId[]): string {
  const labels = moduleIds.map((moduleId) => BILLING_MODULE_LABELS[moduleId])

  if (labels.length === 0) return 'another module'
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`

  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`
}

function buildRefusal(
  selectedModule: ScopeGuardModuleId,
  blockedBy: ScopeRefusalResult['blockedBy'],
  confidence: number,
  reason: string,
  candidateMatches: ScopeMatch[]
): ScopeRefusalResult {
  const suggestedModules = sortSuggestions(selectedModule, candidateMatches)
  const selectedLabel = BILLING_MODULE_LABELS[selectedModule]
  const selectedSummary = MODULE_SCOPE_REGISTRY[selectedModule].summary
  const redirectText = formatModuleList(suggestedModules)
  const primarySuggestion = suggestedModules[0]
    ? MODULE_SCOPE_REGISTRY[suggestedModules[0]].summary
    : 'a different specialist task'

  return {
    kind: 'scope_refusal',
    moduleId: selectedModule,
    blockedBy,
    confidence,
    reason,
    message: `${selectedLabel} focuses on ${selectedSummary}. This prompt looks closer to ${primarySuggestion}. Try ${redirectText} instead.`,
    suggestedModules,
  }
}

function shouldDeterministicallyBlock(
  selectedModule: ScopeGuardModuleId,
  selectedMatch: ScopeMatch,
  foreignMatch: ScopeMatch | undefined,
  features: PromptFeatures
): boolean {
  if (!foreignMatch) return false

  if (selectedModule === 'full-launch') {
    return foreignMatch.moduleId === 'marketing' && foreignMatch.score >= 7
  }

  if (!features.hasTaskIntent) return false
  if (foreignMatch.deliverableHits.length === 0) return false

  return foreignMatch.score >= 7 && foreignMatch.score >= selectedMatch.score + 4
}

function shouldRunClassifier(
  selectedModule: ScopeGuardModuleId,
  selectedMatch: ScopeMatch,
  foreignMatch: ScopeMatch | undefined,
  features: PromptFeatures
): boolean {
  if (!foreignMatch) return false
  if (selectedModule === 'general' || selectedModule === 'full-launch') return false
  if (!features.hasTaskIntent) return false
  if (foreignMatch.deliverableHits.length === 0) return false

  return foreignMatch.score >= 5 && foreignMatch.score >= selectedMatch.score + 3
}

async function classifySuspiciousPrompt(
  selectedModule: ScopeGuardModuleId,
  prompt: string,
  selectedMatch: ScopeMatch,
  candidateMatches: ScopeMatch[],
  existingOutput: boolean
): Promise<z.infer<typeof CLASSIFIER_SCHEMA> | null> {
  const model = getFlashModel(400)
  const candidates = [selectedModule, ...candidateMatches.slice(0, 3).map((match) => match.moduleId)]
  const moduleDescriptions = [...new Set(candidates)]
    .map((moduleId) => {
      const definition = MODULE_SCOPE_REGISTRY[moduleId]
      return `- ${moduleId}: ${definition.summary}`
    })
    .join('\n')

  const chat = model.startChat({
    history: [],
    systemInstruction: {
      role: 'system',
      parts: [{
        text: `You are a Forze module scope classifier.

Only block when the user's request is clearly a better fit for another module than the selected module.
If the request is ambiguous, mixed, or plausibly belongs to the selected module, allow it.
Continuations and valid edits should be allowed.

Return ONLY JSON:
{
  "blocked": boolean,
  "confidence": number,
  "reason": "short reason",
  "betterFitModules": ["module-id"]
}`,
      }],
    },
  })

  const response = await withTimeout(
    chat.sendMessage(
      `Selected module: ${selectedModule}
Selected module score: ${selectedMatch.score}
Existing output for selected module: ${existingOutput ? 'yes' : 'no'}
Prompt: "${prompt}"

Candidate modules:
${moduleDescriptions}

If this prompt is clearly asking for another module's primary deliverable, block it.
If not, allow it.`
    ),
    10000
  )

  const parsed = CLASSIFIER_SCHEMA.safeParse(extractJSON(response.response.text()))
  if (!parsed.success) return null

  return parsed.data
}

export async function evaluateModuleScope({
  moduleId,
  prompt,
  context,
  isContinuation = false,
  mode = 'run',
}: EvaluateModuleScopeOptions): Promise<ModuleScopeDecision> {
  if (moduleId === 'general' || isContinuation) {
    return { allowed: true }
  }

  const features = getPromptFeatures(prompt)
  const matches = getAllMatches(features)
  const selectedMatch = matches.find((match) => match.moduleId === moduleId) ?? {
    moduleId,
    score: 0,
    deliverableHits: [],
    keywordHits: [],
  }
  const foreignMatches = matches.filter((match) => match.moduleId !== moduleId && match.score > 0)
  const strongestForeign = foreignMatches[0]

  if (shouldAllowEditBypass(moduleId, features, context, strongestForeign)) {
    return { allowed: true }
  }

  if (selectedModuleLooksValid(moduleId, selectedMatch, features)) {
    return { allowed: true }
  }

  if (shouldDeterministicallyBlock(moduleId, selectedMatch, strongestForeign, features)) {
    return {
      allowed: false,
      refusal: buildRefusal(
        moduleId,
        'deterministic',
        0.96,
        `Prompt strongly matches ${BILLING_MODULE_LABELS[strongestForeign!.moduleId]}.`,
        foreignMatches
      ),
    }
  }

  if (mode === 'preflight' || !shouldRunClassifier(moduleId, selectedMatch, strongestForeign, features)) {
    return { allowed: true }
  }

  try {
    const classifierResult = await classifySuspiciousPrompt(
      moduleId,
      prompt,
      selectedMatch,
      foreignMatches,
      hasExistingOutput(moduleId, context)
    )

    if (!classifierResult?.blocked || classifierResult.confidence < 0.8) {
      return { allowed: true }
    }

    const suggestedMatches = classifierResult.betterFitModules.length > 0
      ? foreignMatches.filter((match) => classifierResult.betterFitModules.includes(match.moduleId))
      : foreignMatches

    return {
      allowed: false,
      refusal: buildRefusal(
        moduleId,
        'classifier',
        classifierResult.confidence,
        classifierResult.reason,
        suggestedMatches.length > 0 ? suggestedMatches : foreignMatches
      ),
    }
  } catch {
    return { allowed: true }
  }
}

function selectedModuleLooksValid(
  moduleId: ScopeGuardModuleId,
  selectedMatch: ScopeMatch,
  features: PromptFeatures
): boolean {
  if (moduleId === 'full-launch') {
    return features.hasBroadLaunchIntent || selectedMatch.score > 0
  }

  if (selectedMatch.score <= 0) return false

  if (selectedMatch.deliverableHits.length > 0) return true

  return selectedMatch.keywordHits.length > 0 && features.hasAnalysisIntent
}
