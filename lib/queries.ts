// lib/queries.ts
import { createDb } from '@/lib/db'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Venture {
  id: string
  user_id: string
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
  module_id: 'research' | 'branding' | 'marketing' | 'landing' | 'feasibility' | 'full-launch'
  prompt: string
  status: 'running' | 'complete' | 'failed'
  stream_output: string[]
  result: Record<string, unknown>
  created_at: string
}

// ─── Ventures ─────────────────────────────────────────────────────────────────

export async function createVenture(userId: string, name: string): Promise<Venture> {
  const db = await createDb()
  const { data, error } = await db
    .from('ventures')
    .insert({ user_id: userId, name, context: { research: null, branding: null, marketing: null, landing: null, feasibility: null } })
    .select()
    .single()

  if (error) throw new Error(`createVenture failed: ${error.message}`)
  return data
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
  const db = await createDb()
  const { data, error } = await db
    .from('conversations')
    .insert({ venture_id: ventureId, module_id: moduleId, prompt, status: 'running', stream_output: [], result: {} })
    .select()
    .single()

  if (error) throw new Error(`createConversation failed: ${error.message}`)
  return data
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