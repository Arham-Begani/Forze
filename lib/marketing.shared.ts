import type { PlanSlug } from '@/lib/billing'

export const SOCIAL_PROVIDERS = ['youtube', 'linkedin', 'instagram'] as const
export type SocialProvider = typeof SOCIAL_PROVIDERS[number]

export const CONNECTION_STATUSES = ['active', 'expired', 'revoked', 'reauth_required'] as const
export type ConnectionStatus = typeof CONNECTION_STATUSES[number]

export const MARKETING_ASSET_TYPES = ['youtube_video', 'linkedin_post', 'instagram_post'] as const
export type MarketingAssetType = typeof MARKETING_ASSET_TYPES[number]

export const MARKETING_ASSET_STATUSES = [
  'draft',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'needs_reauth',
] as const
export type MarketingAssetStatus = typeof MARKETING_ASSET_STATUSES[number]

export const PUBLISH_JOB_STATUSES = [
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'needs_reauth',
] as const
export type PublishJobStatus = typeof PUBLISH_JOB_STATUSES[number]

export interface SocialConnection {
  id: string
  user_id: string
  provider: SocialProvider
  provider_account_id: string
  provider_account_label: string
  token_expires_at: string | null
  scopes: string[]
  status: ConnectionStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SocialConnectionSecretRecord extends SocialConnection {
  access_token_encrypted: string | null
  refresh_token_encrypted: string | null
}

export interface MarketingAsset {
  id: string
  venture_id: string
  user_id: string
  conversation_id: string | null
  provider: SocialProvider
  asset_type: MarketingAssetType
  title: string
  body: string
  payload: Record<string, unknown>
  status: MarketingAssetStatus
  scheduled_for: string | null
  published_at: string | null
  provider_asset_id: string | null
  provider_permalink: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface MarketingPublishJob {
  id: string
  asset_id: string
  user_id: string
  provider: SocialProvider
  run_at: string
  status: PublishJobStatus
  retry_count: number
  max_retries: number
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface MarketingPublishAttempt {
  id: string
  job_id: string
  asset_id: string
  user_id: string
  provider: SocialProvider
  status: 'success' | 'failed'
  error_message: string | null
  provider_response: Record<string, unknown>
  created_at: string
}

export interface CreateMarketingAssetSeed {
  provider: SocialProvider
  assetType: MarketingAssetType
  title: string
  body: string
  payload?: Record<string, unknown>
}

export interface CreateMarketingAssetInput extends CreateMarketingAssetSeed {
  ventureId: string
  userId: string
  conversationId?: string | null
  status?: MarketingAssetStatus
}

export interface ScheduleMarketingAssetInput {
  scheduledFor: string
}

export interface ProviderPublishResult {
  providerAssetId: string | null
  permalink: string | null
  metadata?: Record<string, unknown>
}

const MARKETING_AUTOMATION_PLAN_ORDER: PlanSlug[] = ['free', 'starter', 'builder', 'pro', 'studio']

export function hasMarketingAutomationAccess(planSlug: PlanSlug, hasUnlimitedAccess = false): boolean {
  if (hasUnlimitedAccess) return true
  return MARKETING_AUTOMATION_PLAN_ORDER.indexOf(planSlug) >= MARKETING_AUTOMATION_PLAN_ORDER.indexOf('builder')
}

export function isSocialProvider(value: string): value is SocialProvider {
  return SOCIAL_PROVIDERS.includes(value as SocialProvider)
}
