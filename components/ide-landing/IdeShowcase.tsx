'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

type Showcase = {
  id: string
  eyebrow: string
  icon: string
  accent: string
  title: string
  description: string
  bullets: { label: string; detail: string }[]
  callout?: string
  visualLabel: string
  reverse?: boolean
  render: (visible: boolean) => ReactNode
}

// ─── Visuals ────────────────────────────────────────────────────────────────

function EditorVisual({ visible }: { visible: boolean }) {
  const lines = [
    { n: 1, g: '', tokens: [{ t: 'import ', c: '#8C5A7A' }, { t: 'stripe ', c: 'var(--text)' }, { t: 'from ', c: '#8C5A7A' }, { t: "'./lib'", c: '#8C7A5A' }] },
    { n: 2, g: '', tokens: [{ t: '', c: 'var(--text)' }] },
    { n: 3, g: '', tokens: [{ t: 'export function ', c: '#8C5A7A' }, { t: 'Checkout', c: '#5A8CA5' }, { t: '() {', c: 'var(--muted)' }] },
    { n: 4, g: 'M', tokens: [{ t: '  const ', c: '#8C5A7A' }, { t: 'url', c: 'var(--text)' }, { t: ' = stripe.', c: 'var(--text-soft)' }, { t: 'session', c: '#5A8CA5' }, { t: '()', c: 'var(--muted)' }] },
    { n: 5, g: '+', tokens: [{ t: '  return ', c: '#8C5A7A' }, { t: '<Pay ', c: '#5A8C6E' }, { t: 'href', c: '#B8864E' }, { t: '={url} />', c: '#8C7A5A' }] },
    { n: 6, g: '', tokens: [{ t: '}', c: 'var(--muted)' }] },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        overflow: 'hidden',
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: '12px',
      }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'center', background: 'hsla(0,0%,0%,0.02)' }}>
          <span style={{ color: '#8C7A5A', fontSize: '11px' }}>Checkout.tsx</span>
          <span style={{ color: 'var(--muted)', fontSize: '11px' }}>· git: 2 changed</span>
          <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: '11px' }}>⇧⌥F</span>
        </div>
        <div style={{ padding: '12px 8px' }}>
          {lines.map((line, i) => (
            <div key={line.n} style={{
              display: 'flex',
              gap: '8px',
              lineHeight: 1.75,
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateX(0)' : 'translateX(-6px)',
              transition: `opacity 0.35s ${0.1 + i * 0.05}s ease, transform 0.35s ${0.1 + i * 0.05}s ease`,
            }}>
              <span style={{ color: line.g === '+' ? '#22c55e' : line.g === 'M' ? '#B8864E' : 'var(--border-strong)', width: '8px', textAlign: 'center', userSelect: 'none' }}>{line.g || '·'}</span>
              <span style={{ color: 'var(--muted)', opacity: 0.5, minWidth: '14px', textAlign: 'right', userSelect: 'none' }}>{line.n}</span>
              <span style={{ whiteSpace: 'pre' }}>
                {line.tokens.map((tk, j) => <span key={j} style={{ color: tk.c }}>{tk.t}</span>)}
              </span>
            </div>
          ))}
        </div>
        <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '14px', alignItems: 'center', background: 'hsla(0,0%,0%,0.02)', color: 'var(--muted)', fontSize: '11px' }}>
          <span style={{ color: '#8C7A5A' }}>git: main</span>
          <span>· Prettier</span>
          <span>· UTF-8</span>
          <span style={{ marginLeft: 'auto', color: '#5A8C6E' }}>&gt;_ terminal</span>
        </div>
      </div>
      <div style={{
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: '#8C7A5A12',
        border: '1px solid #8C7A5A30',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '12px',
      }}>
        <span style={{ color: '#8C7A5A', fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', flexShrink: 0 }}>→</span>
        <span style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-soft)' }}>
          Real Monaco editing, a live <strong style={{ color: '#8C7A5A' }}>Git change gutter</strong>, and a PTY terminal — not a toy.
        </span>
      </div>
    </div>
  )
}

function StationsVisual({ visible }: { visible: boolean }) {
  const stations = [
    { name: 'Claude Code #1', status: 'building', accent: '#C4975A', dot: '#22c55e' },
    { name: 'Codex', status: 'writing tests', accent: '#5A8C6E', dot: '#22c55e' },
    { name: 'Antigravity', status: 'queued', accent: '#5A6E8C', dot: '#f59e0b' },
    { name: 'OpenCode', status: 'idle', accent: '#7A5A8C', dot: 'var(--border-strong)' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
      }}>
        <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
          Agent Manager
        </span>
        <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', color: 'var(--accent)' }}>
          architect → 4 tasks
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {stations.map((s, i) => (
          <div key={s.name} style={{
            padding: '11px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--glass-bg)',
            border: `1px solid ${s.accent}25`,
            borderLeft: `3px solid ${s.accent}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity 0.4s ${0.1 + i * 0.09}s ease, transform 0.4s ${0.1 + i * 0.09}s ease`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.dot, flexShrink: 0, animation: s.dot === '#22c55e' ? 'pulse 1.5s ease-in-out infinite' : 'none' }} />
              <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11.5px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)' }}>
              {s.status}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: '#C4975A12',
        border: '1px solid #C4975A30',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '12px',
      }}>
        <span style={{ color: '#C4975A', fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', flexShrink: 0 }}>BUS</span>
        <span style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-soft)' }}>
          Shared Context Bus over local MCP — <strong style={{ color: '#C4975A' }}>every agent knows the project</strong>.
        </span>
      </div>
    </div>
  )
}

function SovereigntyVisual({ visible }: { visible: boolean }) {
  const platforms = [
    { name: 'macOS', meta: 'Apple Silicon + Intel · .dmg', accent: '#8C7A5A' },
    { name: 'Windows', meta: 'x64 · .msi / .exe', accent: '#5A8CA5' },
    { name: 'Linux', meta: '.AppImage / .deb', accent: '#5A8C6E' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[
          { k: 'local-first', v: 'SQLite cache' },
          { k: 'your keys', v: 'no middleman' },
          { k: 'signed', v: 'auto-update' },
        ].map((c, i) => (
          <div key={c.k} style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity 0.4s ${0.1 + i * 0.08}s ease, transform 0.4s ${0.1 + i * 0.08}s ease`,
          }}>
            <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>{c.k}</span>
            <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)' }}>{c.v}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {platforms.map((p, i) => (
          <div key={p.name} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '11px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--glass-bg)',
            border: `1px solid ${p.accent}25`,
            borderLeft: `3px solid ${p.accent}`,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateX(0)' : 'translateX(-8px)',
            transition: `opacity 0.4s ${0.25 + i * 0.1}s ease, transform 0.4s ${0.25 + i * 0.1}s ease`,
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              background: `${p.accent}18`,
              border: `1px solid ${p.accent}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-jetbrains-mono)',
              fontSize: '11px',
              fontWeight: 700,
              color: p.accent,
              flexShrink: 0,
            }}>
              {p.name.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
              <div style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', color: 'var(--muted)' }}>{p.meta}</div>
            </div>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', color: '#22c55e', flexShrink: 0 }}>signed</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Configs ──────────────────────────────────────────────────────────────

const SHOWCASES: Showcase[] = [
  {
    id: 'editor',
    eyebrow: 'A real IDE at the core',
    icon: 'ED',
    accent: '#8C7A5A',
    title: 'A serious editor. Everything else is the upgrade.',
    description: 'All-in-one tools usually ship a toy editor. Forze does not. At the core is a real Monaco workbench — the highlighting, multi-tab editing, and keystrokes you already know — with a full file tree, project-wide search, quick open, Prettier, real Git, and integrated PTY terminals. Open any folder and go.',
    bullets: [
      { label: 'Monaco editor + file tree', detail: 'Syntax highlighting, multi-tab, create/rename/delete — open any folder like you would in VS Code.' },
      { label: 'Real Git with a change gutter', detail: 'Diff against the committed baseline, stage, commit, and review from a clickable Source Control panel.' },
      { label: 'Search, Quick Open, Prettier', detail: 'Jump to any file or line in a keystroke; format the document with Shift+Alt+F. No extension hunting.' },
      { label: 'Integrated terminals', detail: 'Real xterm PTY terminals live inside the workspace, scoped to your project.' },
    ],
    visualLabel: 'Checkout.tsx · git',
    render: (v) => <EditorVisual visible={v} />,
  },
  {
    id: 'ai-control',
    eyebrow: 'The AI control room',
    icon: 'AI',
    accent: '#C4975A',
    title: "Don't manage your agents. Command them.",
    description: "Give the Agent Manager a goal and an Architect agent breaks it into tasks, then runs a team of workers in parallel. Vibe Stations put Claude Code, Codex, Antigravity and OpenCode live side by side, and a shared context bus means every agent already knows your project. The floating Assistant doesn't just chat — it operates the IDE for you.",
    bullets: [
      { label: 'Agent Manager (Mission Control)', detail: 'One goal in, a team of agents out — an Architect plans the tasks and workers run them in parallel.' },
      { label: 'Vibe Stations', detail: 'Claude Code, Codex, Antigravity and OpenCode running live in a grid of CLI terminals.' },
      { label: 'Shared Context Bus', detail: 'Every agent shares one project context over a local MCP bus. Explain it once, not five times.' },
      { label: 'The Forze Assistant', detail: 'A floating copilot that opens views, runs features, and takes actions — not just a chat box.' },
    ],
    callout: 'Keyless Gemini built in. Plug in your own Claude or OpenAI key when you want it.',
    visualLabel: 'mission control · 4 agents',
    reverse: true,
    render: (v) => <StationsVisual visible={v} />,
  },
  {
    id: 'sovereignty',
    eyebrow: 'Sovereignty',
    icon: 'SV',
    accent: '#5A8C6E',
    title: 'Your machine. Your keys. Your data.',
    description: 'Forze runs on your desktop and keeps it that way. A local SQLite cache means it works offline and your project data lives on your device. Bring-your-own-key sends your AI calls straight to the provider with no middleman. The app is a lightweight Tauri/Rust build — code-signed, auto-updating, and native on all three platforms.',
    bullets: [
      { label: 'Local-first & offline', detail: 'A SQLite cache keeps the workspace working without a connection. Your data stays on your machine.' },
      { label: 'Bring your own key', detail: 'Your AI calls go directly to the provider — no proxy sitting between you and your keys.' },
      { label: 'Lightweight & signed', detail: 'A Rust core instead of a heavy Electron stack: fast boot, small footprint, code-signed auto-updates.' },
      { label: 'Cross-platform', detail: 'Native desktop builds for macOS, Windows and Linux, all from one Tauri v2 codebase.' },
    ],
    visualLabel: 'local · signed · 3 platforms',
    render: (v) => <SovereigntyVisual visible={v} />,
  },
]

// ─── Section + parent ───────────────────────────────────────────────────────

function ShowcaseRow({ showcase, index }: { showcase: Showcase; index: number }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.12 }
    )
    if (rowRef.current) obs.observe(rowRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const sync = () => setIsNarrow(window.innerWidth < 900)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  const reverse = !!showcase.reverse && !isNarrow

  return (
    <div
      ref={rowRef}
      id={showcase.id}
      style={{
        display: 'grid',
        gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
        gap: 'clamp(28px, 5vw, 64px)',
        alignItems: 'center',
        padding: 'clamp(56px, 8vw, 88px) 24px',
        maxWidth: '1180px',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute',
        top: '50%',
        [reverse ? 'left' : 'right']: '-10%',
        width: '460px',
        height: '460px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${showcase.accent}14 0%, transparent 70%)`,
        animation: `blob-float ${14 + index * 2}s ease-in-out infinite`,
        pointerEvents: 'none',
        zIndex: 0,
        transform: 'translateY(-50%)',
      }} />

      {/* Copy */}
      <div style={{
        order: reverse ? 2 : 1,
        position: 'relative',
        zIndex: 1,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            background: `${showcase.accent}18`,
            border: `1px solid ${showcase.accent}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '12px',
            fontWeight: 700,
            color: showcase.accent,
          }}>
            {showcase.icon}
          </div>
          <p style={{
            fontFamily: 'var(--font-dm-sans), sans-serif',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: showcase.accent,
            textTransform: 'uppercase',
            margin: 0,
          }}>
            {showcase.eyebrow}
          </p>
        </div>

        <h3 style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(26px, 3.4vw, 38px)',
          fontWeight: 800,
          color: 'var(--text)',
          margin: '0 0 18px',
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
        }}>
          {showcase.title}
        </h3>

        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '16px',
          color: 'var(--text-soft)',
          margin: '0 0 24px',
          lineHeight: 1.65,
        }}>
          {showcase.description}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {showcase.bullets.map((b, i) => (
            <div key={b.label} style={{
              display: 'grid',
              gridTemplateColumns: '20px 1fr',
              gap: '12px',
              alignItems: 'flex-start',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateX(0)' : 'translateX(-8px)',
              transition: `opacity 0.5s ${0.15 + i * 0.08}s ease, transform 0.5s ${0.15 + i * 0.08}s ease`,
            }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: `${showcase.accent}25`,
                border: `1.5px solid ${showcase.accent}60`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 700,
                color: showcase.accent,
                marginTop: '2px',
                flexShrink: 0,
              }}>
                ✓
              </div>
              <div>
                <div style={{
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginBottom: '2px',
                }}>
                  {b.label}
                </div>
                <div style={{
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  fontSize: '13px',
                  color: 'var(--text-soft)',
                  lineHeight: 1.55,
                }}>
                  {b.detail}
                </div>
              </div>
            </div>
          ))}
        </div>

        {showcase.callout && (
          <div style={{
            marginTop: '20px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: `${showcase.accent}12`,
            border: `1px solid ${showcase.accent}30`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.6s 0.5s ease, transform 0.6s 0.5s ease',
          }}>
            <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '11px', fontWeight: 700, color: showcase.accent, flexShrink: 0 }}>KEY</span>
            <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '13px', color: 'var(--text-soft)', lineHeight: 1.5 }}>
              {showcase.callout}
            </span>
          </div>
        )}
      </div>

      {/* Visual */}
      <div style={{
        order: reverse ? 1 : 2,
        position: 'relative',
        zIndex: 1,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(28px) scale(0.98)',
        transition: 'opacity 0.8s 0.15s ease, transform 0.8s 0.15s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{
          borderRadius: 'var(--radius-xl)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: `1px solid ${showcase.accent}30`,
          boxShadow: `0 24px 60px -12px ${showcase.accent}25`,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: `${showcase.accent}08`,
          }}>
            <div style={{ display: 'flex', gap: '5px' }}>
              {['#ef4444', '#f59e0b', '#22c55e'].map(c => (
                <div key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.7 }} />
              ))}
            </div>
            <span style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '11px',
              color: 'var(--muted)',
            }}>
              {showcase.visualLabel}
            </span>
            <div style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: showcase.accent,
              animation: 'pulse 1.8s ease-in-out infinite',
            }} />
          </div>
          <div style={{ padding: '20px' }}>
            {showcase.render(visible)}
          </div>
        </div>
      </div>
    </div>
  )
}

export function IdeShowcase() {
  return (
    <section style={{
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      background: 'linear-gradient(180deg, var(--bg), var(--sidebar) 50%, var(--bg))',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {SHOWCASES.map((showcase, i) => (
        <ShowcaseRow key={showcase.id} showcase={showcase} index={i} />
      ))}
    </section>
  )
}
