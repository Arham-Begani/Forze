'use client'

import { useEffect, useState } from 'react'

interface CrmDashboardProps {
  ventureId: string
  ventureName: string
}

export function CrmDashboard({ ventureId: _ventureId, ventureName }: CrmDashboardProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 48px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
          textTransform: 'uppercase', color: 'var(--accent)',
        }}>
          {ventureName}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>
          CRM Dashboard
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6, maxWidth: 720 }}>
          Inbound signal from every connected channel — comments, replies, and threads — aggregated into one inbox, deduplicated into leads, and tracked through your outreach pipeline.
        </div>
      </div>
      <div style={{
        border: '1px dashed var(--border)',
        background: 'var(--sidebar)',
        borderRadius: 14,
        padding: '24px 20px',
        fontSize: 13,
        color: 'var(--muted)',
      }}>
        Loading CRM modules…
      </div>
    </div>
  )
}
