'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import {
  LEAD_STATUSES,
  SectionHeader,
  StateCard,
  buttonLinkStyle,
  cellStrongStyle,
  cellStyle,
  dangerButtonStyle,
  formatDate,
  inputStyle,
  miniButtonStyle,
  panelStyle,
  smallSelectStyle,
  tableWrapStyle,
  toolbarStyle,
  type AsyncState,
  type EmailLead,
  type LeadStatus,
} from './shared'

export function LeadsTab({
  ventureId,
  state,
  onStatusChange,
  onDeleteLead,
  onBulkStatusChange,
  onBulkDelete,
  onOpenLead,
}: {
  ventureId: string
  state: AsyncState<EmailLead[]>
  onStatusChange: (lead: EmailLead, status: LeadStatus) => void
  onDeleteLead: (lead: EmailLead) => void
  onBulkStatusChange: (leadIds: string[], status: LeadStatus) => void
  onBulkDelete: (leadIds: string[]) => void
  onOpenLead: (lead: EmailLead) => void
}) {
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const sources = useMemo(
    () => Array.from(new Set(state.data.map((lead) => lead.source))).sort(),
    [state.data]
  )
  const filtered = sourceFilter === 'all' ? state.data : state.data.filter((lead) => lead.source === sourceFilter)

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((l) => l.id))))
  }

  function runBulkStatus(status: LeadStatus) {
    onBulkStatusChange(Array.from(selected), status)
    setSelected(new Set())
  }

  function runBulkDelete() {
    if (!window.confirm(`Delete ${selected.size} lead${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return
    onBulkDelete(Array.from(selected))
    setSelected(new Set())
  }

  return (
    <section style={panelStyle}>
      <div style={toolbarStyle}>
        <div>
          <SectionHeader title="Leads" detail="Every lead — from landing-page captures to social commenters — in one pipeline." />
          <div style={filterRowStyle}>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={smallSelectStyle}>
              <option value="all">All sources</option>
              {sources.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
          </div>
        </div>
        <a href={`/api/ventures/${ventureId}/crm/leads/export?type=email`} style={buttonLinkStyle}>Export CSV</a>
      </div>

      {selected.size > 0 && (
        <div style={bulkBarStyle}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{selected.size} selected</span>
          <button type="button" onClick={() => runBulkStatus('won')} style={miniButtonStyle}>Mark Won</button>
          <button type="button" onClick={() => runBulkStatus('lost')} style={miniButtonStyle}>Mark Lost</button>
          <button type="button" onClick={runBulkDelete} style={dangerButtonStyle}>Delete</button>
          <button type="button" onClick={() => setSelected(new Set())} style={{ ...miniButtonStyle, marginLeft: 'auto' }}>Clear</button>
        </div>
      )}

      {state.loading && <StateCard title="Loading leads..." />}
      {state.error && <StateCard title="Failed to load leads" detail={state.error} tone="error" />}
      {!state.loading && !state.error && filtered.length === 0 && (
        <StateCard title="No leads yet" detail="Landing-page captures and social commenters will appear here." />
      )}
      {!state.loading && !state.error && filtered.length > 0 && (
        <div style={tableWrapStyle}>
          <div style={headerRowStyle}>
            <input type="checkbox" checked={selected.size === filtered.length} onChange={toggleAll} />
            <div>Name</div>
            <div>Email / Handle</div>
            <div>Company</div>
            <div>Source</div>
            <div>Status</div>
            <div>Captured</div>
            <div>Actions</div>
          </div>
          {filtered.map((lead) => (
            <div key={lead.id} style={rowStyle}>
              <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelected(lead.id)} />
              <button type="button" onClick={() => onOpenLead(lead)} style={{ ...cellStrongStyle, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'inherit' }}>
                {lead.name || 'Unknown'}
              </button>
              <div style={cellStyle}>{lead.email ?? (lead.external_identity ? `@${lead.external_identity.split(':')[1] ?? lead.external_identity}` : '—')}</div>
              <div style={cellStyle}>{lead.company || '—'}</div>
              <div style={cellStyle}>{lead.source}</div>
              <div>
                <select value={lead.status} onChange={(e) => onStatusChange(lead, e.target.value as LeadStatus)} style={smallSelectStyle}>
                  {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={cellStyle}>{formatDate(lead.created_at)}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => onDeleteLead(lead)} style={dangerButtonStyle}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const filterRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 10,
}

const bulkBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid var(--accent-glow)',
  background: 'var(--accent-soft)',
  marginBottom: 12,
  flexWrap: 'wrap',
}

const headerRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '24px 130px minmax(170px, 1.2fr) 120px 100px 130px 120px 100px',
  minWidth: 1000,
  gap: 12,
  padding: '12px 16px',
  background: 'var(--bg)',
  borderBottom: '1px solid var(--border)',
  color: 'var(--muted)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  alignItems: 'center',
}

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '24px 130px minmax(170px, 1.2fr) 120px 100px 130px 120px 100px',
  minWidth: 1000,
  gap: 12,
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  alignItems: 'center',
}
