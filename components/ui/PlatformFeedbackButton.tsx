'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

type Category = 'bug' | 'feature' | 'praise' | 'other'

const CATEGORIES: { id: Category; label: string; hint: string }[] = [
  { id: 'bug', label: 'Bug', hint: 'Something broken' },
  { id: 'feature', label: 'Feature', hint: 'Something missing' },
  { id: 'praise', label: 'Praise', hint: 'Something you love' },
  { id: 'other', label: 'Other', hint: 'Anything else' },
]

interface Props {
  collapsed?: boolean
}

export function PlatformFeedbackButton({ collapsed = false }: Props) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<Category>('feature')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const pathname = usePathname()
  const toast = useToast()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => textareaRef.current?.focus(), 80)
      return () => clearTimeout(id)
    }
  }, [open])

  async function submit() {
    if (submitting) return
    const trimmed = message.trim()
    if (trimmed.length < 5) {
      toast.error('Please write a bit more detail (5+ characters).')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/platform-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message: trimmed,
          pageUrl: pathname,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to submit feedback')
      toast.success('Feedback sent — thank you!')
      setMessage('')
      setCategory('feature')
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ backgroundColor: 'var(--nav-active)' }}
        whileTap={{ scale: 0.97 }}
        title="Send feedback about Forze"
        aria-label="Send feedback about Forze"
        style={{
          width: '100%',
          padding: collapsed ? 0 : '7px 8px',
          height: collapsed ? 32 : undefined,
          borderRadius: 7,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 6,
          color: 'var(--muted)',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {!collapsed && <span>Send feedback</span>}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={overlayStyle}
            onClick={() => !submitting && setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Send feedback"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              style={dialogStyle}
            >
              <div style={dialogHeaderStyle}>
                <div>
                  <div style={eyebrowStyle}>Forze platform</div>
                  <h2 style={titleStyle}>Send feedback</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  style={closeButtonStyle}
                >
                  ×
                </button>
              </div>

              <p style={subtitleStyle}>
                Bugs, ideas, kind words — anything you want the Forze team to see.
              </p>

              <div role="radiogroup" aria-label="Feedback category" style={categoriesStyle}>
                {CATEGORIES.map((opt) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={category === opt.id}
                    key={opt.id}
                    onClick={() => setCategory(opt.id)}
                    style={categoryButtonStyle(category === opt.id)}
                  >
                    <span style={{ fontSize: 12, fontWeight: 900 }}>{opt.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{opt.hint}</span>
                  </button>
                ))}
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-soft)' }}>
                  Your message
                </span>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder="What happened, what would help, or what made your day?"
                  style={textareaStyle}
                />
                <span style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'right' }}>
                  {message.length}/4000
                </span>
              </label>

              <div style={footerStyle}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Sent from <code style={{ color: 'var(--text-soft)' }}>{pathname || '/'}</code>
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    style={secondaryButtonStyle}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    style={primaryButtonStyle(submitting)}
                  >
                    {submitting ? 'Sending…' : 'Send feedback'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  background: 'rgba(0,0,0,0.4)',
  backdropFilter: 'blur(4px)',
}

const dialogStyle: CSSProperties = {
  width: 'min(480px, 100%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  background: 'var(--card-solid)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  padding: 20,
  boxShadow: '0 28px 80px rgba(0,0,0,0.28)',
}

const dialogHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
}

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  color: 'var(--accent)',
}

const titleStyle: CSSProperties = {
  margin: '4px 0 0',
  fontSize: 20,
  fontWeight: 900,
  color: 'var(--text)',
  letterSpacing: -0.3,
}

const subtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--text-soft)',
}

const closeButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
  color: 'var(--text-soft)',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
  fontFamily: 'inherit',
  fontWeight: 800,
}

const categoriesStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
  gap: 8,
}

function categoryButtonStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    padding: '10px 12px',
    borderRadius: 12,
    border: active ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
    background: active ? 'var(--accent-soft)' : 'var(--sidebar)',
    color: active ? 'var(--accent)' : 'var(--text)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  }
}

const textareaStyle: CSSProperties = {
  width: '100%',
  fontFamily: 'inherit',
  fontSize: 13,
  color: 'var(--text)',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '11px 12px',
  outline: 'none',
  resize: 'vertical',
  minHeight: 110,
  lineHeight: 1.6,
}

const footerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 4,
}

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--sidebar)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 800,
  padding: '9px 12px',
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: 'none',
    borderRadius: 10,
    background: 'var(--accent)',
    color: '#fff',
    cursor: disabled ? 'wait' : 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 900,
    padding: '9px 14px',
    opacity: disabled ? 0.7 : 1,
  }
}
