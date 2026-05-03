'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CampaignList } from '@/components/venture/CampaignList'
import { CreateCampaignFlow } from '@/components/venture/CreateCampaignFlow'
import { DirectMailFlow } from '@/components/venture/DirectMailFlow'
import { VentureHeader } from '@/components/venture/VentureHeader'
import { ConnectedChannelsPanel } from '@/components/marketing/ConnectedChannelsPanel'
import type { Campaign } from '@/lib/schemas/campaign'

type VentureSummary = {
  id: string
  name: string
  context?: { research?: { positioning?: string } }
}

export default function CampaignsPage() {
  const params = useParams()
  const router = useRouter()
  const ventureId = params.id as string

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [view, setView] = useState<'list' | 'create' | 'direct'>('list')
  const [tab, setTab] = useState<'campaigns' | 'direct' | 'social'>('campaigns')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [venture, setVenture] = useState<VentureSummary | null>(null)

  const loadData = useCallback(async () => {
    setLoadError(null)
    try {
      const [ventureRes, campaignsRes] = await Promise.all([
        fetch(`/api/ventures/${ventureId}`),
        fetch(`/api/campaigns?venture_id=${ventureId}`),
      ])

      if (ventureRes.status === 404) {
        router.replace('/dashboard')
        return
      }

      if (ventureRes.ok) {
        // /api/ventures/[id] returns venture fields spread at the top level.
        const v = await ventureRes.json() as VentureSummary
        setVenture(v)
      } else {
        setLoadError('Failed to load venture')
      }

      if (campaignsRes.ok) {
        const d = await campaignsRes.json() as { campaigns: Campaign[] }
        setCampaigns(d.campaigns ?? [])
      } else if (campaignsRes.status !== 404) {
        setLoadError('Failed to load campaigns')
      }
    } catch {
      setLoadError('Network error — please retry')
    } finally {
      setLoading(false)
    }
  }, [ventureId, router])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCampaigns((prev) => prev.filter((c) => c.id !== id))
      }
    } catch {
      // Non-fatal
    }
  }

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
      if (res.ok) {
        setCampaigns((prev) => prev.filter((c) => c.id !== id))
      }
    } catch {
      // Non-fatal
    }
  }

  const ventureName = venture?.name ?? 'Venture'
  const ventureDescription = venture?.context?.research?.positioning ?? ventureName

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      <VentureHeader
        ventureId={ventureId}
        ventureName={ventureName}
        subtitle="Outreach Campaigns"
        activeTab="campaigns"
      />

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          {loading ? (
            <CampaignsSkeleton />
          ) : loadError ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
              <p className="text-sm text-[var(--text-soft)]">{loadError}</p>
              <button
                onClick={() => { setLoading(true); void loadData() }}
                className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Retry
              </button>
            </div>
          ) : view === 'create' ? (
            <CreateCampaignFlow
              ventureId={ventureId}
              ventureName={ventureName}
              ventureDescription={ventureDescription}
              onComplete={(campaignId) => {
                router.push(`/dashboard/venture/${ventureId}/campaigns/${campaignId}`)
              }}
              onCancel={() => setView('list')}
            />
          ) : view === 'direct' ? (
            <DirectMailFlow
              ventureId={ventureId}
              ventureName={ventureName}
              ventureDescription={ventureDescription}
              onComplete={(campaignId) => {
                router.push(`/dashboard/venture/${ventureId}/campaigns/${campaignId}`)
              }}
              onCancel={() => setView('list')}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Channel tabs */}
              <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 w-fit">
                <button
                  onClick={() => setTab('campaigns')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === 'campaigns'
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-soft)] hover:text-[var(--text)]'
                  }`}
                >
                  Cold Outreach
                </button>
                <button
                  onClick={() => setTab('direct')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === 'direct'
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-soft)] hover:text-[var(--text)]'
                  }`}
                >
                  Direct Mail
                </button>
                <button
                  onClick={() => setTab('social')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === 'social'
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-soft)] hover:text-[var(--text)]'
                  }`}
                >
                  Social
                </button>
              </div>

              {tab === 'campaigns' ? (
                <CampaignList
                  ventureId={ventureId}
                  campaigns={campaigns.filter((c) => c.data_source !== 'direct')}
                  onSelect={(id) => router.push(`/dashboard/venture/${ventureId}/campaigns/${id}`)}
                  onCreate={() => setView('create')}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                />
              ) : tab === 'direct' ? (
                <DirectMailPanel
                  ventureId={ventureId}
                  campaigns={campaigns.filter((c) => c.data_source === 'direct')}
                  onOpen={(id) => router.push(`/dashboard/venture/${ventureId}/campaigns/${id}`)}
                  onCompose={() => setView('direct')}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                />
              ) : (
                <ConnectedChannelsPanel
                  ventureId={ventureId}
                  ventureName={ventureName}
                  billing={null}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// A lightweight table for Direct Mail sends — same monitoring columns as the
// cold-outreach list, with different empty-state copy and a single "Compose"
// CTA instead of the campaign wizard.
function DirectMailPanel({
  campaigns,
  onOpen,
  onCompose,
  onDelete,
  onArchive,
}: {
  ventureId: string
  campaigns: Campaign[]
  onOpen: (id: string) => void
  onCompose: () => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
}) {
  const visible = campaigns.filter((c) => c.status !== 'archived')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Direct Mail</h2>
          <p className="text-sm text-[var(--muted)]">Mail anyone — users, customers, anyone you already know.</p>
        </div>
        <button
          onClick={onCompose}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Compose
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-sm font-medium text-[var(--text-soft)]">No direct mail sends yet</p>
          <p className="text-xs text-[var(--muted)] max-w-md">
            Paste emails, Forze auto-detects names from the addresses, and your message goes out from your own Gmail — with the same opens/clicks/replies monitoring as cold campaigns.
          </p>
          <button
            onClick={onCompose}
            className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Compose first send
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--sidebar)]">
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-soft)]">Send</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-soft)]">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--text-soft)]">Sent</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--text-soft)]">Opened</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--text-soft)]">Clicked</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--text-soft)]">Replied</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--text-soft)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onOpen(c.id)}
                  className="group cursor-pointer border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--nav-active)]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase text-[var(--text-soft)]">{c.status}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--text-soft)]">{c.sent_count ?? 0}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--text-soft)]">{c.opened_count ?? 0}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--text-soft)]">{c.clicked_count ?? 0}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--text-soft)]">{c.replied_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onArchive(c.id)}
                        className="text-xs text-[var(--muted)] hover:text-[var(--text-soft)]"
                      >
                        Archive
                      </button>
                      <button
                        onClick={() => onDelete(c.id)}
                        className="text-xs text-[var(--muted)] hover:text-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CampaignsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-32 rounded bg-[var(--border)] animate-pulse" />
          <div className="h-3 w-20 rounded bg-[var(--border)]/60 animate-pulse" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-[var(--border)] animate-pulse" />
      </div>
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--border)] last:border-0 px-4 py-4"
          >
            <div className="h-4 flex-1 rounded bg-[var(--border)]/60 animate-pulse" />
            <div className="h-4 w-20 rounded bg-[var(--border)]/60 animate-pulse" />
            <div className="h-4 w-12 rounded bg-[var(--border)]/60 animate-pulse" />
            <div className="h-4 w-12 rounded bg-[var(--border)]/60 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
