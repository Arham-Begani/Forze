'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Globe, Swords } from 'lucide-react'
import type { ModuleId } from '@/components/ui/ResultCard'

export type VentureTabId = ModuleId

type TabDef = { id: ModuleId; label: string; icon: React.ReactNode; color: string; kind: 'module' }

export const VENTURE_TABS: TabDef[] = [
  { id: 'landing', label: 'Landing', icon: <Globe size={16} />, color: '#8C7A5A', kind: 'module' },
  { id: 'shadow-board', label: 'Shadow Board', icon: <Swords size={16} />, color: '#E04848', kind: 'module' },
]

interface VentureHeaderProps {
  ventureId: string
  ventureName: string
  subtitle?: string
  /** Currently active tab. Omit on standalone pages (like Outreach) where no tab should be highlighted. */
  activeTab?: VentureTabId
  /** Called when a module tab is clicked. If omitted, navigates to /dashboard/venture/[id]?tab=<id>. */
  onModuleTabClick?: (id: ModuleId) => void
  /** Optional action slot rendered on the right side of the header (e.g. Export PDF). */
  actions?: React.ReactNode
}

export function VentureHeader({
  ventureId,
  ventureName,
  subtitle = 'Master Venture Dossier',
  activeTab,
  onModuleTabClick,
  actions,
}: VentureHeaderProps) {
  const router = useRouter()

  const handleTabClick = (tab: TabDef) => {
    if (onModuleTabClick) {
      onModuleTabClick(tab.id)
      return
    }
    router.push(`/dashboard/venture/${ventureId}?tab=${tab.id}`)
  }

  return (
    <>
      {/* Top Header / Stats */}
      <div className="border-b border-[var(--border)] bg-[var(--sidebar)]">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 max-w-7xl mx-auto w-full">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text)] sm:text-2xl truncate">
              {ventureName}
            </h1>
            <p className="text-sm text-[var(--muted)]" style={{ marginTop: '2px' }}>
              {subtitle}
            </p>
          </div>
          {actions && (
            <div className="flex w-full gap-2 sm:w-auto sm:justify-end sm:gap-3 flex-wrap sm:flex-nowrap">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[var(--border)] bg-[var(--glass-bg)]">
        <div className="flex gap-2 overflow-x-auto p-3 sm:p-4 no-scrollbar max-w-7xl mx-auto">
          {VENTURE_TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300 sm:px-6
                  ${isActive
                    ? 'bg-[var(--glass-bg-strong)] text-[var(--text)] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--text-soft)] hover:bg-[var(--glass-bg)]'}
                `}
              >
                <span style={{ color: isActive ? tab.color : 'inherit' }}>{tab.icon}</span>
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="ventureActiveTab"
                    className="absolute bottom-0 left-2 right-2 h-0.5"
                    style={{ backgroundColor: tab.color }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
