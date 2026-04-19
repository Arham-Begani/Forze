// lib/queries.ts
import { createDb } from '@/lib/db'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  let lastError: any
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
      }
    }
  }
  throw lastError
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SourceDocument {
  name: string
  content: string
  type: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string
  icon: string
  status: 'active' | 'archived'
  global_idea: string | null
  source_documents: SourceDocument[]
  created_at: string
  updated_at: string
}

export interface Venture {
  id: string
  user_id: string
  project_id: string | null
  name: string
  context: VentureContext
  created_at: string
  updated_at: string
}

export interface VentureContext {
  research: Record<string, unknown> | null
  branding: Record<string, unknown> | null
  marketing: Record<string, unknown> | null
  landing: Record<string, unknown> | null
  feasibility: Record<string, unknown> | null
  shadowBoard?: Record<string, unknown> | null
  investorKit?: Record<string, unknown> | null
  launchAutopilot?: Record<string, unknown> | null
  mvpScalpel?: Record<string, unknown> | null
}

export interface Conversation {
  id: string
  venture_id: string
  module_id: 'research' | 'branding' | 'marketing' | 'landing' | 'feasibility' | 'full-launch' | 'general' | 'shadow-board' | 'investor-kit' | 'launch-autopilot' | 'mvp-scalpel'
  prompt: string
  status: 'running' | 'complete' | 'failed'
  stream_output: string[]
  result: Record<string, unknown>
  created_at: string
}

const LEGACY_CONVERSATION_MODULE_IDS = new Set<Conversation['module_id']>([
  'research',
  'branding',
  'marketing',
  'landing',
  'feasibility',
  'full-launch',
])

const CONVERSATION_MODULE_FALLBACK: Record<Conversation['module_id'], Conversation['module_id']> = {
  research: 'research',
  branding: 'branding',
  marketing: 'marketing',
  landing: 'landing',
  feasibility: 'feasibility',
  'full-launch': 'full-launch',
  general: 'research',
  'shadow-board': 'feasibility',
  'investor-kit': 'marketing',
  'launch-autopilot': 'landing',
  'mvp-scalpel': 'feasibility',
}

const CONVERSATION_MODULE_PREFIX = '__FORZE_MODULE__:'

function encodeConversationPrompt(moduleId: Conversation['module_id'], prompt: string): string {
  if (LEGACY_CONVERSATION_MODULE_IDS.has(moduleId)) return prompt
  return `${CONVERSATION_MODULE_PREFIX}${moduleId}\n${prompt}`
}

function decodeConversationModuleId(
  storedModuleId: Conversation['module_id'],
  prompt: string
): Conversation['module_id'] {
  if (!prompt.startsWith(CONVERSATION_MODULE_PREFIX)) return storedModuleId

  const newlineIndex = prompt.indexOf('\n')
  const encodedModuleId = (newlineIndex === -1
    ? prompt.slice(CONVERSATION_MODULE_PREFIX.length)
    : prompt.slice(CONVERSATION_MODULE_PREFIX.length, newlineIndex)
  ).trim() as Conversation['module_id']

  return encodedModuleId || storedModuleId
}

function decodeConversationPrompt(prompt: string): string {
  if (!prompt.startsWith(CONVERSATION_MODULE_PREFIX)) return prompt
  const newlineIndex = prompt.indexOf('\n')
  return newlineIndex === -1 ? '' : prompt.slice(newlineIndex + 1)
}

function normalizeConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    module_id: decodeConversationModuleId(conversation.module_id, conversation.prompt),
    prompt: decodeConversationPrompt(conversation.prompt),
  }
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function createProject(
  userId: string,
  name: string,
  description = '',
  icon = '💡'
): Promise<Project> {
  return withRetry(async () => {
    const db = await createDb()
    const { data, error } = await db
      .from('projects')
      .insert({ user_id: userId, name, description, icon, status: 'active' })
      .select()
      .single()

    if (error) throw new Error(`createProject failed: ${error.message}`)
    return data
  })
}

export async function getProjectsByUser(userId: string): Promise<Project[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getProjectsByUser failed: ${error.message}`)
  return data ?? []
}

export async function getProject(id: string, userId: string): Promise<Project | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) return null
  return data
}

export async function updateProject(
  id: string,
  updates: { name?: string; description?: string; icon?: string; status?: 'active' | 'archived'; global_idea?: string; source_documents?: SourceDocument[] }
): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`updateProject failed: ${error.message}`)
}

export async function deleteProject(id: string): Promise<void> {
  const db = await createDb()
  const { error } = await db.from('projects').delete().eq('id', id)
  if (error) throw new Error(`deleteProject failed: ${error.message}`)
}

// ─── Ventures ─────────────────────────────────────────────────────────────────

export async function createVenture(userId: string, name: string, projectId?: string): Promise<Venture> {
  return withRetry(async () => {
    const db = await createDb()
    const insertData: Record<string, unknown> = {
      user_id: userId,
      name,
      context: {
        research: null,
        branding: null,
        marketing: null,
        landing: null,
        feasibility: null,
        shadowBoard: null,
        investorKit: null,
        launchAutopilot: null,
        mvpScalpel: null,
      },
    }
    if (projectId) insertData.project_id = projectId

    const { data, error } = await db
      .from('ventures')
      .insert(insertData)
      .select()
      .single()

    if (error) throw new Error(`createVenture failed: ${error.message}`)
    return data
  })
}

export async function getVenturesByUser(userId: string): Promise<Venture[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('ventures')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getVenturesByUser failed: ${error.message}`)
  return data ?? []
}

export async function getVenturesByProject(projectId: string): Promise<Venture[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('ventures')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getVenturesByProject failed: ${error.message}`)
  return data ?? []
}

export async function getVenture(id: string, userId: string): Promise<Venture | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('ventures')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) return null
  return data
}

export async function updateVentureName(id: string, name: string): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('ventures')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`updateVentureName failed: ${error.message}`)
}

export async function updateVentureContext(
  id: string,
  contextKey: 'research' | 'branding' | 'marketing' | 'landing' | 'feasibility' | 'shadowBoard' | 'investorKit' | 'launchAutopilot' | 'mvpScalpel',
  value: unknown
): Promise<void> {
  return withRetry(async () => {
    const db = await createDb()

    // Fetch existing context first, then merge atomically
    const { data: venture, error: fetchError } = await db
      .from('ventures')
      .select('context')
      .eq('id', id)
      .single()

    if (fetchError) throw new Error(`updateVentureContext fetch failed: ${fetchError.message}`)

    const updatedContext = { ...venture.context, [contextKey]: value }

    const { error } = await db
      .from('ventures')
      .update({ context: updatedContext, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw new Error(`updateVentureContext update failed: ${error.message}`)
  })
}

export async function deleteVenture(id: string): Promise<void> {
  const db = await createDb()
  const { error } = await db.from('ventures').delete().eq('id', id)
  if (error) throw new Error(`deleteVenture failed: ${error.message}`)
}

// ─── Conversations ─────────────────────────────────────────────────────────────

export async function createConversation(
  ventureId: string,
  moduleId: Conversation['module_id'],
  prompt: string
): Promise<Conversation> {
  return withRetry(async () => {
    const db = await createDb()
    const storedModuleId = CONVERSATION_MODULE_FALLBACK[moduleId]
    const storedPrompt = encodeConversationPrompt(moduleId, prompt)
    const { data, error } = await db
      .from('conversations')
      .insert({ venture_id: ventureId, module_id: storedModuleId, prompt: storedPrompt, status: 'running', stream_output: [], result: {} })
      .select()
      .single()

    if (error) throw new Error(`createConversation failed: ${error.message}`)
    return normalizeConversation(data)
  })
}

export async function updateConversationStatus(
  id: string,
  status: 'running' | 'complete' | 'failed'
): Promise<void> {
  const db = await createDb()
  const { error } = await db.from('conversations').update({ status }).eq('id', id)
  if (error) throw new Error(`updateConversationStatus failed: ${error.message}`)
}

export async function appendStreamLine(id: string, line: string): Promise<void> {
  const db = await createDb()

  // Use atomic RPC to append to stream_output array and prevent race conditions
  const { error } = await db.rpc('append_to_jsonb_array', {
    table_name: 'conversations',
    id_val: id,
    col_name: 'stream_output',
    new_value: line,
  })

  if (!error) return

  // Fallback: read-modify-write (non-atomic but acceptable for stream output)
  // Triggers when the DB function hasn't been deployed yet
  const { data, error: readError } = await db
    .from('conversations')
    .select('stream_output')
    .eq('id', id)
    .single()
  if (readError) throw new Error(`appendStreamLine failed: ${readError.message}`)
  const current = Array.isArray(data?.stream_output) ? data.stream_output : []
  const { error: writeError } = await db
    .from('conversations')
    .update({ stream_output: [...current, line] })
    .eq('id', id)
  if (writeError) throw new Error(`appendStreamLine failed: ${writeError.message}`)
}

export async function setConversationResult(
  id: string,
  result: Record<string, unknown>
): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('conversations')
    .update({ result, status: 'complete' })
    .eq('id', id)

  if (error) throw new Error(`setConversationResult failed: ${error.message}`)
}

export async function patchConversationResult(
  id: string,
  path: string[],
  oldText: string,
  newText: string
): Promise<Record<string, unknown>> {
  const db = await createDb()
  const { data, error } = await db
    .from('conversations')
    .select('result')
    .eq('id', id)
    .single()

  if (error || !data) throw new Error(`patchConversationResult: conversation not found`)

  const result = structuredClone(data.result) as Record<string, unknown>

  // Walk the JSON path to find the target field
  let target: any = result
  for (let i = 0; i < path.length - 1; i++) {
    if (target == null || typeof target !== 'object') {
      throw new Error(`patchConversationResult: invalid path at segment "${path[i]}"`)
    }
    target = target[path[i]]
  }

  const lastKey = path[path.length - 1]
  if (target == null || typeof target !== 'object' || !(lastKey in target)) {
    throw new Error(`patchConversationResult: field "${lastKey}" not found`)
  }

  const currentValue = String(target[lastKey])
  if (!currentValue.includes(oldText)) {
    throw new Error(`patchConversationResult: old text not found in field`)
  }

  target[lastKey] = currentValue.replace(oldText, newText)

  const { error: updateError } = await db
    .from('conversations')
    .update({ result })
    .eq('id', id)

  if (updateError) throw new Error(`patchConversationResult failed: ${updateError.message}`)
  return result
}

export async function getConversationsByModule(
  ventureId: string,
  moduleId: Conversation['module_id']
): Promise<Conversation[]> {
  const db = await createDb()
  const storedModuleId = CONVERSATION_MODULE_FALLBACK[moduleId]
  const { data, error } = await db
    .from('conversations')
    .select('*')
    .eq('venture_id', ventureId)
    .eq('module_id', storedModuleId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getConversationsByModule failed: ${error.message}`)
  return (data ?? []).map(normalizeConversation).filter(conversation => conversation.module_id === moduleId)
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return normalizeConversation(data)
}

// ─── User Ideas ───────────────────────────────────────────────────────────────

export async function getUserIdea(userId: string): Promise<string | null> {
  const db = await createDb()
  const { data } = await db
    .from('user_ideas')
    .select('idea_text')
    .eq('user_id', userId)
    .single()
  return data?.idea_text ?? null
}

export async function setUserIdea(userId: string, ideaText: string): Promise<void> {
  return withRetry(async () => {
    const db = await createDb()
    const { error } = await db
      .from('user_ideas')
      .upsert(
        { user_id: userId, idea_text: ideaText, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    if (error) throw new Error(`setUserIdea failed: ${error.message}`)
  })
}

// Public venture lookup (no auth required — used for /v/[id] live preview)
export async function getVenturePublic(id: string): Promise<Venture | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('ventures')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export async function getConversationsByVenture(ventureId: string): Promise<Conversation[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('conversations')
    .select('*')
    .eq('venture_id', ventureId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getConversationsByVenture failed: ${error.message}`)
  return (data ?? []).map(normalizeConversation)
}

// ─── Investor Kits ────────────────────────────────────────────────────────────

export interface InvestorKit {
  id: string
  venture_id: string
  user_id: string
  access_code: string
  kit_data: Record<string, unknown>
  is_active: boolean
  views: number
  has_manual_edits: boolean
  last_edited_at: string | null
  created_at: string
}

export async function createInvestorKit(
  ventureId: string,
  userId: string,
  accessCode: string,
  kitData: Record<string, unknown>
): Promise<InvestorKit> {
  return withRetry(async () => {
    const db = await createDb()
    const { data, error } = await db
      .from('investor_kits')
      .insert({ venture_id: ventureId, user_id: userId, access_code: accessCode, kit_data: kitData })
      .select()
      .single()

    if (error) throw new Error(`createInvestorKit failed: ${error.message}`)
    return data
  })
}

export async function getInvestorKitByVenture(ventureId: string): Promise<InvestorKit | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('investor_kits')
    .select('*')
    .eq('venture_id', ventureId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data
}

export async function getInvestorKitByCode(code: string): Promise<(InvestorKit & { venture: Venture }) | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('investor_kits')
    .select('*, venture:ventures(*)')
    .eq('access_code', code)
    .eq('is_active', true)
    .single()

  if (error) return null
  return data as any
}

export async function incrementKitViews(kitId: string): Promise<void> {
  const db = await createDb()
  
  // Try atomic RPC first to prevent race conditions
  const { error } = await db.rpc('increment_int_column', {
    table_name: 'investor_kits',
    id_val: kitId,
    col_name: 'views',
  })

  if (!error) return

  // Fallback: read-modify-write when RPC not available (acceptable for views)
  const { data, error: readError } = await db
    .from('investor_kits')
    .select('views')
    .eq('id', kitId)
    .single()

  if (readError) return

  const { error: writeError } = await db
    .from('investor_kits')
    .update({ views: (data.views ?? 0) + 1 })
    .eq('id', kitId)

  if (writeError) console.error('incrementKitViews failed:', writeError.message)
}

export async function updateInvestorKit(
  kitId: string,
  userId: string,
  patch: Record<string, unknown>
): Promise<InvestorKit> {
  return withRetry(async () => {
    const db = await createDb()

    // Fetch current kit to merge patch into existing kit_data
    const { data: existing, error: fetchError } = await db
      .from('investor_kits')
      .select('*')
      .eq('id', kitId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existing) throw new Error(`Kit not found: ${fetchError?.message}`)

    const mergedData = { ...existing.kit_data, ...patch }

    const { data, error } = await db
      .from('investor_kits')
      .update({
        kit_data: mergedData,
        has_manual_edits: true,
        last_edited_at: new Date().toISOString(),
      })
      .eq('id', kitId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new Error(`updateInvestorKit failed: ${error.message}`)
    return data
  })
}

// ─── Cohorts ──────────────────────────────────────────────────────────────────

export interface Cohort {
  id: string
  user_id: string
  project_id: string | null
  name: string
  core_idea: string
  variant_ids: string[]
  winner_id: string | null
  comparison: Record<string, unknown> | null
  status: 'draft' | 'running' | 'comparing' | 'complete'
  created_at: string
  updated_at: string
}

export async function getCohortsByUser(userId: string): Promise<Cohort[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('cohorts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getCohortsByUser failed: ${error.message}`)
  return data ?? []
}

export async function getCohortById(cohortId: string): Promise<Cohort | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('cohorts')
    .select('*')
    .eq('id', cohortId)
    .single()

  if (error) return null
  return data
}

export async function createCohort(
  userId: string,
  name: string,
  coreIdea: string,
  projectId?: string
): Promise<Cohort> {
  return withRetry(async () => {
    const db = await createDb()
    const insertData: Record<string, unknown> = {
      user_id: userId,
      name,
      core_idea: coreIdea,
    }
    if (projectId) insertData.project_id = projectId

    const { data, error } = await db
      .from('cohorts')
      .insert(insertData)
      .select()
      .single()

    if (error) throw new Error(`createCohort failed: ${error.message}`)
    return data
  })
}

export async function updateCohortVariants(cohortId: string, variantIds: string[]): Promise<void> {
  const db = await createDb()
  
  // Try atomic RPC first to prevent race conditions
  const { error: rpcError } = await db.rpc('set_cohort_variants', {
    cohort_id_val: cohortId,
    variant_ids_array: variantIds,
  })

  if (!rpcError) return

  // Fallback: direct update when RPC not available
  const { error } = await db
    .from('cohorts')
    .update({ variant_ids: variantIds, updated_at: new Date().toISOString() })
    .eq('id', cohortId)

  if (error) throw new Error(`updateCohortVariants failed: ${error.message}`)
}

export async function updateCohortStatus(cohortId: string, status: string): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('cohorts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', cohortId)

  if (error) throw new Error(`updateCohortStatus failed: ${error.message}`)
}

export async function updateCohortComparison(cohortId: string, comparison: Record<string, unknown>): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('cohorts')
    .update({ comparison, updated_at: new Date().toISOString() })
    .eq('id', cohortId)

  if (error) throw new Error(`updateCohortComparison failed: ${error.message}`)
}

export async function setCohortWinner(cohortId: string, winnerId: string): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('cohorts')
    .update({ winner_id: winnerId, status: 'complete', updated_at: new Date().toISOString() })
    .eq('id', cohortId)

  if (error) throw new Error(`setCohortWinner failed: ${error.message}`)
}
