'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'
import {
  Badge,
  errorMessage,
  formatDate,
  formatTime,
  inputStyle,
  labelStyle,
  LEAD_STATUSES,
  miniButtonStyle,
  primaryButtonStyle,
  readJson,
  secondaryButtonStyle,
  smallSelectStyle,
  type EmailLead,
  type LeadActivityItem,
  type LeadStatus,
} from './shared'

export function LeadDetailDrawer({
  ventureId,
  lead,
  onClose,
  onUpdated,
  onDeleted,
}: {
  ventureId: string
  lead: EmailLead
  onClose: () => void
  onUpdated: (lead: EmailLead) => void
  onDeleted: (leadId: string) => void
}) {
  const toast = useToast()
  const [activity, setActivity] = useState<LeadActivityItem[]>([])
  const [loadingActivity, setLoadingActivity] = useState(true)
  const [saving, setSaving] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [converting, setConverting] = useState(false)
  const [dealTitle, setDealTitle] = useState(lead.company || lead.name || lead.email || 'New deal')
  const [showConvertForm, setShowConvertForm] = useState(false)

  const [name, setName] = useState(lead.name ?? '')
  const [company, setCompany] = useState(lead.company ?? '')
  const [phone, setPhone] = useState(lead.phone ?? '')
  const [tagsInput, setTagsInput] = useState((lead.tags ?? []).join(', '))
  const [status, setStatus] = useState<LeadStatus>(lead.status)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingActivity(true)
      try {
        const res = await fetch(`/api/ventures/${ventureId}/crm/leads/${lead.id}`)
        const data = await readJson<{ activity?: LeadActivityItem[]; error?: unknown }>(res)
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load lead activity')
        if (!cancelled) setActivity(data.activity ?? [])
      } catch (error) {
        if (!cancelled) toast.error(errorMessage(error, 'Failed to load lead activity'))
      } finally {
        if (!cancelled) setLoadingActivity(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  async function handleSave() {
    setSaving(true)
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
      const res = await fetch(`/api/ventures/${ventureId}/crm/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          company: company.trim() || null,
          phone: phone.trim() || null,
          tags,
          status,
        }),
      })
      const data = await readJson<{ success?: boolean; lead?: EmailLead; error?: unknown }>(res)
      if (!res.ok || !data.success || !data.lead) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save lead')
      }
      onUpdated(data.lead)
      toast.success('Lead updated')
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save lead'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAddNote() {
    const body = noteBody.trim()
    if (!body) return
    setAddingNote(true)
    try {
      const res = await fetch(`/api/ventures/${ventureId}/crm/leads/${lead.id}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const data = await readJson<{ success?: boolean; activity?: LeadActivityItem; error?: unknown }>(res)
      if (!res.ok || !data.success || !data.activity) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to add note')
      }
      setActivity((prev) => [data.activity!, ...prev])
      setNoteBody('')
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to add note'))
    } finally {
      setAddingNote(false)
    }
  }

  async function handleConvertToDeal() {
    setConverting(true)
    try {
      const res = await fetch(`/api/ventures/${ventureId}/crm/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, title: dealTitle.trim() || 'New deal' }),
      })
      const data = await readJson<{ success?: boolean; error?: unknown }>(res)
      if (!res.ok || !data.success) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to convert to deal')
      }
      toast.success('Converted to deal — see the Pipeline tab')
      setShowConvertForm(false)
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to convert to deal'))
    } finally {
      setConverting(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${lead.email ?? lead.name ?? 'this lead'}? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/ventures/${ventureId}/crm/leads/${lead.id}`, { method: 'DELETE' })
      const data = await readJson<{ error?: unknown }>(res)
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete lead')
      onDeleted(lead.id)
      toast.success('Lead deleted')
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to delete lead'))
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        style={overlayStyle}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
      <motion.div
        style={drawerStyle}
        onClick={(e) => e.stopPropagation()}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {lead.external_identity ? `@${lead.external_identity.split(':')[1] ?? lead.external_identity}` : lead.email}
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>{lead.name || 'Unknown lead'}</h2>
          </div>
          <button type="button" onClick={onClose} style={miniButtonStyle}>Close</button>
        </div>

        <div style={fieldGridStyle}>
          <label style={labelStyle}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} style={smallSelectStyle}>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Company
            <input value={company} onChange={(e) => setCompany(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Tags (comma separated)
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="vip, referral" style={inputStyle} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={handleSave} disabled={saving} style={primaryButtonStyle(saving)}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button type="button" onClick={() => setShowConvertForm((v) => !v)} style={secondaryButtonStyle}>
            Convert to Deal
          </button>
          <button type="button" onClick={handleDelete} style={{ ...secondaryButtonStyle, borderColor: '#dc262630', color: '#dc2626' }}>
            Delete lead
          </button>
        </div>

        {showConvertForm && (
          <div style={convertBoxStyle}>
            <label style={labelStyle}>
              Deal title
              <input value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} style={inputStyle} />
            </label>
            <button type="button" onClick={handleConvertToDeal} disabled={converting} style={primaryButtonStyle(converting)}>
              {converting ? 'Converting...' : 'Create deal'}
            </button>
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          Source: {lead.source} · Captured {formatDate(lead.created_at)}
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Notes &amp; activity</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote() }}
              placeholder="Add a note..."
              style={inputStyle}
            />
            <button type="button" onClick={handleAddNote} disabled={addingNote || !noteBody.trim()} style={secondaryButtonStyle}>
              Add
            </button>
          </div>

          {loadingActivity && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading activity...</div>}
          {!loadingActivity && activity.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>No activity yet.</div>
          )}
          {!loadingActivity && activity.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {activity.map((item) => (
                <div key={item.id} style={activityItemStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <Badge color={activityTypeColor(item.type)}>{item.type.replace('_', ' ')}</Badge>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatTime(item.created_at)}</span>
                  </div>
                  {item.body && <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 6 }}>{item.body}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function activityTypeColor(type: LeadActivityItem["type"]): string {
  switch (type) {
    case 'note': return '#5A6E8C'
    case 'status_change': return '#C4975A'
    case 'field_change': return '#6b7280'
    case 'email_sent': return '#5A8C6E'
    case 'deal_stage_change': return '#8C5A7A'
    default: return '#6b7280'
  }
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  justifyContent: 'flex-end',
  background: 'rgba(0,0,0,0.42)',
}

const drawerStyle: CSSProperties = {
  width: 'min(440px, 100%)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  background: 'var(--card-solid)',
  borderLeft: '1px solid var(--border)',
  padding: 22,
  overflowY: 'auto',
  boxShadow: '-28px 0 80px rgba(0,0,0,0.32)',
}

const fieldGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
}

const convertBoxStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--accent-glow)',
  background: 'var(--accent-soft)',
}

const activityItemStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
}
