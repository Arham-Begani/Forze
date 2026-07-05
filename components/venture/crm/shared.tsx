'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { SocialProvider } from '@/lib/marketing.shared'

// ─── Shared types ───────────────────────────────────────────────────────────────

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'lost' | 'won'
export type TabId = 'overview' | 'inbox' | 'leads' | 'pipeline' | 'outreach'
export type ChannelKey = SocialProvider | 'gmail' | 'reddit' | 'telegram'

export type VentureSummary = {
  id: string
  name: string
}

export type AnalyticsEvent = {
  id: string
  event_type: string
  metadata?: Record<string, unknown>
  created_at: string
}

export type SocialBreakdown = {
  platform: string
  count: number
  leads: number
  engagement?: number
  likes?: number
  comments?: number
  views?: number
  posts?: number
}

export type CrmAnalytics = {
  visitors: number
  landingPageviews?: number
  socialReach?: number
  leads: number
  conversionRate: string
  rawAnalytics: AnalyticsEvent[]
  socialBreakdown: SocialBreakdown[]
}

// Only Instagram is ever actually populated by the aggregator today — the
// LinkedIn/Gmail/Reddit/Telegram filter options were removed from the UI
// since they always returned zero results (see app/api/ventures/[id]/crm/inbox/route.ts).
// Gmail replies get their own panel (CrmReply below) rather than living here.
export type InboxItem = {
  id: string
  source: 'instagram'
  username: string | null
  text: string
  timestamp: string | null
  permalink: string | null
  assetId: string | null
}

export type EmailLead = {
  id: string
  venture_id: string
  email: string | null
  name: string | null
  status: LeadStatus
  source: string
  company?: string | null
  phone?: string | null
  tags?: string[]
  owner_id?: string | null
  external_identity?: string | null
  created_at: string
}

export type LeadActivityItem = {
  id: string
  lead_id: string
  type: 'note' | 'status_change' | 'field_change' | 'email_sent' | 'deal_stage_change'
  body: string | null
  metadata?: Record<string, unknown>
  created_at: string
}

export type CampaignSummary = {
  id: string
  name: string
  status: string
  sent_count?: number
  opened_count?: number
  clicked_count?: number
  replied_count?: number
  origin?: 'crm' | 'campaigns'
}

export type PipelineStage = {
  id: string
  venture_id: string
  name: string
  position: number
  is_won: boolean
  is_lost: boolean
  color: string | null
}

export type Deal = {
  id: string
  venture_id: string
  lead_id: string
  stage_id: string
  title: string
  value: number | null
  probability: number | null
  expected_close_date: string | null
  lost_reason: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
}

export type CrmReply = {
  id: string
  outreach_message_id: string
  lead_id: string
  from_email: string | null
  subject: string | null
  body: string | null
  reply_type: string | null
  sentiment_score: number | null
  summary: string | null
  received_at: string | null
}

export type GmailUI = {
  connected: boolean
  email: string | null
  canSend: boolean
  state: 'not_connected' | 'active' | 'needs_reauth' | 'error' | 'disconnected'
  errorMessage: string | null
}

export type AsyncState<T> = {
  data: T
  loading: boolean
  error: string | null
}

export interface ChannelDescriptor {
  key: ChannelKey
  label: string
  comingSoon?: boolean
}

export const CHANNELS: ChannelDescriptor[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'gmail', label: 'Gmail' },
  { key: 'reddit', label: 'Reddit', comingSoon: true },
]

export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'lost', 'won']

// ─── Shared helpers ─────────────────────────────────────────────────────────────

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T
}

export function statusColor(status: string | null | undefined): string {
  switch (status) {
    case 'active':
      return '#16a34a'
    case 'reauth_required':
    case 'needs_reauth':
      return '#d97706'
    case 'expired':
    case 'revoked':
    case 'error':
      return '#dc2626'
    default:
      return '#6b7280'
  }
}

export function sourceBadgeColor(source: string): string {
  switch (source) {
    case 'instagram': return '#8C5A7A'
    case 'gmail': return '#5A8C6E'
    default: return '#6b7280'
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function interpolateTemplate(template: string, lead: EmailLead | null): string {
  const name = lead?.name?.trim() || 'there'
  return template.replace(/{{\s*name\s*}}/g, name)
}

// ─── Shared small components ────────────────────────────────────────────────────

export function MetricCard({ label, value, accent = false, sublabel }: { label: string; value: string; accent?: boolean; sublabel?: string }) {
  return (
    <div style={{
      padding: '16px 18px',
      borderRadius: 16,
      border: accent ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
      background: accent ? 'var(--accent-soft)' : 'var(--sidebar)',
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: accent ? 'var(--accent)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent ? 'var(--accent)' : 'var(--text)', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{value}</div>
      {sublabel && (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginTop: 4 }}>{sublabel}</div>
      )}
    </div>
  )
}

export function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color, background: `${color}14`, border: `1px solid ${color}30`, padding: '3px 8px', borderRadius: 999 }}>
      {children}
    </span>
  )
}

export function SectionHeader({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.2 }}>{title}</h2>
        {detail && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>{detail}</p>}
      </div>
      {action}
    </div>
  )
}

export function StateCard({ title, detail, tone, compact = false }: { title: string; detail?: string; tone?: 'error'; compact?: boolean }) {
  return (
    <div style={{
      ...emptyStateStyle,
      padding: compact ? '16px 18px' : emptyStateStyle.padding,
      borderColor: tone === 'error' ? '#dc262630' : 'var(--border)',
      background: tone === 'error' ? '#dc262610' : 'var(--sidebar)',
    }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: tone === 'error' ? '#dc2626' : 'var(--text)' }}>{title}</div>
      {detail && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{detail}</div>}
    </div>
  )
}

export function ArrowConnector() {
  return <div aria-hidden="true" style={{ color: 'var(--muted)', fontWeight: 900, alignSelf: 'center', textAlign: 'center' }}>→</div>
}

// Generic confirm modal — reused for lead delete, bulk delete, and campaign
// dispatch so the app never falls back to window.confirm().
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  disabled,
  onCancel,
  onConfirm,
}: {
  title: string
  message: string
  confirmLabel?: string
  disabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div style={modalOverlayStyle} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div style={modalStyle}>
        <h2 id="confirm-modal-title" style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>{title}</h2>
        <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: 13, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button type="button" onClick={onCancel} style={secondaryButtonStyle}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={disabled} style={primaryButtonStyle(Boolean(disabled))}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared styles ──────────────────────────────────────────────────────────────

export const stackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

export const panelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--border)',
  background: 'var(--card-solid)',
  padding: 18,
  boxShadow: '0 16px 40px rgba(0,0,0,0.04)',
}

export const grid3Style: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
}

export const grid4Style: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 10,
}

export const twoColumnStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 16,
}

export const toolbarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

export const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--bg)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
  padding: '10px 12px',
}

export const linkStyle: CSSProperties = {
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 700,
  textDecoration: 'none',
}

export const buttonLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 10,
  border: '1px solid var(--accent-glow)',
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 800,
  padding: '9px 12px',
  textDecoration: 'none',
}

export const tableWrapStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
  overflowX: 'auto',
}

export const cellStyle: CSSProperties = {
  color: 'var(--text-soft)',
  fontSize: 13,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export const cellStrongStyle: CSSProperties = {
  ...cellStyle,
  color: 'var(--text)',
  fontWeight: 800,
}

export const smallSelectStyle: CSSProperties = {
  ...inputStyle,
  padding: '7px 8px',
  textTransform: 'capitalize',
}

export const miniButtonStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg)',
  color: 'var(--text-soft)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 800,
  padding: '6px 8px',
}

export const dangerButtonStyle: CSSProperties = {
  ...miniButtonStyle,
  borderColor: '#dc262630',
  color: '#dc2626',
}

export const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  color: 'var(--text-soft)',
  fontSize: 12,
  fontWeight: 800,
}

export function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: 'none',
    borderRadius: 11,
    background: 'var(--text)',
    color: 'var(--bg)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 900,
    opacity: disabled ? 0.5 : 1,
    padding: '11px 14px',
  }
}

export const secondaryButtonStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 11,
  background: 'var(--sidebar)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 800,
  padding: '11px 14px',
}

export const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 18,
  background: 'rgba(0,0,0,0.42)',
}

export const modalStyle: CSSProperties = {
  width: 'min(440px, 100%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  borderRadius: 18,
  border: '1px solid var(--border)',
  background: 'var(--card-solid)',
  padding: 20,
  boxShadow: '0 28px 80px rgba(0,0,0,0.32)',
}

export const emptyStateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  borderRadius: 14,
  border: '1px dashed var(--border)',
  background: 'var(--sidebar)',
  padding: '24px 20px',
}
