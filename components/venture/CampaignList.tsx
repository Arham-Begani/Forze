'use client'

import React, { useState } from 'react'
import { Plus, Trash2, ArchiveIcon, Mail, Users, MousePointerClick, MessageCircle, ChevronRight } from 'lucide-react'
import type { Campaign } from '@/lib/schemas/campaign'

const STATUS_STYLES: Record<Campaign['status'], string> = {
  draft: 'bg-[var(--border)] text-[var(--text-soft)]',
  scheduled: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  active: 'bg-green-500/15 text-green-600 dark:text-green-400',
  paused: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  completed: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  archived: 'bg-[var(--border)] text-[var(--muted)]',
}

function pct(num: number, denom: number): string {
  if (!denom) return '—'
  return `${((num / denom) * 100).toFixed(1)}%`
}

interface CampaignListProps {
  ventureId: string
  campaigns: Campaign[]
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
}

export function CampaignList({
  ventureId: _ventureId,
  campaigns,
  onSelect,
  onCreate,
  onDelete,
  onArchive,
}: CampaignListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const visible = campaigns.filter((c) => c.status !== 'archived')

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Campaigns</h2>
          <p className="text-sm text-[var(--muted)]">{visible.length} campaign{visible.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={15} />
          New Campaign
        </button>
      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
          <Mail size={32} className="text-[var(--muted)]" />
          <p className="text-sm font-medium text-[var(--text-soft)]">No campaigns yet</p>
          <p className="text-xs text-[var(--muted)]">Create your first cold email campaign to start reaching prospects</p>
          <button
            onClick={onCreate}
            className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            Create Campaign
          </button>
        </div>
      )}

      {/* Table */}
      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--sidebar)]">
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-soft)]">Campaign</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-soft)]">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--text-soft)]">
                  <span className="flex items-center justify-end gap-1"><Mail size={13} /> Sent</span>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--text-soft)]">
                  <span className="flex items-center justify-end gap-1"><Users size={13} /> Opened</span>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--text-soft)]">
                  <span className="flex items-center justify-end gap-1"><MousePointerClick size={13} /> Clicked</span>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--text-soft)]">
                  <span className="flex items-center justify-end gap-1"><MessageCircle size={13} /> Replied</span>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--text-soft)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((campaign) => (
                <tr
                  key={campaign.id}
                  onClick={() => onSelect(campaign.id)}
                  className="group cursor-pointer border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--nav-active)]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                        {campaign.name}
                      </span>
                      <ChevronRight size={13} className="text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {campaign.description && (
                      <p className="mt-0.5 text-xs text-[var(--muted)] line-clamp-1">{campaign.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[campaign.status]}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--text-soft)]">
                    {campaign.sent_count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--text-soft)]">
                    {campaign.opened_count ?? 0}
                    <span className="ml-1 text-xs text-[var(--muted)]">
                      {pct(campaign.opened_count ?? 0, campaign.sent_count ?? 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--text-soft)]">
                    {campaign.clicked_count ?? 0}
                    <span className="ml-1 text-xs text-[var(--muted)]">
                      {pct(campaign.clicked_count ?? 0, campaign.sent_count ?? 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--text-soft)]">
                    {campaign.replied_count ?? 0}
                    <span className="ml-1 text-xs text-[var(--muted)]">
                      {pct(campaign.replied_count ?? 0, campaign.sent_count ?? 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onArchive(campaign.id)}
                        title="Archive"
                        className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--text-soft)] transition-colors"
                      >
                        <ArchiveIcon size={14} />
                      </button>
                      {confirmDelete === campaign.id ? (
                        <>
                          <button
                            onClick={() => onDelete(campaign.id)}
                            className="rounded px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="rounded px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--border)]"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(campaign.id)}
                          title="Delete"
                          className="rounded p-1.5 text-[var(--muted)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
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
