import 'server-only'

import { Buffer } from 'node:buffer'
import { decryptSecret, encryptSecret, isSecretDecryptError } from '@/lib/marketing-crypto'
import {
  generatePostImage,
  isImageAspect,
  isImageStyle,
  prepareInstagramImageUrl,
} from '@/lib/marketing-image-gen'
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

async function safeDecryptForReauth(
  encrypted: string | null | undefined,
  connection: SocialConnectionSecretRecord,
  providerLabel: string
): Promise<string | null> {
  try {
    return decryptSecret(encrypted)
  } catch (err) {
    if (isSecretDecryptError(err)) {
      await markSocialConnectionStatus(connection.id, 'reauth_required')
      throw new MarketingProviderError(
        `${providerLabel} connection needs to be reconnected (stored token cannot be decrypted)`,
        { retryable: false, requiresReauth: true }
      )
    }
    throw err
  }
}

async function refreshYouTubeAccessToken(connection: SocialConnectionSecretRecord): Promise<string> {
  const refreshToken = await safeDecryptForReauth(connection.refresh_token_encrypted, connection, 'YouTube')
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
  const refreshToken = await safeDecryptForReauth(connection.refresh_token_encrypted, connection, 'LinkedIn')
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
  const currentToken = await safeDecryptForReauth(connection.access_token_encrypted, connection, 'Instagram')
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
  let token: string | null
  try {
    token = decryptSecret(connection.access_token_encrypted)
  } catch (err) {
    if (isSecretDecryptError(err)) {
      // MARKETING_TOKEN_ENCRYPTION_KEY has changed (rotated or never set on
      // this environment). The stored token can't be recovered — flag the
      // connection so the UI prompts a reconnect instead of looping forever
      // on the cryptic Node crypto error.
      await markSocialConnectionStatus(connection.id, 'reauth_required')
      throw new MarketingProviderError(
        `${connection.provider} connection needs to be reconnected (stored token cannot be decrypted)`,
        { retryable: false, requiresReauth: true }
      )
    }
    throw err
  }
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

// LinkedIn rewards posts that include native media (image or video) — text-only
// posts are demoted in the feed. We always try to attach a generated image
// before publishing. Two-step LinkedIn flow: register the upload to get an
// asset URN + upload URL, then PUT the image bytes. Returned URN is then
// referenced in the ugcPost media[] array with shareMediaCategory='IMAGE'.
async function uploadLinkedInImage(input: {
  accessToken: string
  ownerUrn: string
  imageBytes: Buffer
  contentType: string
}): Promise<string> {
  const registerRes = await fetch(
    'https://api.linkedin.com/v2/assets?action=registerUpload',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: input.ownerUrn,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      }),
    }
  )

  if (!registerRes.ok) {
    const text = await registerRes.text()
    throw new MarketingProviderError(`LinkedIn image registerUpload failed: ${text}`, {
      retryable: registerRes.status >= 500 || registerRes.status === 429,
    })
  }

  const registerData = await parseJson<{
    value?: {
      uploadMechanism?: {
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'?: {
          uploadUrl?: string
        }
      }
      asset?: string
    }
  }>(registerRes)

  const uploadUrl =
    registerData.value?.uploadMechanism?.[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ]?.uploadUrl
  const assetUrn = registerData.value?.asset
  if (!uploadUrl || !assetUrn) {
    throw new MarketingProviderError('LinkedIn registerUpload returned no upload URL or asset URN', {
      retryable: false,
    })
  }

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': input.contentType,
    },
    body: new Uint8Array(input.imageBytes),
  })

  if (!putRes.ok) {
    const text = await putRes.text()
    throw new MarketingProviderError(`LinkedIn image upload failed: ${text}`, {
      retryable: putRes.status >= 500 || putRes.status === 429,
    })
  }

  return assetUrn
}

// Resolves which image a post should publish with, in priority order:
//   1. payload.imageUrl          — the founder uploaded or explicitly set it
//   2. the selected candidate    — they generated options and picked one
//   3. null                      — caller falls back to blind generation
// Drafts created before the image studio existed carry neither new key and so
// fall straight through to (3), i.e. exactly the old behaviour.
function selectedImageFromPayload(payload: Record<string, unknown>): string | null {
  const direct = stringValue(payload.imageUrl)
  if (direct) return direct

  const candidates = Array.isArray(payload.imageCandidates)
    ? (payload.imageCandidates as unknown[]).filter((c): c is string => typeof c === 'string')
    : []
  if (candidates.length === 0) return null

  const rawIndex = typeof payload.selectedImageIndex === 'number' ? payload.selectedImageIndex : 0
  const index = Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < candidates.length ? rawIndex : 0
  return candidates[index] ?? null
}

// Explicit multi-image attachment. Empty for every draft that doesn't use a
// carousel, which is the single-image path unchanged.
function carouselImagesFromPayload(payload: Record<string, unknown>): string[] {
  const urls = Array.isArray(payload.imageUrls)
    ? (payload.imageUrls as unknown[]).filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    : []
  return urls.slice(0, IG_CAROUSEL_MAX)
}

// Art direction stamped on the asset, used only when we still have to generate
// blind (scheduled posts the founder never opened, routine-published posts).
function imageOptionsFromPayload(payload: Record<string, unknown>) {
  const style = payload.imageStyle
  const aspect = payload.aspect
  return {
    style: isImageStyle(style) ? style : undefined,
    aspect: isImageAspect(aspect) ? aspect : undefined,
    artDirection: typeof payload.artDirection === 'string' ? payload.artDirection : undefined,
  }
}

// Fetches one image URL and hands its bytes to LinkedIn's asset uploader.
// Returns null on any failure so the post can still go out — a transient
// image error should never kill a working post.
async function uploadOneLinkedInImage(input: {
  accessToken: string
  ownerUrn: string
  imageUrl: string
}): Promise<string | null> {
  try {
    const fetchRes = await fetch(input.imageUrl, { cache: 'no-store' })
    if (!fetchRes.ok) return null

    const contentType = fetchRes.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return null

    const bytes = Buffer.from(await fetchRes.arrayBuffer())
    if (bytes.byteLength === 0) return null

    return await uploadLinkedInImage({
      accessToken: input.accessToken,
      ownerUrn: input.ownerUrn,
      imageBytes: bytes,
      contentType,
    })
  } catch (err) {
    console.warn('[linkedin] image attachment failed:', err)
    return null
  }
}

// Resolves every image a LinkedIn post should carry. Returns [] to publish
// text-only. A multi-image post keeps whichever uploads succeeded rather than
// dropping all images because one of them failed.
async function resolveLinkedInImageAssets(input: {
  accessToken: string
  ownerUrn: string
  asset: MarketingAsset
  payload: Record<string, unknown>
}): Promise<string[]> {
  if (input.payload.skipImage === true) return []

  const ventureName = stringValue(input.payload.ventureName) || input.asset.title || 'Brand'
  const brandColors = Array.isArray(input.payload.brandColors)
    ? (input.payload.brandColors as unknown[]).filter((c): c is string => typeof c === 'string')
    : []

  try {
    const carousel = carouselImagesFromPayload(input.payload)
    let imageUrls: string[]

    if (carousel.length > 0) {
      imageUrls = carousel
    } else {
      const chosen = selectedImageFromPayload(input.payload)
      imageUrls = [
        chosen ?? (await generatePostImage(
          input.asset.body.trim(),
          ventureName,
          brandColors,
          imageOptionsFromPayload(input.payload)
        )),
      ]
    }

    const uploaded = await Promise.all(
      imageUrls.map((imageUrl) =>
        uploadOneLinkedInImage({
          accessToken: input.accessToken,
          ownerUrn: input.ownerUrn,
          imageUrl,
        })
      )
    )

    return uploaded.filter((urn): urn is string => Boolean(urn))
  } catch (err) {
    console.warn('[linkedin] image attachment failed, falling back to text-only post:', err)
    return []
  }
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

  // Prefer image over link card — LinkedIn only allows one media category per
  // post, and native images get the biggest algorithmic boost.
  const imageAssetUrns = await resolveLinkedInImageAssets({
    accessToken,
    ownerUrn: author,
    asset,
    payload,
  })

  let shareMediaCategory: 'IMAGE' | 'ARTICLE' | 'NONE' = 'NONE'
  let mediaEntries: Array<Record<string, unknown>> = []

  if (imageAssetUrns.length > 0) {
    shareMediaCategory = 'IMAGE'
    mediaEntries = imageAssetUrns.map((urn) => ({
      status: 'READY',
      media: urn,
      title: { text: asset.title || 'Post image' },
      description: { text: asset.title || '' },
    }))
  } else if (linkUrl) {
    shareMediaCategory = 'ARTICLE'
    mediaEntries = [
      {
        status: 'READY',
        originalUrl: linkUrl,
        title: { text: asset.title || 'Learn more' },
      },
    ]
  }

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
          shareMediaCategory,
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
  // LinkedIn returns the share/ugcPost URN in the X-Restli-Id header (e.g.
  // "urn:li:share:7..." or "urn:li:ugcPost:7..."). The public permalink is
  // https://www.linkedin.com/feed/update/{urlencoded-urn}/ — encoding the
  // colons is required because LinkedIn's router treats raw `urn:li:share:`
  // as a different segment and 404s.
  const permalink = restliId
    ? `https://www.linkedin.com/feed/update/${encodeURIComponent(restliId)}/`
    : null
  const metadata: Record<string, unknown> = {}
  if (restliId) metadata.restliId = restliId
  // Keep the singular key for backward compatibility with metadata already
  // written on published assets, and add the full list for multi-image posts.
  if (imageAssetUrns.length > 0) {
    metadata.imageAssetUrn = imageAssetUrns[0]
    if (imageAssetUrns.length > 1) metadata.imageAssetUrns = imageAssetUrns
  }
  return {
    providerAssetId: restliId,
    permalink,
    metadata,
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

// POSTs one /media container to a specific IG target. Returns null only for
// the "object does not exist" case, which means this target id is wrong and
// the caller should try the next candidate. Every other failure throws.
async function postInstagramContainer(input: {
  accessToken: string
  targetId: string
  body: Record<string, unknown>
  connection: SocialConnectionSecretRecord
}): Promise<{ id: string } | { missing: string }> {
  const containerRes = await fetch(
    `https://graph.instagram.com/v21.0/${encodeURIComponent(input.targetId)}/media`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input.body),
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

    return { id: containerData.id }
  }

  if (isObjectMissingError(responseText)) {
    return { missing: `${input.targetId}: ${responseText}` }
  }

  throw new MarketingProviderError(`Instagram media container creation failed: ${responseText}`, {
    retryable: containerRes.status >= 500 || containerRes.status === 429,
  })
}

function noPublishableAccountError(failures: string[]): MarketingProviderError {
  return new MarketingProviderError(
    'Instagram could not find a publishable professional account for this token. ' +
      'Reconnect Instagram and make sure the account is professional and has content publishing permission. ' +
      `Tried: ${failures.join(' | ')}`,
    { retryable: false, requiresReauth: true }
  )
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
    const result = await postInstagramContainer({
      accessToken: input.accessToken,
      targetId,
      body: { image_url: input.imageUrl, caption: input.caption },
      connection: input.connection,
    })

    if ('id' in result) return { creationId: result.id, targetId }
    failures.push(result.missing)
  }

  throw noPublishableAccountError(failures)
}

// Carousel: every image becomes a child container (is_carousel_item), then one
// parent container references them by id. Meta caps a carousel at 10 items.
const IG_CAROUSEL_MAX = 10

async function createInstagramCarouselContainer(input: {
  accessToken: string
  imageUrls: string[]
  caption: string
  connection: SocialConnectionSecretRecord
}): Promise<{ creationId: string; targetId: string }> {
  const profile = await fetchInstagramProfile(input.accessToken)
  const targets = getInstagramPublishTargets(input.connection, profile)
  const images = input.imageUrls.slice(0, IG_CAROUSEL_MAX)
  const failures: string[] = []

  for (const targetId of targets) {
    // Probe with the first child. If this target id is wrong we learn it here
    // and move on without having created orphan containers for the rest.
    const first = await postInstagramContainer({
      accessToken: input.accessToken,
      targetId,
      body: { image_url: images[0], is_carousel_item: true },
      connection: input.connection,
    })

    if (!('id' in first)) {
      failures.push(first.missing)
      continue
    }

    const childIds = [first.id]
    for (const imageUrl of images.slice(1)) {
      const child = await postInstagramContainer({
        accessToken: input.accessToken,
        targetId,
        body: { image_url: imageUrl, is_carousel_item: true },
        connection: input.connection,
      })
      if (!('id' in child)) {
        // The target worked for the first child, so a missing-object error on
        // a later one is a genuine failure, not a wrong-target signal.
        throw new MarketingProviderError(
          `Instagram carousel child creation failed: ${child.missing}`,
          { retryable: true }
        )
      }
      childIds.push(child.id)
    }

    // Children must finish ingesting before the parent can reference them.
    for (const childId of childIds) {
      await waitForInstagramContainerReady(childId, input.accessToken, targetId)
    }

    const parent = await postInstagramContainer({
      accessToken: input.accessToken,
      targetId,
      body: { media_type: 'CAROUSEL', children: childIds, caption: input.caption },
      connection: input.connection,
    })

    if (!('id' in parent)) {
      throw new MarketingProviderError(
        `Instagram carousel container creation failed: ${parent.missing}`,
        { retryable: true }
      )
    }

    return { creationId: parent.id, targetId }
  }

  throw noPublishableAccountError(failures)
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

// Posts the first comment on a freshly published media. Requires the
// instagram_business_manage_comments scope, which lib/marketing-oauth.ts
// already requests. Never throws: the post is live by the time this runs.
async function postInstagramFirstComment(
  mediaId: string,
  message: string,
  accessToken: string
): Promise<void> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/v21.0/${encodeURIComponent(mediaId)}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message.slice(0, 2200) }),
      }
    )
    if (!res.ok) {
      console.warn('[instagram] first comment failed:', await res.text())
    }
  } catch (err) {
    console.warn('[instagram] first comment failed:', err)
  }
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

  // A carousel wins when the founder attached more than one image; otherwise
  // fall back to the single-image path (chosen image, else blind generation).
  const carouselImages = carouselImagesFromPayload(payload)
  let imageUrls: string[]
  if (carouselImages.length > 1) {
    imageUrls = await Promise.all(
      carouselImages.map((url) => prepareInstagramImageUrl(url, ventureName))
    )
  } else {
    const chosenImage = carouselImages[0] ?? selectedImageFromPayload(payload)
    imageUrls = [
      chosenImage
        ? await prepareInstagramImageUrl(chosenImage, ventureName)
        : await generatePostImage(caption, ventureName, brandColors, imageOptionsFromPayload(payload)),
    ]
  }

  // Verify each image URL is publicly fetchable AND served as image/* before
  // handing it to Meta. Without this, error_subcode 2207052 ("Media URI does
  // not meet our terms") fires when the Vercel Blob CDN hasn't propagated yet
  // or when the upstream model returned malformed bytes.
  for (const url of imageUrls) {
    await verifyImageUrlReachable(url)
  }

  // Meta resolves the IG User ID from the access token, so the helpers walk a
  // list of candidate target ids. Avoids the error_subcode 33 "Object with ID
  // X does not exist" failure when the stored provider_account_id drifts from
  // the canonical Instagram Graph user_id.
  const { creationId, targetId } = imageUrls.length > 1
    ? await createInstagramCarouselContainer({ accessToken, imageUrls, caption, connection })
    : await createInstagramMediaContainer({ accessToken, imageUrl: imageUrls[0], caption, connection })

  const imageUrl = imageUrls[0]

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

  // Step 3b: first comment. Keeps hashtags and links out of the caption.
  // Best-effort by design — the post is already live at this point, so a
  // failed comment must never turn a successful publish into a failure.
  const firstComment = stringValue(payload.firstComment)
  if (mediaId && firstComment) {
    await postInstagramFirstComment(mediaId, firstComment, accessToken)
  }

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
