'use client'

import { useRef, useState } from 'react'
import type { MarketingAsset } from '@/lib/marketing.shared'
import { buttonStyle, inputStyle, sectionLabelStyle } from './styles'

// Art direction for a post's image, at DRAFT time. The style/aspect ids mirror
// lib/marketing-image-gen.ts — keep them in sync; the server re-validates with
// isImageStyle/isImageAspect and falls back to defaults on anything unknown.

const STYLES: Array<{ id: string; label: string; hint: string }> = [
  { id: 'editorial_photo', label: 'Editorial', hint: 'Photoreal, shallow depth of field, magazine feel' },
  { id: 'bold_graphic', label: 'Bold graphic', hint: 'Flat shapes, high contrast, poster impact' },
  { id: 'product_shot', label: 'Product', hint: 'Studio backdrop, catalogue lighting' },
  { id: 'minimal_type', label: 'Minimal', hint: 'One subject, lots of empty space' },
  { id: 'illustrated', label: 'Illustrated', hint: 'Hand-drawn op-ed illustration' },
]

const ASPECTS: Array<{ id: string; label: string }> = [
  { id: '1:1', label: 'Square' },
  { id: '4:5', label: 'Portrait' },
  { id: '1.91:1', label: 'Landscape' },
]

const MAX_ART_DIRECTION = 400

function chipStyle(active: boolean): React.CSSProperties {
  return {
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-soft)',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}

export interface ImageStudioProps {
  asset: MarketingAsset
  /** Brand palette resolved server-side; read-only here. */
  brandColors: string[]
  style: string
  aspect: string
  artDirection: string
  candidates: string[]
  selectedIndex: number
  uploadedUrl: string
  busy: boolean
  onChange: (patch: {
    style?: string
    aspect?: string
    artDirection?: string
    selectedIndex?: number
    uploadedUrl?: string
  }) => void
  onGenerated: (asset: MarketingAsset) => void
}

export function ImageStudio({
  asset,
  brandColors,
  style,
  aspect,
  artDirection,
  candidates,
  selectedIndex,
  uploadedUrl,
  busy,
  onChange,
  onGenerated,
}: ImageStudioProps) {
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const disabled = busy || generating || uploading

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/ventures/${asset.venture_id}/marketing/assets/${asset.id}/image`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ style, aspect, artDirection: artDirection.trim(), count: 3 }),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Image generation failed')
      }
      onGenerated(data.asset as MarketingAsset)
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Image generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleFile(file: File | null) {
    if (!file) return
    const mime = (file.type || '').toLowerCase()
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(mime)) {
      setError('Only PNG and JPG images are accepted')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Image must be 8 MB or smaller')
      return
    }

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`/api/ventures/${asset.venture_id}/marketing/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Image upload failed')
      onChange({ uploadedUrl: data.url as string })
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={sectionLabelStyle}>Post image</div>

      {/* An uploaded image always wins at publish time, so make that visible
          rather than letting generated options look active but unused. */}
      {uploadedUrl.trim() ? (
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: 10,
            borderRadius: 14,
            background: 'var(--sidebar)',
            border: '1px solid var(--border)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={uploadedUrl}
            alt="Uploaded post image"
            style={{
              width: 72,
              height: 72,
              objectFit: 'cover',
              borderRadius: 10,
              border: '1px solid var(--border)',
              flexShrink: 0,
            }}
            onError={(event) => {
              ;(event.currentTarget as HTMLImageElement).style.visibility = 'hidden'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>
              Your uploaded image will be used. Remove it to publish a generated one instead.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled} style={buttonStyle('secondary')}>
                {uploading ? 'Uploading…' : 'Replace'}
              </button>
              <button type="button" onClick={() => onChange({ uploadedUrl: '' })} disabled={disabled} style={buttonStyle('danger')}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STYLES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                title={preset.hint}
                onClick={() => onChange({ style: preset.id })}
                disabled={disabled}
                style={chipStyle(style === preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {ASPECTS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange({ aspect: option.id })}
                disabled={disabled}
                style={chipStyle(aspect === option.id)}
              >
                {option.label}
              </button>
            ))}

            {brandColors.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Brand</span>
                {brandColors.map((color) => (
                  <span
                    key={color}
                    title={color}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: color,
                      border: '1px solid var(--border)',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              Art direction (optional)
            </label>
            <textarea
              value={artDirection}
              maxLength={MAX_ART_DIRECTION}
              onChange={(event) => onChange({ artDirection: event.target.value })}
              placeholder="e.g. warm morning light, a ceramic mug on a linen table"
              rows={2}
              disabled={disabled}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
              {artDirection.length}/{MAX_ART_DIRECTION}
            </div>
          </div>

          {candidates.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
              {candidates.map((url, index) => {
                const active = index === selectedIndex
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onChange({ selectedIndex: index })}
                    disabled={disabled}
                    aria-pressed={active}
                    aria-label={`Use image option ${index + 1}`}
                    style={{
                      position: 'relative',
                      padding: 0,
                      border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 12,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: 'var(--sidebar)',
                      aspectRatio: '1 / 1',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Option ${index + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(event) => {
                        ;(event.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                      }}
                    />
                    {active && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        style={{ display: 'none' }}
      />

      {!uploadedUrl.trim() && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={generate} disabled={disabled} style={buttonStyle('primary')}>
            {generating ? 'Generating…' : candidates.length > 0 ? 'Regenerate options' : 'Generate 3 options'}
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled} style={buttonStyle('secondary')}>
            {uploading ? 'Uploading…' : 'Upload your own'}
          </button>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: '#dc2626', lineHeight: 1.5 }}>{error}</div>
      )}

      {!uploadedUrl.trim() && candidates.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
          If you publish without choosing an image, one is generated automatically using the style above.
        </div>
      )}
    </div>
  )
}
