'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { IdeaIntakeChat, type IdeaBriefValue } from '@/components/dashboard/IdeaIntakeChat'

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

function DocAttach({
  docs,
  parsing,
  dragOver,
  setDragOver,
  fileInputRef,
  handleFiles,
  removeDoc,
}: {
  docs: UploadedDoc[]
  parsing: boolean
  dragOver: boolean
  setDragOver: (v: boolean) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFiles: (files: FileList | File[]) => void
  removeDoc: (index: number) => void
}) {
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={docs.length >= 5}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: dragOver ? 'var(--accent-soft)' : 'transparent',
            border: `1px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
            color: 'var(--muted)',
            fontSize: 11,
            fontWeight: 600,
            cursor: docs.length >= 5 ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          {parsing ? 'Reading…' : 'Attach reference docs'}
        </button>
        {docs.map((d, i) => (
          <span
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'var(--nav-active)',
              border: '1px solid var(--border)',
              color: 'var(--text-soft)',
            }}
          >
            {d.name}
            <button
              type="button"
              onClick={() => removeDoc(i)}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}
              aria-label={`Remove ${d.name}`}
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.csv,.json"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files?.length) handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default function NewProjectPage() {
  const router = useRouter()

  const [ideaInput, setIdeaInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [mounted, setMounted] = useState(false)
  const [docs, setDocs] = useState<UploadedDoc[]>([])
  const [parsing, setParsing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleSubmit(brief: IdeaBriefValue, suggestedName: string | null) {
    if (submitting) return
    const rawIdea = ideaInput.trim()
    // The synthesized summary is what agents read. Fall back to the founder's
    // raw sentence if the interview degraded and produced nothing usable.
    const idea = brief.summary.trim() || rawIdea
    setSubmitting(true)
    setError('')

    try {
      // Instant name — NO AI on the critical path. The interview already
      // proposed a name, so we usually skip the background namer entirely.
      const instantName = (suggestedName || '').trim() || deriveNameFromIdea(rawIdea)

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

      // Step 2: Save the idea (+brief +docs) AND create the initial venture in
      // parallel — both only need project.id and are independent of each other,
      // so there's no reason to await them one after the other.
      setStatus('Setting up your venture...')
      const patchBody: Record<string, unknown> = { global_idea: idea, idea_brief: brief }
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
      // Skip the namer when the interview already gave us a real product name.
      if (!suggestedName) void refineProjectNameInBackground(project.id, idea, instantName)
      void saveFirstIdeaInBackground(rawIdea)

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
      <div style={glowStyle} />


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

      <motion.h2
        initial={mounted ? { opacity: 0, y: 12 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ delay: 0.15, duration: 0.5 }}
        style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.03em', textAlign: 'center' }}
      >
        Start a new venture
      </motion.h2>
      <motion.p
        initial={mounted ? { opacity: 0 } : false}
        animate={mounted ? { opacity: 0.6 } : false}
        transition={{ delay: 0.25 }}
        style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 32px', textAlign: 'center', maxWidth: 420 }}
      >
        Forze will interview you about your idea, then build from what you tell it.
      </motion.p>

      <div style={{ width: '100%', maxWidth: 640 }}>
        <IdeaIntakeChat
          docNames={docs.map(d => d.name)}
          busy={submitting}
          onComplete={handleSubmit}
          onSeedCaptured={setIdeaInput}
          attachSlot={<DocAttach
            docs={docs}
            parsing={parsing}
            dragOver={dragOver}
            setDragOver={setDragOver}
            fileInputRef={fileInputRef}
            handleFiles={handleFiles}
            removeDoc={(i: number) => setDocs(prev => prev.filter((_, idx) => idx !== i))}
          />}
        />
      </div>

      <motion.p
        style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', textAlign: 'center', opacity: 0.5, minHeight: 20, maxWidth: 620 }}
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
        ) : null}
      </motion.p>
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
