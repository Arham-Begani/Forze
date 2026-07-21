'use client'

import { useEffect, useState } from 'react'
import { buttonStyle, inputStyle, sectionLabelStyle } from './styles'

// One writing profile per venture, read by the Instagram, LinkedIn, cold-email,
// and Direct Mail generators through lib/brand-kit.ts. Editing it here changes
// how every channel writes, which is the point — the alternative was tuning
// each generator's prompt separately and having them drift.

type Voice = {
  tone: string
  pov: 'first-person' | 'we' | 'neutral'
  bannedWords: string[]
  favoredWords: string[]
  emojiPolicy: 'none' | 'sparing' | 'liberal'
  sample: string
}

const EMPTY: Voice = {
  tone: '',
  pov: 'neutral',
  bannedWords: [],
  favoredWords: [],
  emojiPolicy: 'sparing',
  sample: '',
}

const POV_OPTIONS: Array<{ id: Voice['pov']; label: string }> = [
  { id: 'first-person', label: 'I' },
  { id: 'we', label: 'We' },
  { id: 'neutral', label: 'Either' },
]

const EMOJI_OPTIONS: Array<{ id: Voice['emojiPolicy']; label: string }> = [
  { id: 'none', label: 'No emoji' },
  { id: 'sparing', label: 'Sparing' },
  { id: 'liberal', label: 'Liberal' },
]

function chipStyle(active: boolean): React.CSSProperties {
  return {
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-soft)',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}

function parseWords(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((word) => word.trim())
        .filter(Boolean)
    )
  ).slice(0, 30)
}

export function BrandVoiceCard({ ventureId }: { ventureId: string }) {
  const [open, setOpen] = useState(false)
  const [voice, setVoice] = useState<Voice>(EMPTY)
  const [banned, setBanned] = useState('')
  const [favored, setFavored] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  // Load lazily — the founder has to open the card first, so the Social tab
  // doesn't pay for a request most visits never use.
  useEffect(() => {
    if (!open || loaded) return
    let cancelled = false

    void (async () => {
      try {
        const response = await fetch(`/api/ventures/${ventureId}/brand-voice`)
        if (!response.ok) throw new Error('load failed')
        const data = await response.json().catch(() => null)
        const next = (data?.voice as Voice | undefined) ?? EMPTY
        if (cancelled) return
        setVoice({ ...EMPTY, ...next })
        setBanned((next.bannedWords ?? []).join(', '))
        setFavored((next.favoredWords ?? []).join(', '))
      } catch {
        // A failed load leaves the empty defaults in place — the founder can
        // still write a profile and save it.
        if (!cancelled) setStatus({ tone: 'error', message: 'Could not load your saved voice — showing a blank profile.' })
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()

    return () => { cancelled = true }
  }, [open, loaded, ventureId])

  async function save() {
    setSaving(true)
    setStatus(null)
    try {
      const response = await fetch(`/api/ventures/${ventureId}/brand-voice`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...voice,
          bannedWords: parseWords(banned),
          favoredWords: parseWords(favored),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to save brand voice')
      const next = (data.voice as Voice | undefined) ?? EMPTY
      setVoice({ ...EMPTY, ...next })
      setBanned((next.bannedWords ?? []).join(', '))
      setFavored((next.favoredWords ?? []).join(', '))
      setStatus({ tone: 'success', message: 'Saved — every generator will use this from now on.' })
    } catch (error) {
      setStatus({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save brand voice' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 18,
        background: 'var(--card)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: open ? 14 : 0,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
          width: '100%',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={sectionLabelStyle}>Brand voice</span>
          <span style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6 }}>
            One writing profile shared by captions, posts, and outreach email.
          </span>
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, flexShrink: 0 }}>
          {open ? 'Hide' : 'Edit'}
        </span>
      </button>

      {open && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Tone</label>
            <input
              value={voice.tone}
              maxLength={240}
              onChange={(event) => setVoice((prev) => ({ ...prev, tone: event.target.value }))}
              placeholder="e.g. direct and dry, technical but never stiff"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Speak as</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {POV_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setVoice((prev) => ({ ...prev, pov: option.id }))}
                    style={chipStyle(voice.pov === option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Emoji</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {EMOJI_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setVoice((prev) => ({ ...prev, emojiPolicy: option.id }))}
                    style={chipStyle(voice.emojiPolicy === option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              Never use these words
            </label>
            <input
              value={banned}
              onChange={(event) => setBanned(event.target.value)}
              placeholder="synergy, leverage, game-changer"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              Words that fit the brand
            </label>
            <input
              value={favored}
              onChange={(event) => setFavored(event.target.value)}
              placeholder="ship, operator, pipeline"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              Sample of your writing
            </label>
            <textarea
              value={voice.sample}
              maxLength={800}
              rows={4}
              onChange={(event) => setVoice((prev) => ({ ...prev, sample: event.target.value }))}
              placeholder="Paste a paragraph you actually wrote. The generators match its rhythm — this is the single highest-signal field here."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
              {voice.sample.length}/800
            </div>
          </div>

          {status && (
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: status.tone === 'success' ? '#16a34a' : '#dc2626',
              }}
            >
              {status.message}
            </div>
          )}

          <div>
            <button type="button" onClick={save} disabled={saving || !loaded} style={buttonStyle('primary')}>
              {saving ? 'Saving…' : 'Save brand voice'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
