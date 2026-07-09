'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface UploadedDoc {
  name: string
  content: string
  type: string
}

async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (['txt', 'md', 'csv', 'json'].includes(ext)) {
    return await file.text()
  }

  if (ext === 'pdf') {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pages: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      pages.push(textContent.items.map((item: any) => item.str).join(' '))
    }
    return pages.join('\n\n')
  }

  return await file.text() // fallback
}

// Instant, no-network project name derived from the idea text. Venture creation
// must feel immediate, so we never block on the AI namer on the critical path —
// this is used right away and the AI refines it in the background (see
// handleSubmit). Falls back to "New Venture" for sparse input.
function deriveNameFromIdea(idea: string): string {
  const stop = new Set([
    'the', 'a', 'an', 'and', 'for', 'to', 'of', 'that', 'this', 'with', 'app', 'apps',
    'application', 'platform', 'tool', 'my', 'our', 'is', 'it', 'on', 'in', 'build',
    'building', 'create', 'creating', 'make', 'making', 'startup', 'idea', 'want',
    'need', 'using', 'via', 'by', 'into', 'from', 'their', 'your',
  ])
  const words = idea
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w.toLowerCase()))
    .slice(0, 3)
  if (words.length === 0) return 'New Venture'
  return words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .slice(0, 40)
}

// Background, best-effort: ask the AI for a nicer project name and persist it if
// it differs. Aborted after 20s so it can never hang; on any failure the instant
// name simply stays. This is fire-and-forget — the user is already in their
// venture by the time this runs.
async function refineProjectNameInBackground(projectId: string, idea: string, currentName: string): Promise<void> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    const nameRes = await fetch('/api/generate-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!nameRes.ok) return
    const nameData = await nameRes.json().catch(() => ({}))
    const aiName = typeof nameData?.name === 'string' ? nameData.name.trim() : ''
    if (!aiName || aiName === currentName) return
    await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: aiName }),
    })
    // Sidebar re-reads projects and picks up the refined name.
    window.dispatchEvent(new CustomEvent('Forze:refresh-projects'))
  } catch {
    // best-effort — the instant name stays
  }
}

// Background, best-effort: record the user's first idea if they don't have one.
async function saveFirstIdeaInBackground(idea: string): Promise<void> {
  try {
    const ideaRes = await fetch('/api/user/idea')
    if (!ideaRes.ok) return
    const ideaData = await ideaRes.json().catch(() => ({}))
    if (!ideaData?.idea) {
      await fetch('/api/user/idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea }),
      })
    }
  } catch {
    // non-critical
  }
}

export default function NewProjectPage() {
  const router = useRouter()

  const [ideaInput, setIdeaInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [enhanced, setEnhanced] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [mounted, setMounted] = useState(false)
  const [docs, setDocs] = useState<UploadedDoc[]>([])
  const [parsing, setParsing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canUploadDocs = true // Enable document upload for all users

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).slice(0, 5 - docs.length) // max 5 docs
    if (fileArray.length === 0) return

    setParsing(true)
    try {
      const newDocs: UploadedDoc[] = []
      for (const file of fileArray) {
        const content = await extractTextFromFile(file)
        if (content.trim()) {
          newDocs.push({
            name: file.name,
            content: content.slice(0, 50000), // cap at 50k chars
            type: file.name.split('.').pop()?.toLowerCase() ?? 'txt',
          })
        }
      }
      setDocs(prev => [...prev, ...newDocs].slice(0, 5))
    } catch (err) {
      console.error('File parsing error:', err)
    } finally {
      setParsing(false)
    }
  }, [docs.length])

  useEffect(() => {
    setMounted(true)
  }, [])

  const canSubmit = ideaInput.trim().length > 5 && !submitting
  const canEnhance = ideaInput.trim().length >= 5 && !enhancing && !submitting

  async function handleEnhance() {
    if (!canEnhance) return
    setEnhancing(true)
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: ideaInput.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.enhanced) {
          setIdeaInput(data.enhanced)
          setEnhanced(true)
          setTimeout(() => setEnhanced(false), 3000)
        }
      }
    } catch (err) {
      console.error('Failed to enhance:', err)
    } finally {
      setEnhancing(false)
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return
    const idea = ideaInput.trim()
    setSubmitting(true)
    setError('')

    try {
      // Instant local name — NO AI on the critical path. The old flow blocked
      // venture creation on a Gemini call (which, when the model was slow/hung,
      // took minutes). We name it locally now and let the AI refine it in the
      // background afterward, so the venture appears in well under a second.
      const instantName = deriveNameFromIdea(idea)

      // Step 1: Create the project
      setStatus('Creating project...')
      const projRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: instantName }),
      })
      if (!projRes.ok) {
        const err = await projRes.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create project')
      }
      const project = await projRes.json()

      // Step 2: Save the idea (+docs) AND create the initial venture in parallel —
      // both only need project.id and are independent of each other, so there's no
      // reason to await them one after the other.
      setStatus('Setting up your venture...')
      const patchBody: Record<string, unknown> = { global_idea: idea }
      if (docs.length > 0) {
        patchBody.source_documents = docs.map(d => ({
          name: d.name,
          content: d.content,
          type: d.type,
        }))
      }
      const [, ventureRes] = await Promise.all([
        fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody),
        }),
        fetch('/api/ventures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `${instantName} - v1`, projectId: project.id }),
        }).catch(() => null),
      ])

      if (ventureRes && ventureRes.ok) {
        const newVenture = await ventureRes.json().catch(() => null)
        if (newVenture) window.dispatchEvent(new CustomEvent('Forze:venture-added', { detail: newVenture }))
      }
      window.dispatchEvent(new CustomEvent('Forze:refresh-projects'))

      // Navigate immediately — the user is in their venture now.
      setStatus('Launching...')
      router.push(`/dashboard/project/${project.id}`)

      // ── Background, non-blocking: AI naming + first-idea save. Their latency no
      // longer affects how fast the venture is created. ──
      void refineProjectNameInBackground(project.id, idea, instantName)
      void saveFirstIdeaInBackground(idea)

    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
      setStatus('')
    }
  }

  if (!mounted) return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 52 }}>
        <div style={hexStyle} />
        <span style={wordmarkStyle}>Forze</span>
      </div>
    </div>
  )

  return (
    <motion.div
      style={pageStyle}
      initial={mounted ? { opacity: 0 } : false}
      animate={mounted ? { opacity: 1 } : false}
      transition={{ duration: 0.5 }}
    >
      {/* Ambient glow */}
      <div style={glowStyle} />

      {/* Logo */}
      <motion.div
        style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 52 }}
        initial={mounted ? { opacity: 0, y: -20 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <motion.div
          style={hexStyle}
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        />
        <span style={wordmarkStyle}>Forze</span>
      </motion.div>

      {/* Heading */}
      <motion.h2
        initial={mounted ? { opacity: 0, y: 12 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ delay: 0.15, duration: 0.5 }}
        style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.03em', textAlign: 'center' }}
      >
        What do you want to build?
      </motion.h2>
      <motion.p
        initial={mounted ? { opacity: 0 } : false}
        animate={mounted ? { opacity: 0.6 } : false}
        transition={{ delay: 0.25 }}
        style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 32px', textAlign: 'center', maxWidth: 420 }}
      >
        Tell us your big idea and our AI workforce will handle the rest.
      </motion.p>

      {/* Input card */}
      <motion.div
        initial={mounted ? { opacity: 0, y: 20, scale: 0.97 } : false}
        animate={mounted ? { opacity: 1, y: 0, scale: 1 } : false}
        transition={{ duration: 0.5, delay: 0.2, type: 'spring', stiffness: 300, damping: 24 }}
        style={{ width: '100%', maxWidth: 620 }}
      >
        <div
          className="glass-card"
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Gradient top accent */}
          <motion.div
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 2,
              background: 'linear-gradient(90deg, var(--accent), #e8a04e, var(--accent))',
              backgroundSize: '200% 100%',
              borderRadius: '16px 16px 0 0',
            }}
            animate={ideaInput.trim() ? { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] } : {}}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />

          <textarea
            value={ideaInput}
            onChange={e => setIdeaInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
            }}
            placeholder="Describe your startup idea in detail — the problem it solves, who it's for, and what makes it unique..."
            style={{
              width: '100%',
              minHeight: 100,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 15,
              lineHeight: 1.7,
              resize: 'none',
              fontFamily: 'inherit',
            }}
            autoFocus
            maxLength={2000}
            disabled={submitting}
            aria-label="Describe your startup idea"
          />

          {/* Document upload section */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            {/* Section label */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)' }}>
                  Reference Documents
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)', padding: '1px 7px', borderRadius: 999, background: 'var(--nav-active)', border: '1px solid var(--border)' }}>
                  optional
                </span>
              </div>
              {docs.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{docs.length}/5 files</span>
              )}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
              }}
              style={{
                border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'hsla(28,62%,42%,0.35)'}`,
                borderRadius: 10,
                padding: docs.length > 0 ? '10px 12px' : '18px 16px',
                background: dragOver ? 'var(--accent-soft)' : 'hsla(28,62%,42%,0.04)',
                transition: 'all 200ms',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                cursor: docs.length === 0 ? 'pointer' : 'default',
              }}
              onClick={docs.length === 0 ? () => fileInputRef.current?.click() : undefined}
            >
              {docs.length === 0 && !parsing && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: 10,
                    background: 'var(--accent-soft)',
                    border: '1px solid hsla(28,62%,42%,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 2 }}>
                      Drop files here, or <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>click to browse</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      PDF, TXT, MD, CSV, JSON · Up to 5 files · Agents will read these for context
                    </div>
                  </div>
                </div>
              )}

              {parsing && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: 'var(--accent)' }}>
                  <motion.div
                    style={{ width: 12, height: 12, border: '2px solid var(--accent-glow)', borderTopColor: 'var(--accent)', borderRadius: '50%' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                  />
                  Extracting text from document...
                </div>
              )}

              {docs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {docs.map((doc, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      background: 'var(--nav-active)',
                      borderRadius: 8,
                      fontSize: 12,
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span style={{ color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                          {Math.round(doc.content.length / 1000)}k chars
                        </span>
                        <button
                          onClick={() => setDocs(prev => prev.filter((_, idx) => idx !== i))}
                          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 2, fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                          title="Remove"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                  {docs.length < 5 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'left', padding: '4px 0', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add another file
                    </button>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.csv,.json"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.length) handleFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          {/* Action bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border)',
            paddingTop: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 11,
                color: ideaInput.length > 1800 ? '#e05252' : 'var(--muted)',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 500,
                transition: 'color 200ms',
              }}>
                {ideaInput.length}/2000
              </span>

              {/* AI Enhance button */}
              {mounted && (
                <AnimatePresence>
                  {ideaInput.trim().length >= 5 && !submitting && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={handleEnhance}
                      disabled={!canEnhance}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 14px',
                        borderRadius: 20,
                        background: enhanced ? 'rgba(90, 140, 110, 0.12)' : 'var(--accent-soft)',
                        border: `1px solid ${enhanced ? 'rgba(90, 140, 110, 0.3)' : 'var(--accent-glow)'}`,
                        color: enhanced ? '#5A8C6E' : 'var(--accent)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: enhancing ? 'wait' : 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 200ms',
                      }}
                      whileHover={canEnhance ? { scale: 1.04, boxShadow: '0 2px 12px var(--accent-glow)' } : {}}
                      whileTap={canEnhance ? { scale: 0.96 } : {}}
                    >
                      {enhancing ? (
                        <>
                          <motion.div
                            style={{
                              width: 12, height: 12,
                              border: '2px solid var(--accent-glow)',
                              borderTopColor: 'var(--accent)',
                              borderRadius: '50%',
                            }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                          />
                          <span>Enhancing...</span>
                        </>
                      ) : enhanced ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Enhanced</span>
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                          </svg>
                          <span>Enhance with AI</span>
                        </>
                      )}
                    </motion.button>
                  )}
                </AnimatePresence>
              )}
            </div>

            {mounted && (
              <AnimatePresence>
                {canSubmit && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8, x: 12 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: 12 }}
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 20px',
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, var(--accent), #e8963a)',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      boxShadow: '0 4px 14px var(--accent-glow)',
                      transition: 'box-shadow 200ms',
                    }}
                    whileHover={!submitting ? { scale: 1.05, boxShadow: '0 6px 20px var(--accent-glow)' } : {}}
                    whileTap={!submitting ? { scale: 0.95 } : {}}
                  >
                    {submitting ? (
                      <motion.div
                        style={{
                          width: 16, height: 16,
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#fff',
                          borderRadius: '50%',
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                      />
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Initialize</span>
                      </>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Status / hint */}
        <motion.p
          style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', textAlign: 'center', opacity: 0.5, minHeight: 20 }}
          initial={mounted ? { opacity: 0 } : false}
          animate={mounted ? { opacity: 0.5 } : false}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {error ? (
            <span style={{ color: '#e05252', opacity: 1 }}>{error}</span>
          ) : submitting ? (
            <motion.span
              style={{ color: 'var(--accent)', opacity: 1 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {status}
            </motion.span>
          ) : (
            <>Press <kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>Enter</kbd> to initialize your vision</>
          )}
        </motion.p>
      </motion.div>
    </motion.div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg)',
  position: 'relative',
  overflow: 'hidden',
  padding: '0 24px',
}

const glowStyle: React.CSSProperties = {
  position: 'absolute',
  top: '30%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 600,
  height: 400,
  background: 'radial-gradient(ellipse, var(--accent-glow) 0%, transparent 65%)',
  filter: 'blur(60px)',
  opacity: 0.35,
  pointerEvents: 'none',
}

const hexStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
  flexShrink: 0,
  boxShadow: '0 0 20px var(--accent-glow)',
}

const wordmarkStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  color: 'var(--text)',
  letterSpacing: '-0.04em',
}

const kbdStyle: React.CSSProperties = {
  background: 'var(--nav-active)',
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  fontFamily: 'system-ui',
  fontSize: 11,
}
