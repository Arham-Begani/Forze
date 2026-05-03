import 'server-only'

import { Buffer } from 'node:buffer'
import { decryptSecret, encryptSecret } from '@/lib/marketing-crypto'
import { generatePostImage, prepareInstagramImageUrl } from '@/lib/marketing-image-gen'
import {
  markSocialConnectionStatus,
  updateSocialConnectionTokens,
} from '@/lib/marketing-queries'
import type {
  MarketingAsset,
  ProviderPublishResult,
  SocialConnectionSecretRecord,
} from '@/lib/marketing.shared'

function getMetaClientId(): string {
  const value = process.env.META_CLIENT_ID
  if (!value) throw new Error('META_CLIENT_ID is required for Instagram integration')
  return value
}

function getMetaClientSecret(): string {
  const value = process.env.META_CLIENT_SECRET
  if (!value) throw new Error('META_CLIENT_SECRET is required for Instagram integration')
  return value
}

function getGoogleClientId(): string {
  const value = process.env.GOOGLE_CLIENT_ID
  if (!value) throw new Error('GOOGLE_CLIENT_ID is required for YouTube integration')
  return value
}

function getGoogleClientSecret(): string {
  const value = process.env.GOOGLE_CLIENT_SECRET
  if (!value) throw new Error('GOOGLE_CLIENT_SECRET is required for YouTube integration')
  return value
}

function getLinkedInClientId(): string {
  const value = process.env.LINKEDIN_CLIENT_ID
  if (!value) throw new Error('LINKEDIN_CLIENT_ID is required for LinkedIn integration')
  return value
}

function getLinkedInClientSecret(): string {
  const value = process.env.LINKEDIN_CLIENT_SECRET
  if (!value) throw new Error('LINKEDIN_CLIENT_SECRET is required for LinkedIn integration')
  return value
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => stringValue(value)).filter(Boolean)))
}

function parseProviderError(text: string): { message?: string; code?: number; subcode?: number } {
  try {
    const data = JSON.parse(text) as {
      error?: {
        message?: string
        code?: number
        error_subcode?: number
      }
    }
    return {
      message: data.error?.message,
      code: data.error?.code,
      subcode: data.error?.error_subcode,
    }
  } catch {
    return { message: text }
  }
}

function isObjectMissingError(text: string): boolean {
  const error = parseProviderError(text)
  return error.code === 100 && error.subcode === 33
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Unexpected provider response: ${text}`)
  }
}

export class MarketingProviderError extends Error {
  retryable: boolean
  requiresReauth: boolean

  constructor(message: string, options?: { retryable?: boolean; requiresReauth?: boolean }) {
    super(message)
    this.name = 'MarketingProviderError'
    this.retryable = options?.retryable ?? false
    this.requiresReauth = options?.requiresReauth ?? false
  }
}

async function refreshYouTubeAccessToken(connection: SocialConnectionSecretRecord): Promise<string> {
  const refreshToken = decryptSecret(connection.refresh_token_encrypted)
  if (!refreshToken) {
    await markSocialConnectionStatus(connection.id, 'reauth_required')
    throw new MarketingProviderError('YouTube connection needs to be reauthorized', {
      retryable: false,
      requiresReauth: true,
    })
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await parseJson<{
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }>(response)

  if (!response.ok || !data.access_token) {
    await markSocialConnectionStatus(connection.id, 'reauth_required')
    throw new MarketingProviderError(data.error_description || data.error || 'Failed to refresh YouTube access token', {
      retryable: false,
      requiresReauth: true,
    })
  }

  const accessTokenEncrypted = encryptSecret(data.access_token)
  const expiresAt = typeof data.expires_in === 'number'
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null

  await updateSocialConnectionTokens(connection.id, accessTokenEncrypted, undefined, expiresAt)
  return data.access_token
}

async function refreshLinkedInAccessToken(connection: SocialConnectionSecretRecord): Promise<string> {
  const refreshToken = decryptSecret(connection.refresh_token_encrypted)
  if (!refreshToken) {
    await markSocialConnectionStatus(connection.id, 'reauth_required')
    throw new MarketingProviderError('LinkedIn connection needs to be reauthorized', {
      retryable: false,
      requiresReauth: true,
    })
  }

  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: getLinkedInClientId(),
      client_secret: getLinkedInClientSecret(),
    }),
  })

  const data = await parseJson<{
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }>(response)

  if (!response.ok || !data.access_token) {
    await markSocialConnectionStatus(connection.id, 'reauth_required')
    throw new MarketingProviderError(data.error_description || data.error || 'Failed to refresh LinkedIn access token', {
      retryable: false,
      requiresReauth: true,
    })
  }

  await updateSocialConnectionTokens(
    connection.id,
    encryptSecret(data.access_token),
    data.refresh_token ? encryptSecret(data.refresh_token) : undefined,
    typeof data.expires_in === 'number' ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null
  )

  return data.access_token
}

async function refreshInstagramAccessToken(connection: SocialConnectionSecretRecord): Promise<string> {
  const currentToken = decryptSecret(connection.access_token_encrypted)
  if (!currentToken) {
    await markSocialConnectionStatus(connection.id, 'reauth_required')
    throw new MarketingProviderError('Instagram connection needs to be reauthorized', {
      retryable: false,
      requiresReauth: true,
    })
  }

  // Instagram long-lived tokens can be refreshed up to 60 days before expiry
  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?` +
      new URLSearchParams({
        grant_type: 'ig_refresh_token',
        access_token: currentToken,
      }).toString()
  )

  const data = await parseJson<{
    access_token?: string
    expires_in?: number
    error?: { message?: string }
  }>(response)

  if (!response.ok || !data.access_token) {
    await markSocialConnectionStatus(connection.id, 'reauth_required')
    throw new MarketingProviderError(data.error?.message ?? 'Failed to refresh Instagram access token', {
      retryable: false,
      requiresReauth: true,
    })
  }

  const expiresAt = typeof data.expires_in === 'number'
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null

  await updateSocialConnectionTokens(connection.id, encryptSecret(data.access_token), undefined, expiresAt)
  return data.access_token
}

async function getAccessToken(connection: SocialConnectionSecretRecord): Promise<string> {
  const token = decryptSecret(connection.access_token_encrypted)
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null
  const isExpired = expiresAt !== null && expiresAt <= Date.now() + 60_000

  if (token && !isExpired && connection.status === 'active') {
    return token
  }

  if (connection.provider === 'youtube') {
    return refreshYouTubeAccessToken(connection)
  }

  if (connection.provider === 'instagram') {
    return refreshInstagramAccessToken(connection)
  }

  return refreshLinkedInAccessToken(connection)
}

async function publishLinkedInAsset(
  asset: MarketingAsset,
  connection: SocialConnectionSecretRecord
): Promise<ProviderPublishResult> {
  const accessToken = await getAccessToken(connection)
  const payload = asObject(asset.payload)
  const linkUrl = stringValue(payload.linkUrl)
  const author = `urn:li:person:${connection.provider_account_id}`
  const body = asset.body.trim()

  if (!body) {
    throw new MarketingProviderError('LinkedIn post body is required', { retryable: false })
  }

  const mediaEntries = linkUrl
    ? [{
      status: 'READY',
      originalUrl: linkUrl,
      title: { text: asset.title || 'Learn more' },
    }]
    : []

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: body },
          shareMediaCategory: linkUrl ? 'ARTICLE' : 'NONE',
          media: mediaEntries,
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }),
  })

  if (response.status === 401 || response.status === 403) {
    await markSocialConnectionStatus(connection.id, 'reauth_required')
    throw new MarketingProviderError('LinkedIn authorization expired or is missing required scopes', {
      retryable: false,
      requiresReauth: true,
    })
  }

  if (!response.ok) {
    const bodyText = await response.text()
    throw new MarketingProviderError(`LinkedIn publish failed: ${bodyText}`, {
      retryable: response.status >= 500 || response.status === 429,
    })
  }

  const restliId = response.headers.get('x-restli-id')
  return {
    providerAssetId: restliId,
    permalink: null,
    metadata: restliId ? { restliId } : {},
  }
}

async function publishYouTubeAsset(
  asset: MarketingAsset,
  connection: SocialConnectionSecretRecord
): Promise<ProviderPublishResult> {
  const accessToken = await getAccessToken(connection)
  const payload = asObject(asset.payload)
  const videoSourceUrl = stringValue(payload.videoSourceUrl)
  const privacyStatus = stringValue(payload.privacyStatus) || 'unlisted'
  const tags = stringArray(payload.tags)
  const categoryId = stringValue(payload.categoryId) || '28'

  if (!videoSourceUrl) {
    throw new MarketingProviderError('YouTube video source URL is required before publishing', { retryable: false })
  }

  const sourceResponse = await fetch(videoSourceUrl)
  if (!sourceResponse.ok) {
    throw new MarketingProviderError(`Unable to fetch video source: ${sourceResponse.status}`, {
      retryable: sourceResponse.status >= 500,
    })
  }

  const sourceContentType = sourceResponse.headers.get('content-type') || 'video/mp4'
  const videoBuffer = Buffer.from(await sourceResponse.arrayBuffer())

  const sessionResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(videoBuffer.byteLength),
      'X-Upload-Content-Type': sourceContentType,
    },
    body: JSON.stringify({
      snippet: {
        title: asset.title,
        description: asset.body,
        tags,
        categoryId,
      },
      status: {
        privacyStatus,
      },
    }),
  })

  if (sessionResponse.status === 401 || sessionResponse.status === 403) {
    await markSocialConnectionStatus(connection.id, 'reauth_required')
    throw new MarketingProviderError('YouTube authorization expired or is missing upload scope', {
      retryable: false,
      requiresReauth: true,
    })
  }

  if (!sessionResponse.ok) {
    const bodyText = await sessionResponse.text()
    throw new MarketingProviderError(`YouTube upload session failed: ${bodyText}`, {
      retryable: sessionResponse.status >= 500 || sessionResponse.status === 429,
    })
  }

  const uploadUrl = sessionResponse.headers.get('location')
  if (!uploadUrl) {
    throw new MarketingProviderError('YouTube upload session did not return an upload URL', { retryable: false })
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(videoBuffer.byteLength),
      'Content-Type': sourceContentType,
    },
    body: videoBuffer,
  })

  if (!uploadResponse.ok) {
    const bodyText = await uploadResponse.text()
    throw new MarketingProviderError(`YouTube video upload failed: ${bodyText}`, {
      retryable: uploadResponse.status >= 500 || uploadResponse.status === 429,
    })
  }

  const videoData = await parseJson<{ id?: string }>(uploadResponse)
  const videoId = typeof videoData.id === 'string' ? videoData.id : null

  return {
    providerAssetId: videoId,
    permalink: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
    metadata: videoId ? { videoId } : {},
  }
}

async function verifyImageUrlReachable(
  imageUrl: string,
  maxAttempts = 8,
  intervalMs = 2000
): Promise<void> {
  let lastStatus = 0
  let lastContentType = ''
  let lastByteLength = 0
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(imageUrl, {
        cache: 'no-store',
        headers: {
          Accept: 'image/jpeg,image/png,image/*;q=0.8,*/*;q=0.5',
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        },
      })
      lastStatus = res.status
      lastContentType = res.headers.get('content-type') ?? ''
      if (res.ok && (lastContentType.startsWith('image/jpeg') || lastContentType.startsWith('image/png'))) {
        const bytes = Buffer.from(await res.arrayBuffer())
        lastByteLength = bytes.byteLength
        const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        const isPng =
          bytes.length > 8 &&
          bytes[0] === 0x89 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x4e &&
          bytes[3] === 0x47

        if ((isJpeg || isPng) && bytes.byteLength > 0 && bytes.byteLength <= 8 * 1024 * 1024) {
          return
        }
      }
    } catch {
      // Ignore — retry below.
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new MarketingProviderError(
    `Image URL not reachable as an Instagram-safe image after ${maxAttempts} attempts ` +
      `(last status ${lastStatus}, content-type "${lastContentType}", bytes ${lastByteLength}): ${imageUrl}`,
    { retryable: true }
  )
}

async function fetchInstagramProfile(accessToken: string): Promise<{
  id: string | null
  userId: string | null
  username: string | null
}> {
  const response = await fetch(
    `https://graph.instagram.com/v21.0/me?fields=id,user_id,username&access_token=${encodeURIComponent(accessToken)}`,
    { cache: 'no-store' }
  )
  const data = await parseJson<{
    id?: string
    user_id?: string
    username?: string
    error?: { message?: string }
  }>(response)

  if (!response.ok) {
    throw new MarketingProviderError(data.error?.message ?? 'Failed to validate Instagram connection', {
      retryable: false,
      requiresReauth: true,
    })
  }

  return {
    id: stringValue(data.id) || null,
    userId: stringValue(data.user_id) || null,
    username: stringValue(data.username) || null,
  }
}

function getInstagramPublishTargets(
  connection: SocialConnectionSecretRecord,
  profile: Awaited<ReturnType<typeof fetchInstagramProfile>>
): string[] {
  const metadata = asObject(connection.metadata)
  return uniqueStrings([
    profile.userId,
    profile.id,
    typeof metadata.igUserId === 'string' ? metadata.igUserId : null,
    typeof metadata.igScopedId === 'string' ? metadata.igScopedId : null,
    connection.provider_account_id,
    'me',
  ])
}

async function createInstagramMediaContainer(input: {
  accessToken: string
  imageUrl: string
  caption: string
  connection: SocialConnectionSecretRecord
}): Promise<{ creationId: string; targetId: string }> {
  const profile = await fetchInstagramProfile(input.accessToken)
  const targets = getInstagramPublishTargets(input.connection, profile)
  const failures: string[] = []

  for (const targetId of targets) {
    const containerRes = await fetch(
      `https://graph.instagram.com/v21.0/${encodeURIComponent(targetId)}/media`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_url: input.imageUrl, caption: input.caption }),
      }
    )

    if (containerRes.status === 401 || containerRes.status === 403) {
      await markSocialConnectionStatus(input.connection.id, 'reauth_required')
      throw new MarketingProviderError('Instagram authorization expired or missing required permissions', {
        retryable: false,
        requiresReauth: true,
      })
    }

    const responseText = await containerRes.text()
    if (containerRes.ok) {
      let containerData: { id?: string }
      try {
        containerData = JSON.parse(responseText) as { id?: string }
      } catch {
        throw new MarketingProviderError(`Unexpected Instagram container response: ${responseText}`, {
          retryable: true,
        })
      }

      if (!containerData.id) {
        throw new MarketingProviderError('Instagram media container did not return a creation ID', { retryable: false })
      }

      return { creationId: containerData.id, targetId }
    }

    failures.push(`${targetId}: ${responseText}`)
    if (!isObjectMissingError(responseText)) {
      throw new MarketingProviderError(`Instagram media container creation failed: ${responseText}`, {
        retryable: containerRes.status >= 500 || containerRes.status === 429,
      })
    }
  }

  throw new MarketingProviderError(
    'Instagram could not find a publishable professional account for this token. ' +
      'Reconnect Instagram and make sure the account is professional and has content publishing permission. ' +
      `Tried: ${failures.join(' | ')}`,
    { retryable: false, requiresReauth: true }
  )
}

async function waitForInstagramContainerReady(
  creationId: string,
  accessToken: string,
  targetId: string,
  maxAttempts = 12,
  intervalMs = 2500
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusRes = await fetch(
      `https://graph.instagram.com/v21.0/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`
    )
    if (!statusRes.ok) {
      const errText = await statusRes.text()
      if (isObjectMissingError(errText)) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
        return
      }
      throw new MarketingProviderError(`Instagram container status check failed: ${errText}`, {
        retryable: statusRes.status >= 500 || statusRes.status === 429,
      })
    }
    const statusData = await parseJson<{ status_code?: string; status?: string }>(statusRes)
    const code = statusData.status_code ?? statusData.status ?? ''
    if (code === 'FINISHED') return
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new MarketingProviderError(`Instagram container status: ${code}`, { retryable: false })
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new MarketingProviderError(`Instagram container did not finish processing in time for ${targetId}`, { retryable: true })
}

async function publishInstagramAsset(
  asset: MarketingAsset,
  connection: SocialConnectionSecretRecord
): Promise<ProviderPublishResult> {
  const accessToken = await getAccessToken(connection)
  const payload = asObject(asset.payload)
  const caption = asset.body.trim()
  const ventureName = stringValue(payload.ventureName) || asset.title
  const brandColors = Array.isArray(payload.brandColors)
    ? (payload.brandColors as unknown[]).filter((c): c is string => typeof c === 'string')
    : []

  // Use existing image URL if present (e.g. user supplied one), else AI-generate
  let imageUrl = stringValue(payload.imageUrl)
  if (!imageUrl) {
    imageUrl = await generatePostImage(caption, ventureName, brandColors)
  } else {
    imageUrl = await prepareInstagramImageUrl(imageUrl, ventureName)
  }

  // Verify the image URL is publicly fetchable AND served as image/* before
  // handing it to Meta. Without this, error_subcode 2207052 ("Media URI does
  // not meet our terms") fires when the Vercel Blob CDN hasn't propagated yet
  // or when the upstream model returned malformed bytes.
  await verifyImageUrlReachable(imageUrl)

  // Use /me/media instead of /{stored-id}/media — Meta resolves the IG User ID
  // from the access token. Avoids the error_subcode 33 "Object with ID X does
  // not exist" failure when the stored provider_account_id drifts from the
  // canonical Instagram Graph user_id.
  const { creationId, targetId } = await createInstagramMediaContainer({
    accessToken,
    imageUrl,
    caption,
    connection,
  })

  // Step 2: poll container status until Meta finishes ingesting the image.
  // Skipping this leads to intermittent media_publish failures.
  await waitForInstagramContainerReady(creationId, accessToken, targetId)

  // Step 3: publish the container
  const publishRes = await fetch(
    `https://graph.instagram.com/v21.0/${encodeURIComponent(targetId)}/media_publish`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ creation_id: creationId }),
    }
  )

  if (!publishRes.ok) {
    const errText = await publishRes.text()
    throw new MarketingProviderError(`Instagram media publish failed: ${errText}`, {
      retryable: publishRes.status >= 500 || publishRes.status === 429,
    })
  }

  const publishData = await parseJson<{ id?: string }>(publishRes)
  const mediaId = publishData.id ?? null

  // Step 4: fetch the real permalink. The published media id is numeric; the
  // user-facing instagram.com URL uses a shortcode that only Meta knows.
  let permalink: string | null = null
  if (mediaId) {
    try {
      const permalinkRes = await fetch(
        `https://graph.instagram.com/v21.0/${mediaId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`
      )
      if (permalinkRes.ok) {
        const permalinkData = await parseJson<{ permalink?: string }>(permalinkRes)
        if (typeof permalinkData.permalink === 'string') {
          permalink = permalinkData.permalink
        }
      }
    } catch {
      // Non-fatal — the post is live; we just don't have a permalink.
    }
  }

  return {
    providerAssetId: mediaId,
    permalink,
    metadata: { imageUrl, creationId },
  }
}

export async function publishMarketingAsset(
  asset: MarketingAsset,
  connection: SocialConnectionSecretRecord
): Promise<ProviderPublishResult> {
  if (asset.provider !== connection.provider) {
    throw new MarketingProviderError('Asset/provider mismatch', { retryable: false })
  }

  if (asset.provider === 'linkedin') {
    return publishLinkedInAsset(asset, connection)
  }

  if (asset.provider === 'instagram') {
    return publishInstagramAsset(asset, connection)
  }

  return publishYouTubeAsset(asset, connection)
}
