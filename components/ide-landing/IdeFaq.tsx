'use client'

import { useEffect, useRef, useState } from 'react'

const FAQS = [
  {
    q: 'Is Forze IDE free?',
    a: 'Yes — it is free while in beta. Download the signed build for your OS and start immediately. You can run it on the keyless Gemini default at no cost, or plug in your own AI key.',
  },
  {
    q: 'Which platforms are supported?',
    a: 'macOS (both Apple Silicon and Intel), Windows (64-bit), and Linux. They are all native desktop builds from one Tauri v2 codebase, and a single account works across every machine you install it on.',
  },
  {
    q: 'Do I have to bring my own API key?',
    a: 'No. Gemini works out of the box with no key. When you want more, plug in your own Claude or OpenAI key — your keys live on your machine and your AI calls go straight to the provider, with no middleman in between.',
  },
  {
    q: 'Is my code and data private?',
    a: 'Forze is local-first. A local SQLite cache means it works offline, and your files, keys, and project data stay on your device. A pre-commit security gate also scans for secrets so you never push a key by accident.',
  },
  {
    q: 'How is it different from VS Code or Cursor?',
    a: 'Those are editors with AI bolted on. Forze is a real Monaco editor sitting inside a founder OS — deployments, AI agent orchestration, a kanban board, analytics, build-in-public, and community are all first-class, in the same window, local-first.',
  },
  {
    q: 'Which AI agents can it run?',
    a: 'Claude Code, Codex, Antigravity, and OpenCode run as live Vibe Stations side by side. The Agent Manager gives them a goal, an Architect agent breaks it into tasks, and a shared context bus means every agent already knows your project.',
  },
  {
    q: 'Can it deploy my app?',
    a: 'Yes. A full Vercel client lets you deploy, redeploy, cancel, promote to production, and stream build logs without leaving Forze. You just paste a Vercel token (and an optional Team ID).',
  },
  {
    q: 'Is it heavy? Does it update itself?',
    a: 'It is built on Tauri with a Rust core instead of a full Electron browser, so it boots fast and stays light. Releases ship as cryptographically signed bundles through a built-in updater, applied in the background.',
  },
]

function FaqItem({ item, index, visible }: { item: { q: string; a: string }; index: number; visible: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      borderRadius: 'var(--radius-lg)',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      border: `1px solid ${open ? 'var(--accent-glow)' : 'var(--glass-border)'}`,
      overflow: 'hidden',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(16px)',
      transition: `opacity 0.5s ${0.05 + index * 0.06}s ease, transform 0.5s ${0.05 + index * 0.06}s ease, border-color var(--transition-fast)`,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '20px 22px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '16px',
          fontWeight: 700,
          color: 'var(--text)',
          letterSpacing: '-0.01em',
        }}>
          {item.q}
        </span>
        <span style={{
          flexShrink: 0,
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          border: '1px solid var(--border-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: open ? 'var(--accent)' : 'var(--muted)',
          transition: 'transform var(--transition-fast), color var(--transition-fast)',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      <div style={{
        maxHeight: open ? '320px' : '0px',
        opacity: open ? 1 : 0,
        transition: 'max-height 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
        overflow: 'hidden',
      }}>
        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '15px',
          color: 'var(--text-soft)',
          lineHeight: 1.65,
          margin: 0,
          padding: '0 22px 22px',
        }}>
          {item.a}
        </p>
      </div>
    </div>
  )
}

export function IdeFaq() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="faq" ref={sectionRef} style={{
      padding: 'clamp(64px, 8vw, 112px) 24px',
      maxWidth: '780px',
      margin: '0 auto',
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '48px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: 'var(--accent)',
          textTransform: 'uppercase',
          margin: '0 0 12px',
        }}>
          Questions
        </p>
        <h2 style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 800,
          color: 'var(--text)',
          margin: 0,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}>
          Good to know
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {FAQS.map((item, i) => (
          <FaqItem key={item.q} item={item} index={i} visible={visible} />
        ))}
      </div>
    </section>
  )
}
