'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LandingAsset, LandingAssetKind } from '@/lib/schemas/landing-assets'

// Popover that lives anchored to the landing-module chat input. Founder
// uploads images here (logo, hero, screenshots, etc.) — the rows write to
// the landing_assets table, the Production Pipeline agent reads them on
// every run, and the resulting <img> tags reference the storage URLs
// directly. Nothing here changes the chat prompt; the assets persist on
// the venture and the agent picks them up automatically.

type Limits = {
  maxBytes: number
  allowedMime: string[]
}

const DEFAULT_KIND: LandingAssetKind = 'image'
const KIND_OPTIONS: Array<{ value: LandingAssetKind; label: string; hint: string }> = [
  { value: 'logo', label: 'Logo', hint: 'Navbar + footer' },
  { value: 'hero', label: 'Hero', hint: 'Hero section image' },
  { value: 'background', label: 'Background', hint: 'Section background' },
  { value: 'product', label: 'Product', hint: 'Product screenshot' },
  { value: 'feature', label: 'Feature', hint: 'Inside a feature card' },
  { value: 'team', label: 'Team', hint: 'About / team section' },
  { value: 'testimonial', label: 'Testimonial', hint: 'Customer avatar' },
  { value: 'customer-logo', label: 'Customer logo', hint: '"Trusted by" strip' },
  { value: 'image', label: 'Other', hint: 'General-purpose image' },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function LandingAssetsPopover({ ventureId, accent, onClose }: {
  ventureId: string
  accent: string
  onClose: () => void
}) {
  const [assets, setAssets] = useState<LandingAsset[]>([])
  const [limits, setLimits] = useState<Limits | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [altText, setAltText] = useState('')
  const [kind, setKind] = useState<LandingAssetKind>(DEFAULT_KIND)
  const [busyId, setBusyId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initial load.
  const loadAssets = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/ventures/${ventureId}/assets`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Failed to load assets (${res.status})`)
      }
      const data = await res.json() as { assets: LandingAsset[]; limits: Limits }
      setAssets(data.assets || [])
      setLimits(data.limits)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [ventureId])

  useEffect(() => { loadAssets() }, [loadAssets])

  // Stage selection — show local preview without uploading yet so the
  // founder can review + fill the label/alt fields first.
  useEffect(() => {
    if (!stagedFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(stagedFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [stagedFile])

  function resetStaging() {
    setStagedFile(null)
    setLabel('')
    setAltText('')
    setKind(DEFAULT_KIND)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (limits) {
      if (file.size > limits.maxBytes) {
        setError(`File is too large. Limit: ${formatBytes(limits.maxBytes)}.`)
        e.target.value = ''
        return
      }
      if (!limits.allowedMime.includes(file.type)) {
        setError(`File type ${file.type || 'unknown'} not allowed.`)
        e.target.value = ''
        return
      }
    }
    setError(null)
    setStagedFile(file)
    // Default the label to the file's basename so the founder rarely has to
    // type — they can edit before upload.
    if (!label) {
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
      if (base) setLabel(base.charAt(0).toUpperCase() + base.slice(1))
    }
  }

  async function handleUpload() {
    if (!stagedFile) return
    try {
      setUploading(true)
      setError(null)
      const form = new FormData()
      form.append('file', stagedFile)
      form.append('label', label)
      form.append('altText', altText || label)
      form.append('kind', kind)
      const res = await fetch(`/api/ventures/${ventureId}/assets`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Upload failed (${res.status})`)
      }
      const { asset } = await res.json() as { asset: LandingAsset }
      setAssets((prev) => [...prev, asset])
      resetStaging()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(assetId: string) {
    if (!window.confirm('Delete this asset? The image will be removed from any landing page that references it.')) return
    try {
      setBusyId(assetId)
      const res = await fetch(`/api/ventures/${ventureId}/assets/${assetId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Delete failed (${res.status})`)
      }
      setAssets((prev) => prev.filter((a) => a.id !== assetId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleUpdateKind(assetId: string, nextKind: LandingAssetKind) {
    try {
      setBusyId(assetId)
      const res = await fetch(`/api/ventures/${ventureId}/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: nextKind }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Update failed (${res.status})`)
      }
      const { asset } = await res.json() as { asset: LandingAsset }
      setAssets((prev) => prev.map((a) => a.id === asset.id ? asset : a))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Landing page images"
      style={{
        width: 'min(420px, calc(100vw - 32px))',
        maxHeight: 'min(540px, calc(100vh - 120px))',
        background: 'var(--card-solid, var(--card, #fff))',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 20px 48px rgba(0,0,0,0.18)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: `${accent}18`, color: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Landing images</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.04em' }}>
              {assets.length} uploaded
              {limits ? ` • Max ${formatBytes(limits.maxBytes)} each` : ''}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--muted)', fontSize: 20, lineHeight: 1, padding: 4,
          }}
        >×</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {error && (
          <div style={{
            marginBottom: 12,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(220,38,38,0.08)',
            color: '#b91c1c',
            fontSize: 11,
            border: '1px solid rgba(220,38,38,0.18)',
          }}>{error}</div>
        )}

        {/* Upload zone */}
        <div style={{
          border: `1px dashed var(--border)`,
          borderRadius: 10,
          padding: 12,
          background: 'rgba(0,0,0,0.015)',
          marginBottom: 14,
        }}>
          {stagedFile && previewUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <img
                  src={previewUrl}
                  alt="staged"
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stagedFile.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                    {stagedFile.type} • {formatBytes(stagedFile.size)}
                  </div>
                </div>
              </div>

              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (e.g. Acme logo, hero photo)"
                maxLength={160}
                style={inputStyle}
              />
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Alt text (defaults to label if blank)"
                maxLength={280}
                style={inputStyle}
              />
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as LandingAssetKind)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label} — {opt.hint}</option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: uploading ? 'wait' : 'pointer',
                    opacity: uploading ? 0.7 : 1,
                    letterSpacing: '0.04em',
                  }}
                >{uploading ? 'Uploading…' : 'Upload'}</button>
                <button
                  onClick={resetStaging}
                  disabled={uploading}
                  style={{
                    padding: '8px 12px',
                    background: 'transparent',
                    color: 'var(--text-soft)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '12px 8px',
                color: 'var(--text-soft)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: accent, opacity: 0.85 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span style={{ fontWeight: 600 }}>Upload an image</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                {limits ? `${limits.allowedMime.map((m) => m.replace('image/', '')).join(', ')} • up to ${formatBytes(limits.maxBytes)}` : 'PNG, JPG, WEBP, SVG, GIF'}
              </span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={limits?.allowedMime.join(',') || 'image/*'}
            onChange={handleFilePicked}
            style={{ display: 'none' }}
          />
        </div>

        {/* Existing assets */}
        {loading ? (
          <div style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 0' }}>Loading…</div>
        ) : assets.length === 0 ? (
          <div style={{
            fontSize: 11,
            color: 'var(--muted)',
            padding: '12px 0',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            No images yet. Upload your logo or hero photo and the next landing-page generation will use them automatically.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assets.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 8,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg)',
                }}
              >
                <img
                  src={a.publicUrl}
                  alt={a.altText || a.label || a.kind}
                  style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, background: '#fff', border: '1px solid var(--border)' }}
                  loading="lazy"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.label || '(no label)'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                    <span>{formatBytes(a.byteSize)}</span>
                    <span style={{ opacity: 0.5 }}>•</span>
                    <select
                      value={a.kind}
                      onChange={(e) => handleUpdateKind(a.id, e.target.value as LandingAssetKind)}
                      disabled={busyId === a.id}
                      style={{
                        fontSize: 10,
                        background: 'transparent',
                        color: 'var(--text-soft)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '1px 4px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {KIND_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={busyId === a.id}
                  title="Delete asset"
                  style={{
                    width: 28, height: 28,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: '#dc2626',
                    cursor: busyId === a.id ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: busyId === a.id ? 0.5 : 0.85,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid var(--border)',
        background: 'rgba(0,0,0,0.02)',
        fontSize: 10,
        color: 'var(--muted)',
        lineHeight: 1.5,
      }}>
        The next time you run or edit the Landing module, the agent will embed these images automatically.
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 7,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
}
