import 'server-only'

import { createDb } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'
import type { LandingAsset, LandingAssetKind, LandingAssetPatch } from '@/lib/schemas/landing-assets'

// Raw row shape as Postgres returns it. Kept private — callers receive the
// camelCase LandingAsset transformed by `rowToAsset`.
type LandingAssetRow = {
  id: string
  venture_id: string
  user_id: string
  storage_path: string
  public_url: string
  label: string
  alt_text: string
  kind: LandingAssetKind
  mime_type: string
  byte_size: number
  width: number | null
  height: number | null
  created_at: string
  updated_at: string
}

function rowToAsset(row: LandingAssetRow): LandingAsset {
  return {
    id: row.id,
    ventureId: row.venture_id,
    userId: row.user_id,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    label: row.label ?? '',
    altText: row.alt_text ?? '',
    kind: row.kind,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listLandingAssets(ventureId: string): Promise<LandingAsset[]> {
  const db = await createDb()
  const { data, error } = await db
    .from('landing_assets')
    .select('*')
    .eq('venture_id', ventureId)
    .order('created_at', { ascending: true })
  if (error) {
    throw new Error(`listLandingAssets failed: ${error.message}`)
  }
  return (data ?? []).map((row) => rowToAsset(row as LandingAssetRow))
}

export type InsertLandingAssetInput = {
  ventureId: string
  userId: string
  storagePath: string
  publicUrl: string
  label: string
  altText: string
  kind: LandingAssetKind
  mimeType: string
  byteSize: number
  width?: number | null
  height?: number | null
}

export async function insertLandingAsset(input: InsertLandingAssetInput): Promise<LandingAsset> {
  const db = await createDb()
  const { data, error } = await db
    .from('landing_assets')
    .insert({
      venture_id: input.ventureId,
      user_id: input.userId,
      storage_path: input.storagePath,
      public_url: input.publicUrl,
      label: input.label,
      alt_text: input.altText,
      kind: input.kind,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      width: input.width ?? null,
      height: input.height ?? null,
    })
    .select('*')
    .single()

  // Fallback to admin client if RLS rejected the insert (legacy ventures
  // not yet enrolled in venture_members). Mirrors the pattern in
  // lib/queries/inspiration-queries.ts.
  if (error || !data) {
    const admin = createAdminClient()
    const { data: adminData, error: adminError } = await admin
      .from('landing_assets')
      .insert({
        venture_id: input.ventureId,
        user_id: input.userId,
        storage_path: input.storagePath,
        public_url: input.publicUrl,
        label: input.label,
        alt_text: input.altText,
        kind: input.kind,
        mime_type: input.mimeType,
        byte_size: input.byteSize,
        width: input.width ?? null,
        height: input.height ?? null,
      })
      .select('*')
      .single()
    if (adminError || !adminData) {
      throw new Error(`insertLandingAsset failed: ${adminError?.message || error?.message || 'unknown'}`)
    }
    return rowToAsset(adminData as LandingAssetRow)
  }
  return rowToAsset(data as LandingAssetRow)
}

export async function getLandingAssetById(
  ventureId: string,
  assetId: string,
): Promise<LandingAsset | null> {
  const db = await createDb()
  const { data, error } = await db
    .from('landing_assets')
    .select('*')
    .eq('id', assetId)
    .eq('venture_id', ventureId)
    .single()
  if (error || !data) return null
  return rowToAsset(data as LandingAssetRow)
}

export async function updateLandingAsset(
  ventureId: string,
  assetId: string,
  patch: LandingAssetPatch,
): Promise<LandingAsset | null> {
  const db = await createDb()
  const updates: Record<string, unknown> = {}
  if (patch.label !== undefined) updates.label = patch.label
  if (patch.altText !== undefined) updates.alt_text = patch.altText
  if (patch.kind !== undefined) updates.kind = patch.kind
  if (Object.keys(updates).length === 0) {
    return getLandingAssetById(ventureId, assetId)
  }
  const { data, error } = await db
    .from('landing_assets')
    .update(updates)
    .eq('id', assetId)
    .eq('venture_id', ventureId)
    .select('*')
    .single()
  if (error || !data) return null
  return rowToAsset(data as LandingAssetRow)
}

export async function deleteLandingAssetRow(
  ventureId: string,
  assetId: string,
): Promise<{ storagePath: string } | null> {
  const db = await createDb()
  // Fetch storage path BEFORE delete so the route can remove the storage
  // object after the DB row is gone.
  const existing = await getLandingAssetById(ventureId, assetId)
  if (!existing) return null
  const { error } = await db
    .from('landing_assets')
    .delete()
    .eq('id', assetId)
    .eq('venture_id', ventureId)
  if (error) {
    // Try with admin client as a fallback (legacy RLS gap).
    const admin = createAdminClient()
    const { error: adminError } = await admin
      .from('landing_assets')
      .delete()
      .eq('id', assetId)
      .eq('venture_id', ventureId)
    if (adminError) {
      throw new Error(`deleteLandingAssetRow failed: ${adminError.message}`)
    }
  }
  return { storagePath: existing.storagePath }
}
