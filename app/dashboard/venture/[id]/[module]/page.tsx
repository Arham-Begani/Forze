'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
  type FormEvent,
} from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { AgentStatusRow } from '@/components/ui/AgentStatusRow'
import { ResultCard } from '@/components/ui/ResultCard'

// ─── Module metadata (mirrors ModulePicker) ──────────────────────────────────

const MODULES = [
  { id: 'full-launch', label: 'Full Launch', accent: '#C4975A', description: 'Run all agents together — research, brand, landing, feasibility', agentName: 'Orchestrator' },
  { id: 'research', label: 'Research', accent: '#5A8C6E', description: 'Market data, TAM/SAM/SOM, competitors, 10 ranked concepts', agentName: 'Genesis' },
  { id: 'branding', label: 'Branding', accent: '#5A6E8C', description: 'Brand name, voice, colors, typography, full Brand Bible', agentName: 'Identity' },
  { id: 'marketing', label: 'Marketing', accent: '#8C5A7A', description: '30-day GTM, 90 social posts, SEO outlines, email sequence', agentName: 'Content Factory' },
  { id: 'landing', label: 'Landing Page', accent: '#8C7A5A', description: 'Sitemap, copy, Next.js component, live deployment', agentName: 'Pipeline' },
  { id: 'feasibility', label: 'Feasibility', accent: '#7A5A8C', description: 'Financial model, risk matrix, GO/NO-GO verdict', agentName: 'Feasibility' },
] as const

type ModuleId = typeof MODULES[number]['id']

function getModule(id: string) {
  return MODULES.find(m => m.id === id) ?? MODULES[0]
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

const SUGGESTIONS: Record<string, [string, string]> = {
  'full-launch': ['Launch an async client portal for freelance developers', 'Build a B2B expense tracking tool for remote teams'],
  'research': ['Validate an AI writing assistant for solo lawyers', 'Research the market for async video feedback tools'],
  'branding': ['Create a brand for a B2B invoice automation startup', 'Build the identity for a wellness app for remote workers'],
  'marketing': ['Build a 30-day GTM for a Notion template marketplace', 'Create a social strategy for a SaaS HR onboarding tool'],
  'landing': ['Build a landing page for a code review automation tool', 'Deploy a page for an AI meeting notes product'],
  'feasibility': ['Validate financial model for a subscription recipe app', 'Assess feasibility of a niche job board for designers'],
}

// ─── Full Launch agent rows ───────────────────────────────────────────────────

const FULL_LAUNCH_AGENTS = [
  { key: 'research', label: 'Market Research', detail: 'Competitor analysis & TAM calc' },
  { key: 'branding', label: 'Brand Identity', detail: 'Generating logos & color palettes' },
  { key: 'marketing', label: 'Marketing Strategy', detail: '30-day GTM & Content Plan' },
  { key: 'landing', label: 'Landing Page', detail: 'Wireframing & Copywriting' },
  { key: 'feasibility', label: 'Feasibility Check', detail: 'Legal & Technical risk assessment' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentStatus = 'pending' | 'running' | 'complete' | 'failed'

interface AgentState {
  status: AgentStatus
  detail: string
  durationMs?: number
}

interface ConversationEntry {
  conversationId: string
  prompt: string
  lines: string[]
  agentStatuses: Record<string, AgentState>
  result: Record<string, unknown> | null
  isRunning: boolean
  isError: boolean
}

// ─── Module icon SVG ──────────────────────────────────────────────────────────

function ModuleIconSvg({ id, size = 20 }: { id: string; size?: number }) {
  const s = size
  switch (id) {
    case 'full-launch': return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    )
    case 'research': return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
    )
    case 'branding': return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
      </svg>
    )
    case 'marketing': return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l19-9-9 19-2-8-8-2z" />
      </svg>
    )
    case 'landing': return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
      </svg>
    )
    case 'feasibility': return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )
    default: return null
  }
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ accent }: { accent: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 4 }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: accent,
          }}
          animate={{
            y: [0, -4, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  )
}

// ─── Stream output panel ──────────────────────────────────────────────────────

function StreamPanel({ lines, accent }: { lines: string[]; accent: string }) {
  return (
    <motion.div
      style={{
        marginTop: 4,
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'var(--sidebar)',
      }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--glass-bg)',
      }}>
        <div style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 6px ${accent}60`,
        }} />
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--muted)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          Stream Output
        </span>
        <span style={{
          fontSize: 10,
          color: 'var(--muted)',
          marginLeft: 'auto',
          fontFamily: "'JetBrains Mono', monospace",
          opacity: 0.6,
        }}>
          {lines.length} line{lines.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lines */}
      <div style={{
        padding: '12px 0',
        maxHeight: 400,
        overflowY: 'auto',
        fontSize: 13,
        fontFamily: "'JetBrains Mono', monospace",
        lineHeight: 1.7,
      }}>
        {lines.map((line, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              padding: '1px 14px 1px 0',
              transition: 'background 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{
              width: 44,
              textAlign: 'right',
              paddingRight: 14,
              color: 'var(--muted)',
              opacity: 0.4,
              fontSize: 11,
              userSelect: 'none',
              flexShrink: 0,
              lineHeight: 'inherit',
              fontFamily: 'inherit',
            }}>
              {idx + 1}
            </span>
            <span style={{
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              flex: 1,
            }}>
              {line}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ModulePage() {
  const params = useParams()
  const ventureId = params.id as string
  const moduleParam = params.module as string

  const [activeModule, setActiveModule] = useState<ModuleId>(moduleParam as ModuleId)
  const mod = getModule(activeModule)
  const suggestions = SUGGESTIONS[activeModule] ?? SUGGESTIONS['research']

  const [ventureName, setVentureName] = useState<string>('...')
  const [conversations, setConversations] = useState<ConversationEntry[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  const [prompt, setPrompt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)

  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [readingPanelOpen, setReadingPanelOpen] = useState(true)

  // ── Auto-resize textarea ──────────────────────────────────────────────
  const autoResizeTextarea = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const maxHeight = 4 * 22 // ~4 lines
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px'
    ta.style.overflowY = ta.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  useEffect(() => {
    autoResizeTextarea()
  }, [prompt, autoResizeTextarea])

  // ── Scroll-to-bottom detection ────────────────────────────────────────
  useEffect(() => {
    const el = chatAreaRef.current
    if (!el) return
    function onScroll() {
      if (!el) return
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      setShowScrollBtn(distFromBottom > 200)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  function scrollToBottom() {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // ── Load venture + conversation history on mount ────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/ventures/${ventureId}`)
        if (!res.ok) return
        const data = await res.json()
        setVentureName(data.name ?? 'Venture')

        const moduleConvos: ConversationEntry[] = (
          data.conversations?.[activeModule] ?? []
        ).map((c: {
          id: string
          prompt: string
          stream_output?: string[]
          result?: Record<string, unknown>
          status?: string
        }) => ({
          conversationId: c.id,
          prompt: c.prompt,
          lines: c.stream_output ?? [],
          agentStatuses: buildCompletedStatuses(mod.accent),
          result: c.result && Object.keys(c.result).length > 0 ? c.result : null,
          isRunning: false,
          isError: c.status === 'failed',
        }))
        setConversations(moduleConvos.reverse())
      } finally {
        setHistoryLoaded(true)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventureId, activeModule])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversations])

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    const text = prompt.trim()
    if (!text || isSubmitting) return

    setPrompt('')
    setIsSubmitting(true)

    const entryId = crypto.randomUUID()

    const newEntry: ConversationEntry = {
      conversationId: entryId,
      prompt: text,
      lines: [],
      agentStatuses: buildInitialStatuses(),
      result: null,
      isRunning: true,
      isError: false,
    }
    setConversations(prev => [...prev, newEntry])

    try {
      const runRes = await fetch(`/api/ventures/${ventureId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: activeModule, prompt: text }),
      })
      if (!runRes.ok) throw new Error('Failed to start run')
      const { conversationId: serverConversationId } = await runRes.json()

      function updateEntry(patch: Partial<ConversationEntry> | ((e: ConversationEntry) => Partial<ConversationEntry>)) {
        setConversations(prev => prev.map(c => {
          if (c.conversationId !== serverConversationId && c.conversationId !== entryId) return c
          const delta = typeof patch === 'function' ? patch(c) : patch
          return { ...c, ...delta }
        }))
      }

      setConversations(prev => prev.map(c =>
        c.conversationId === entryId ? { ...c, conversationId: serverConversationId } : c
      ))

      const es = new EventSource(`/api/ventures/${ventureId}/stream/${serverConversationId}`)

      es.addEventListener('message', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'line') {
            updateEntry(prev => ({ lines: [...prev.lines, data.content] }))
          } else if (data.type === 'agent-status') {
            const { agentId, status, detail, durationMs } = data
            updateEntry(prev => ({
              agentStatuses: {
                ...prev.agentStatuses,
                [agentId]: { status, detail: detail ?? prev.agentStatuses[agentId]?.detail ?? '', durationMs },
              },
            }))
          } else if (data.type === 'complete') {
            updateEntry({ isRunning: false, result: data.result, agentStatuses: buildCompletedStatuses(mod.accent) })
            es.close()
            setIsSubmitting(false)
          } else if (data.type === 'error') {
            updateEntry({ isRunning: false, isError: true })
            es.close()
            setIsSubmitting(false)
          }
        } catch (err) {
          console.error("Error parsing SSE message:", err)
        }
      })

      es.addEventListener('error', () => {
        updateEntry({ isRunning: false, isError: true })
        es.close()
        setIsSubmitting(false)
      })

    } catch {
      setConversations(prev => prev.map(c => {
        if (c.conversationId !== entryId) return c
        return { ...c, isRunning: false, isError: true }
      }))
      setIsSubmitting(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  function retryEntry(entry: ConversationEntry) {
    setPrompt(entry.prompt)
    setConversations(prev => prev.filter(c => c.conversationId !== entry.conversationId))
    textareaRef.current?.focus()
  }

  // Reset reading panel when module changes
  useEffect(() => { setReadingPanelOpen(true) }, [activeModule])

  const [pickerOpen, setPickerOpen] = useState(false)
  const hasMessages = conversations.length > 0 && historyLoaded

  const canSubmit = !!prompt.trim() && !isSubmitting

  // Compute latest result for reading panel
  const latestResult = [...conversations].reverse().find(c => c.result && Object.keys(c.result).length > 0)?.result as Record<string, any> | null
  const showReadingPanel = readingPanelOpen && latestResult !== null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', position: 'relative' }}>

      {/* Ambient background orb */}
      <div style={{
        position: 'fixed',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${mod.accent}18 0%, transparent 70%)`,
        filter: 'blur(80px)',
        top: -100,
        right: -80,
        pointerEvents: 'none',
        zIndex: 0,
        animation: 'blob-float 18s ease-in-out infinite',
      }} />

      {/* ── Header ── */}
      <motion.header
        style={headerStyle}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Accent top line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, background: `linear-gradient(90deg, ${mod.accent}40, ${mod.accent}80, ${mod.accent}40)` }} />

        <div className="flex items-center gap-3">
          <motion.div
            style={{ ...headerIconStyle, background: `${mod.accent}18`, color: mod.accent }}
            whileHover={{ scale: 1.05 }}
          >
            <ModuleIconSvg id={activeModule} size={18} />
          </motion.div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              {mod.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, letterSpacing: '0.01em' }}>
              {ventureName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.span
            style={agentBadgeStyle(mod.accent)}
            whileHover={{ scale: 1.04 }}
          >
            {mod.agentName}
          </motion.span>
        </div>
      </motion.header>

      {/* ── Content area (chat + reading panel) ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* ── Chat area ── */}
      <div
        ref={chatAreaRef}
        className="overflow-y-auto"
        style={{ flex: 1, position: 'relative', zIndex: 1, scrollBehavior: 'smooth' }}
      >
        <div style={chatInnerStyle}>

            {/* Empty state */}
            <AnimatePresence>
              {!hasMessages && historyLoaded && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={emptyStateStyle}
                >
                  {/* Gradient card behind icon */}
                  <div style={{ position: 'relative', marginBottom: 28 }}>
                    <div style={{
                      position: 'absolute', inset: -24,
                      borderRadius: 28,
                      background: `linear-gradient(135deg, ${mod.accent}15, ${mod.accent}08, transparent)`,
                      border: `1px solid ${mod.accent}12`,
                      filter: 'blur(0px)',
                    }} />
                    <div style={{
                      position: 'absolute', inset: -20,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${mod.accent}20 0%, transparent 70%)`,
                      filter: 'blur(16px)',
                      animation: 'glow-pulse 3s ease-in-out infinite',
                    }} />
                    <motion.div
                      style={{
                        width: 72, height: 72, borderRadius: 22,
                        background: `linear-gradient(135deg, ${mod.accent}20, ${mod.accent}08)`,
                        border: `1.5px solid ${mod.accent}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: mod.accent,
                        position: 'relative', zIndex: 1,
                        boxShadow: `0 12px 32px ${mod.accent}20, inset 0 1px 0 ${mod.accent}15`,
                      }}
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <ModuleIconSvg id={activeModule} size={32} />
                    </motion.div>
                  </div>

                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                    {mod.label}
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px', textAlign: 'center', maxWidth: 380, lineHeight: 1.7 }}>
                    {mod.description}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 32px', textAlign: 'center', opacity: 0.5 }}>
                    Powered by {mod.agentName} agent
                  </p>

                  {/* Suggestion chips */}
                  <motion.div
                    className="flex gap-2 flex-wrap justify-center"
                    style={{ maxWidth: 520 }}
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: { opacity: 0 },
                      show: { opacity: 1, transition: { staggerChildren: 0.12 } }
                    }}
                  >
                    {suggestions.map(s => (
                      <motion.button
                        key={s}
                        variants={{
                          hidden: { opacity: 0, y: 12, scale: 0.95 },
                          show: { opacity: 1, y: 0, scale: 1 }
                        }}
                        whileHover={{ scale: 1.04, y: -1, boxShadow: `0 4px 16px ${mod.accent}20` }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => { setPrompt(s); textareaRef.current?.focus() }}
                        style={chipStyle(mod.accent)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mod.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, flexShrink: 0 }}>
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        {s}
                      </motion.button>
                    ))}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Conversations */}
            <AnimatePresence initial={false}>
              {conversations.map((entry, i) => (
                <motion.div
                  key={entry.conversationId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: i === conversations.length - 1 ? 0.05 : 0 }}
                  style={{ marginBottom: 36 }}
                >
                  {/* User message */}
                  <div className="flex justify-end" style={{ marginBottom: 18 }}>
                    <motion.div
                      initial={{ opacity: 0, x: 16, scale: 0.97 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      style={userBubbleStyle}
                    >
                      <div style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--muted)',
                        marginBottom: 4,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        You
                      </div>
                      {entry.prompt}
                    </motion.div>
                  </div>

                  {/* Agent response */}
                  <div className="flex flex-col gap-4">
                    {/* Avatar + agent name */}
                    <motion.div
                      className="flex items-center gap-2"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.12 }}
                    >
                      <div style={{
                        ...avatarStyle,
                        background: `${mod.accent}18`,
                        color: mod.accent,
                        border: `1.5px solid ${mod.accent}30`,
                        boxShadow: `0 0 10px ${mod.accent}18`,
                      }}>
                        <ModuleIconSvg id={activeModule} size={14} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                        {mod.agentName}
                      </span>
                      {entry.isRunning && (
                        <TypingIndicator accent={mod.accent} />
                      )}
                    </motion.div>

                    {/* Full Launch: status rows + stream */}
                    {activeModule === 'full-launch' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {FULL_LAUNCH_AGENTS.map(agent => {
                          const s = entry.agentStatuses[agent.key] ?? { status: 'pending', detail: agent.detail }
                          const agentIdMap: Record<string, 'genesis' | 'identity' | 'pipeline' | 'feasibility'> = {
                            research: 'genesis',
                            branding: 'identity',
                            landing: 'pipeline',
                            feasibility: 'feasibility'
                          }
                          return (
                            <AgentStatusRow
                              key={agent.key}
                              agentId={agentIdMap[agent.key]}
                              status={s.status === 'pending' ? 'waiting' : s.status as 'waiting' | 'running' | 'complete' | 'failed'}
                            />
                          )
                        })}
                      </div>
                    )}

                    {/* Stream output */}
                    {entry.lines.length > 0 && (
                      <StreamPanel lines={entry.lines} accent={mod.accent} />
                    )}

                    {/* Result */}
                    {entry.result && !entry.isRunning && (
                      <motion.div
                        style={{ marginTop: 4 }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        <ResultCard
                          moduleId={activeModule}
                          result={entry.result}
                          deploymentUrl={entry.result.deploymentUrl as string}
                        />
                      </motion.div>
                    )}

                    {/* Error state */}
                    {entry.isError && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={errorBoxStyle}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: 'rgba(220, 38, 38, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e05252" strokeWidth="2.5" strokeLinecap="round">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                            </div>
                            <div>
                              <span style={{ fontSize: 13, color: '#e05252', fontWeight: 600, display: 'block' }}>
                                Agent run failed
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'block' }}>
                                The {mod.agentName} agent encountered an error while processing your request. This could be due to a timeout or service issue.
                              </span>
                            </div>
                          </div>
                        </div>
                        <motion.button
                          onClick={() => retryEntry(entry)}
                          style={retryBtnStyle}
                          whileHover={{ scale: 1.04, background: 'rgba(220, 38, 38, 0.08)' }}
                          whileTap={{ scale: 0.96 }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e05252" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                          </svg>
                          Try Again
                        </motion.button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <div ref={chatEndRef} />
        </div>
      </div>

      {/* ── Reading Panel (all modules) ── */}
      {showReadingPanel && (
        <ReadingPanel
          moduleId={activeModule}
          result={latestResult!}
          accent={mod.accent}
          onClose={() => setReadingPanelOpen(false)}
        />
      )}
      </div> {/* End content area flex */}

      {/* ── Scroll to bottom button ── */}
      <AnimatePresence>
        {showScrollBtn && hasMessages && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            onClick={scrollToBottom}
            style={{
              position: 'fixed',
              bottom: 120,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 15,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--glass-bg-strong)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text)',
              fontFamily: 'inherit',
            }}
            whileHover={{ scale: 1.1, boxShadow: `0 4px 20px ${mod.accent}30` }}
            whileTap={{ scale: 0.9 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Input area ── */}
      <motion.div
        style={inputAreaStyle}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div style={inputInnerStyle}>
          <form onSubmit={handleSubmit}>
            <motion.div
              style={{
                ...inputWrapStyle,
                borderColor: inputFocused ? mod.accent : 'var(--glass-border)',
                boxShadow: inputFocused
                  ? `var(--shadow-lg), 0 0 0 3px ${mod.accent}18`
                  : 'var(--shadow-md)',
              }}
              transition={{ duration: 0.2 }}
            >
              {/* Module picker pill */}
              <div style={{ position: 'relative' }}>
                <motion.button
                  type="button"
                  onClick={() => setPickerOpen(p => !p)}
                  style={modulePickerPillStyle(mod.accent)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span style={{ color: mod.accent, display: 'flex', alignItems: 'center' }}>
                    <ModuleIconSvg id={activeModule} size={13} />
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: mod.accent }}>{mod.label}</span>
                  <motion.svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={mod.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    animate={{ rotate: pickerOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </motion.svg>
                </motion.button>

                {/* Dropdown */}
                <AnimatePresence>
                  {pickerOpen && (
                    <motion.div
                      style={pickerDropdownStyle}
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                      {MODULES.map(m => (
                        <motion.button
                          key={m.id}
                          type="button"
                          onClick={() => { setActiveModule(m.id as ModuleId); setPickerOpen(false) }}
                          style={{
                            ...pickerOptionStyle,
                            background: m.id === activeModule ? `${m.accent}12` : 'transparent',
                          }}
                          whileHover={{ backgroundColor: `${m.accent}10`, x: 2 }}
                        >
                          <span style={{ color: m.accent, display: 'flex', alignItems: 'center' }}>
                            <ModuleIconSvg id={m.id} size={13} />
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: m.id === activeModule ? 600 : 400 }}>{m.label}</span>
                          {m.id === activeModule && (
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: m.accent, marginLeft: 'auto' }} />
                          )}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={`Ask ${mod.label} anything about your venture...`}
                rows={1}
                style={textareaStyle}
              />

              {/* Send button + hint row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span style={kbdStyle}>
                    {typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent) ? '\u2318' : 'Ctrl'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', opacity: 0.5 }}>+</span>
                  <span style={kbdStyle}>Enter</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', opacity: 0.4, marginLeft: 4 }}>to run</span>
                </div>
                <motion.button
                  type="submit"
                  whileHover={canSubmit ? { scale: 1.08 } : {}}
                  whileTap={canSubmit ? { scale: 0.92 } : {}}
                  disabled={!canSubmit}
                  style={{
                    ...sendBtnStyle,
                    background: canSubmit
                      ? `linear-gradient(135deg, ${mod.accent}, ${mod.accent}cc)`
                      : 'var(--border)',
                    boxShadow: canSubmit ? `0 4px 12px ${mod.accent}40` : 'none',
                  }}
                >
                  {isSubmitting ? (
                    <motion.div
                      style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                    />
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                    </svg>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </form>
        </div>
      </motion.div>

      {/* Click-away for picker */}
      {pickerOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9 }}
          onClick={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildInitialStatuses(): Record<string, AgentState> {
  return Object.fromEntries(
    FULL_LAUNCH_AGENTS.map(a => [a.key, { status: 'pending' as AgentStatus, detail: a.detail }])
  )
}

function buildCompletedStatuses(_accent: string): Record<string, AgentState> {
  return Object.fromEntries(
    FULL_LAUNCH_AGENTS.map(a => [a.key, { status: 'complete' as AgentStatus, detail: a.detail }])
  )
}

// ─── Reading Panel (Universal Document Viewer) ──────────────────────────────

const PANEL_TITLES: Record<string, string> = {
  'full-launch': 'Venture Dossier',
  research: 'Research Report',
  branding: 'Brand Bible',
  marketing: 'GTM Strategy',
  landing: 'Production Pipeline',
  feasibility: 'Feasibility Report',
}

function ReadingPanel({ moduleId, result, accent, onClose }: {
  moduleId: string
  result: Record<string, any>
  accent: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const title = PANEL_TITLES[moduleId] || 'Report'

  function getPlainText(): string {
    return contentRef.current?.innerText || JSON.stringify(result, null, 2)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getPlainText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback */ }
  }

  function handleExportPDF() {
    const content = contentRef.current?.innerHTML || ''
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>${title}</title><style>
      body{font-family:'DM Sans',system-ui,sans-serif;padding:48px;max-width:800px;margin:0 auto;color:#1a1a1a;line-height:1.6}
      h1{font-size:26px;border-bottom:2px solid #e5e5e5;padding-bottom:12px;margin-bottom:20px}
      h2{font-size:18px;margin-top:28px;margin-bottom:10px;color:#333}
      h3{font-size:15px;margin-top:20px;margin-bottom:8px;color:#444}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th,td{padding:10px 14px;border:1px solid #ddd;text-align:left;font-size:13px}
      th{background:#f5f5f5;font-weight:600}
      p,li{font-size:14px;margin-bottom:8px}
      ul{padding-left:20px}
      .badge{display:inline-block;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:700}
    </style></head><body>${content}</body></html>`)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  async function handleShare() {
    const text = getPlainText()
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title, text }) } catch {}
    } else {
      await handleCopy()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        width: 380,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sidebar)',
        borderLeft: '1px solid var(--border)',
        height: '100%',
      }}
    >
      {/* Top Bar */}
      <div style={{
        padding: '0 14px',
        height: 44,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, opacity: 0.5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-soft)', opacity: 0.8 }}>{title} · MD</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={handleCopy} style={panelActionBtnStyle}>{copied ? 'Copied!' : 'Copy'}</button>
          <button onClick={handleExportPDF} style={panelActionBtnStyle}>PDF</button>
          <button onClick={handleShare} style={panelActionBtnStyle}>Share</button>
          <button onClick={onClose} style={{ ...panelActionBtnStyle, padding: '4px 6px', display: 'flex', alignItems: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>

      {/* Document Content */}
      <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {moduleId === 'full-launch' && <FullLaunchDoc result={result} accent={accent} />}
        {moduleId === 'research' && <ResearchDoc result={result} />}
        {moduleId === 'branding' && <BrandingDoc result={result} />}
        {moduleId === 'marketing' && <MarketingDoc result={result} />}
        {moduleId === 'landing' && <LandingDoc result={result} />}
        {moduleId === 'feasibility' && <FeasibilityDoc result={result} />}
      </div>
    </motion.div>
  )
}

// ─── Document Sub-Components ─────────────────────────────────────────────────

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>{title}</h2>
      {children}
    </div>
  )
}

function DocKV({ label, value }: { label: string; value: any }) {
  if (!value) return null
  const str = typeof value === 'object' ? (value.value || value.name || JSON.stringify(value)) : String(value)
  return (
    <div style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
      <span style={{ width: 100, flexShrink: 0, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em', paddingTop: 2 }}>{label}</span>
      <span style={{ color: 'var(--text-soft)', lineHeight: 1.5 }}>{str}</span>
    </div>
  )
}

function DocList({ items }: { items: any[] }) {
  if (!items || items.length === 0) return null
  return (
    <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>
          {typeof item === 'object' ? (item.name || item.description || item.title || JSON.stringify(item)) : String(item)}
        </li>
      ))}
    </ul>
  )
}

function ResearchDoc({ result }: { result: Record<string, any> }) {
  const r = result.research || result
  const tam = r.tam?.value || (typeof r.tam === 'string' ? r.tam : r.tam ? JSON.stringify(r.tam) : '')
  const sam = r.sam?.value || (typeof r.sam === 'string' ? r.sam : '')
  const som = r.som?.value || (typeof r.som === 'string' ? r.som : '')
  const competitors = Array.isArray(r.competitors) ? r.competitors : []
  const painPoints = Array.isArray(r.painPoints) ? r.painPoints : []
  const concepts = Array.isArray(r.concepts || r.rankedConcepts) ? (r.concepts || r.rankedConcepts) : []

  return (
    <>
      <h1 style={docTitleStyle}>Market Research Report</h1>

      {r.marketSummary && (
        <DocSection title="Executive Summary">
          <p style={docParaStyle}>{r.marketSummary}</p>
        </DocSection>
      )}

      <DocSection title="Market Sizing">
        <DocKV label="TAM" value={tam} />
        <DocKV label="SAM" value={sam} />
        <DocKV label="SOM" value={som} />
      </DocSection>

      {competitors.length > 0 && (
        <DocSection title="Competitive Landscape">
          {competitors.map((c: any, i: number) => {
            const name = typeof c === 'object' ? (c.name || JSON.stringify(c)) : String(c)
            const desc = typeof c === 'object' ? (c.description || c.threat || c.weakness || '') : ''
            return (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < competitors.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</div>
                {desc && <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2 }}>{desc}</div>}
              </div>
            )
          })}
        </DocSection>
      )}

      {painPoints.length > 0 && (
        <DocSection title="Market Pain Points">
          <DocList items={painPoints} />
        </DocSection>
      )}

      {concepts.length > 0 && (
        <DocSection title="Ranked Concepts">
          {concepts.map((c: any, i: number) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                #{i + 1} {typeof c === 'object' ? (c.name || c.title || JSON.stringify(c)) : String(c)}
              </div>
              {typeof c === 'object' && c.description && (
                <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2 }}>{c.description}</div>
              )}
            </div>
          ))}
        </DocSection>
      )}

      {r.recommendedConcept && (
        <DocSection title="Recommended Concept">
          <p style={docParaStyle}>{typeof r.recommendedConcept === 'object' ? JSON.stringify(r.recommendedConcept) : r.recommendedConcept}</p>
        </DocSection>
      )}
    </>
  )
}

function BrandingDoc({ result }: { result: Record<string, any> }) {
  const b = result.branding || result
  const colors = Array.isArray(b.colorPalette) ? b.colorPalette : (typeof b.colorPalette === 'object' && b.colorPalette ? Object.entries(b.colorPalette) : [])

  return (
    <>
      <h1 style={docTitleStyle}>Brand Identity Bible</h1>

      <DocSection title="Brand Foundation">
        <DocKV label="Name" value={b.brandName} />
        <DocKV label="Tagline" value={b.tagline} />
        <DocKV label="Archetype" value={b.brandArchetype} />
        <DocKV label="Personality" value={b.brandPersonality} />
      </DocSection>

      {b.brandVoice && (
        <DocSection title="Brand Voice">
          <p style={docParaStyle}>{typeof b.brandVoice === 'string' ? b.brandVoice : JSON.stringify(b.brandVoice)}</p>
        </DocSection>
      )}

      {colors.length > 0 && (
        <DocSection title="Color Palette">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {colors.map((c: any, i: number) => {
              const hex = typeof c === 'string' ? c : (Array.isArray(c) ? String(c[1]) : (c.hex || c.code || '#666'))
              const name = Array.isArray(c) ? c[0] : (typeof c === 'object' ? (c.name || '') : '')
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: String(hex), border: '1px solid var(--border)', boxShadow: `0 2px 6px ${hex}30` }} />
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--muted)' }}>{String(hex)}</span>
                  {name && <span style={{ fontSize: 9, color: 'var(--muted)' }}>{name}</span>}
                </div>
              )
            })}
          </div>
        </DocSection>
      )}

      {b.typography && (
        <DocSection title="Typography">
          <DocKV label="Heading" value={b.typography.heading || b.typography.headingFont} />
          <DocKV label="Body" value={b.typography.body || b.typography.bodyFont} />
        </DocSection>
      )}

      {b.messaging && (
        <DocSection title="Key Messaging">
          <p style={docParaStyle}>{typeof b.messaging === 'string' ? b.messaging : JSON.stringify(b.messaging)}</p>
        </DocSection>
      )}
    </>
  )
}

function MarketingDoc({ result }: { result: Record<string, any> }) {
  const m = result.marketing || result
  const gtm = m.gtmStrategy || m
  const socialPosts = Array.isArray(m.socialCalendar) ? m.socialCalendar : []
  const seoOutlines = Array.isArray(m.seoOutlines) ? m.seoOutlines : []
  const emailSequence = Array.isArray(m.emailSequence) ? m.emailSequence : []
  const channels = Array.isArray(gtm.channels || m.channels) ? (gtm.channels || m.channels) : []
  const phases = Array.isArray(gtm.phases || m.phases) ? (gtm.phases || m.phases) : []

  return (
    <>
      <h1 style={docTitleStyle}>Go-To-Market Strategy</h1>

      {(gtm.overview || m.theme) && (
        <DocSection title="Strategy Overview">
          <p style={docParaStyle}>{gtm.overview || m.theme}</p>
        </DocSection>
      )}

      {phases.length > 0 && (
        <DocSection title="Growth Phases">
          {phases.map((p: any, i: number) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                Phase {i + 1}: {typeof p === 'object' ? (p.name || p.title || '') : String(p)}
              </div>
              {typeof p === 'object' && (p.description || p.activities) && (
                <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 4, lineHeight: 1.5 }}>
                  {p.description || (Array.isArray(p.activities) ? p.activities.join(', ') : String(p.activities || ''))}
                </div>
              )}
            </div>
          ))}
        </DocSection>
      )}

      {channels.length > 0 && (
        <DocSection title="Marketing Channels">
          <DocList items={channels} />
        </DocSection>
      )}

      {socialPosts.length > 0 && (
        <DocSection title={`Social Calendar (${socialPosts.length} posts)`}>
          {socialPosts.slice(0, 10).map((post: any, i: number) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                {typeof post === 'object' ? (post.platform || post.channel || `Post ${i + 1}`) : `Post ${i + 1}`}
                {typeof post === 'object' && post.day && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> - Day {post.day}</span>}
              </div>
              <div style={{ color: 'var(--text-soft)', lineHeight: 1.4 }}>
                {typeof post === 'object' ? (post.content || post.caption || post.text || JSON.stringify(post)) : String(post)}
              </div>
            </div>
          ))}
          {socialPosts.length > 10 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 0', fontStyle: 'italic' }}>
              + {socialPosts.length - 10} more posts...
            </div>
          )}
        </DocSection>
      )}

      {seoOutlines.length > 0 && (
        <DocSection title="SEO Content Outlines">
          {seoOutlines.map((outline: any, i: number) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {typeof outline === 'object' ? (outline.title || outline.topic || JSON.stringify(outline)) : String(outline)}
              </div>
              {typeof outline === 'object' && outline.keywords && (
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                  Keywords: {Array.isArray(outline.keywords) ? outline.keywords.join(', ') : outline.keywords}
                </div>
              )}
            </div>
          ))}
        </DocSection>
      )}

      {emailSequence.length > 0 && (
        <DocSection title="Email Sequence">
          {emailSequence.map((email: any, i: number) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {typeof email === 'object' ? (email.subject || email.title || `Email ${i + 1}`) : String(email)}
              </div>
              {typeof email === 'object' && email.body && (
                <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2, lineHeight: 1.4 }}>
                  {email.body.length > 200 ? email.body.slice(0, 200) + '...' : email.body}
                </div>
              )}
            </div>
          ))}
        </DocSection>
      )}

      <DocSection title="Performance Metrics">
        <DocKV label="Total Posts" value={m.totalPostsCount || socialPosts.length || undefined} />
        <DocKV label="SEO Articles" value={seoOutlines.length || undefined} />
        <DocKV label="Email Drips" value={emailSequence.length || undefined} />
        <DocKV label="Target CAC" value={m.targetCac || gtm.targetCac} />
      </DocSection>
    </>
  )
}

function LandingDoc({ result }: { result: Record<string, any> }) {
  const l = result.landing || result
  const copy = l.landingPageCopy || l.copy || {}
  const heroHeadline = copy.hero?.headline || l.heroHeadline || l.headline
  const heroSubheadline = copy.hero?.subheadline || l.heroSubheadline
  const cta = copy.cta || l.cta
  const sections = Array.isArray(copy.sections || l.sections) ? (copy.sections || l.sections) : []
  const deployUrl = l.deploymentUrl || result.deploymentUrl

  return (
    <>
      <h1 style={docTitleStyle}>Production Pipeline</h1>

      <DocSection title="Hero Section">
        <DocKV label="Headline" value={heroHeadline} />
        <DocKV label="Subheadline" value={heroSubheadline} />
        <DocKV label="CTA" value={typeof cta === 'object' ? (cta.text || cta.label || JSON.stringify(cta)) : cta} />
      </DocSection>

      {sections.length > 0 && (
        <DocSection title="Page Sections">
          {sections.map((s: any, i: number) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {typeof s === 'object' ? (s.title || s.name || `Section ${i + 1}`) : String(s)}
              </div>
              {typeof s === 'object' && s.content && (
                <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2, lineHeight: 1.4 }}>{s.content}</div>
              )}
            </div>
          ))}
        </DocSection>
      )}

      {deployUrl && (
        <DocSection title="Deployment">
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '12px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#8C7A5A', textTransform: 'uppercase', marginBottom: 4 }}>Live URL</div>
            <a href={deployUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, textDecoration: 'none', wordBreak: 'break-all' }}>
              {deployUrl}
            </a>
          </div>
        </DocSection>
      )}

      <DocSection title="Status">
        <DocKV label="Pipeline" value={deployUrl ? 'Deployed' : 'Generating...'} />
        <DocKV label="Framework" value={l.framework || 'Next.js'} />
        <DocKV label="Conversion" value="Lead capture hooks active" />
      </DocSection>
    </>
  )
}

function FeasibilityDoc({ result }: { result: Record<string, any> }) {
  const f = result.feasibility || result
  const fm = f.financialModel || {}
  const risks = Array.isArray(f.riskMatrix || f.risks) ? (f.riskMatrix || f.risks) : []
  const strengths = Array.isArray(f.strengths) ? f.strengths : []
  const weaknesses = Array.isArray(f.weaknesses) ? f.weaknesses : []

  return (
    <>
      <h1 style={docTitleStyle}>Feasibility Assessment</h1>

      <DocSection title="Verdict">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            padding: '6px 14px',
            borderRadius: 8,
            color: f.verdict?.toLowerCase()?.includes('no') ? '#dc2626' : f.verdict?.toLowerCase()?.includes('conditional') ? '#d97706' : '#16a34a',
            background: f.verdict?.toLowerCase()?.includes('no') ? '#dc262612' : f.verdict?.toLowerCase()?.includes('conditional') ? '#d9770612' : '#16a34a12',
            border: `1px solid ${f.verdict?.toLowerCase()?.includes('no') ? '#dc262624' : f.verdict?.toLowerCase()?.includes('conditional') ? '#d9770624' : '#16a34a24'}`,
            textTransform: 'uppercase',
          }}>
            {f.verdict || 'Pending'}
          </span>
        </div>
        {f.rationale && <p style={docParaStyle}>{f.rationale}</p>}
      </DocSection>

      <DocSection title="Financial Model">
        <DocKV label="CAC" value={fm.cac} />
        <DocKV label="LTV" value={fm.ltv} />
        <DocKV label="Margin" value={fm.margin || fm.grossMargin} />
        <DocKV label="Breakeven" value={fm.breakeven || fm.breakevenMonths} />
        <DocKV label="Payback" value={fm.paybackPeriod} />
        <DocKV label="Revenue Y1" value={fm.revenueYear1 || fm.yearOneRevenue} />
      </DocSection>

      {risks.length > 0 && (
        <DocSection title="Risk Matrix">
          {risks.map((risk: any, i: number) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {typeof risk === 'object' ? (risk.risk || risk.name || risk.category || JSON.stringify(risk)) : String(risk)}
              </div>
              {typeof risk === 'object' && (
                <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2, display: 'flex', gap: 12 }}>
                  {risk.likelihood && <span>Likelihood: {risk.likelihood}</span>}
                  {risk.impact && <span>Impact: {risk.impact}</span>}
                  {risk.mitigation && <div style={{ marginTop: 2 }}>Mitigation: {risk.mitigation}</div>}
                </div>
              )}
            </div>
          ))}
        </DocSection>
      )}

      {strengths.length > 0 && (
        <DocSection title="Strengths">
          <DocList items={strengths} />
        </DocSection>
      )}

      {weaknesses.length > 0 && (
        <DocSection title="Weaknesses">
          <DocList items={weaknesses} />
        </DocSection>
      )}
    </>
  )
}

function FullLaunchDoc({ result, accent }: { result: Record<string, any>; accent: string }) {
  const research = result.research || {}
  const branding = result.branding || {}
  const marketing = result.marketing || {}
  const landing = result.landing || {}
  const feasibility = result.feasibility || {}
  const fm = feasibility.financialModel || {}
  const gtm = marketing.gtmStrategy || marketing
  const socialPosts = Array.isArray(marketing.socialCalendar) ? marketing.socialCalendar : []
  const seoOutlines = Array.isArray(marketing.seoOutlines) ? marketing.seoOutlines : []
  const competitors = Array.isArray(research.competitors) ? research.competitors : []
  const risks = Array.isArray(feasibility.riskMatrix || feasibility.risks) ? (feasibility.riskMatrix || feasibility.risks) : []
  const phases = Array.isArray(gtm.phases || marketing.phases) ? (gtm.phases || marketing.phases) : []
  const channels = Array.isArray(gtm.channels || marketing.channels) ? (gtm.channels || marketing.channels) : []
  const tam = research.tam?.value || (typeof research.tam === 'string' ? research.tam : research.tam ? JSON.stringify(research.tam) : '')
  const colors = Array.isArray(branding.colorPalette)
    ? branding.colorPalette
    : (typeof branding.colorPalette === 'object' && branding.colorPalette ? Object.entries(branding.colorPalette) : [])

  return (
    <>
      <h1 style={docTitleStyle}>{branding.brandName || 'Venture Dossier'}</h1>
      {branding.tagline && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '-8px 0 16px', fontStyle: 'italic' }}>{branding.tagline}</p>}

      {/* ── Market Intelligence ── */}
      <DocSection title="Market Intelligence">
        <DocKV label="TAM" value={tam} />
        <DocKV label="Summary" value={research.marketSummary} />
        {competitors.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>Competitors</div>
            {competitors.slice(0, 5).map((c: any, i: number) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--text-soft)', padding: '4px 0' }}>
                {typeof c === 'object' ? (c.name || JSON.stringify(c)) : String(c)}
              </div>
            ))}
          </div>
        )}
      </DocSection>

      {/* ── Brand Identity ── */}
      <DocSection title="Brand Identity">
        <DocKV label="Name" value={branding.brandName} />
        <DocKV label="Archetype" value={branding.brandArchetype} />
        <DocKV label="Voice" value={typeof branding.brandVoice === 'string' ? branding.brandVoice : branding.brandVoice ? JSON.stringify(branding.brandVoice) : undefined} />
        {colors.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {colors.map((c: any, i: number) => {
              const hex = typeof c === 'string' ? c : (Array.isArray(c) ? String(c[1]) : (c.hex || c.code || '#666'))
              return <div key={i} style={{ width: 28, height: 28, borderRadius: 6, background: String(hex), border: '1px solid var(--border)' }} title={String(hex)} />
            })}
          </div>
        )}
      </DocSection>

      {/* ── GTM Strategy (expanded) ── */}
      <DocSection title="Go-To-Market Strategy">
        {(gtm.overview || marketing.theme) && (
          <p style={{ ...docParaStyle, marginBottom: 12 }}>{gtm.overview || marketing.theme}</p>
        )}

        {phases.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>Growth Phases</div>
            {phases.map((p: any, i: number) => (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>Phase {i + 1}: </span>
                <span style={{ color: 'var(--text-soft)' }}>{typeof p === 'object' ? (p.name || p.title || p.description || JSON.stringify(p)) : String(p)}</span>
              </div>
            ))}
          </div>
        )}

        {channels.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>Channels</div>
            <DocList items={channels} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{socialPosts.length || '0'}</div>
            <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', marginTop: 2 }}>Social Posts</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{seoOutlines.length || '0'}</div>
            <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', marginTop: 2 }}>SEO Articles</div>
          </div>
        </div>

        {socialPosts.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>Sample Posts</div>
            {socialPosts.slice(0, 3).map((post: any, i: number) => (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.4 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {typeof post === 'object' ? (post.platform || `Day ${post.day || i + 1}`) : `Post ${i + 1}`}:
                </span>{' '}
                {typeof post === 'object' ? (post.content || post.caption || post.text || '') : String(post)}
              </div>
            ))}
          </div>
        )}
      </DocSection>

      {/* ── Feasibility ── */}
      <DocSection title="Investment Assessment">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Verdict:</span>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 6,
            color: feasibility.verdict?.toLowerCase()?.includes('no') ? '#dc2626' : feasibility.verdict?.toLowerCase()?.includes('conditional') ? '#d97706' : '#16a34a',
            background: feasibility.verdict?.toLowerCase()?.includes('no') ? '#dc262612' : feasibility.verdict?.toLowerCase()?.includes('conditional') ? '#d9770612' : '#16a34a12',
            textTransform: 'uppercase',
          }}>
            {feasibility.verdict || 'Pending'}
          </span>
        </div>
        {feasibility.rationale && <p style={{ ...docParaStyle, marginBottom: 8 }}>{feasibility.rationale}</p>}
        <DocKV label="CAC" value={fm.cac} />
        <DocKV label="LTV" value={fm.ltv} />
        <DocKV label="Margin" value={fm.margin || fm.grossMargin} />
        {risks.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>Key Risks</div>
            {risks.slice(0, 3).map((r: any, i: number) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--text-soft)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                {typeof r === 'object' ? (r.risk || r.name || JSON.stringify(r)) : String(r)}
              </div>
            ))}
          </div>
        )}
      </DocSection>

      {/* ── Production ── */}
      {landing.deploymentUrl && (
        <DocSection title="Production">
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '12px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#8C7A5A', textTransform: 'uppercase', marginBottom: 4 }}>Live URL</div>
            <a href={landing.deploymentUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, textDecoration: 'none', wordBreak: 'break-all' }}>
              {landing.deploymentUrl}
            </a>
          </div>
        </DocSection>
      )}
    </>
  )
}

const docTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: 'var(--text)',
  marginBottom: 4,
  letterSpacing: '-0.01em',
}

const docParaStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-soft)',
  lineHeight: 1.6,
  margin: 0,
}

const panelActionBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--glass-border)',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--text-soft)',
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  height: 54,
  padding: '0 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid var(--border)',
  background: 'var(--glass-bg-strong)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  flexShrink: 0,
  position: 'relative',
  zIndex: 10,
}

const headerIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

function agentBadgeStyle(accent: string): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    color: accent,
    background: `${accent}12`,
    border: `1px solid ${accent}28`,
    borderRadius: 20,
    padding: '4px 12px',
    letterSpacing: '0.02em',
    boxShadow: `0 2px 8px ${accent}18`,
  }
}

const chatInnerStyle: React.CSSProperties = {
  maxWidth: 780,
  margin: '0 auto',
  padding: '32px 24px 32px',
  width: '100%',
}

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 'calc(100vh - 240px)',
  padding: '0 24px',
}

function chipStyle(accent: string): React.CSSProperties {
  return {
    fontSize: 12,
    color: accent,
    background: `${accent}0d`,
    border: `1px solid ${accent}22`,
    borderRadius: 20,
    padding: '8px 16px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 150ms, box-shadow 150ms',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textAlign: 'left',
    lineHeight: 1.4,
  }
}

const userBubbleStyle: React.CSSProperties = {
  maxWidth: '78%',
  fontSize: 14,
  color: 'var(--text)',
  background: 'var(--glass-bg-strong)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid var(--glass-border)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  borderRadius: '20px 20px 4px 20px',
  padding: '12px 18px',
  lineHeight: 1.6,
  letterSpacing: '0.01em',
}

const avatarStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const errorBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '14px 18px',
  background: 'rgba(220, 38, 38, 0.05)',
  border: '1px solid rgba(220, 38, 38, 0.15)',
  borderRadius: 14,
}

const retryBtnStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#e05252',
  background: 'transparent',
  border: '1px solid rgba(220, 38, 38, 0.25)',
  borderRadius: 10,
  padding: '7px 14px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'background 150ms',
}

const inputAreaStyle: React.CSSProperties = {
  background: 'var(--glass-bg-strong)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  borderTop: '1px solid var(--border)',
  padding: '14px 24px 22px',
  flexShrink: 0,
  zIndex: 10,
  position: 'relative',
}

const inputInnerStyle: React.CSSProperties = {
  maxWidth: 780,
  margin: '0 auto',
}

const inputWrapStyle: React.CSSProperties = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid var(--glass-border)',
  borderRadius: 18,
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  position: 'relative',
  transition: 'border-color 250ms ease, box-shadow 250ms ease',
}

function modulePickerPillStyle(accent: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 10px',
    borderRadius: 20,
    border: `1px solid ${accent}28`,
    background: `${accent}0d`,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 150ms',
  }
}

const pickerDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: 0,
  background: 'var(--glass-bg-strong)',
  backdropFilter: 'blur(32px)',
  WebkitBackdropFilter: 'blur(32px)',
  border: '1px solid var(--glass-border)',
  borderRadius: 14,
  padding: 6,
  zIndex: 20,
  minWidth: 190,
  boxShadow: 'var(--shadow-xl)',
}

const pickerOptionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
  transition: 'background 100ms',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontSize: 14,
  color: 'var(--text)',
  fontFamily: 'inherit',
  resize: 'none',
  lineHeight: 1.55,
  padding: 0,
  overflow: 'hidden',
}

const sendBtnStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'background 200ms, box-shadow 200ms',
}

const kbdStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--muted)',
  background: 'var(--glass-bg)',
  border: '1px solid var(--border)',
  borderRadius: 5,
  padding: '2px 6px',
  fontFamily: "'JetBrains Mono', monospace",
  lineHeight: 1.4,
}
