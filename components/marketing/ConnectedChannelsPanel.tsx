'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MarketingAsset, SocialConnection, SocialProvider } from '@/lib/marketing.shared'

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
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTitle(asset.title)
    setBody(asset.body)
    setScheduleAt(toInputDateTime(asset.scheduled_for))
    setVideoSourceUrl(typeof asset.payload.videoSourceUrl === 'string' ? asset.payload.videoSourceUrl : '')
    setTags(Array.isArray(asset.payload.tags) ? asset.payload.tags.join(', ') : '')
    setPrivacyStatus(typeof asset.payload.privacyStatus === 'string' ? asset.payload.privacyStatus : 'unlisted')
    setLinkUrl(typeof asset.payload.linkUrl === 'string' ? asset.payload.linkUrl : '')
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

    return {
      ...providerPayloadDefaults('linkedin'),
      ...asset.payload,
      linkUrl,
    }
  }, [asset.payload, asset.provider, linkUrl, privacyStatus, tags, videoSourceUrl])

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
            {asset.provider === 'youtube' ? 'YouTube video draft' : 'LinkedIn post draft'}
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
        placeholder={asset.provider === 'youtube' ? 'Video description' : 'Post copy'}
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

  useEffect(() => {
    refreshData()
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
      setSuccess(provider === 'youtube' ? 'YouTube draft created' : 'LinkedIn drafts created')
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate drafts')
    } finally {
      setBusyProvider(null)
    }
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Connected Channels</div>
          <span
            style={{
              padding: '5px 12px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              color: '#d97706',
              background: '#d9770612',
              border: '1px solid #d9770620',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Coming Soon
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6 }}>
          Connect external channels for <strong style={{ color: 'var(--text)' }}>{ventureName}</strong>, turn your marketing strategy into reviewable drafts, and schedule publishes without leaving Forge.
        </div>
      </div>

      {success && <FlashMessage tone="success" message={success} />}
      {error && <FlashMessage tone="error" message={error} />}

      <div style={{ ...providerGridStyle, opacity: 0.5, pointerEvents: 'none' }}>
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
                    <button type="button" onClick={() => handleDisconnect(provider.id)} disabled={true} style={buttonStyle('secondary')}>
                      Disconnect
                    </button>
                    <button type="button" onClick={() => handleGenerate(provider.id)} disabled={true} style={buttonStyle('primary')}>
                      {provider.id === 'youtube' ? 'Create YouTube Draft' : 'Create LinkedIn Drafts'}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => handleConnect(provider.id)} disabled={true} style={buttonStyle('primary')}>
                    Connect {provider.label}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.5, pointerEvents: 'none' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Draft Queue</div>
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading connected channels…</div>
        ) : assets.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            No channel drafts yet. Connect a provider and generate drafts from your marketing output.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {assets.map((asset) => (
              <AssetEditorCard
                key={asset.id}
                asset={asset}
                onSaved={(nextAsset) => {
                  setAssets((current) => current.map((item) => item.id === nextAsset.id ? nextAsset : item))
                }}
                onRemoved={() => {
                  refreshData()
                }}
              />
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
  gap: 16,
  border: '1px solid var(--glass-border)',
  background: 'var(--glass-bg-strong)',
  borderRadius: 22,
  padding: '18px 18px 20px',
  boxShadow: 'var(--shadow-md)',
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
