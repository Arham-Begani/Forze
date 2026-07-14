'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Save, Plus, Trash2, GripVertical, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SlideItem {
  slide: string
  content: string
  speakerNotes: string
}

interface AskDetails {
  suggestedRaise: string
  useOfFunds: string[]
  keyMilestones: string[]
}

interface InvestorKitData {
  executiveSummary: string
  pitchDeckOutline: SlideItem[]
  onePageMemo: string
  askDetails: AskDetails
  dataRoomSections: string[]
}

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

const ACCENT = '#7A8C5A'

// ─── Editable List ─────────────────────────────────────────────────────────────

function EditableList({
  items,
  onChange,
  placeholder,
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, cursor: 'grab' }} />
          <input
            value={item}
            onChange={(e) => {
              const next = [...items]
              next[i] = e.target.value
              onChange(next)
            }}
            placeholder={placeholder}
            style={inputStyle}
          />
          <button
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            style={iconBtnStyle}
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ''])}
        style={{ ...iconBtnStyle, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 10px' }}
      >
        <Plus size={12} /> Add
      </button>
    </div>
  )
}

// ─── Slide Editor ──────────────────────────────────────────────────────────────

function SlideEditor({
  slides,
  onChange,
}: {
  slides: SlideItem[]
  onChange: (slides: SlideItem[]) => void
}) {
  const [expanded, setExpanded] = useState<number | null>(null)

  const updateSlide = (i: number, field: keyof SlideItem, value: string) => {
    const next = [...slides]
    next[i] = { ...next[i], [field]: value }
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {slides.map((slide, i) => (
        <div
          key={i}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: 'var(--sidebar)',
            overflow: 'hidden',
          }}
        >
          <div
            onClick={() => setExpanded(expanded === i ? null : i)}
            style={{
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            <span>Slide {i + 1}: {slide.slide || 'Untitled'}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={(e) => { e.stopPropagation(); onChange(slides.filter((_, idx) => idx !== i)) }}
                style={iconBtnStyle}
                title="Remove slide"
              >
                <Trash2 size={13} />
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{expanded === i ? '▲' : '▼'}</span>
            </div>
          </div>
          <AnimatePresence>
            {expanded === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={labelStyle}>
                    Slide Title
                    <input value={slide.slide} onChange={(e) => updateSlide(i, 'slide', e.target.value)} style={inputStyle} />
                  </label>
                  <label style={labelStyle}>
                    Content
                    <textarea value={slide.content} onChange={(e) => updateSlide(i, 'content', e.target.value)} style={{ ...textareaStyle, minHeight: 80 }} />
                  </label>
                  <label style={labelStyle}>
                    Speaker Notes
                    <textarea value={slide.speakerNotes} onChange={(e) => updateSlide(i, 'speakerNotes', e.target.value)} style={{ ...textareaStyle, minHeight: 60 }} />
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      <button
        onClick={() => onChange([...slides, { slide: `Slide ${slides.length + 1}`, content: '', speakerNotes: '' }])}
        style={{ ...iconBtnStyle, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '6px 12px' }}
      >
        <Plus size={12} /> Add Slide
      </button>
    </div>
  )
}

// ─── Section Wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 12,
      background: 'var(--glass-bg)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h3>
      {children}
    </div>
  )
}

// ─── Main Editor Page ──────────────────────────────────────────────────────────

export default function InvestorKitEditorPage() {
  const params = useParams()
  const router = useRouter()
  const ventureId = params.id as string

  const [kit, setKit] = useState<InvestorKitData | null>(null)
  const [kitId, setKitId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [hasManualEdits, setHasManualEdits] = useState(false)

  const originalRef = useRef<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load kit ──
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/ventures/${ventureId}/investor-kit`)
        const data = await res.json()
        if (data.kit) {
          const kitData = data.kit.kit_data as InvestorKitData
          setKit(kitData)
          setKitId(data.kit.id)
          setHasManualEdits(data.meta?.has_manual_edits ?? false)
          setLastSavedAt(data.meta?.last_edited_at ?? data.kit.created_at)
          originalRef.current = JSON.stringify(kitData)
        }
      } catch {
        // handled by empty state
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [ventureId])

  // ── Check dirty ──
  const checkDirty = useCallback(() => {
    if (!kit) return
    const current = JSON.stringify(kit)
    if (current !== originalRef.current) {
      setSaveStatus('dirty')
    }
  }, [kit])

  useEffect(() => { checkDirty() }, [checkDirty])

  // ── Save handler ──
  const save = useCallback(async () => {
    if (!kit || !kitId) return
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/ventures/${ventureId}/investor-kit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: kit }),
      })
      if (!res.ok) throw new Error('Save failed')
      const data = await res.json()
      originalRef.current = JSON.stringify(kit)
      setLastSavedAt(new Date().toISOString())
      setHasManualEdits(true)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }, [kit, kitId, ventureId])

  // ── Auto-save on dirty (debounced 3s) ──
  useEffect(() => {
    if (saveStatus !== 'dirty') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { save() }, 3000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [saveStatus, save])

  // ── Update helpers ──
  const updateField = <K extends keyof InvestorKitData>(field: K, value: InvestorKitData[K]) => {
    setKit(prev => prev ? { ...prev, [field]: value } : prev)
  }

  const updateAsk = <K extends keyof AskDetails>(field: K, value: AskDetails[K]) => {
    setKit(prev => prev ? { ...prev, askDetails: { ...prev.askDetails, [field]: value } } : prev)
  }

  // ── Loading / empty ──
  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 60 }}>
          Loading investor kit...
        </div>
      </div>
    )
  }

  if (!kit) {
    return (
      <div style={pageStyle}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 60 }}>
          No investor kit found. Generate one first with the &ldquo;Investor Kit&rdquo; button in your venture&rsquo;s Landing workspace.
          <br />
          <button onClick={() => router.back()} style={{ ...btnStyle, marginTop: 16 }}>
            <ArrowLeft size={14} /> Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={iconBtnStyle} title="Back">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Edit Investor Kit
            </h1>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {hasManualEdits ? 'Manually edited' : 'AI-generated'}
              {lastSavedAt && ` \u00b7 Last saved ${new Date(lastSavedAt).toLocaleDateString()}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SaveIndicator status={saveStatus} />
          <button
            onClick={save}
            disabled={saveStatus === 'saving' || saveStatus === 'idle'}
            style={{
              ...btnStyle,
              background: saveStatus === 'dirty' ? ACCENT : 'transparent',
              color: saveStatus === 'dirty' ? '#fff' : 'var(--text-soft)',
              opacity: saveStatus === 'idle' || saveStatus === 'saved' ? 0.5 : 1,
            }}
          >
            <Save size={14} /> Save
          </button>
        </div>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Section title="Executive Summary">
          <textarea
            value={kit.executiveSummary}
            onChange={(e) => updateField('executiveSummary', e.target.value)}
            style={{ ...textareaStyle, minHeight: 160 }}
            placeholder="300-500 word executive summary..."
          />
        </Section>

        <Section title="Pitch Deck Outline">
          <SlideEditor slides={kit.pitchDeckOutline} onChange={(s) => updateField('pitchDeckOutline', s)} />
        </Section>

        <Section title="One-Page Investment Memo">
          <textarea
            value={kit.onePageMemo}
            onChange={(e) => updateField('onePageMemo', e.target.value)}
            style={{ ...textareaStyle, minHeight: 240, fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
            placeholder="# Investment Memo&#10;&#10;Write in markdown..."
          />
        </Section>

        <Section title="The Ask">
          <label style={labelStyle}>
            Suggested Raise
            <input
              value={kit.askDetails.suggestedRaise}
              onChange={(e) => updateAsk('suggestedRaise', e.target.value)}
              style={inputStyle}
              placeholder="e.g. $500K pre-seed"
            />
          </label>
          <label style={labelStyle}>Use of Funds</label>
          <EditableList
            items={kit.askDetails.useOfFunds}
            onChange={(items) => updateAsk('useOfFunds', items)}
            placeholder="e.g. 40% Engineering"
          />
          <label style={{ ...labelStyle, marginTop: 8 }}>Key Milestones</label>
          <EditableList
            items={kit.askDetails.keyMilestones}
            onChange={(items) => updateAsk('keyMilestones', items)}
            placeholder="e.g. Launch MVP by Q2"
          />
        </Section>

        <Section title="Data Room Sections">
          <EditableList
            items={kit.dataRoomSections}
            onChange={(items) => updateField('dataRoomSections', items)}
            placeholder="e.g. Market Research"
          />
        </Section>
      </div>
    </div>
  )
}

// ─── Save Indicator ────────────────────────────────────────────────────────────

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null

  const config: Record<SaveStatus, { icon: React.ReactNode; text: string; color: string }> = {
    idle: { icon: null, text: '', color: '' },
    dirty: { icon: null, text: 'Unsaved changes', color: '#d4924a' },
    saving: { icon: <RotateCcw size={12} style={{ animation: 'spin 1s linear infinite' }} />, text: 'Saving...', color: 'var(--text-muted)' },
    saved: { icon: <CheckCircle2 size={12} />, text: 'Saved', color: ACCENT },
    error: { icon: <AlertTriangle size={12} />, text: 'Save failed', color: '#E04848' },
  }

  const c = config[status]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: c.color }}>
      {c.icon} {c.text}
    </div>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: '32px 20px',
  fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--sidebar)',
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  lineHeight: 1.6,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-soft)',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const btnStyle: React.CSSProperties = {
  padding: '7px 14px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--text-soft)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: 'inherit',
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: 4,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
}
