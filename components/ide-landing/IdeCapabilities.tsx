'use client'

import { useEffect, useRef, useState } from 'react'

type Category = {
  icon: string
  accent: string
  title: string
  features: { name: string; line: string }[]
}

// The full feature inventory, grouped exactly as in the product. Every item here
// ships in Forze IDE. Accents reuse the design-system module palette.
const CATEGORIES: Category[] = [
  {
    icon: 'ED',
    accent: '#8C7A5A',
    title: 'Editor & workbench',
    features: [
      { name: 'Monaco code editor', line: 'Syntax highlighting, auto-indent, multi-tab — the keystrokes you already know.' },
      { name: 'File Explorer', line: 'Full file tree with create/rename/delete; open any folder.' },
      { name: 'Project-wide search', line: 'Fast workspace search with jump-to-line reveal.' },
      { name: 'Quick Open', line: 'Jump to any file in a single keystroke.' },
      { name: 'Format Document', line: 'Prettier built in (Shift+Alt+F) — no extension hunting.' },
      { name: 'Integrated terminal', line: 'Real xterm PTY terminals inside the workspace.' },
      { name: 'Command center', line: 'Borderless native window with a menu bar and command center.' },
      { name: 'Workspaces', line: 'Switch folders and everything re-scopes to the project.' },
    ],
  },
  {
    icon: 'AI',
    accent: '#C4975A',
    title: 'AI, agents & orchestration',
    features: [
      { name: 'The Forze Assistant', line: 'A floating copilot that drives the IDE — opens views, runs features, takes action.' },
      { name: 'BYOK + keyless default', line: 'Gemini works out of the box; plug in your own Claude or OpenAI key.' },
      { name: 'Agent Manager', line: 'One goal in, a team of worker agents out, running in parallel.' },
      { name: 'Vibe Stations', line: 'Claude Code, Codex, Antigravity & OpenCode, live, side by side.' },
      { name: 'Shared Context Bus', line: 'Agents share one project context over a local MCP bus.' },
      { name: 'Scheduled prompts', line: '"Run the tests on Claude Code #1 at 9pm" — Forze types it for you.' },
      { name: 'Vibe Canvas', line: 'A visual AI builder that generates code straight into the editor.' },
    ],
  },
  {
    icon: 'GIT',
    accent: '#6B8F71',
    title: 'Source control & safety',
    features: [
      { name: 'VS Code-style Git', line: 'Change gutter, Source Control panel, stage / commit / diff.' },
      { name: 'Commit Guard', line: 'Optional auto-commit every N changes — never lose work.' },
      { name: 'Security review gate', line: 'Pre-commit scanner blocks commits that would leak secrets.' },
      { name: 'Security Auditor', line: 'A panel that scans your code for exposed keys and risky patterns.' },
    ],
  },
  {
    icon: '▲',
    accent: '#7A5A8C',
    title: 'Deployments',
    features: [
      { name: 'Full Vercel client', line: 'Deploy, redeploy, cancel, promote to prod, and stream build logs.' },
      { name: 'Live deploy status', line: 'Auto-polling deployment list so you always see the current state.' },
      { name: 'One credential', line: 'Paste a Vercel token (and optional Team ID) — that\'s it.' },
    ],
  },
  {
    icon: 'OS',
    accent: '#8C5A7A',
    title: 'Run the company',
    features: [
      { name: 'Kanban board', line: 'A drag-and-drop board, per workspace, that the AI planner writes into.' },
      { name: 'Dashboard', line: 'A founder cockpit built from real signals — commits, streaks, tasks.' },
      { name: 'Analytics', line: 'Builder analytics from your actual activity, not vanity data.' },
      { name: 'Build in Public', line: 'Schedule and publish updates (LinkedIn) as you ship.' },
      { name: 'Community', line: 'A local-first builder feed with profiles, posts and Demo Day launches.' },
      { name: 'Team', line: 'A team roster with voice rooms for the people building with you.' },
    ],
  },
  {
    icon: 'SV',
    accent: '#5A8CA5',
    title: 'Platform & trust',
    features: [
      { name: 'Cross-platform', line: 'Native desktop builds for macOS, Windows and Linux (Tauri v2).' },
      { name: 'Offline-first', line: 'A local SQLite cache means it works without a connection.' },
      { name: 'Local-first & sovereign', line: 'Files, keys and project data stay on your machine.' },
      { name: 'Signed + auto-update', line: 'Code-signed bundles with a built-in updater on forze.in.' },
      { name: 'Light & dark themes', line: '"Daylight" light mode and the default "Builder OS" dark.' },
      { name: 'Lightweight', line: 'A Rust core, not Electron — fast boot, small footprint.' },
    ],
  },
]

function CategoryCard({ category, index, visible }: { category: Category; index: number; visible: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 'var(--radius-lg)',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--glass-border)',
        borderTop: `3px solid ${hovered ? category.accent : `${category.accent}80`}`,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        alignSelf: 'start',
        opacity: visible ? 1 : 0,
        transform: visible
          ? (hovered ? 'translateY(-4px)' : 'translateY(0)')
          : 'translateY(32px)',
        transition: `opacity 0.5s ${0.1 + index * 0.06}s ease, transform 0.5s ${0.1 + index * 0.06}s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease, border-color 0.2s ease`,
        boxShadow: hovered ? `0 16px 40px -8px ${category.accent}25` : 'none',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          background: `${category.accent}18`,
          border: `1px solid ${category.accent}35`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '13px',
          fontWeight: 700,
          color: category.accent,
          flexShrink: 0,
        }}>
          {category.icon}
        </div>
        <h3 style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '18px',
          fontWeight: 700,
          color: 'var(--text)',
          margin: 0,
          letterSpacing: '-0.01em',
        }}>
          {category.title}
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {category.features.map((f) => (
          <div key={f.name} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ color: category.accent, fontSize: '11px', lineHeight: '20px', flexShrink: 0 }}>▸</span>
            <div>
              <span style={{
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text)',
              }}>
                {f.name}
              </span>
              <span style={{
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '13px',
                color: 'var(--text-soft)',
                lineHeight: 1.5,
                display: 'block',
                marginTop: '1px',
              }}>
                {f.line}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function IdeCapabilities() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.06 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="capabilities" ref={sectionRef} style={{
      padding: 'clamp(64px, 8vw, 112px) 24px',
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '56px',
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
          Everything in the box
        </p>
        <h2 style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 800,
          color: 'var(--text)',
          margin: '0 0 16px',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}>
          The complete founder toolset
        </h2>
        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '17px',
          color: 'var(--text-soft)',
          maxWidth: '620px',
          margin: '0 auto',
          lineHeight: 1.6,
        }}>
          Replaces your IDE — and the six tools bolted around it. Every capability below ships in the app, grouped the way you actually use them.
        </p>
      </div>

      <div className="ide-cap-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '16px',
      }}>
        {CATEGORIES.map((category, i) => (
          <CategoryCard key={category.title} category={category} index={i} visible={visible} />
        ))}
      </div>

      <style>{`
        @media (max-width: 680px) {
          .ide-cap-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
