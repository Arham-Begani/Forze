'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MarketingAsset, SocialConnection, SocialProvider } from '@/lib/marketing.shared'

const INSTAGRAM_DRAFT_QUEUE_CAP = 2
const DRAFT_LIKE_STATUSES = new Set(['draft', 'approved', 'scheduled'])

interface InstagramInsights {
  likeCount: number | null
  commentsCount: number | null
  reach: number | null
  impressions: number | null
  saved: number | null
  permalink: string | null
  caption: string | null
  comments: Array<{ id: string; text: string; username: string | null; timestamp: string | null }>
  commentsFetchError?: string | null
  fetchedAt: string
}

interface CommentAnalysis {
  totalCommentsAnalyzed: number
  themes: Array<{ theme: string; frequency: 'rare' | 'occasional' | 'common'; exampleQuote: string }>
  topPositiveSignal: string | null
  topConcern: string | null
  notableQuestions: string[]
  commentDriverVerdict: string
}

interface InstagramValidation {
  signalStrength: 'weak' | 'moderate' | 'strong'
  signalSummary: string
  sentiment: { positive: number; neutral: number; negative: number; headline: string }
  commentAnalysis?: CommentAnalysis
  audienceObservations: string[]
  ideaValidationVerdict: 'validated' | 'mixed' | 'invalidated' | 'inconclusive'
  verdictReasoning: string
  startupImprovements: Array<{ area: string; suggestion: string; priority: 'high' | 'medium' | 'low' }>
}

interface AggregateValidation extends InstagramValidation {
  postsAnalyzed: number
  totalEngagement: { likes: number; comments: number; reach: number; impressions: number; saves: number }
  perPostHighlights: Array<{ assetId: string; headline: string; signal: 'weak' | 'moderate' | 'strong' }>
}

type BillingSummary = {
  planSlug: string
  planLabel: string
  hasUnlimitedAccess: boolean
}

type ConnectionsResponse = {
  connections: SocialConnection[]
}

type AssetsResponse = {
  assets: MarketingAsset[]
}

const PROVIDERS: Array<{ id: SocialProvider; label: string; description: string }> = [
  {
    id: 'youtube',
    label: 'YouTube',
    description: 'Upload metadata and publish launch videos from a connected YouTube account.',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    description: 'Turn your marketing strategy into member-ready LinkedIn posts and schedule them.',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    description: 'Publish AI-generated image posts to your Instagram Business account with AI-crafted captions.',
  },
]

function toInputDateTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const tzOffset = date.getTimezoneOffset() * 60_000
  const local = new Date(date.getTime() - tzOffset)
  return local.toISOString().slice(0, 16)
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':
    case 'approved':
    case 'published':
    case 'completed':
      return '#16a34a'
    case 'scheduled':
    case 'publishing':
    case 'processing':
      return '#2563eb'
    case 'needs_reauth':
    case 'reauth_required':
      return '#d97706'
    case 'failed':
    case 'revoked':
      return '#dc2626'
    default:
      return '#6b7280'
  }
}

function providerPayloadDefaults(provider: SocialProvider): Record<string, unknown> {
  if (provider === 'youtube') {
    return {
      videoSourceUrl: '',
      privacyStatus: 'unlisted',
      tags: [],
      categoryId: '28',
    }
  }

  if (provider === 'instagram') {
    return {
      hashtags: [],
      imageUrl: '',
    }
  }

  return {
    linkUrl: '',
    visibility: 'PUBLIC',
  }
}

function FlashMessage({
  tone,
  message,
}: {
  tone: 'success' | 'error'
  message: string
}) {
  const color = tone === 'success' ? '#16a34a' : '#dc2626'
  return (
    <div
      style={{
        border: `1px solid ${color}24`,
        background: `${color}10`,
        color,
        borderRadius: 14,
        padding: '12px 14px',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {message}
    </div>
  )
}

function AssetEditorCard({
  asset,
  onSaved,
  onRemoved,
}: {
  asset: MarketingAsset
  onSaved: (asset: MarketingAsset) => void
  onRemoved: (asset: MarketingAsset) => void
}) {
  const [title, setTitle] = useState(asset.title)
  const [body, setBody] = useState(asset.body)
  const [scheduleAt, setScheduleAt] = useState(toInputDateTime(asset.scheduled_for))
  const [videoSourceUrl, setVideoSourceUrl] = useState(typeof asset.payload.videoSourceUrl === 'string' ? asset.payload.videoSourceUrl : '')
  const [tags, setTags] = useState(Array.isArray(asset.payload.tags) ? asset.payload.tags.join(', ') : '')
  const [privacyStatus, setPrivacyStatus] = useState(typeof asset.payload.privacyStatus === 'string' ? asset.payload.privacyStatus : 'unlisted')
  const [linkUrl, setLinkUrl] = useState(typeof asset.payload.linkUrl === 'string' ? asset.payload.linkUrl : '')
  const [imageUrl, setImageUrl] = useState(typeof asset.payload.imageUrl === 'string' ? asset.payload.imageUrl : '')
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleImageFile(file: File | null) {
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

    setUploadingImage(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`/api/ventures/${asset.venture_id}/marketing/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Image upload failed')
      setImageUrl(data.url as string)
      setMessage('Image uploaded')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  useEffect(() => {
    setTitle(asset.title)
    setBody(asset.body)
    setScheduleAt(toInputDateTime(asset.scheduled_for))
    setVideoSourceUrl(typeof asset.payload.videoSourceUrl === 'string' ? asset.payload.videoSourceUrl : '')
    setTags(Array.isArray(asset.payload.tags) ? asset.payload.tags.join(', ') : '')
    setPrivacyStatus(typeof asset.payload.privacyStatus === 'string' ? asset.payload.privacyStatus : 'unlisted')
    setLinkUrl(typeof asset.payload.linkUrl === 'string' ? asset.payload.linkUrl : '')
    setImageUrl(typeof asset.payload.imageUrl === 'string' ? asset.payload.imageUrl : '')
  }, [asset])

  const payload = useMemo(() => {
    if (asset.provider === 'youtube') {
      return {
        ...providerPayloadDefaults('youtube'),
        ...asset.payload,
        videoSourceUrl,
        privacyStatus,
        tags: tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }
    }

    if (asset.provider === 'instagram') {
      return {
        ...providerPayloadDefaults('instagram'),
        ...asset.payload,
        imageUrl: imageUrl.trim(),
      }
    }

    return {
      ...providerPayloadDefaults('linkedin'),
      ...asset.payload,
      linkUrl,
    }
  }, [asset.payload, asset.provider, imageUrl, linkUrl, privacyStatus, tags, videoSourceUrl])

  async function saveAsset(showMessage = true) {
    const response = await fetch(`/api/ventures/${asset.venture_id}/marketing/assets/${asset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, payload }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to save asset')
    onSaved(data.asset as MarketingAsset)
    if (showMessage) {
      setMessage('Saved')
    }
  }

  async function doAction(action: 'save' | 'approve' | 'schedule' | 'publish' | 'cancel') {
    setBusy(true)
    setMessage(null)
    setError(null)

    try {
      if (action === 'save') {
        await saveAsset()
        return
      }

      if (action === 'approve') {
        const response = await fetch(`/api/ventures/${asset.venture_id}/marketing/assets/${asset.id}/approve`, {
          method: 'POST',
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to approve asset')
        onSaved(data.asset as MarketingAsset)
        setMessage('Approved')
        return
      }

      if (action === 'schedule') {
        if (!scheduleAt) {
          throw new Error('Choose a schedule time first')
        }

        await saveAsset(false)

        const response = await fetch(`/api/ventures/${asset.venture_id}/marketing/assets/${asset.id}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledFor: new Date(scheduleAt).toISOString() }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to schedule asset')
        onSaved(data.asset as MarketingAsset)
        setMessage('Scheduled')
        return
      }

      if (action === 'publish') {
        await saveAsset(false)

        const response = await fetch(`/api/ventures/${asset.venture_id}/marketing/assets/${asset.id}/publish`, {
          method: 'POST',
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to publish asset')
        setMessage(data.summary?.completed ? 'Published' : 'Queued for publishing')
        onRemoved(asset)
        return
      }

      const response = await fetch(`/api/ventures/${asset.venture_id}/marketing/assets/${asset.id}/cancel`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to cancel schedule')
      onSaved(data.asset as MarketingAsset)
      setMessage('Schedule cancelled')
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--glass-border)',
        background: 'var(--glass-bg-strong)',
        borderRadius: 18,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {asset.provider === 'youtube' ? 'YouTube video draft' : asset.provider === 'instagram' ? 'Instagram post draft' : 'LinkedIn post draft'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            Created {new Date(asset.created_at).toLocaleString()}
          </div>
        </div>
        <span
          style={{
            padding: '5px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            color: statusColor(asset.status),
            background: `${statusColor(asset.status)}12`,
            border: `1px solid ${statusColor(asset.status)}20`,
            textTransform: 'capitalize',
          }}
        >
          {asset.status.replace('_', ' ')}
        </span>
      </div>

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Title"
        style={{
          width: '100%',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--sidebar)',
          color: 'var(--text)',
          padding: '10px 12px',
          fontSize: 14,
          fontFamily: 'inherit',
        }}
      />

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={asset.provider === 'youtube' ? 'Video description' : asset.provider === 'instagram' ? 'Caption (hashtags included)' : 'Post copy'}
        rows={6}
        style={{
          width: '100%',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--sidebar)',
          color: 'var(--text)',
          padding: '10px 12px',
          fontSize: 14,
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />

      {asset.provider === 'youtube' ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <input
            value={videoSourceUrl}
            onChange={(event) => setVideoSourceUrl(event.target.value)}
            placeholder="Remote video file URL"
            style={inputStyle}
          />
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Tags, comma separated"
            style={inputStyle}
          />
          <select
            value={privacyStatus}
            onChange={(event) => setPrivacyStatus(event.target.value)}
            style={inputStyle}
          >
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </div>
      ) : asset.provider === 'instagram' ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              Post image
            </label>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              PNG or JPG · up to 8 MB
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={(event) => handleImageFile(event.target.files?.[0] ?? null)}
            style={{ display: 'none' }}
          />
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
            {imageUrl.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Instagram post preview"
                style={{
                  width: 72,
                  height: 72,
                  objectFit: 'cover',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  flexShrink: 0,
                }}
                onError={(event) => {
                  ;(event.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                }}
              />
            ) : (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 10,
                  border: '1px dashed var(--border)',
                  background: 'var(--bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: 'var(--muted)',
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                No image
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>
                {imageUrl.trim()
                  ? 'Will be normalized to 1080×1080 before publishing.'
                  : 'Upload your own image, or leave empty to AI-generate a branded square image.'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage || busy}
                  style={buttonStyle('secondary')}
                >
                  {uploadingImage ? 'Uploading…' : imageUrl.trim() ? 'Replace image' : 'Upload image'}
                </button>
                {imageUrl.trim() && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    disabled={uploadingImage || busy}
                    style={buttonStyle('danger')}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <input
          value={linkUrl}
          onChange={(event) => setLinkUrl(event.target.value)}
          placeholder="Optional link URL"
          style={inputStyle}
        />
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
          Schedule time
        </label>
        <input
          type="datetime-local"
          value={scheduleAt}
          onChange={(event) => setScheduleAt(event.target.value)}
          style={inputStyle}
        />
      </div>

      {asset.provider_permalink && (
        <a
          href={asset.provider_permalink}
          target="_blank"
          rel="noreferrer"
          style={{ color: '#2563eb', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
        >
          Open published asset
        </a>
      )}

      {asset.last_error && (
        <div style={{ color: '#dc2626', fontSize: 12, lineHeight: 1.5 }}>
          {asset.last_error}
        </div>
      )}

      {message && <FlashMessage tone="success" message={message} />}
      {error && <FlashMessage tone="error" message={error} />}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => doAction('save')} disabled={busy} style={buttonStyle('secondary')}>
          Save
        </button>
        <button type="button" onClick={() => doAction('approve')} disabled={busy} style={buttonStyle('secondary')}>
          Approve
        </button>
        <button type="button" onClick={() => doAction('schedule')} disabled={busy} style={buttonStyle('primary')}>
          Schedule
        </button>
        <button type="button" onClick={() => doAction('publish')} disabled={busy} style={buttonStyle('primary')}>
          Publish now
        </button>
        {asset.status === 'scheduled' && (
          <button type="button" onClick={() => doAction('cancel')} disabled={busy} style={buttonStyle('danger')}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

function MonitorCard({
  asset,
  onUpdated,
  onRemoved,
}: {
  asset: MarketingAsset
  onUpdated: (asset: MarketingAsset) => void
  onRemoved: (assetId: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const insights = (asset.payload.insights ?? null) as InstagramInsights | null
  const validation = (asset.payload.validation ?? null) as InstagramValidation | null
  const validationError = typeof asset.payload.validationError === 'string'
    ? asset.payload.validationError
    : null
  const imageUrl = typeof asset.payload.imageUrl === 'string' ? asset.payload.imageUrl : ''

  async function runValidation() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/ventures/${asset.venture_id}/marketing/assets/${asset.id}/validate`,
        { method: 'POST' }
      )
      const data = await response.json()
      if (!response.ok) {
        if (data.asset) onUpdated(data.asset as MarketingAsset)
        throw new Error(data.error || 'Validation failed')
      }
      // If Instagram reports the post is gone, the server hard-deletes the
      // asset row. Mirror that on the client so the card disappears.
      if (data.deleted) {
        onRemoved(asset.id)
        return
      }
      onUpdated(data.asset as MarketingAsset)
    } catch (validateError) {
      setError(validateError instanceof Error ? validateError.message : 'Validation failed')
    } finally {
      setBusy(false)
    }
  }

  async function removeFromMonitor() {
    setRemoving(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/ventures/${asset.venture_id}/marketing/assets/${asset.id}`,
        { method: 'DELETE' }
      )
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to remove post')
      }
      onRemoved(asset.id)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove post')
      setRemoving(false)
    }
  }

  return (
    <div style={monitorCardStyle}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Published post"
            style={{
              width: 88,
              height: 88,
              objectFit: 'cover',
              borderRadius: 12,
              border: '1px solid var(--border)',
              flexShrink: 0,
            }}
            onError={(event) => {
              ;(event.currentTarget as HTMLImageElement).style.visibility = 'hidden'
            }}
          />
        ) : (
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--sidebar)',
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {asset.title || 'Published Instagram post'}
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--muted)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {asset.body}
          </div>
          {asset.provider_permalink && (
            <a
              href={asset.provider_permalink}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#2563eb', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
            >
              View on Instagram ↗
            </a>
          )}
        </div>
      </div>

      <div style={metricsRowStyle}>
        <MetricChip label="Likes" value={insights?.likeCount} />
        <MetricChip label="Comments" value={insights?.commentsCount} />
        <MetricChip label="Reach" value={insights?.reach} />
        <MetricChip label="Impressions" value={insights?.impressions} />
        <MetricChip label="Saves" value={insights?.saved} />
      </div>

      {insights?.commentsFetchError && (
        <FlashMessage tone="error" message={insights.commentsFetchError} />
      )}

      {validation && (
        <div style={validationBlockStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Market validation
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge tone={signalTone(validation.signalStrength)}>
                Signal: {validation.signalStrength}
              </Badge>
              <Badge tone={verdictTone(validation.ideaValidationVerdict)}>
                {validation.ideaValidationVerdict}
              </Badge>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6 }}>
            {validation.signalSummary}
          </div>
          <div style={sentimentBarStyle}>
            <div style={{ ...sentimentSegmentStyle, flex: validation.sentiment.positive, background: '#16a34a' }} />
            <div style={{ ...sentimentSegmentStyle, flex: validation.sentiment.neutral, background: '#a1a1aa' }} />
            <div style={{ ...sentimentSegmentStyle, flex: validation.sentiment.negative, background: '#dc2626' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {validation.sentiment.headline} · +{validation.sentiment.positive}% / ={validation.sentiment.neutral}% / −{validation.sentiment.negative}%
          </div>
          {validation.commentAnalysis && (
            <CommentAnalysisBlock analysis={validation.commentAnalysis} />
          )}
          {validation.audienceObservations.length > 0 && (
            <div>
              <div style={subheadStyle}>Audience observations</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6 }}>
                {validation.audienceObservations.map((observation, index) => (
                  <li key={index}>{observation}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div style={subheadStyle}>Verdict reasoning</div>
            <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6 }}>
              {validation.verdictReasoning}
            </div>
          </div>
          {validation.startupImprovements.length > 0 && (
            <div>
              <div style={subheadStyle}>Startup improvements</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {validation.startupImprovements.map((item, index) => (
                  <div key={index} style={improvementItemStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>
                        {item.area}
                      </span>
                      <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6 }}>
                      {item.suggestion}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {validationError && (
        <FlashMessage tone="error" message={validationError} />
      )}
      {error && <FlashMessage tone="error" message={error} />}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={runValidation}
          disabled={busy || removing}
          style={buttonStyle('primary')}
        >
          {busy ? 'Analyzing…' : validation ? 'Refresh validation' : 'Run AI market validation'}
        </button>
        {confirmRemove ? (
          <>
            <button
              type="button"
              onClick={removeFromMonitor}
              disabled={removing}
              style={buttonStyle('danger')}
            >
              {removing ? 'Removing…' : 'Confirm remove'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemove(false)}
              disabled={removing}
              style={buttonStyle('secondary')}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            disabled={busy || removing}
            style={buttonStyle('secondary')}
            title="Remove this post from the monitor (use after deleting it on Instagram)"
          >
            Remove from monitor
          </button>
        )}
        {insights?.fetchedAt && (
          <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center', marginLeft: 'auto' }}>
            Last fetched {new Date(insights.fetchedAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div style={metricChipStyle}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
        {typeof value === 'number' ? value.toLocaleString() : '—'}
      </div>
    </div>
  )
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: tone,
        background: `${tone}14`,
        border: `1px solid ${tone}30`,
      }}
    >
      {children}
    </span>
  )
}

function signalTone(value: 'weak' | 'moderate' | 'strong'): string {
  if (value === 'strong') return '#16a34a'
  if (value === 'moderate') return '#d97706'
  return '#dc2626'
}

function verdictTone(value: 'validated' | 'mixed' | 'invalidated' | 'inconclusive'): string {
  if (value === 'validated') return '#16a34a'
  if (value === 'mixed') return '#d97706'
  if (value === 'invalidated') return '#dc2626'
  return '#6b7280'
}

function priorityTone(value: 'high' | 'medium' | 'low'): string {
  if (value === 'high') return '#dc2626'
  if (value === 'medium') return '#d97706'
  return '#16a34a'
}

function frequencyTone(value: 'rare' | 'occasional' | 'common'): string {
  if (value === 'common') return '#16a34a'
  if (value === 'occasional') return '#d97706'
  return '#6b7280'
}

function CommentAnalysisBlock({ analysis }: { analysis: CommentAnalysis }) {
  const empty =
    analysis.totalCommentsAnalyzed === 0 &&
    analysis.themes.length === 0 &&
    !analysis.topPositiveSignal &&
    !analysis.topConcern &&
    analysis.notableQuestions.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={subheadStyle}>
        Comment analysis · {analysis.totalCommentsAnalyzed} comment{analysis.totalCommentsAnalyzed === 1 ? '' : 's'}
      </div>
      {empty ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          {analysis.commentDriverVerdict || 'No comments yet — too early to extract comment-driven signal.'}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6, fontStyle: 'italic' }}>
            {analysis.commentDriverVerdict}
          </div>
          {analysis.themes.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              {analysis.themes.map((theme, index) => (
                <div key={index} style={improvementItemStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      {theme.theme}
                    </span>
                    <Badge tone={frequencyTone(theme.frequency)}>{theme.frequency}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6 }}>
                    “{theme.exampleQuote}”
                  </div>
                </div>
              ))}
            </div>
          )}
          {analysis.topPositiveSignal && (
            <div style={{ ...improvementItemStyle, borderColor: '#16a34a30', background: '#16a34a08' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Strongest positive
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6 }}>
                {analysis.topPositiveSignal}
              </div>
            </div>
          )}
          {analysis.topConcern && (
            <div style={{ ...improvementItemStyle, borderColor: '#dc262630', background: '#dc262608' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Top concern
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6 }}>
                {analysis.topConcern}
              </div>
            </div>
          )}
          {analysis.notableQuestions.length > 0 && (
            <div>
              <div style={subheadStyle}>Audience questions</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6 }}>
                {analysis.notableQuestions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function AggregateValidationCard({
  validation,
  loading,
  error,
  generatedAt,
  onRefresh,
}: {
  validation: AggregateValidation | null
  loading: boolean
  error: string | null
  generatedAt: string | null
  onRefresh: () => void
}) {
  return (
    <div style={{ ...monitorCardStyle, borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)20' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Venture validation · all posts
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
            {loading ? 'Analyzing every published post…' : validation ? `${validation.postsAnalyzed} post${validation.postsAnalyzed === 1 ? '' : 's'} analyzed` : 'No analysis yet'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {validation && (
            <>
              <Badge tone={signalTone(validation.signalStrength)}>Signal: {validation.signalStrength}</Badge>
              <Badge tone={verdictTone(validation.ideaValidationVerdict)}>{validation.ideaValidationVerdict}</Badge>
            </>
          )}
          <button type="button" onClick={onRefresh} disabled={loading} style={buttonStyle('secondary')}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <FlashMessage tone="error" message={error} />}

      {validation && (
        <>
          <div style={metricsRowStyle}>
            <MetricChip label="Total likes" value={validation.totalEngagement.likes} />
            <MetricChip label="Total comments" value={validation.totalEngagement.comments} />
            <MetricChip label="Reach" value={validation.totalEngagement.reach} />
            <MetricChip label="Impressions" value={validation.totalEngagement.impressions} />
            <MetricChip label="Saves" value={validation.totalEngagement.saves} />
          </div>

          <div style={validationBlockStyle}>
            <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6 }}>
              {validation.signalSummary}
            </div>
            <div style={sentimentBarStyle}>
              <div style={{ ...sentimentSegmentStyle, flex: validation.sentiment.positive, background: '#16a34a' }} />
              <div style={{ ...sentimentSegmentStyle, flex: validation.sentiment.neutral, background: '#a1a1aa' }} />
              <div style={{ ...sentimentSegmentStyle, flex: validation.sentiment.negative, background: '#dc2626' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {validation.sentiment.headline} · +{validation.sentiment.positive}% / ={validation.sentiment.neutral}% / −{validation.sentiment.negative}%
            </div>

            {validation.commentAnalysis && (
              <CommentAnalysisBlock analysis={validation.commentAnalysis} />
            )}

            {validation.audienceObservations.length > 0 && (
              <div>
                <div style={subheadStyle}>Cross-post observations</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6 }}>
                  {validation.audienceObservations.map((observation, index) => (
                    <li key={index}>{observation}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div style={subheadStyle}>Verdict reasoning</div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6 }}>
                {validation.verdictReasoning}
              </div>
            </div>

            {validation.startupImprovements.length > 0 && (
              <div>
                <div style={subheadStyle}>Venture improvements</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {validation.startupImprovements.map((item, index) => (
                    <div key={index} style={improvementItemStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>
                          {item.area}
                        </span>
                        <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6 }}>
                        {item.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validation.perPostHighlights.length > 0 && (
              <div>
                <div style={subheadStyle}>Per-post takeaways</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {validation.perPostHighlights.map((highlight, index) => (
                    <div key={index} style={improvementItemStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5, flex: 1 }}>
                          {highlight.headline}
                        </span>
                        <Badge tone={signalTone(highlight.signal)}>{highlight.signal}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {generatedAt && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
              Last analyzed {new Date(generatedAt).toLocaleString()}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function ConnectedChannelsPanel({
  ventureId,
  ventureName,
  billing: _billing,
}: {
  ventureId: string
  ventureName: string
  billing: BillingSummary | null
}) {
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [assets, setAssets] = useState<MarketingAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [busyProvider, setBusyProvider] = useState<SocialProvider | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [aggregateValidation, setAggregateValidation] = useState<AggregateValidation | null>(null)
  const [aggregateLoading, setAggregateLoading] = useState(false)
  const [aggregateError, setAggregateError] = useState<string | null>(null)
  const [aggregateGeneratedAt, setAggregateGeneratedAt] = useState<string | null>(null)

  async function refreshData() {
    setLoading(true)
    setError(null)

    try {
      const [connectionsResponse, assetsResponse] = await Promise.all([
        fetch('/api/integrations'),
        fetch(`/api/ventures/${ventureId}/marketing/assets`),
      ])

      const connectionsData = await connectionsResponse.json().catch(() => ({ connections: [] })) as ConnectionsResponse & { error?: string }
      const assetsData = await assetsResponse.json().catch(() => ({ assets: [] })) as AssetsResponse & { error?: string }

      if (!connectionsResponse.ok) {
        throw new Error(connectionsData.error || 'Failed to load connected channels')
      }
      if (!assetsResponse.ok) {
        throw new Error(assetsData.error || 'Failed to load marketing assets')
      }

      setConnections(connectionsData.connections ?? [])
      setAssets(assetsData.assets ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load connected channels')
    } finally {
      setLoading(false)
    }
  }

  async function refreshAggregateValidation() {
    setAggregateLoading(true)
    setAggregateError(null)
    try {
      const response = await fetch(`/api/ventures/${ventureId}/marketing/validation`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Aggregate validation failed')
      }
      if (Array.isArray(data.removedAssetIds) && data.removedAssetIds.length > 0) {
        const removed = new Set<string>(data.removedAssetIds)
        setAssets((current) => current.filter((asset) => !removed.has(asset.id)))
      }
      // Apply refreshed per-post insights into the local asset list so monitor
      // cards reflect the same numbers the aggregate analyzer just used.
      if (Array.isArray(data.posts)) {
        const byId = new Map<string, InstagramInsights>()
        for (const post of data.posts as Array<{ assetId: string; insights: InstagramInsights }>) {
          byId.set(post.assetId, post.insights)
        }
        setAssets((current) =>
          current.map((asset) => {
            const insights = byId.get(asset.id)
            if (!insights) return asset
            return { ...asset, payload: { ...asset.payload, insights } }
          })
        )
      }
      setAggregateValidation((data.validation as AggregateValidation | null) ?? null)
      setAggregateGeneratedAt(typeof data.generatedAt === 'string' ? data.generatedAt : null)
    } catch (validationError) {
      setAggregateError(
        validationError instanceof Error ? validationError.message : 'Aggregate validation failed'
      )
    } finally {
      setAggregateLoading(false)
    }
  }

  useEffect(() => {
    refreshData()
  }, [ventureId])

  // Refresh the venture-level validation every time this panel mounts (i.e.
  // every time the user opens the social tab) so the report is always fresh.
  useEffect(() => {
    void refreshAggregateValidation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventureId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('integrationStatus')
    const provider = params.get('integrationProvider')
    const message = params.get('integrationMessage')

    if (status && provider) {
      if (status === 'success') {
        setSuccess(`${provider} connected successfully`)
        refreshData()
      } else {
        setError(message || `Failed to connect ${provider}`)
      }

      params.delete('integrationStatus')
      params.delete('integrationProvider')
      params.delete('integrationMessage')
      const nextQuery = params.toString()
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`
      window.history.replaceState({}, '', nextUrl)
    }
  }, [])

  async function handleConnect(provider: SocialProvider) {
    setBusyProvider(provider)
    setError(null)
    try {
      const response = await fetch(`/api/integrations/${provider}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnTo: window.location.pathname }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || `Failed to connect ${provider}`)
      }

      window.location.href = data.authUrl
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : `Failed to connect ${provider}`)
      setBusyProvider(null)
    }
  }

  async function handleDisconnect(provider: SocialProvider) {
    setBusyProvider(provider)
    setError(null)

    try {
      const response = await fetch(`/api/integrations/${provider}/disconnect`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || `Failed to disconnect ${provider}`)
      }
      setSuccess(`${provider} disconnected`)
      await refreshData()
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : `Failed to disconnect ${provider}`)
    } finally {
      setBusyProvider(null)
    }
  }

  async function handleGenerate(provider: SocialProvider) {
    setBusyProvider(provider)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/ventures/${ventureId}/marketing/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'generate_from_marketing',
          provider,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate drafts')
      }

      setAssets((current) => [...(data.assets as MarketingAsset[]), ...current])
      const label = provider === 'youtube' ? 'YouTube draft created' : provider === 'instagram' ? 'Instagram drafts created' : 'LinkedIn drafts created'
      setSuccess(label)
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate drafts')
    } finally {
      setBusyProvider(null)
    }
  }

  const draftAssets = useMemo(
    () => assets.filter((asset) => DRAFT_LIKE_STATUSES.has(asset.status)),
    [assets]
  )
  const publishedAssets = useMemo(
    () => assets.filter((asset) => asset.status === 'published'),
    [assets]
  )
  const instagramDraftCount = useMemo(
    () => draftAssets.filter((asset) => asset.provider === 'instagram').length,
    [draftAssets]
  )

  function handleAssetUpdated(nextAsset: MarketingAsset) {
    setAssets((current) => current.map((item) => item.id === nextAsset.id ? nextAsset : item))
  }

  function handleAssetRemoved(assetId: string) {
    setAssets((current) => current.filter((item) => item.id !== assetId))
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={sectionLabelStyle}>Social</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.2 }}>
          Connected Channels
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6, maxWidth: 720 }}>
          Connect external channels for <strong style={{ color: 'var(--text)' }}>{ventureName}</strong>, generate fresh AI-written drafts, publish from Forge, and let real engagement validate the idea — automatically.
        </div>
      </div>

      {success && <FlashMessage tone="success" message={success} />}
      {error && <FlashMessage tone="error" message={error} />}

      <div style={providerGridStyle}>
        {PROVIDERS.map((provider) => {
          const connection = connections.find((item) => item.provider === provider.id)
          const isBusy = busyProvider === provider.id
          return (
            <div key={provider.id} style={providerCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{provider.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginTop: 6 }}>
                    {provider.description}
                  </div>
                </div>
                <span
                  style={{
                    alignSelf: 'flex-start',
                    padding: '5px 10px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    color: statusColor(connection?.status ?? 'revoked'),
                    background: `${statusColor(connection?.status ?? 'revoked')}12`,
                    border: `1px solid ${statusColor(connection?.status ?? 'revoked')}20`,
                  }}
                >
                  {connection ? connection.status.replace('_', ' ') : 'Not connected'}
                </span>
              </div>

              {connection && (
                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                  Connected as {connection.provider_account_label}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {connection ? (
                  <>
                    <button type="button" onClick={() => handleDisconnect(provider.id)} disabled={isBusy} style={buttonStyle('secondary')}>
                      Disconnect
                    </button>
                    <button type="button" onClick={() => handleGenerate(provider.id)} disabled={isBusy} style={buttonStyle('primary')}>
                      {provider.id === 'youtube' ? 'Create YouTube Draft' : provider.id === 'instagram' ? 'Create Instagram Drafts' : 'Create LinkedIn Drafts'}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => handleConnect(provider.id)} disabled={isBusy} style={buttonStyle('primary')}>
                    Connect {provider.label}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={dividerStyle} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={sectionLabelStyle}>Draft queue</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              In review · {draftAssets.length} draft{draftAssets.length === 1 ? '' : 's'}
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: instagramDraftCount >= INSTAGRAM_DRAFT_QUEUE_CAP ? '#dc2626' : 'var(--text-soft)',
              background: instagramDraftCount >= INSTAGRAM_DRAFT_QUEUE_CAP ? '#dc262614' : 'var(--sidebar)',
              border: `1px solid ${instagramDraftCount >= INSTAGRAM_DRAFT_QUEUE_CAP ? '#dc262630' : 'var(--border)'}`,
              padding: '6px 10px',
              borderRadius: 999,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            Instagram drafts {instagramDraftCount}/{INSTAGRAM_DRAFT_QUEUE_CAP}
          </div>
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading connected channels…</div>
        ) : draftAssets.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>No drafts in review</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              Connect a provider and click <em>Create Instagram Drafts</em> to spin up fresh AI-written posts.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {draftAssets.map((asset) => (
              <AssetEditorCard
                key={asset.id}
                asset={asset}
                onSaved={handleAssetUpdated}
                onRemoved={() => {
                  refreshData()
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div style={dividerStyle} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={sectionLabelStyle}>Monitor</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            Live posts · {publishedAssets.length} published
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6, maxWidth: 720 }}>
            Forze pulls real engagement from your published Instagram posts and runs an AI market-validation analysis on the audience response.
          </div>
        </div>

        {/* The aggregate card is venture-level — only useful when there's more
            than one published post. With a single post it just duplicates the
            per-post MonitorCard below. */}
        {publishedAssets.length > 1 && (aggregateValidation || aggregateLoading || aggregateError) && (
          <AggregateValidationCard
            validation={aggregateValidation}
            loading={aggregateLoading}
            error={aggregateError}
            generatedAt={aggregateGeneratedAt}
            onRefresh={() => void refreshAggregateValidation()}
          />
        )}

        {loading ? null : publishedAssets.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Nothing published yet</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              Once a draft is published, it moves out of the queue and into this monitor zone with engagement metrics and AI-driven validation.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {publishedAssets.map((asset) => (
              asset.provider === 'instagram' ? (
                <MonitorCard
                  key={asset.id}
                  asset={asset}
                  onUpdated={handleAssetUpdated}
                  onRemoved={handleAssetRemoved}
                />
              ) : (
                <div key={asset.id} style={monitorCardStyle}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {asset.title || `${asset.provider} post`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                    Validation analysis is currently Instagram-only.
                  </div>
                  {asset.provider_permalink && (
                    <a
                      href={asset.provider_permalink}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#2563eb', fontSize: 12, fontWeight: 600 }}
                    >
                      Open ↗
                    </a>
                  )}
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  marginBottom: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 22,
  border: '1px solid var(--glass-border)',
  background: 'var(--glass-bg-strong)',
  borderRadius: 22,
  padding: '22px 22px 24px',
  boxShadow: 'var(--shadow-md)',
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  color: 'var(--accent)',
}

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--border)',
  opacity: 0.55,
  width: '100%',
}

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  borderRadius: 14,
  border: '1px dashed var(--border)',
  background: 'var(--sidebar)',
  padding: '18px 16px',
}

const monitorCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  borderRadius: 18,
  border: '1px solid var(--glass-border)',
  background: 'var(--glass-bg-strong)',
  padding: 18,
  boxShadow: 'var(--shadow-sm)',
}

const metricsRowStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
}

const metricChipStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
}

const validationBlockStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 14,
  borderRadius: 14,
  background: 'var(--sidebar)',
  border: '1px solid var(--border)',
}

const subheadStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--muted)',
  marginBottom: 6,
}

const sentimentBarStyle: React.CSSProperties = {
  display: 'flex',
  height: 8,
  width: '100%',
  borderRadius: 999,
  overflow: 'hidden',
  background: 'var(--border)',
}

const sentimentSegmentStyle: React.CSSProperties = {
  minWidth: 0,
}

const improvementItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
}

const providerGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
}

const providerCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  borderRadius: 18,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
  padding: 16,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
}

function buttonStyle(kind: 'primary' | 'secondary' | 'danger'): React.CSSProperties {
  if (kind === 'primary') {
    return {
      border: 'none',
      borderRadius: 12,
      background: 'linear-gradient(135deg, #8C5A7A, #B26F95)',
      color: '#fff',
      padding: '10px 14px',
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit',
    }
  }

  if (kind === 'danger') {
    return {
      border: '1px solid rgba(220, 38, 38, 0.2)',
      borderRadius: 12,
      background: 'rgba(220, 38, 38, 0.08)',
      color: '#dc2626',
      padding: '10px 14px',
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit',
    }
  }

  return {
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'transparent',
    color: 'var(--text)',
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}
