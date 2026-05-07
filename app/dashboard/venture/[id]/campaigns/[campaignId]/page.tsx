'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CampaignDetail } from '@/components/venture/CampaignDetail'
import type { Campaign } from '@/lib/schemas/campaign'

type VentureSummary = { id: string; name: string }

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const ventureId = params.id as string
  const campaignId = params.campaignId as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [venture, setVenture] = useState<VentureSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [ventureRes, campaignRes] = await Promise.all([
        fetch(`/api/ventures/${ventureId}`),
        fetch(`/api/campaigns/${campaignId}`),
      ])

      if (ventureRes.ok) {
        // /api/ventures/[id] returns venture fields spread at the top level.
        const v = await ventureRes.json() as VentureSummary
        setVenture(v)
      }

      if (campaignRes.status === 404) {
        router.replace(`/dashboard/venture/${ventureId}/campaigns`)
        return
      }
      if (!campaignRes.ok) {
        setError('Failed to load campaign')
        return
      }
      const { campaign: c } = await campaignRes.json() as { campaign: Campaign }
      // Safety: ensure the campaign is for this venture (URL tampering protection)
      if (c.venture_id !== ventureId) {
        router.replace(`/dashboard/venture/${ventureId}/campaigns`)
        return
      }
      setCampaign(c)
    } catch {
      setError('Network error — please retry')
    } finally {
      setLoading(false)
    }
  }, [campaignId, ventureId, router])

  useEffect(() => {
    void load()
  }, [load])

  const handleStatusUpdate = async (status: Campaign['status']) => {
    if (!campaign) return
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const { campaign: updated } = await res.json() as { campaign: Campaign }
        setCampaign(updated)
      }
    } catch {
      // Non-fatal
    }
  }

  const ventureName = venture?.name ?? 'Venture'

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      <div className="border-b border-[var(--border)] bg-[var(--sidebar)]">
        <div className="max-w-7xl mx-auto w-full p-4 sm:p-6">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)] sm:text-2xl truncate">
            {ventureName}
          </h1>
          <p className="text-sm text-[var(--muted)]" style={{ marginTop: 2 }}>
            Outreach Campaigns
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          {loading ? (
            <DetailSkeleton />
          ) : error ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
              <p className="text-sm text-[var(--text-soft)]">{error}</p>
              <button
                onClick={() => { setLoading(true); void load() }}
                className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Retry
              </button>
            </div>
          ) : campaign ? (
            <CampaignDetail
              campaign={campaign}
              onBack={() => router.push(`/dashboard/venture/${ventureId}/campaigns`)}
              onPause={() => handleStatusUpdate('paused')}
              onResume={() => handleStatusUpdate('active')}
              onPollReplies={() => {
                fetch(`/api/campaigns/${campaignId}`)
                  .then((r) => (r.ok ? r.json() : null))
                  .then((data) => {
                    if (data?.campaign) setCampaign(data.campaign as Campaign)
                  })
                  .catch(() => {})
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-4 w-24 rounded bg-[var(--border)] animate-pulse" />
        <div className="h-4 w-40 rounded bg-[var(--border)]/60 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="h-3 w-16 rounded bg-[var(--border)]/60 animate-pulse" />
            <div className="mt-3 h-6 w-10 rounded bg-[var(--border)] animate-pulse" />
          </div>
        ))}
      </div>
      <div className="h-48 rounded-xl border border-[var(--border)] bg-[var(--card)] animate-pulse" />
    </div>
  )
}
