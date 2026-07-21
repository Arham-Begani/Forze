import 'server-only'

import { GoogleGenerativeAI } from '@google/generative-ai'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'

function getImageGeminiApiKey(): string {
  const value = process.env.IMAGE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
  if (!value) throw new Error('IMAGE_GEMINI_API_KEY or GEMINI_API_KEY is required')
  return value
}

// Default to Google's GA native image generation model, returned as inline
// image data via generateContent.
// Set IMAGE_GEMINI_MODEL to an `imagen-*` value to route through the Imagen
// :predict REST endpoint instead.
const IMAGE_MODEL = process.env.IMAGE_GEMINI_MODEL || 'gemini-2.5-flash-image'

const INSTAGRAM_MEDIA_BUCKET = 'instagram-media'

// ─── Art direction ────────────────────────────────────────────────────────────
//
// Before these existed, every generated post image used one hardcoded
// editorial-photography prompt and the founder never saw the result until it
// was live on their account. `editorial_photo` reproduces that exact prompt,
// so any draft that doesn't name a style behaves identically to before.

export const IMAGE_STYLES = [
  'editorial_photo',
  'bold_graphic',
  'product_shot',
  'minimal_type',
  'illustrated',
] as const
export type ImageStyle = (typeof IMAGE_STYLES)[number]
export const DEFAULT_IMAGE_STYLE: ImageStyle = 'editorial_photo'

export function isImageStyle(value: unknown): value is ImageStyle {
  return typeof value === 'string' && (IMAGE_STYLES as readonly string[]).includes(value)
}

interface StylePreset {
  label: string
  /** Positive direction: medium, lighting, composition. */
  style: string
  /** Extra forbidden elements on top of the shared hard rules. */
  negative: string
}

export const IMAGE_STYLE_PRESETS: Record<ImageStyle, StylePreset> = {
  editorial_photo: {
    label: 'Editorial photo',
    style:
      'Style: photorealistic, editorial photography, shallow depth of field, soft directional lighting, considered negative space, premium magazine feel. ' +
      'Composition: rule of thirds, sharp focus on the subject, clean uncluttered background.',
    negative: 'stock-photo clichés (handshakes, lightbulb-ideas, generic office scenes)',
  },
  bold_graphic: {
    label: 'Bold graphic',
    style:
      'Style: flat vector-style graphic design, large simple shapes, high colour contrast, confident geometry, poster-like impact. ' +
      'Composition: one dominant shape or motif, generous flat background, strong silhouette that reads at thumbnail size.',
    negative: 'photorealism, gradients that muddy the shapes, drop shadows, skeuomorphism',
  },
  product_shot: {
    label: 'Product shot',
    style:
      'Style: studio product photography, seamless backdrop, controlled soft-box lighting with one crisp highlight, subtle contact shadow, catalogue quality. ' +
      'Composition: the product centred and hero-framed, filling roughly two thirds of the frame.',
    negative: 'busy environments, human faces, hands entering the frame, cluttered props',
  },
  minimal_type: {
    label: 'Minimal',
    style:
      'Style: extreme minimalism, one subject on a vast plain background, abundant negative space, muted palette, quiet and confident. ' +
      'Composition: subject small and off-centre, most of the frame intentionally empty.',
    negative: 'busy detail, multiple subjects, textures competing for attention',
  },
  illustrated: {
    label: 'Illustrated',
    style:
      'Style: hand-drawn editorial illustration, confident linework, limited flat colour palette, subtle paper grain, New Yorker / Financial Times op-ed feel. ' +
      'Composition: one clear illustrated metaphor, balanced and legible at small sizes.',
    negative: 'photorealism, 3D renders, cartoon mascots, clip-art',
  },
}

// ─── Aspect ratios ────────────────────────────────────────────────────────────
// 1:1 is the default and matches the previous hardcoded 1080x1080 behaviour.

export const IMAGE_ASPECTS = ['1:1', '4:5', '1.91:1'] as const
export type ImageAspect = (typeof IMAGE_ASPECTS)[number]
export const DEFAULT_IMAGE_ASPECT: ImageAspect = '1:1'

export function isImageAspect(value: unknown): value is ImageAspect {
  return typeof value === 'string' && (IMAGE_ASPECTS as readonly string[]).includes(value)
}

const ASPECT_DIMENSIONS: Record<ImageAspect, { width: number; height: number }> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '1.91:1': { width: 1080, height: 566 },
}

interface GeneratedImage {
  buffer: Buffer
  mimeType: string
  extension: string
}

interface GeminiImageResult {
  response: {
    candidates: Array<{
      content: { parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }
    }>
  }
}

async function generateWithImagen(
  prompt: string,
  aspect: ImageAspect = DEFAULT_IMAGE_ASPECT
): Promise<GeneratedImage> {
  const apiKey = getImageGeminiApiKey()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:predict?key=${encodeURIComponent(apiKey)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        // Imagen accepts 1:1 / 4:5 / 16:9 style ratios; 1.91:1 is not in its
        // enum, so ask for the nearest landscape and let sharp do the exact crop.
        aspectRatio: aspect === '1.91:1' ? '16:9' : aspect,
        personGeneration: 'allow_adult',
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Imagen API error ${response.status}: ${errText}`)
  }

  const data = await response.json() as {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
    error?: { message?: string }
  }

  if (data.error) {
    throw new Error(`Imagen API error: ${data.error.message ?? 'unknown'}`)
  }

  const prediction = data.predictions?.[0]
  if (!prediction?.bytesBase64Encoded) {
    throw new Error('Imagen returned no image data')
  }

  const mimeType = prediction.mimeType || 'image/png'
  const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png'
  return {
    buffer: Buffer.from(prediction.bytesBase64Encoded, 'base64'),
    mimeType,
    extension,
  }
}

async function generateWithGeminiInlineImage(prompt: string): Promise<GeneratedImage> {
  const genAI = new GoogleGenerativeAI(getImageGeminiApiKey())
  const model = genAI.getGenerativeModel({ model: IMAGE_MODEL })

  let result: GeminiImageResult

  try {
    result = await (model as unknown as {
      generateContent: (params: {
        contents: Array<{ role: string; parts: Array<{ text: string }> }>
        generationConfig: { responseModalities: string[] }
      }) => Promise<GeminiImageResult>
    }).generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('404') || message.includes('NOT_FOUND')) {
      throw new Error(
        `Gemini image model "${IMAGE_MODEL}" was not found or does not support image generation. ` +
          'Set IMAGE_GEMINI_MODEL to a supported image model such as gemini-2.5-flash-image.'
      )
    }
    throw error
  }

  const candidates = result.response.candidates ?? []
  for (const candidate of candidates) {
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || 'image/png'
        const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png'
        return {
          buffer: Buffer.from(part.inlineData.data, 'base64'),
          mimeType,
          extension,
        }
      }
    }
  }
  throw new Error('Gemini image generation returned no image data')
}

async function normalizeForInstagramFeed(
  image: GeneratedImage,
  aspect: ImageAspect = DEFAULT_IMAGE_ASPECT
): Promise<GeneratedImage> {
  const { width, height } = ASPECT_DIMENSIONS[aspect] ?? ASPECT_DIMENSIONS[DEFAULT_IMAGE_ASPECT]
  const buffer = await sharp(image.buffer, { failOn: 'error' })
    .rotate()
    .resize(width, height, {
      fit: 'cover',
      position: 'attention',
    })
    .flatten({ background: '#ffffff' })
    .toColorspace('srgb')
    .jpeg({
      quality: 92,
      progressive: false,
      mozjpeg: false,
    })
    .toBuffer()

  return {
    buffer,
    mimeType: 'image/jpeg',
    extension: 'jpg',
  }
}

let bucketReady: Promise<void> | null = null

async function ensureInstagramMediaBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase.storage.listBuckets()
      if (error) throw new Error(`Failed to list storage buckets: ${error.message}`)

      const exists = data.some((bucket) => bucket.name === INSTAGRAM_MEDIA_BUCKET)
      const options = {
        public: true,
        fileSizeLimit: 8 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png'],
      }

      const result = exists
        ? await supabase.storage.updateBucket(INSTAGRAM_MEDIA_BUCKET, options)
        : await supabase.storage.createBucket(INSTAGRAM_MEDIA_BUCKET, options)

      if (result.error) {
        throw new Error(`Failed to prepare Instagram media bucket: ${result.error.message}`)
      }
    })()
  }

  return bucketReady
}

async function uploadInstagramImage(filename: string, image: GeneratedImage): Promise<string> {
  await ensureInstagramMediaBucket()

  const supabase = createAdminClient()
  const { error } = await supabase.storage
    .from(INSTAGRAM_MEDIA_BUCKET)
    .upload(filename, image.buffer, {
      cacheControl: '3600',
      contentType: image.mimeType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload Instagram image: ${error.message}`)
  }

  const { data } = supabase.storage.from(INSTAGRAM_MEDIA_BUCKET).getPublicUrl(filename)
  if (!data.publicUrl) {
    throw new Error('Failed to create public Instagram image URL')
  }

  return data.publicUrl
}

/**
 * Uploads a user-supplied PNG/JPG buffer (e.g. from a file <input>) and returns
 * a public URL that's safe for Instagram's ingest crawler. The buffer is
 * normalized to a 1080×1080 JPEG so it always meets Meta's media requirements.
 */
export async function uploadUserSuppliedInstagramImage(
  buffer: Buffer,
  mimeType: string,
  ventureName: string
): Promise<string> {
  if (buffer.byteLength === 0) {
    throw new Error('Uploaded image is empty')
  }
  if (buffer.byteLength > 8 * 1024 * 1024) {
    throw new Error('Image must be 8 MB or smaller')
  }

  const inferredMime = mimeType.toLowerCase()
  const isPng = inferredMime.includes('png')
  const isJpeg = inferredMime.includes('jpeg') || inferredMime.includes('jpg')
  if (!isPng && !isJpeg) {
    throw new Error('Only PNG and JPG images are supported')
  }

  const normalized = await normalizeForInstagramFeed({
    buffer,
    mimeType: isPng ? 'image/png' : 'image/jpeg',
    extension: isPng ? 'png' : 'jpg',
  })

  const safeName = ventureName.replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase().slice(0, 40) || 'post'
  return uploadInstagramImage(`uploads/${safeName}-${Date.now()}.${normalized.extension}`, normalized)
}

export async function prepareInstagramImageUrl(imageUrl: string, ventureName: string): Promise<string> {
  const normalizedUrl = imageUrl.trim()
  if (
    normalizedUrl.includes('/storage/v1/object/public/instagram-media/') &&
    normalizedUrl.includes('.supabase.co/')
  ) {
    return normalizedUrl
  }

  const response = await fetch(normalizedUrl, {
    cache: 'no-store',
    headers: {
      Accept: 'image/jpeg,image/png,image/*;q=0.8,*/*;q=0.5',
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    },
  })

  if (!response.ok) {
    throw new Error(`Unable to fetch Instagram image URL before publishing: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/')) {
    throw new Error(`Instagram image URL did not return image content: ${contentType || 'unknown content type'}`)
  }

  const source = await normalizeForInstagramFeed({
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: contentType,
    extension: contentType.includes('png') ? 'png' : 'jpg',
  })
  const safeName = ventureName.replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase().slice(0, 40) || 'post'
  return uploadInstagramImage(`prepared/${safeName}-${Date.now()}.${source.extension}`, source)
}

/**
 * Generates a branded social image for an Instagram post and uploads it to a
 * public Supabase Storage bucket. Returns the public URL that Instagram's crawler
 * will fetch when creating the media container.
 */
export interface PostImageOptions {
  caption: string
  ventureName: string
  brandColors?: string[]
  style?: ImageStyle
  /** Free-text art direction typed by the founder. Treated as untrusted. */
  artDirection?: string
  aspect?: ImageAspect
}

const MAX_ART_DIRECTION = 400

// The art-direction box is founder-supplied text that lands in a model prompt.
// Strip control characters and cap the length so it can't be used to smuggle
// a wall of instructions past the hard rules below.
function sanitizeArtDirection(input: string | undefined | null): string {
  if (!input) return ''
  return input
    .replace(/[\u0000-\u0008\u000B-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ART_DIRECTION)
}

/**
 * Builds the image-generation prompt. Exported and pure so the same string can
 * be shown to the founder or unit-tested without spending a generation.
 */
export function buildImagePrompt(options: PostImageOptions): string {
  const { caption, ventureName, brandColors, aspect = DEFAULT_IMAGE_ASPECT } = options
  const preset = IMAGE_STYLE_PRESETS[options.style ?? DEFAULT_IMAGE_STYLE]
    ?? IMAGE_STYLE_PRESETS[DEFAULT_IMAGE_STYLE]

  const colorHint =
    brandColors && brandColors.length > 0
      ? `Brand palette: ${brandColors.join(', ')}. Use these tones tastefully — do not paint the entire image in them.`
      : 'Use a refined, modern palette with soft natural light, gentle shadows, and rich material textures.'

  const cleanCaption = caption
    .replace(/(^|\s)#[\w-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320)

  const artDirection = sanitizeArtDirection(options.artDirection)
  const artDirectionHint = artDirection
    ? `The brand owner asked for this specifically, honour it wherever it does not conflict with the hard rules: "${artDirection}". `
    : ''

  const aspectHint = aspect === '4:5'
    ? '4:5 portrait'
    : aspect === '1.91:1'
      ? '1.91:1 landscape'
      : '1:1 square'

  return (
    `You are an editorial art director composing a single Instagram feed post for a brand called "${ventureName}". ` +
    `The caption the image must visually support is: "${cleanCaption}". ` +
    `Translate the meaning of that caption into a concrete, depictable scene — not an abstract concept. ` +
    `Pick ONE clear subject (a person mid-action, an object on a surface, an environment, or a still life) and stage it deliberately. ` +
    `${colorHint} ` +
    `${artDirectionHint}` +
    `${preset.style} Frame it as ${aspectHint}. ` +
    `Hard rules — do NOT include any of these: text, words, letters, numbers, logos, watermarks, captions, UI mockups, app screenshots, charts, infographics, ` +
    `collages, multiple panels, borders, frames, AI-generated faces with distorted features, or ${preset.negative}. ` +
    `If the caption mentions a product, depict the product itself — not a person holding a sign about it. ` +
    `Output a single, full-bleed, gallery-quality image.`
  )
}

async function renderAndUpload(options: PostImageOptions): Promise<string> {
  const aspect = options.aspect ?? DEFAULT_IMAGE_ASPECT
  const prompt = buildImagePrompt(options)
  const usingImagen = IMAGE_MODEL.startsWith('imagen-')
  const generatedImage = usingImagen
    ? await generateWithImagen(prompt, aspect)
    : await generateWithGeminiInlineImage(prompt)
  const image = await normalizeForInstagramFeed(generatedImage, aspect)

  const safeName = options.ventureName.replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase().slice(0, 40) || 'post'
  // Random suffix: candidates generated in the same millisecond would
  // otherwise collide on filename and the second upload would fail
  // (uploadInstagramImage uses upsert: false).
  const suffix = Math.random().toString(36).slice(2, 8)
  const filename = `generated/${safeName}-${Date.now()}-${suffix}.${image.extension}`
  return uploadInstagramImage(filename, image)
}

export async function generatePostImage(
  caption: string,
  ventureName: string,
  brandColors?: string[],
  options: Omit<PostImageOptions, 'caption' | 'ventureName' | 'brandColors'> = {}
): Promise<string> {
  return renderAndUpload({ caption, ventureName, brandColors, ...options })
}

export const MAX_IMAGE_CANDIDATES = 3

/**
 * Generates up to `count` independent candidates so the founder can pick one
 * before publishing. Partial success is a valid result — a single model hiccup
 * shouldn't waste the candidates that did render. Throws only when every
 * attempt failed, so the caller can surface one honest error.
 */
export async function generatePostImageCandidates(
  options: PostImageOptions,
  count: number
): Promise<string[]> {
  const attempts = Math.max(1, Math.min(MAX_IMAGE_CANDIDATES, Math.floor(count) || 1))
  const results = await Promise.allSettled(
    Array.from({ length: attempts }, () => renderAndUpload(options))
  )

  const urls = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map((r) => r.value)

  if (urls.length === 0) {
    const firstRejection = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    const reason = firstRejection?.reason
    throw new Error(reason instanceof Error ? reason.message : 'Image generation failed')
  }

  return urls
}
