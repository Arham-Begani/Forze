'use client'

import type { CSSProperties } from 'react'
import {
  Badge,
  SectionHeader,
  StateCard,
  formatTime,
  inputStyle,
  linkStyle,
  panelStyle,
  sourceBadgeColor,
  toolbarStyle,
  type InboxItem,
} from './shared'
import { RepliesPanel } from './RepliesPanel'

export function InboxTab({
  ventureId,
  loading,
  error,
  items,
  totalItems,
  search,
  onSearch,
}: {
  ventureId: string
  loading: boolean
  error: string | null
  items: InboxItem[]
  totalItems: number
  search: string
  onSearch: (value: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section style={panelStyle}>
        <div style={toolbarStyle}>
          <SectionHeader title="Inbox" detail={`${totalItems.toLocaleString()} total inbound comments.`} />
          <div style={filterRowStyle}>
            <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search comments" style={inputStyle} />
          </div>
        </div>

        {loading && <StateCard title="Loading inbox..." />}
        {error && <StateCard title="Failed to load inbox" detail={error} tone="error" />}
        {!loading && !error && items.length === 0 && (
          <StateCard title="No inbound signal yet" detail="Once published content receives comments, they land here." />
        )}
        {!loading && !error && items.length > 0 && (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item) => <InboxItemRow key={item.id} item={item} />)}
          </div>
        )}
      </section>

      <RepliesPanel ventureId={ventureId} />
    </div>
  )
}

function InboxItemRow({ item }: { item: InboxItem }) {
  const color = sourceBadgeColor(item.source)
  return (
    <div style={inboxRowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Badge color={color}>{item.source}</Badge>
        {item.username && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>@{item.username}</span>}
        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{formatTime(item.timestamp)}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.text}</div>
      {item.permalink && (
        <a href={item.permalink} target="_blank" rel="noreferrer" style={linkStyle}>Open original</a>
      )}
    </div>
  )
}

const filterRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const inboxRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
}
