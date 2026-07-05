'use client'

import type { CSSProperties } from 'react'
import {
  SectionHeader,
  inputStyle,
  interpolateTemplate,
  labelStyle,
  panelStyle,
  primaryButtonStyle,
  type EmailLead,
} from './shared'

export function OutreachTab({
  campaignType,
  subject,
  body,
  recipientCount,
  previewLead,
  dispatching,
  onCampaignType,
  onSubject,
  onBody,
  onOpenConfirm,
}: {
  campaignType: string
  subject: string
  body: string
  recipientCount: number
  previewLead: EmailLead | null
  dispatching: boolean
  onCampaignType: (value: string) => void
  onSubject: (value: string) => void
  onBody: (value: string) => void
  onOpenConfirm: () => void
}) {
  const disabled = !subject.trim() || !body.trim() || recipientCount === 0 || dispatching
  return (
    <div style={outreachGridStyle}>
      <section style={panelStyle}>
        <SectionHeader title="Outreach" detail="Dispatch one campaign to qualified email leads." />
        <div style={recipientCardStyle}>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>Recipients</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>
            Will send to {recipientCount.toLocaleString()} qualified email leads
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Qualified means every email lead where status is not lost.</div>
        </div>

        <div style={formStackStyle}>
          <label style={labelStyle}>
            Campaign Type
            <select value={campaignType} onChange={(event) => onCampaignType(event.target.value)} style={inputStyle}>
              <option value="initial_outreach">Welcome / Initial Outreach</option>
              <option value="follow_up">Product Update Follow-up</option>
              <option value="newsletter">Weekly Newsletter</option>
            </select>
          </label>
          <label style={labelStyle}>
            Email Subject
            <input value={subject} onChange={(event) => onSubject(event.target.value)} placeholder="Welcome to the waitlist" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Email Body
            <textarea value={body} onChange={(event) => onBody(event.target.value)} rows={8} placeholder={'Hi {{name}},\n\nThanks for joining...'} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Use {'{{name}}'} to inject the lead name.</span>
          </label>
          <button type="button" disabled={disabled} onClick={onOpenConfirm} style={primaryButtonStyle(disabled)}>
            {dispatching ? 'Dispatching...' : `Dispatch to ${recipientCount.toLocaleString()} Leads`}
          </button>
        </div>
      </section>

      <aside style={panelStyle}>
        <SectionHeader title="Live preview" detail={previewLead ? `Previewing ${previewLead.email ?? previewLead.name ?? 'lead'}` : 'Add a lead to preview personalization.'} />
        <div style={previewStyle}>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Subject</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{subject || 'Untitled campaign'}</div>
          <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
          <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-soft)', fontSize: 13, lineHeight: 1.7 }}>
            {interpolateTemplate(body || 'Hi {{name}},\n\nYour email body preview will appear here.', previewLead)}
          </div>
        </div>
      </aside>
    </div>
  )
}

const outreachGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 1.2fr) minmax(260px, 0.8fr)',
  gap: 16,
  alignItems: 'start',
}

const recipientCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--accent-glow)',
  background: 'var(--accent-soft)',
  marginBottom: 16,
}

const formStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const previewStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
  padding: 16,
  minHeight: 280,
}
