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

export interface Project {
  id: string
  user_id: string
  name: string
  description: string
  icon: string
  status: 'active' | 'archived'
  global_idea: string | null
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
}

export interface Conversation {
  id: string
  venture_id: string
  module_id: 'research' | 'branding' | 'marketing' | 'landing' | 'feasibility' | 'full-launch' | 'general' | 'shadow-board' | 'investor-kit'
  prompt: string
  status: 'running' | 'complete' | 'failed'
  stream_output: string[]
  result: Record<string, unknown>
  created_at: string
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function createProject(
  userId: string,
  name: string,
  description = '',
  icon = '🚀'
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
  updates: { name?: string; description?: string; icon?: string; status?: 'active' | 'archived'; global_idea?: string }
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
      context: { research: null, branding: null, marketing: null, landing: null, feasibility: null },
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
  contextKey: 'research' | 'branding' | 'marketing' | 'landing' | 'feasibility',
  value: unknown
): Promise<void> {
  const db = await createDb()

  // Fetch existing context first, then merge
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
    const { data, error } = await db
      .from('conversations')
      .insert({ venture_id: ventureId, module_id: moduleId, prompt, status: 'running', stream_output: [], result: {} })
      .select()
      .single()

    if (error) throw new Error(`createConversation failed: ${error.message}`)
    return data
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

  // Fetch current stream_output, append, write back
  const { data, error: fetchError } = await db
    .from('conversations')
    .select('stream_output')
    .eq('id', id)
    .single()

  if (fetchError) throw new Error(`appendStreamLine fetch failed: ${fetchError.message}`)

  const updated = [...(data.stream_output ?? []), line]

  const { error } = await db
    .from('conversations')
    .update({ stream_output: updated })
    .eq('id', id)

  if (error) throw new Error(`appendStreamLine update failed: ${error.message}`)
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

export async function getConversationsByModule(
  ventureId: string,
  moduleId: Conversation['module_id']
): Promise<Conversation[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('conversations')
    .select('*')
    .eq('venture_id', ventureId)
    .eq('module_id', moduleId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getConversationsByModule failed: ${error.message}`)
  return data ?? []
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
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
  return data ?? []
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
  const { data, error: fetchError } = await db
    .from('investor_kits')
    .select('views')
    .eq('id', kitId)
    .single()

  if (fetchError) return

  const { error } = await db
    .from('investor_kits')
    .update({ views: (data.views ?? 0) + 1 })
    .eq('id', kitId)

  if (error) console.error('incrementKitViews failed:', error.message)
}