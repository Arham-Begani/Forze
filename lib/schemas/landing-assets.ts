import { z } from 'zod'

// Founder-supplied hint that tells the Production Pipeline agent where the
// asset is intended to slot in the generated landing page.
export const LandingAssetKindSchema = z.enum([
  'logo',
  'hero',
  'product',
  'team',
  'customer-logo',
  'background',
  'testimonial',
  'feature',
  'image',
])

export type LandingAssetKind = z.infer<typeof LandingAssetKindSchema>

// Row shape returned to clients (camelCase for the UI; the DB row uses
// snake_case and gets transformed in lib/queries/landing-asset-queries.ts).
export const LandingAssetSchema = z.object({
  id: z.string().uuid(),
  ventureId: z.string().uuid(),
  userId: z.string().uuid(),
  storagePath: z.string(),
  publicUrl: z.string().url(),
  label: z.string(),
  altText: z.string(),
  kind: LandingAssetKindSchema,
  mimeType: z.string(),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().nonnegative().nullable().optional(),
  height: z.number().int().nonnegative().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type LandingAsset = z.infer<typeof LandingAssetSchema>

// Multipart upload metadata accepted by POST /api/ventures/[id]/assets.
// The file itself is the formData "file" field; these are the optional
// founder-supplied hints transmitted alongside.
export const LandingAssetUploadMetaSchema = z.object({
  label: z.string().min(0).max(160).default(''),
  altText: z.string().min(0).max(280).default(''),
  kind: LandingAssetKindSchema.default('image'),
})

export type LandingAssetUploadMeta = z.infer<typeof LandingAssetUploadMetaSchema>

// PATCH /api/ventures/[id]/assets/[assetId] — partial metadata edit.
export const LandingAssetPatchSchema = z
  .object({
    label: z.string().min(0).max(160).optional(),
    altText: z.string().min(0).max(280).optional(),
    kind: LandingAssetKindSchema.optional(),
  })
  .refine(
    (input) =>
      input.label !== undefined ||
      input.altText !== undefined ||
      input.kind !== undefined,
    { message: 'At least one of label, altText, or kind must be supplied.' },
  )

export type LandingAssetPatch = z.infer<typeof LandingAssetPatchSchema>
