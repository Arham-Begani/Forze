'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CampaignList } from '@/components/venture/CampaignList'
import { CreateCampaignFlow } from '@/components/venture/CreateCampaignFlow'
import { VentureHeader } from '@/components/venture/VentureHeader'
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
  const [view, setView] = useState<'list' | 'create'>('list')
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
  const ventureDescription = venture?.context?.research?.positioning ?? ''

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
          ) : (
            <CampaignList
              ventureId={ventureId}
              campaigns={campaigns}
              onSelect={(id) => router.push(`/dashboard/venture/${ventureId}/campaigns/${id}`)}
              onCreate={() => setView('create')}
              onDelete={handleDelete}
              onArchive={handleArchive}
            />
          )}
        </div>
      </div>
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
