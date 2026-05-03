import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createDb } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  ConnectionStatus,
  CreateMarketingAssetInput,
  MarketingAsset,
  MarketingAssetStatus,
  MarketingPublishAttempt,
  MarketingPublishJob,
  ProviderPublishResult,
  PublishJobStatus,
  SocialConnection,
  SocialConnectionSecretRecord,
  SocialProvider,
} from '@/lib/marketing.shared'

type DbClient = SupabaseClient<any, any, any>

async function resolveDb(db?: DbClient): Promise<DbClient> {
  return db ?? (await createDb())
}

function resolveAdminDb(db?: DbClient): DbClient {
  return db ?? createAdminClient()
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }

  if (typeof value === 'string') {
    return value
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function sanitizeConnection(record: SocialConnectionSecretRecord): SocialConnection {
  const { access_token_encrypted: _access, refresh_token_encrypted: _refresh, ...safe } = record
  return {
    ...safe,
    scopes: normalizeStringArray(safe.scopes),
    metadata: asObject(safe.metadata),
  }
}

function normalizeAsset(record: MarketingAsset): MarketingAsset {
  return {
    ...record,
    payload: asObject(record.payload),
  }
}

interface UpsertSocialConnectionInput {
  userId: string
  provider: SocialProvider
  providerAccountId: string
  providerAccountLabel: string
  accessTokenEncrypted: string | null
  refreshTokenEncrypted?: string | null
  tokenExpiresAt: string | null
  scopes: string[]
  metadata?: Record<string, unknown>
  status?: ConnectionStatus
}

export async function listSocialConnectionsByUser(userId: string, db?: DbClient): Promise<SocialConnection[]> {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('social_connections')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'revoked')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`listSocialConnectionsByUser failed: ${error.message}`)
  return (data ?? []).map((record: SocialConnectionSecretRecord) => sanitizeConnection(record))
}

export async function getSocialConnectionByProvider(
  userId: string,
  provider: SocialProvider,
  db?: DbClient
): Promise<SocialConnection | null> {
  const record = await getSocialConnectionSecretByProvider(userId, provider, db)
  return record ? sanitizeConnection(record) : null
}

export async function getSocialConnectionSecretByProvider(
  userId: string,
  provider: SocialProvider,
  db?: DbClient
): Promise<SocialConnectionSecretRecord | null> {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('social_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .neq('status', 'revoked')
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(`getSocialConnectionSecretByProvider failed: ${error.message}`)
  const record = (data ?? [])[0] as SocialConnectionSecretRecord | undefined
  return record ?? null
}

export async function getSocialConnectionSecretByProviderAdmin(
  userId: string,
  provider: SocialProvider,
  db?: DbClient
): Promise<SocialConnectionSecretRecord | null> {
  const client = resolveAdminDb(db)
  const { data, error } = await client
    .from('social_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .neq('status', 'revoked')
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(`getSocialConnectionSecretByProviderAdmin failed: ${error.message}`)
  const record = (data ?? [])[0] as SocialConnectionSecretRecord | undefined
  return record ?? null
}

export async function upsertSocialConnection(input: UpsertSocialConnectionInput, db?: DbClient): Promise<SocialConnection> {
  const client = await resolveDb(db)
  const { data: existingRows, error: listError } = await client
    .from('social_connections')
    .select('*')
    .eq('user_id', input.userId)
    .eq('provider', input.provider)
    .order('updated_at', { ascending: false })

  if (listError) throw new Error(`upsertSocialConnection lookup failed: ${listError.message}`)

  const existing = (existingRows ?? [])[0] as SocialConnectionSecretRecord | undefined
  const payload = {
    user_id: input.userId,
    provider: input.provider,
    provider_account_id: input.providerAccountId,
    provider_account_label: input.providerAccountLabel,
    access_token_encrypted: input.accessTokenEncrypted,
    refresh_token_encrypted: input.refreshTokenEncrypted === undefined
      ? existing?.refresh_token_encrypted ?? null
      : input.refreshTokenEncrypted,
    token_expires_at: input.tokenExpiresAt,
    scopes: input.scopes,
    status: input.status ?? 'active',
    metadata: input.metadata ?? {},
    updated_at: new Date().toISOString(),
  }

  let record: SocialConnectionSecretRecord
  if (existing) {
    const { data, error } = await client
      .from('social_connections')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) throw new Error(`upsertSocialConnection update failed: ${error.message}`)
    record = data as SocialConnectionSecretRecord
  } else {
    const { data, error } = await client
      .from('social_connections')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw new Error(`upsertSocialConnection insert failed: ${error.message}`)
    record = data as SocialConnectionSecretRecord
  }

  const staleIds = (existingRows ?? [])
    .map((row: { id: string }) => row.id)
    .filter((id) => id !== record.id)

  if (staleIds.length > 0) {
    await client
      .from('social_connections')
      .update({
        status: 'revoked',
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        updated_at: new Date().toISOString(),
      })
      .in('id', staleIds)
  }

  return sanitizeConnection(record)
}

export async function disconnectSocialConnection(userId: string, provider: SocialProvider, db?: DbClient): Promise<void> {
  const client = await resolveDb(db)
  const { error } = await client
    .from('social_connections')
    .update({
      status: 'revoked',
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', provider)

  if (error) throw new Error(`disconnectSocialConnection failed: ${error.message}`)
}

export async function markSocialConnectionStatus(
  connectionId: string,
  status: ConnectionStatus,
  db?: DbClient
): Promise<void> {
  const client = resolveAdminDb(db)
  const { error } = await client
    .from('social_connections')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', connectionId)

  if (error) throw new Error(`markSocialConnectionStatus failed: ${error.message}`)
}

export async function updateSocialConnectionTokens(
  connectionId: string,
  accessTokenEncrypted: string | null,
  refreshTokenEncrypted: string | null | undefined,
  tokenExpiresAt: string | null,
  db?: DbClient
): Promise<void> {
  const client = resolveAdminDb(db)
  const payload: Record<string, unknown> = {
    access_token_encrypted: accessTokenEncrypted,
    token_expires_at: tokenExpiresAt,
    status: 'active',
    updated_at: new Date().toISOString(),
  }

  if (refreshTokenEncrypted !== undefined) {
    payload.refresh_token_encrypted = refreshTokenEncrypted
  }

  const { error } = await client
    .from('social_connections')
    .update(payload)
    .eq('id', connectionId)

  if (error) throw new Error(`updateSocialConnectionTokens failed: ${error.message}`)
}

export async function createMarketingAssets(
  inputs: CreateMarketingAssetInput[],
  db?: DbClient
): Promise<MarketingAsset[]> {
  if (inputs.length === 0) return []

  const client = await resolveDb(db)
  const payload = inputs.map((input) => ({
    venture_id: input.ventureId,
    user_id: input.userId,
    conversation_id: input.conversationId ?? null,
    provider: input.provider,
    asset_type: input.assetType,
    title: input.title,
    body: input.body,
    payload: input.payload ?? {},
    status: input.status ?? 'draft',
  }))

  const { data, error } = await client
    .from('marketing_assets')
    .insert(payload)
    .select('*')

  if (error) throw new Error(`createMarketingAssets failed: ${error.message}`)
  return (data ?? []).map((record: MarketingAsset) => normalizeAsset(record))
}

export async function listMarketingAssetsByVenture(
  ventureId: string,
  userId: string,
  db?: DbClient
): Promise<MarketingAsset[]> {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('marketing_assets')
    .select('*')
    .eq('venture_id', ventureId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`listMarketingAssetsByVenture failed: ${error.message}`)
  return (data ?? []).map((record: MarketingAsset) => normalizeAsset(record))
}

export async function getMarketingAssetById(
  assetId: string,
  userId: string,
  ventureId?: string,
  db?: DbClient
): Promise<MarketingAsset | null> {
  const client = await resolveDb(db)
  let query = client
    .from('marketing_assets')
    .select('*')
    .eq('id', assetId)
    .eq('user_id', userId)

  if (ventureId) {
    query = query.eq('venture_id', ventureId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(`getMarketingAssetById failed: ${error.message}`)
  return data ? normalizeAsset(data as MarketingAsset) : null
}

export async function getMarketingAssetByIdAdmin(assetId: string, db?: DbClient): Promise<MarketingAsset | null> {
  const client = resolveAdminDb(db)
  const { data, error } = await client
    .from('marketing_assets')
    .select('*')
    .eq('id', assetId)
    .maybeSingle()

  if (error) throw new Error(`getMarketingAssetByIdAdmin failed: ${error.message}`)
  return data ? normalizeAsset(data as MarketingAsset) : null
}

export async function deleteMarketingAsset(
  assetId: string,
  userId: string,
  db?: DbClient
): Promise<void> {
  const client = await resolveDb(db)

  // Cancel any in-flight publish jobs first so a queued worker doesn't
  // resurrect the post against an already-deleted asset_id.
  await cancelPublishJobsForAsset(assetId, userId, client).catch(() => null)

  const { error } = await client
    .from('marketing_assets')
    .delete()
    .eq('id', assetId)
    .eq('user_id', userId)

  if (error) throw new Error(`deleteMarketingAsset failed: ${error.message}`)
}

export async function updateMarketingAsset(
  assetId: string,
  userId: string,
  updates: Partial<Pick<MarketingAsset, 'title' | 'body' | 'payload' | 'scheduled_for'>>,
  db?: DbClient
): Promise<MarketingAsset> {
  const client = await resolveDb(db)
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (typeof updates.title === 'string') payload.title = updates.title
  if (typeof updates.body === 'string') payload.body = updates.body
  if (updates.payload) payload.payload = updates.payload
  if (updates.scheduled_for !== undefined) payload.scheduled_for = updates.scheduled_for

  const { data, error } = await client
    .from('marketing_assets')
    .update(payload)
    .eq('id', assetId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw new Error(`updateMarketingAsset failed: ${error.message}`)
  return normalizeAsset(data as MarketingAsset)
}

export async function updateMarketingAssetStatus(
  assetId: string,
  userId: string,
  status: MarketingAssetStatus,
  db?: DbClient
): Promise<MarketingAsset> {
  const client = await resolveDb(db)
  const { data, error } = await client
    .from('marketing_assets')
    .update({
      status,
      updated_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', assetId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw new Error(`updateMarketingAssetStatus failed: ${error.message}`)
  return normalizeAsset(data as MarketingAsset)
}

export async function updateMarketingAssetStatusAdmin(
  assetId: string,
  updates: {
    status: MarketingAssetStatus
    scheduledFor?: string | null
    publishedAt?: string | null
    providerAssetId?: string | null
    providerPermalink?: string | null
    lastError?: string | null
  },
  db?: DbClient
): Promise<void> {
  const client = resolveAdminDb(db)
  const payload: Record<string, unknown> = {
    status: updates.status,
    updated_at: new Date().toISOString(),
  }

  if (updates.scheduledFor !== undefined) payload.scheduled_for = updates.scheduledFor
  if (updates.publishedAt !== undefined) payload.published_at = updates.publishedAt
  if (updates.providerAssetId !== undefined) payload.provider_asset_id = updates.providerAssetId
  if (updates.providerPermalink !== undefined) payload.provider_permalink = updates.providerPermalink
  if (updates.lastError !== undefined) payload.last_error = updates.lastError

  const { error } = await client
    .from('marketing_assets')
    .update(payload)
    .eq('id', assetId)

  if (error) throw new Error(`updateMarketingAssetStatusAdmin failed: ${error.message}`)
}

export async function createOrReplaceQueuedPublishJob(
  asset: MarketingAsset,
  runAt: string,
  userId: string,
  db?: DbClient
): Promise<MarketingPublishJob> {
  const client = await resolveDb(db)
  const { data: existingRows, error: lookupError } = await client
    .from('marketing_publish_jobs')
    .select('*')
    .eq('asset_id', asset.id)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (lookupError) throw new Error(`createOrReplaceQueuedPublishJob lookup failed: ${lookupError.message}`)

  const existing = (existingRows ?? [])[0] as MarketingPublishJob | undefined
  const payload = {
    asset_id: asset.id,
    user_id: userId,
    provider: asset.provider,
    run_at: runAt,
    status: 'queued',
    retry_count: 0,
    max_retries: 3,
    last_error: null,
    updated_at: new Date().toISOString(),
  }

  let record: MarketingPublishJob
  if (existing && !['completed', 'cancelled'].includes(existing.status)) {
    const { data, error } = await client
      .from('marketing_publish_jobs')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) throw new Error(`createOrReplaceQueuedPublishJob update failed: ${error.message}`)
    record = data as MarketingPublishJob
  } else {
    const { data, error } = await client
      .from('marketing_publish_jobs')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw new Error(`createOrReplaceQueuedPublishJob insert failed: ${error.message}`)
    record = data as MarketingPublishJob
  }

  return record
}

export async function cancelPublishJobsForAsset(assetId: string, userId: string, db?: DbClient): Promise<void> {
  const client = await resolveDb(db)
  const { error } = await client
    .from('marketing_publish_jobs')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('asset_id', assetId)
    .eq('user_id', userId)
    .in('status', ['queued', 'processing', 'needs_reauth'])

  if (error) throw new Error(`cancelPublishJobsForAsset failed: ${error.message}`)
}

export async function listDuePublishJobs(limit = 10, db?: DbClient): Promise<MarketingPublishJob[]> {
  const client = resolveAdminDb(db)
  const { data, error } = await client
    .from('marketing_publish_jobs')
    .select('*')
    .eq('status', 'queued')
    .lte('run_at', new Date().toISOString())
    .order('run_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`listDuePublishJobs failed: ${error.message}`)
  return (data ?? []) as MarketingPublishJob[]
}

export async function claimPublishJob(jobId: string, db?: DbClient): Promise<MarketingPublishJob | null> {
  const client = resolveAdminDb(db)
  const { data, error } = await client
    .from('marketing_publish_jobs')
    .update({
      status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', 'queued')
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`claimPublishJob failed: ${error.message}`)
  return (data as MarketingPublishJob | null) ?? null
}

export async function markPublishJobCompleted(jobId: string, db?: DbClient): Promise<void> {
  const client = resolveAdminDb(db)
  const { error } = await client
    .from('marketing_publish_jobs')
    .update({
      status: 'completed',
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (error) throw new Error(`markPublishJobCompleted failed: ${error.message}`)
}

export async function markPublishJobFailed(
  jobId: string,
  message: string,
  status: PublishJobStatus = 'failed',
  db?: DbClient
): Promise<void> {
  const client = resolveAdminDb(db)
  const { error } = await client
    .from('marketing_publish_jobs')
    .update({
      status,
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (error) throw new Error(`markPublishJobFailed failed: ${error.message}`)
}

export async function requeuePublishJob(job: MarketingPublishJob, message: string, db?: DbClient): Promise<void> {
  const client = resolveAdminDb(db)
  const nextRunAt = new Date(Date.now() + Math.min(15, job.retry_count + 1) * 60 * 1000).toISOString()
  const { error } = await client
    .from('marketing_publish_jobs')
    .update({
      status: 'queued',
      run_at: nextRunAt,
      retry_count: job.retry_count + 1,
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)

  if (error) throw new Error(`requeuePublishJob failed: ${error.message}`)
}

export async function createPublishAttempt(input: {
  jobId: string
  assetId: string
  userId: string
  provider: SocialProvider
  status: 'success' | 'failed'
  errorMessage?: string | null
  providerResponse?: Record<string, unknown>
}, db?: DbClient): Promise<MarketingPublishAttempt> {
  const client = resolveAdminDb(db)
  const { data, error } = await client
    .from('marketing_publish_attempts')
    .insert({
      job_id: input.jobId,
      asset_id: input.assetId,
      user_id: input.userId,
      provider: input.provider,
      status: input.status,
      error_message: input.errorMessage ?? null,
      provider_response: input.providerResponse ?? {},
    })
    .select('*')
    .single()

  if (error) throw new Error(`createPublishAttempt failed: ${error.message}`)
  return data as MarketingPublishAttempt
}

export async function applyPublishResultToAsset(
  assetId: string,
  result: ProviderPublishResult,
  db?: DbClient
): Promise<void> {
  await updateMarketingAssetStatusAdmin(assetId, {
    status: 'published',
    publishedAt: new Date().toISOString(),
    providerAssetId: result.providerAssetId,
    providerPermalink: result.permalink,
    lastError: null,
  }, db)
}
