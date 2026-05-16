'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'

type Kind = 'testimonial' | 'feedback'

interface FeedbackFormProps {
  ventureId: string
  accent: string
}

export function FeedbackForm({ ventureId, accent }: FeedbackFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [quote, setQuote] = useState('')
  const [kind, setKind] = useState<Kind>('testimonial')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status === 'submitting') return
    setStatus('submitting')
    setError(null)

    try {
      const res = await fetch(`/api/ventures/${ventureId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          quote: quote.trim(),
          kind,
          source: 'public_form',
        }),
      })
      const data = await res.json().catch(() => ({} as { error?: string }))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Submission failed')
      }
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Submission failed')
    }
  }

  if (status === 'success') {
    return (
      <div
        role="status"
        style={{
          padding: '22px 20px',
          borderRadius: 16,
          border: `1px solid ${accent}40`,
          background: `${accent}10`,
          color: '#2a2620',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1c1a16' }}>Thank you!</div>
        <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: '#5f5a52' }}>
          Your {kind === 'testimonial' ? 'testimonial' : 'feedback'} was received. We appreciate
          you taking the time to share it.
        </p>
      </div>
    )
  }

  const submitting = status === 'submitting'

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div role="radiogroup" aria-label="Submission type" style={segmentWrap}>
        <SegmentButton active={kind === 'testimonial'} accent={accent} onClick={() => setKind('testimonial')}>
          Share testimonial
        </SegmentButton>
        <SegmentButton active={kind === 'feedback'} accent={accent} onClick={() => setKind('feedback')}>
          Send feedback
        </SegmentButton>
      </div>

      <Field label="Your name">
        <input
          type="text"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          style={inputStyle}
        />
      </Field>

      <Field label="Email">
        <input
          type="email"
          required
          maxLength={200}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          style={inputStyle}
        />
      </Field>

      <Field
        label={kind === 'testimonial' ? 'Your testimonial' : 'Your feedback'}
        hint={`${quote.length}/2000`}
      >
        <textarea
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder={
            kind === 'testimonial'
              ? 'What did you love? Be specific — it makes the quote more powerful.'
              : 'What could be better? Bugs, feature ideas, anything is welcome.'
          }
          style={{ ...inputStyle, resize: 'vertical', minHeight: 120, lineHeight: 1.6 }}
        />
      </Field>

      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: '#fdecec',
            border: '1px solid #f3b9b9',
            color: '#9a2a2a',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          marginTop: 4,
          border: 'none',
          borderRadius: 12,
          background: submitting ? `${accent}80` : accent,
          color: '#fff',
          fontSize: 14,
          fontWeight: 800,
          padding: '12px 16px',
          cursor: submitting ? 'wait' : 'pointer',
          letterSpacing: 0.2,
          boxShadow: submitting ? 'none' : `0 8px 24px ${accent}40`,
          transition: 'transform 120ms ease, box-shadow 120ms ease',
        }}
      >
        {submitting ? 'Submitting…' : kind === 'testimonial' ? 'Share testimonial' : 'Send feedback'}
      </button>
    </form>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#3a352e', letterSpacing: 0.2 }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: '#928c80' }}>{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function SegmentButton({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean
  accent: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      style={{
        flex: 1,
        border: 'none',
        borderRadius: 10,
        background: active ? '#ffffff' : 'transparent',
        color: active ? '#1c1a16' : '#5f5a52',
        fontSize: 12,
        fontWeight: 800,
        padding: '9px 10px',
        cursor: 'pointer',
        boxShadow: active ? `0 1px 3px ${accent}30` : 'none',
        letterSpacing: 0.2,
      }}
    >
      {children}
    </button>
  )
}

const segmentWrap: CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: 4,
  borderRadius: 12,
  background: '#f4f2ed',
  border: '1px solid #e8e4dc',
}

const inputStyle: CSSProperties = {
  width: '100%',
  fontFamily: 'inherit',
  fontSize: 14,
  color: '#1c1a16',
  background: '#fbfaf7',
  border: '1px solid #e8e4dc',
  borderRadius: 10,
  padding: '11px 12px',
  outline: 'none',
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
}
