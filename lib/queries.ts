// lib/queries.ts
import 'server-only'

import { createDb } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'

// Service-role client used for explicitly-public lookups (subdomain previews,
// `/v/[id]` previews, public feedback pages). The default `createDb()` client
// is cookie-scoped and respects RLS — so on a tenant subdomain like
// `<slug>.forze.in`, the user's auth cookie isn't sent and every read returns
// zero rows. Routes that must work for anonymous visitors should call the
// `*Public` helpers below, which use the admin client and bypass RLS.
function createPublicClient() {
  return createAdminClient()
}

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
  subdomain: string | null
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

export function slugifyVentureName(name: string): string {
  const slug = (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, 32)
  return slug || 'venture'
}

// Returns a unique subdomain, or null if the `subdomain` column doesn't
// exist yet (migration 023 not applied) — caller treats null as "skip".
async function generateUniqueSubdomain(name: string): Promise<string | null> {
  const db = await createDb()
  const base = slugifyVentureName(name)
  let candidate = base
  let attempt = 0

  while (attempt < 8) {
    const { data, error } = await db
      .from('ventures')
      .select('id')
      .ilike('subdomain', candidate)
      .limit(1)
      .maybeSingle()

    // Column missing → migration not run. Skip subdomain assignment silently.
    if (error && /subdomain/i.test(error.message || '')) return null
    if (!data) return candidate

    attempt++
    const suffix = Math.random().toString(36).slice(2, 7)
    candidate = `${base.slice(0, 26)}-${suffix}`
  }
  return `${base.slice(0, 24)}-${Date.now().toString(36)}`
}

// Seed the owner's venture_members row for a freshly created venture. Uses the
// admin (service-role) client because venture_members has RLS enabled with no
// INSERT policy, so the cookie-scoped session client cannot write its own
// membership row. Idempotent (UNIQUE(venture_id,user_id)) and non-fatal: if the
// table is missing or the write fails, getVentureAccess() still falls back to
// ventures.user_id ownership, so the owner is never locked out. This closes the
// gap that previously left every post-migration-024 venture without an owner
// membership row (which surfaced as "Not found" on every module run).
async function ensureVentureOwnerMembership(ventureId: string, userId: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin
      .from('venture_members')
      .upsert(
        { venture_id: ventureId, user_id: userId, role: 'owner' },
        { onConflict: 'venture_id,user_id', ignoreDuplicates: true },
      )
    if (error) {
      console.warn('[ensureVentureOwnerMembership] could not seed owner row:', error.message)
    }
  } catch (err) {
    console.warn('[ensureVentureOwnerMembership] admin client unavailable:', err instanceof Error ? err.message : err)
  }
}

export async function createVenture(userId: string, name: string, projectId?: string): Promise<Venture> {
  return withRetry(async () => {
    const db = await createDb()
    const subdomain = await generateUniqueSubdomain(name)
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
    if (subdomain) insertData.subdomain = subdomain
    if (projectId) insertData.project_id = projectId

    const { data, error } = await db
      .from('ventures')
      .insert(insertData)
      .select()
      .single()

    // If the DB still complains about the subdomain column (e.g. column was
    // dropped or the schema cache is stale), retry once without it so venture
    // creation never blocks on a half-applied migration.
    if (error && /subdomain/i.test(error.message || '')) {
      delete insertData.subdomain
      const retry = await db.from('ventures').insert(insertData).select().single()
      if (retry.error) throw new Error(`createVenture failed: ${retry.error.message}`)
      await ensureVentureOwnerMembership(retry.data.id, userId)
      return retry.data
    }

    if (error) throw new Error(`createVenture failed: ${error.message}`)
    await ensureVentureOwnerMembership(data.id, userId)
    return data
  })
}

function isMissingRelationError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  if (err.code === '42P01') return true
  const msg = (err.message || '').toLowerCase()
  return msg.includes('venture_members') && (msg.includes('does not exist') || msg.includes('relation'))
}

async function getVenturesByUserLegacy(userId: string): Promise<Venture[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('ventures')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`getVenturesByUser legacy fallback failed: ${error.message}`)
  return data ?? []
}

export async function getVenturesByUser(userId: string): Promise<Venture[]> {
  const db = await createDb()

  // Get all venture IDs the user is a member of
  const { data: members, error: membersError } = await db
    .from('venture_members')
    .select('venture_id')
    .eq('user_id', userId)

  // If venture_members table doesn't exist yet (migration 024 not applied),
  // fall back to the legacy ventures.user_id lookup so the app still works.
  if (membersError) {
    if (isMissingRelationError(membersError)) return getVenturesByUserLegacy(userId)
    throw new Error(`getVenturesByUser members fetch failed: ${membersError.message}`)
  }

  if (!members || members.length === 0) return []

  const ventureIds = members.map(m => m.venture_id)

  const { data, error } = await db
    .from('ventures')
    .select('*')
    .in('id', ventureIds)
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

  // Verify access via venture_members (with legacy fallback to ventures.user_id)
  const role = await getVentureAccess(id, userId)
  if (!role) return null

  const { data, error } = await db
    .from('ventures')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function getVentureAccess(ventureId: string, userId: string): Promise<'owner' | 'admin' | 'editor' | 'viewer' | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('venture_members')
    .select('role')
    .eq('venture_id', ventureId)
    .eq('user_id', userId)
    .maybeSingle()

  if (data && !error) return data.role as 'owner' | 'admin' | 'editor' | 'viewer'

  // Owner fallback via ventures.user_id. This runs whenever the membership
  // lookup did NOT resolve a role — because the table is missing (migration
  // 024 not applied), the query errored, OR (the common case) no
  // venture_members row was ever written for this owner. The 024 backfill only
  // seeded ventures that existed when it ran, and createVenture historically
  // never inserted an owner row, so any venture created afterward had no
  // membership row. Without this fallback getVenture() returns null for the
  // true owner and EVERY module run dies with a bare "Not found". Access stays
  // owner-scoped: 'owner' is granted only when the ventures row's user_id
  // matches the caller (a security check, not just a convenience).
  const { data: legacy } = await db
    .from('ventures')
    .select('user_id')
    .eq('id', ventureId)
    .maybeSingle()
  if (legacy && legacy.user_id === userId) return 'owner'

  return null
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

    // Atomic single-statement merge via RPC (migration 008, hardened in 045).
    // Two modules finishing at the same time (e.g. landing + shadow board)
    // each set their own context key without clobbering the other's — the
    // old SELECT → spread → UPDATE below loses whichever write lands first.
    const { error: rpcError } = await db.rpc('merge_venture_context', {
      venture_id_val: id,
      context_key: contextKey,
      context_value: value,
    })
    if (!rpcError) return

    // Fallback: read-modify-write (non-atomic) — only when the RPC isn't
    // deployed on this DB. Identical to the pre-atomic behavior.
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
  let query = db.from('conversations').update({ status }).eq('id', id)
  // A run may only COMPLETE from 'running' — a late-finishing agent must not
  // resurrect a conversation the user already cancelled (status='failed').
  // Failure writes stay unguarded so error paths and the sweeper always win.
  if (status === 'complete') query = query.eq('status', 'running')
  const { error } = await query
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
  // Guarded transition: only a still-'running' conversation may complete.
  // If the user cancelled (status flipped to 'failed') while the agent was
  // finishing, this matches zero rows and the cancel is honored — a silent
  // no-op, deliberately not an error. Every live caller writes while the
  // row is 'running' (run route completion + scope-refusal paths).
  const { error } = await db
    .from('conversations')
    .update({ result, status: 'complete' })
    .eq('id', id)
    .eq('status', 'running')

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

// Public venture lookup (no auth required — used for /v/[id] live preview,
// the public feedback form, and the deployment-URL resolver). Uses the
// service-role admin client to bypass RLS, because anonymous visitors on the
// public preview routes have no Supabase auth cookie.
export async function getVenturePublic(id: string): Promise<Venture | null> {
  try {
    const db = createPublicClient()
    const { data, error } = await db
      .from('ventures')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[getVenturePublic] query failed:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.error('[getVenturePublic] admin client unavailable:', err instanceof Error ? err.message : err)
    return null
  }
}

// Public venture lookup by subdomain — used for wildcard subdomain routing.
// Uses the service-role admin client to bypass RLS so requests on a tenant
// subdomain (where the user's auth cookie isn't sent) can resolve to a row.
export async function getVentureBySubdomain(subdomain: string): Promise<Venture | null> {
  if (!subdomain) return null
  try {
    const db = createPublicClient()
    const { data, error } = await db
      .from('ventures')
      .select('*')
      .ilike('subdomain', subdomain)
      .maybeSingle()

    if (error) {
      console.error('[getVentureBySubdomain] query failed:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.error('[getVentureBySubdomain] admin client unavailable:', err instanceof Error ? err.message : err)
    return null
  }
}

// Read landing conversations for a venture using the service-role client —
// for use ONLY by public preview routes that must work without auth cookies.
// Returns [] on any error so callers can degrade to context.landing.
export async function getLandingConversationsPublic(ventureId: string): Promise<Conversation[]> {
  try {
    const db = createPublicClient()
    const storedModuleId = CONVERSATION_MODULE_FALLBACK['landing']
    const { data, error } = await db
      .from('conversations')
      .select('*')
      .eq('venture_id', ventureId)
      .eq('module_id', storedModuleId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[getLandingConversationsPublic] query failed:', error.message)
      return []
    }
    return (data ?? []).map(normalizeConversation).filter(c => c.module_id === 'landing')
  } catch (err) {
    console.error('[getLandingConversationsPublic] admin client unavailable:', err instanceof Error ? err.message : err)
    return []
  }
}

export async function updateVentureSubdomain(id: string, subdomain: string): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('ventures')
    .update({ subdomain, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`updateVentureSubdomain failed: ${error.message}`)
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

// ─── CRM ──────────────────────────────────────────────────────────────────────

export interface Lead {
  id: string
  venture_id: string
  // Nullable since 035_crm_leads_unify_social.sql: a lead is reachable by
  // email OR external_identity (e.g. an Instagram commenter with no email).
  email: string | null
  name: string | null
  status: 'new' | 'contacted' | 'qualified' | 'lost' | 'won'
  source: string
  external_identity: string | null
  company: string | null
  phone: string | null
  tags: string[]
  owner_id: string | null
  created_at: string
}

export interface LeadActivity {
  id: string
  lead_id: string
  venture_id: string
  actor_id: string | null
  type: 'note' | 'status_change' | 'field_change' | 'email_sent' | 'deal_stage_change'
  body: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface PipelineStage {
  id: string
  venture_id: string
  name: string
  position: number
  is_won: boolean
  is_lost: boolean
  color: string | null
  created_at: string
}

export interface Deal {
  id: string
  venture_id: string
  lead_id: string
  stage_id: string
  title: string
  value: number | null
  probability: number | null
  expected_close_date: string | null
  lost_reason: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
}

export interface OutreachReply {
  id: string
  outreach_message_id: string
  lead_id: string
  gmail_message_id: string
  gmail_thread_id: string
  from_email: string | null
  subject: string | null
  body: string | null
  reply_type: string | null
  sentiment_score: number | null
  summary: string | null
  received_at: string | null
  created_at: string
}

export interface AnalyticsEvent {
  id: string
  venture_id: string
  event_type: 'pageview' | 'cta_click' | 'form_submit' | string
  metadata: Record<string, unknown>
  created_at: string
}

export interface OutreachCampaign {
  id: string
  venture_id: string
  type: string
  status: 'draft' | 'running' | 'complete'
  sent_count: number
  thread_ids?: string[]
  created_at: string
}

export interface OutreachMessage {
  id: string
  campaign_id: string
  lead_id: string
  google_message_id: string
  google_thread_id: string
  subject: string | null
  body: string | null
  sent_at: string
}

export interface OutreachMessageWithLead extends OutreachMessage {
  lead: Lead | null
}

export async function createLead(ventureId: string, email: string, name?: string, source = 'landing_page'): Promise<Lead> {
  return withRetry(async () => {
    const db = await createDb()
    const { data, error } = await db
      .from('leads')
      .insert({ venture_id: ventureId, email, name, source })
      .select()
      .single()

    if (error) throw new Error(`createLead failed: ${error.message}`)
    return data
  })
}

export async function getLeadsForVenture(ventureId: string): Promise<Lead[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('leads')
    .select('*')
    .eq('venture_id', ventureId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getLeadsForVenture failed: ${error.message}`)
  return data ?? []
}

export async function getLeadById(leadId: string): Promise<Lead | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()

  if (error) return null
  return data
}

export async function updateLeadStatus(leadId: string, status: string): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('leads')
    .update({ status })
    .eq('id', leadId)

  if (error) throw new Error(`updateLeadStatus failed: ${error.message}`)
}

export async function deleteLead(leadId: string): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('leads')
    .delete()
    .eq('id', leadId)

  if (error) throw new Error(`deleteLead failed: ${error.message}`)
}

export async function updateLead(
  leadId: string,
  fields: Partial<Pick<Lead, 'company' | 'phone' | 'tags' | 'owner_id' | 'name'>>
): Promise<Lead> {
  const db = await createDb()
  const { data, error } = await db
    .from('leads')
    .update(fields)
    .eq('id', leadId)
    .select()
    .single()

  if (error) throw new Error(`updateLead failed: ${error.message}`)
  return data
}

export async function bulkUpdateLeadStatus(leadIds: string[], status: Lead['status']): Promise<void> {
  if (leadIds.length === 0) return
  const db = await createDb()
  const { error } = await db
    .from('leads')
    .update({ status })
    .in('id', leadIds)

  if (error) throw new Error(`bulkUpdateLeadStatus failed: ${error.message}`)
}

export async function bulkDeleteLeads(leadIds: string[]): Promise<void> {
  if (leadIds.length === 0) return
  const db = await createDb()
  const { error } = await db
    .from('leads')
    .delete()
    .in('id', leadIds)

  if (error) throw new Error(`bulkDeleteLeads failed: ${error.message}`)
}

// Idempotent upsert for social commenters (e.g. Instagram) materialized into
// `leads` (see 035_crm_leads_unify_social.sql) — one row per
// (venture_id, external_identity), keyed by a "source:handle" identity string.
export async function upsertSocialLead(
  ventureId: string,
  externalIdentity: string,
  fields: { name?: string | null; source: string }
): Promise<Lead> {
  return withRetry(async () => {
    const db = await createDb()
    const { data, error } = await db
      .from('leads')
      .upsert(
        {
          venture_id: ventureId,
          external_identity: externalIdentity,
          name: fields.name ?? null,
          source: fields.source,
        },
        { onConflict: 'venture_id,external_identity', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error) throw new Error(`upsertSocialLead failed: ${error.message}`)
    return data
  })
}

export async function createLeadActivity(input: {
  leadId: string
  ventureId: string
  actorId?: string | null
  type: LeadActivity['type']
  body?: string | null
  metadata?: Record<string, unknown>
}): Promise<LeadActivity> {
  const db = await createDb()
  const { data, error } = await db
    .from('lead_activity')
    .insert({
      lead_id: input.leadId,
      venture_id: input.ventureId,
      actor_id: input.actorId ?? null,
      type: input.type,
      body: input.body ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single()

  if (error) throw new Error(`createLeadActivity failed: ${error.message}`)
  return data
}

export async function getLeadActivityForLead(leadId: string): Promise<LeadActivity[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('lead_activity')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getLeadActivityForLead failed: ${error.message}`)
  return data ?? []
}

export async function createAnalyticsEvent(ventureId: string, eventType: string, metadata: Record<string, unknown> = {}): Promise<AnalyticsEvent> {
  return withRetry(async () => {
    const db = await createDb()
    const { data, error } = await db
      .from('analytics_events')
      .insert({ venture_id: ventureId, event_type: eventType, metadata })
      .select()
      .single()

    if (error) throw new Error(`createAnalyticsEvent failed: ${error.message}`)
    return data
  })
}

export async function getAnalyticsForVenture(ventureId: string): Promise<AnalyticsEvent[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('analytics_events')
    .select('*')
    .eq('venture_id', ventureId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`getAnalyticsForVenture failed: ${error.message}`)
  return data ?? []
}

export async function createOutreachCampaign(
  ventureId: string,
  type: string,
  options: { status?: OutreachCampaign['status']; sentCount?: number } = {}
): Promise<OutreachCampaign> {
  return withRetry(async () => {
    const db = await createDb()
    const payload: Record<string, unknown> = {
      venture_id: ventureId,
      type,
    }
    if (options.status) payload.status = options.status
    if (typeof options.sentCount === 'number') payload.sent_count = options.sentCount

    const { data, error } = await db
      .from('outreach_campaigns')
      .insert(payload)
      .select()
      .single()

    if (error) throw new Error(`createOutreachCampaign failed: ${error.message}`)
    return data
  })
}

export async function updateOutreachCampaign(
  campaignId: string,
  updates: Partial<Pick<OutreachCampaign, 'status' | 'sent_count' | 'thread_ids'>>
): Promise<OutreachCampaign> {
  const db = await createDb()
  const { data, error } = await db
    .from('outreach_campaigns')
    .update(updates)
    .eq('id', campaignId)
    .select()
    .single()

  if (error) throw new Error(`updateOutreachCampaign failed: ${error.message}`)
  return data
}

export async function createOutreachMessage(input: {
  campaignId: string
  leadId: string
  googleMessageId: string
  googleThreadId: string
  // Persisted so analyzeReply() has the original message to compare a reply
  // against (see 039_crm_outreach_replies.sql) — outreach_messages previously
  // stored only IDs/timestamps.
  subject?: string
  body?: string
}): Promise<OutreachMessage> {
  const db = await createDb()
  const { data, error } = await db
    .from('outreach_messages')
    .insert({
      campaign_id: input.campaignId,
      lead_id: input.leadId,
      google_message_id: input.googleMessageId,
      google_thread_id: input.googleThreadId,
      subject: input.subject ?? null,
      body: input.body ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`createOutreachMessage failed: ${error.message}`)
  return data
}

export async function getOutreachCampaignsForVenture(ventureId: string): Promise<OutreachCampaign[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('outreach_campaigns')
    .select('*')
    .eq('venture_id', ventureId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getOutreachCampaignsForVenture failed: ${error.message}`)
  return data ?? []
}

export async function getOutreachMessagesForVenture(ventureId: string): Promise<OutreachMessageWithLead[]> {
  const campaigns = await getOutreachCampaignsForVenture(ventureId)
  const campaignIds = campaigns.map((campaign) => campaign.id)
  if (campaignIds.length === 0) return []

  const [leads, messagesResult] = await Promise.all([
    getLeadsForVenture(ventureId),
    (async () => {
      const db = await createDb()
      return db
        .from('outreach_messages')
        .select('*')
        .in('campaign_id', campaignIds)
        .order('sent_at', { ascending: false })
    })(),
  ])

  if (messagesResult.error) {
    throw new Error(`getOutreachMessagesForVenture failed: ${messagesResult.error.message}`)
  }

  const leadById = new Map(leads.map((lead) => [lead.id, lead]))
  return ((messagesResult.data ?? []) as OutreachMessage[]).map((message) => ({
    ...message,
    lead: leadById.get(message.lead_id) ?? null,
  }))
}

// ─── Pipeline: stages & deals ──────────────────────────────────────────────────

const DEFAULT_STAGE_TEMPLATE: Array<Pick<PipelineStage, 'name' | 'is_won' | 'is_lost'>> = [
  { name: 'New', is_won: false, is_lost: false },
  { name: 'Contacted', is_won: false, is_lost: false },
  { name: 'Qualified', is_won: false, is_lost: false },
  { name: 'Proposal', is_won: false, is_lost: false },
  { name: 'Won', is_won: true, is_lost: false },
  { name: 'Lost', is_won: false, is_lost: true },
]

export async function getPipelineStagesForVenture(ventureId: string): Promise<PipelineStage[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('pipeline_stages')
    .select('*')
    .eq('venture_id', ventureId)
    .order('position', { ascending: true })

  if (error) throw new Error(`getPipelineStagesForVenture failed: ${error.message}`)
  return data ?? []
}

// Lazily seeds a venture's default stage set on first Pipeline-tab visit
// rather than at venture-creation time, so ventures that never open the tab
// don't carry unused rows.
export async function ensurePipelineStagesForVenture(ventureId: string): Promise<PipelineStage[]> {
  const existing = await getPipelineStagesForVenture(ventureId)
  if (existing.length > 0) return existing

  const db = await createDb()
  const { data, error } = await db
    .from('pipeline_stages')
    .insert(
      DEFAULT_STAGE_TEMPLATE.map((stage, index) => ({
        venture_id: ventureId,
        name: stage.name,
        position: index,
        is_won: stage.is_won,
        is_lost: stage.is_lost,
      }))
    )
    .select()

  if (error) throw new Error(`ensurePipelineStagesForVenture failed: ${error.message}`)
  return (data ?? []).sort((a, b) => a.position - b.position)
}

export async function createPipelineStage(
  ventureId: string,
  input: { name: string; position: number; color?: string | null }
): Promise<PipelineStage> {
  const db = await createDb()
  const { data, error } = await db
    .from('pipeline_stages')
    .insert({ venture_id: ventureId, name: input.name, position: input.position, color: input.color ?? null })
    .select()
    .single()

  if (error) throw new Error(`createPipelineStage failed: ${error.message}`)
  return data
}

export async function updatePipelineStage(
  stageId: string,
  fields: Partial<Pick<PipelineStage, 'name' | 'position' | 'color' | 'is_won' | 'is_lost'>>
): Promise<PipelineStage> {
  const db = await createDb()
  const { data, error } = await db
    .from('pipeline_stages')
    .update(fields)
    .eq('id', stageId)
    .select()
    .single()

  if (error) throw new Error(`updatePipelineStage failed: ${error.message}`)
  return data
}

export async function deletePipelineStage(stageId: string): Promise<void> {
  const db = await createDb()
  const { error } = await db.from('pipeline_stages').delete().eq('id', stageId)
  if (error) throw new Error(`deletePipelineStage failed: ${error.message}`)
}

export async function getDealsForVenture(ventureId: string): Promise<Deal[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('deals')
    .select('*')
    .eq('venture_id', ventureId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getDealsForVenture failed: ${error.message}`)
  return data ?? []
}

export async function getDealById(dealId: string): Promise<Deal | null> {
  const db = await createDb()
  const { data, error } = await db.from('deals').select('*').eq('id', dealId).single()
  if (error) return null
  return data
}

// The only path a deal is created from — no auto-backfill from existing
// leads on migration, so every deal traces back to an explicit user action.
export async function createDeal(
  ventureId: string,
  input: { leadId: string; stageId: string; title: string; value?: number | null }
): Promise<Deal> {
  return withRetry(async () => {
    const db = await createDb()
    const { data, error } = await db
      .from('deals')
      .insert({
        venture_id: ventureId,
        lead_id: input.leadId,
        stage_id: input.stageId,
        title: input.title,
        value: input.value ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(`createDeal failed: ${error.message}`)
    return data
  })
}

export async function updateDeal(
  dealId: string,
  fields: Partial<Pick<Deal, 'stage_id' | 'title' | 'value' | 'probability' | 'expected_close_date' | 'lost_reason' | 'owner_id'>>
): Promise<Deal> {
  const db = await createDb()
  const { data, error } = await db
    .from('deals')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .select()
    .single()

  if (error) throw new Error(`updateDeal failed: ${error.message}`)
  return data
}

export async function deleteDeal(dealId: string): Promise<void> {
  const db = await createDb()
  const { error } = await db.from('deals').delete().eq('id', dealId)
  if (error) throw new Error(`deleteDeal failed: ${error.message}`)
}

// ─── Outreach replies (persisted, AI-classified) ───────────────────────────────

export async function createOutreachReply(input: {
  outreachMessageId: string
  leadId: string
  gmailMessageId: string
  gmailThreadId: string
  fromEmail?: string | null
  subject?: string | null
  body?: string | null
  receivedAt?: string | null
  replyType?: string | null
  sentimentScore?: number | null
  summary?: string | null
}): Promise<OutreachReply> {
  const db = await createDb()
  const { data, error } = await db
    .from('outreach_replies')
    .upsert(
      {
        outreach_message_id: input.outreachMessageId,
        lead_id: input.leadId,
        gmail_message_id: input.gmailMessageId,
        gmail_thread_id: input.gmailThreadId,
        from_email: input.fromEmail ?? null,
        subject: input.subject ?? null,
        body: input.body ?? null,
        received_at: input.receivedAt ?? null,
        reply_type: input.replyType ?? null,
        sentiment_score: input.sentimentScore ?? null,
        summary: input.summary ?? null,
      },
      { onConflict: 'gmail_message_id', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error) throw new Error(`createOutreachReply failed: ${error.message}`)
  return data
}

export async function getOutreachRepliesForVenture(ventureId: string): Promise<OutreachReply[]> {
  const campaigns = await getOutreachCampaignsForVenture(ventureId)
  const campaignIds = campaigns.map((campaign) => campaign.id)
  if (campaignIds.length === 0) return []

  const db = await createDb()
  const { data: messages, error: messagesError } = await db
    .from('outreach_messages')
    .select('id')
    .in('campaign_id', campaignIds)

  if (messagesError) throw new Error(`getOutreachRepliesForVenture failed: ${messagesError.message}`)
  const messageIds = (messages ?? []).map((m: { id: string }) => m.id)
  if (messageIds.length === 0) return []

  const { data, error } = await db
    .from('outreach_replies')
    .select('*')
    .in('outreach_message_id', messageIds)
    .order('received_at', { ascending: false })

  if (error) throw new Error(`getOutreachRepliesForVenture failed: ${error.message}`)
  return data ?? []
}

// ─── Testimonials & Platform Feedback ────────────────────────────────────────

export type TestimonialKind = 'testimonial' | 'feedback'

export interface Testimonial {
  id: string
  venture_id: string
  lead_id: string | null
  name: string
  email: string
  quote: string
  kind: TestimonialKind
  featured: boolean
  archived: boolean
  source: string | null
  created_at: string
}

export interface TestimonialFilters {
  kind?: TestimonialKind
  featured?: boolean
  archived?: boolean
}

export async function createTestimonial(
  ventureId: string,
  input: { name: string; email: string; quote: string; kind?: TestimonialKind; source?: string | null }
): Promise<Testimonial> {
  return withRetry(async () => {
    const db = await createDb()

    // Best-effort lead-link: if a lead already exists for (venture, email) attach it.
    let leadId: string | null = null
    try {
      const { data: existing } = await db
        .from('leads')
        .select('id')
        .eq('venture_id', ventureId)
        .ilike('email', input.email)
        .limit(1)
        .maybeSingle()
      if (existing && (existing as { id?: string }).id) {
        leadId = (existing as { id: string }).id
      }
    } catch {
      // Non-fatal — the testimonial inserts even if lookup fails.
    }

    const { data, error } = await db
      .from('testimonials')
      .insert({
        venture_id: ventureId,
        lead_id: leadId,
        name: input.name,
        email: input.email,
        quote: input.quote,
        kind: input.kind ?? 'testimonial',
        source: input.source ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(`createTestimonial failed: ${error.message}`)
    return data as Testimonial
  })
}

export async function listTestimonials(
  ventureId: string,
  filters: TestimonialFilters = {}
): Promise<Testimonial[]> {
  const db = await createDb()
  let query = db
    .from('testimonials')
    .select('*')
    .eq('venture_id', ventureId)
    .order('created_at', { ascending: false })

  if (filters.kind) query = query.eq('kind', filters.kind)
  if (typeof filters.featured === 'boolean') query = query.eq('featured', filters.featured)
  if (typeof filters.archived === 'boolean') query = query.eq('archived', filters.archived)

  const { data, error } = await query
  if (error) throw new Error(`listTestimonials failed: ${error.message}`)
  return (data ?? []) as Testimonial[]
}

export async function getTestimonialById(id: string): Promise<Testimonial | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('testimonials')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Testimonial
}

export async function setTestimonialFeatured(id: string, featured: boolean): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('testimonials')
    .update({ featured })
    .eq('id', id)
  if (error) throw new Error(`setTestimonialFeatured failed: ${error.message}`)
}

export async function setTestimonialArchived(id: string, archived: boolean): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('testimonials')
    .update({ archived })
    .eq('id', id)
  if (error) throw new Error(`setTestimonialArchived failed: ${error.message}`)
}

export async function deleteTestimonial(id: string): Promise<void> {
  const db = await createDb()
  const { error } = await db
    .from('testimonials')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`deleteTestimonial failed: ${error.message}`)
}

export type PlatformFeedbackCategory = 'bug' | 'feature' | 'praise' | 'other'

export interface PlatformFeedback {
  id: string
  user_id: string
  user_email: string
  category: PlatformFeedbackCategory
  message: string
  page_url: string | null
  created_at: string
}

export async function createPlatformFeedback(
  userId: string,
  userEmail: string,
  input: { category: PlatformFeedbackCategory; message: string; pageUrl?: string | null }
): Promise<PlatformFeedback> {
  return withRetry(async () => {
    const db = await createDb()
    const { data, error } = await db
      .from('platform_feedback')
      .insert({
        user_id: userId,
        user_email: userEmail,
        category: input.category,
        message: input.message,
        page_url: input.pageUrl ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(`createPlatformFeedback failed: ${error.message}`)
    return data as PlatformFeedback
  })
}
