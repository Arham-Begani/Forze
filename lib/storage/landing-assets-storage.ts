import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

// Supabase Storage bucket for user-supplied landing-page imagery. Public so
// the rendered iframe can embed images via plain <img src="..."> without
// signed URL refresh dances. Mirrors the pattern used by the Instagram
// media bucket in lib/marketing-image-gen.ts.
export const LANDING_ASSETS_BUCKET =
  process.env.LANDING_ASSETS_BUCKET || 'landing-assets'

export const LANDING_ASSETS_MAX_BYTES =
  Number(process.env.LANDING_ASSETS_MAX_BYTES || 8 * 1024 * 1024)

export const LANDING_ASSETS_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
] as const

export type LandingAssetMimeType = (typeof LANDING_ASSETS_ALLOWED_MIME)[number]

let bucketReady: Promise<void> | null = null

async function ensureLandingAssetsBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase.storage.listBuckets()
      if (error) {
        throw new Error(`Failed to list storage buckets: ${error.message}`)
      }
      const exists = (data ?? []).some((b) => b.name === LANDING_ASSETS_BUCKET)
      const options = {
        public: true,
        fileSizeLimit: LANDING_ASSETS_MAX_BYTES,
        allowedMimeTypes: [...LANDING_ASSETS_ALLOWED_MIME],
      }
      const result = exists
        ? await supabase.storage.updateBucket(LANDING_ASSETS_BUCKET, options)
        : await supabase.storage.createBucket(LANDING_ASSETS_BUCKET, options)
      if (result.error) {
        throw new Error(
          `Failed to prepare landing assets bucket: ${result.error.message}`,
        )
      }
    })()
  }
  return bucketReady
}

// Compose a deterministic-ish storage path. UUID prefix prevents
// collisions between two uploads with the same filename in the same
// venture, while keeping the venture grouping visible in the bucket UI.
function safeFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'file'
  )
}

export function buildLandingAssetPath(
  ventureId: string,
  uploadId: string,
  originalName: string,
  mime: LandingAssetMimeType,
): string {
  const ext =
    mime === 'image/jpeg'
      ? 'jpg'
      : mime === 'image/png'
        ? 'png'
        : mime === 'image/webp'
          ? 'webp'
          : mime === 'image/svg+xml'
            ? 'svg'
            : 'gif'
  const trimmedName = safeFilename(originalName.replace(/\.[^.]+$/, ''))
  return `${ventureId}/${uploadId}-${trimmedName}.${ext}`
}

export type UploadLandingAssetInput = {
  ventureId: string
  uploadId: string
  originalName: string
  buffer: Buffer
  mime: LandingAssetMimeType
}

export type UploadLandingAssetResult = {
  storagePath: string
  publicUrl: string
}

export async function uploadLandingAssetToStorage(
  input: UploadLandingAssetInput,
): Promise<UploadLandingAssetResult> {
  await ensureLandingAssetsBucket()
  const supabase = createAdminClient()
  const storagePath = buildLandingAssetPath(
    input.ventureId,
    input.uploadId,
    input.originalName,
    input.mime,
  )
  const { error } = await supabase.storage
    .from(LANDING_ASSETS_BUCKET)
    .upload(storagePath, input.buffer, {
      cacheControl: '31536000',
      contentType: input.mime,
      upsert: false,
    })
  if (error) {
    throw new Error(`Failed to upload landing asset: ${error.message}`)
  }
  const { data } = supabase.storage
    .from(LANDING_ASSETS_BUCKET)
    .getPublicUrl(storagePath)
  if (!data?.publicUrl) {
    throw new Error('Failed to create public landing asset URL')
  }
  return { storagePath, publicUrl: data.publicUrl }
}

export async function deleteLandingAssetFromStorage(
  storagePath: string,
): Promise<void> {
  await ensureLandingAssetsBucket()
  const supabase = createAdminClient()
  const { error } = await supabase.storage
    .from(LANDING_ASSETS_BUCKET)
    .remove([storagePath])
  if (error) {
    // Soft-fail on missing object — the DB row deletion is what matters.
    if (!/not found|does not exist/i.test(error.message)) {
      throw new Error(`Failed to remove landing asset: ${error.message}`)
    }
  }
}

export function isAllowedLandingAssetMime(mime: string): mime is LandingAssetMimeType {
  return (LANDING_ASSETS_ALLOWED_MIME as readonly string[]).includes(mime)
}
