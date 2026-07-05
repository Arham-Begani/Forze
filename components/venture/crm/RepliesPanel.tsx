'use client'

import { useState, type CSSProperties } from 'react'
import {
  Badge,
  SectionHeader,
  StateCard,
  errorMessage,
  formatTime,
  panelStyle,
  readJson,
  secondaryButtonStyle,
  sourceBadgeColor,
  type AsyncState,
  type CrmReply,
} from './shared'

// Manual, on-demand replies check — GET /api/ventures/[id]/crm/replies hits
// the live Gmail API per tracked thread with no caching, so this is
// button-triggered rather than auto-fetched on mount/poll. Phase 5 persists
// replies server-side (with AI-classified reply_type/sentiment_score) so
// this panel becomes a fast read against stored data instead; the fetch
// contract here (GET returning { success, replies }) stays the same either way.
export function RepliesPanel({ ventureId }: { ventureId: string }) {
  const [state, setState] = useState<AsyncState<CrmReply[]>>({ data: [], loading: false, error: null })
  const [checked, setChecked] = useState(false)

  async function checkForReplies() {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetch(`/api/ventures/${ventureId}/crm/replies`)
      const data = await readJson<{ success?: boolean; replies?: RawReply[]; error?: unknown }>(res)
      if (!res.ok || !data.success) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to check for replies')
      }
      setState({ data: (data.replies ?? []).map(normalizeReply), loading: false, error: null })
      setChecked(true)
    } catch (error) {
      setState({ data: [], loading: false, error: errorMessage(error, 'Failed to check for replies') })
      setChecked(true)
    }
  }

  return (
    <section style={panelStyle}>
      <SectionHeader
        title="Replies"
        detail="Real Gmail replies to your outreach sends."
        action={
          <button type="button" onClick={checkForReplies} disabled={state.loading} style={secondaryButtonStyle}>
            {state.loading ? 'Checking...' : 'Check for replies'}
          </button>
        }
      />

      {!checked && !state.loading && (
        <StateCard title="Not checked yet" detail="Click 'Check for replies' to pull the latest Gmail replies to your outreach sends." compact />
      )}
      {state.error && <StateCard title="Failed to load replies" detail={state.error} tone="error" />}
      {checked && !state.error && state.data.length === 0 && (
        <StateCard title="No replies yet" detail="Replies to outreach emails sent from the Outreach tab will appear here." compact />
      )}
      {state.data.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {state.data.map((reply) => (
            <div key={reply.id} style={replyRowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Badge color={sourceBadgeColor('gmail')}>Gmail</Badge>
                {reply.from_email && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{reply.from_email}</span>}
                {reply.reply_type && <Badge color={replyTypeColor(reply.reply_type)}>{reply.reply_type}</Badge>}
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{formatTime(reply.received_at)}</span>
              </div>
              {reply.subject && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{reply.subject}</div>}
              <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{reply.body}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function replyTypeColor(type: string): string {
  switch (type) {
    case 'interested': return '#16a34a'
    case 'uninterested': return '#dc2626'
    case 'question': return '#d97706'
    case 'spam': return '#6b7280'
    default: return '#5A6E8C'
  }
}

// The live route (pre-Phase-5) returns CrmGmailReply shape (leadName/leadEmail/
// snippet/timestamp/gmailMessageId/gmailThreadId); Phase 5's persisted route
// returns the richer outreach_replies row shape. Normalize both into CrmReply
// so this panel doesn't need to change when 5.1 lands.
interface RawReply {
  id?: string
  leadEmail?: string
  from_email?: string
  leadName?: string
  snippet?: string
  body?: string
  subject?: string
  timestamp?: string
  received_at?: string
  gmailMessageId?: string
  outreach_message_id?: string
  lead_id?: string
  reply_type?: string | null
  sentiment_score?: number | null
  summary?: string | null
}

function normalizeReply(raw: RawReply): CrmReply {
  return {
    id: raw.id ?? raw.gmailMessageId ?? crypto.randomUUID(),
    outreach_message_id: raw.outreach_message_id ?? '',
    lead_id: raw.lead_id ?? '',
    from_email: raw.from_email ?? raw.leadEmail ?? null,
    subject: raw.subject ?? null,
    body: raw.body ?? raw.snippet ?? null,
    reply_type: raw.reply_type ?? null,
    sentiment_score: raw.sentiment_score ?? null,
    summary: raw.summary ?? null,
    received_at: raw.received_at ?? raw.timestamp ?? null,
  }
}

const replyRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
}
