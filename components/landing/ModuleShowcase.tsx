'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

type ModuleConfig = {
  id: string
  eyebrow: string
  icon: string
  accent: string
  title: string
  description: string
  bullets: { label: string; detail: string }[]
  visualLabel: string
  reverse?: boolean
  render: (visible: boolean) => ReactNode
}

// ─── Visual showcases (one per module) ─────────────────────────────────────

function InspirationVisual({ visible }: { visible: boolean }) {
  const swatches = [
    { hex: '#635BFF', label: 'Primary' },
    { hex: '#0A2540', label: 'Surface' },
    { hex: '#F6F9FC', label: 'Background' },
    { hex: '#00D4FF', label: 'Accent' },
    { hex: '#11181C', label: 'Text' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: '12px',
      }}>
        <span style={{ color: '#5A8CA5', flexShrink: 0 }}>{'>'}</span>
        <span style={{ color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          stripe.com
        </span>
        <span style={{
          marginLeft: 'auto',
          padding: '2px 8px',
          borderRadius: '999px',
          background: '#5A8CA520',
          color: '#5A8CA5',
          fontSize: '10px',
          fontWeight: 700,
          flexShrink: 0,
        }}>
          analyzed
        </span>
      </div>

      <div>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Measured palette
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>
          {swatches.map((s, i) => (
            <div key={s.hex} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(8px)',
              transition: `opacity 0.4s ${0.1 + i * 0.08}s ease, transform 0.4s ${0.1 + i * 0.08}s ease`,
            }}>
              <div style={{ height: '44px', borderRadius: 'var(--radius-sm)', background: s.hex, border: '1px solid var(--border)' }} />
              <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '9px', color: 'var(--muted)', textAlign: 'center' }}>{s.hex}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Detected typography
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { role: 'Heading', family: 'Söhne', source: 'preload font' },
            { role: 'Body', family: 'Söhne', source: 'css var' },
            { role: 'Mono', family: 'Söhne Mono', source: 'google fonts' },
          ].map((row, i) => (
            <div key={row.role} style={{
              display: 'grid',
              gridTemplateColumns: '70px 1fr auto',
              gap: '8px',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--glass-bg)',
              border: '1px solid var(--border)',
              fontSize: '12px',
              opacity: visible ? 1 : 0,
              transition: `opacity 0.4s ${0.3 + i * 0.1}s ease`,
            }}>
              <span style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--muted)', fontSize: '11px' }}>{row.role}</span>
              <span style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text)', fontWeight: 600 }}>{row.family}</span>
              <span style={{ fontFamily: 'var(--font-jetbrains-mono)', color: '#5A8CA5', fontSize: '10px' }}>{row.source}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        background: '#5A8CA512',
        border: '1px solid #5A8CA530',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '12px',
      }}>
        <span style={{ color: '#5A8CA5', fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', flexShrink: 0 }}>→</span>
        <span style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-soft)' }}>
          Applied to your landing page. <strong style={{ color: '#5A8CA5' }}>Real fonts, real hex codes</strong> — not LLM guesses.
        </span>
      </div>
    </div>
  )
}

function CrmVisual({ visible }: { visible: boolean }) {
  const leads = [
    { initials: 'AS', name: 'Anika Shah', email: 'anika@cohort.io', src: 'Landing', status: 'New', accent: '#5A8C6E' },
    { initials: 'MJ', name: 'Marcus Jones', email: 'marcus@northpoint.co', src: 'Outreach', status: 'Replied', accent: '#C4975A' },
    { initials: 'PR', name: 'Priya Rao', email: 'priya@stackcore.app', src: 'Landing', status: 'Qualified', accent: '#6B8F71' },
    { initials: 'LK', name: 'Liam Kessler', email: 'liam@orbital.dev', src: 'Direct Mail', status: 'Followed up', accent: '#7A8C5A' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Lead inbox · 4 of 142
        </p>
        <span style={{
          padding: '2px 8px',
          borderRadius: '999px',
          background: '#6B8F7120',
          color: '#6B8F71',
          fontSize: '10px',
          fontWeight: 700,
          fontFamily: 'var(--font-jetbrains-mono)',
        }}>
          live
        </span>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {leads.map((lead, i) => (
          <div key={lead.email} style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr auto',
            gap: '10px',
            padding: '10px 12px',
            alignItems: 'center',
            borderBottom: i < leads.length - 1 ? '1px solid var(--border)' : 'none',
            background: i % 2 === 0 ? 'transparent' : 'hsla(0,0%,0%,0.015)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateX(0)' : 'translateX(-8px)',
            transition: `opacity 0.4s ${0.1 + i * 0.08}s ease, transform 0.4s ${0.1 + i * 0.08}s ease`,
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: `${lead.accent}25`,
              border: `1.5px solid ${lead.accent}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: '11px',
              fontWeight: 700,
              color: lead.accent,
              flexShrink: 0,
            }}>
              {lead.initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lead.name}
              </div>
              <div style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lead.email}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
              <span style={{
                padding: '1px 8px',
                borderRadius: '999px',
                background: `${lead.accent}15`,
                color: lead.accent,
                fontSize: '10px',
                fontWeight: 600,
                fontFamily: 'var(--font-dm-sans)',
              }}>
                {lead.status}
              </span>
              <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '10px', color: 'var(--muted)' }}>
                from {lead.src}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['Send 1:1', 'Bulk dispatch', 'Tag + filter', 'Reply tracking', 'Export CSV'].map((tag, i) => (
          <span key={tag} style={{
            padding: '4px 10px',
            borderRadius: '999px',
            background: '#6B8F7115',
            border: '1px solid #6B8F7130',
            color: '#6B8F71',
            fontSize: '11px',
            fontWeight: 500,
            fontFamily: 'var(--font-dm-sans)',
            opacity: visible ? 1 : 0,
            transition: `opacity 0.4s ${0.4 + i * 0.06}s ease`,
          }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

function OutreachVisual({ visible }: { visible: boolean }) {
  const steps = [
    { day: 'Day 0', subject: 'Quick question about scheduling at Cohort', tone: 'Curious', accent: '#B8864E' },
    { day: 'Day 3', subject: 'Different angle — saw your post on AI ops', tone: 'Empathetic', accent: '#C49A65' },
    { day: 'Day 7', subject: 'Last one — would 10 minutes be useful?', tone: 'Direct', accent: '#D4AE7C' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
            Insurance Agents · Q3 Outbound
          </span>
          <span style={{
            padding: '2px 8px',
            borderRadius: '999px',
            background: '#22c55e20',
            color: '#22c55e',
            fontSize: '10px',
            fontWeight: 700,
            fontFamily: 'var(--font-dm-sans)',
          }}>
            sending
          </span>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', fontFamily: 'var(--font-jetbrains-mono)', color: 'var(--muted)' }}>
          <span><span style={{ color: '#B8864E', fontWeight: 700 }}>240</span> leads</span>
          <span><span style={{ color: '#5A8C6E', fontWeight: 700 }}>38%</span> open</span>
          <span><span style={{ color: '#6B8F71', fontWeight: 700 }}>11%</span> reply</span>
          <span><span style={{ color: '#7A8C5A', fontWeight: 700 }}>4</span> meetings</span>
        </div>
      </div>

      <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        Sequence · tone rotates per touch
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {steps.map((step, i) => (
          <div key={step.day} style={{
            display: 'grid',
            gridTemplateColumns: '60px 1fr auto',
            gap: '12px',
            alignItems: 'center',
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--glass-bg)',
            border: `1px solid ${step.accent}30`,
            borderLeft: `3px solid ${step.accent}`,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity 0.4s ${0.1 + i * 0.12}s ease, transform 0.4s ${0.1 + i * 0.12}s ease`,
          }}>
            <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', color: step.accent, fontWeight: 700 }}>
              {step.day}
            </span>
            <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '12px', color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {step.subject}
            </span>
            <span style={{
              padding: '1px 8px',
              borderRadius: '999px',
              background: `${step.accent}15`,
              color: step.accent,
              fontSize: '10px',
              fontWeight: 600,
              fontFamily: 'var(--font-dm-sans)',
              flexShrink: 0,
            }}>
              {step.tone}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: '#B8864E12',
        border: '1px solid #B8864E30',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '12px',
      }}>
        <span style={{ color: '#B8864E', fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', flexShrink: 0 }}>AI</span>
        <span style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-soft)' }}>
          Replies scored <strong style={{ color: '#22c55e' }}>Interested</strong> · <strong style={{ color: '#5A6E8C' }}>Question</strong> · <strong style={{ color: '#E04848' }}>Uninterested</strong> automatically.
        </span>
      </div>
    </div>
  )
}

function RoutinesVisual({ visible }: { visible: boolean }) {
  const routines = [
    { name: 'Cohort Newsletter', channel: 'Gmail', cadence: 'Weekly', next: 'Mon · 09:00 IST', tone: 'Insight', accent: '#8C5A7A' },
    { name: 'Founder Build Logs', channel: 'Instagram', cadence: 'Every 3 days', next: 'Wed · 18:00 IST', tone: 'Story', accent: '#A56B91' },
    { name: 'Customer Wins', channel: 'Gmail', cadence: 'Monthly', next: 'Jun 1 · 10:00 IST', tone: 'Trust', accent: '#7A5A8C' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Active routines · firing on cron
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          fontFamily: 'var(--font-jetbrains-mono)',
          color: 'var(--muted)',
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#8C5A7A',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          autopilot
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {routines.map((r, i) => (
          <div key={r.name} style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--glass-bg)',
            border: `1px solid ${r.accent}25`,
            borderLeft: `3px solid ${r.accent}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity 0.4s ${0.1 + i * 0.12}s ease, transform 0.4s ${0.1 + i * 0.12}s ease`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                {r.name}
              </span>
              <span style={{
                padding: '1px 8px',
                borderRadius: '999px',
                background: `${r.accent}15`,
                color: r.accent,
                fontSize: '10px',
                fontWeight: 600,
                fontFamily: 'var(--font-dm-sans)',
              }}>
                {r.tone}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px', fontFamily: 'var(--font-dm-sans)', color: 'var(--muted)' }}>
              <span><span style={{ color: r.accent, fontWeight: 600 }}>{r.channel}</span></span>
              <span style={{ color: 'var(--border-strong)' }}>·</span>
              <span>{r.cadence}</span>
              <span style={{ color: 'var(--border-strong)' }}>·</span>
              <span>next <span style={{ color: 'var(--text-soft)', fontFamily: 'var(--font-jetbrains-mono)', fontSize: '10px' }}>{r.next}</span></span>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: '#8C5A7A12',
        border: '1px solid #8C5A7A30',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '12px',
      }}>
        <span style={{ color: '#8C5A7A', fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', flexShrink: 0 }}>⟳</span>
        <span style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-soft)' }}>
          Tone rotates per touch · timezone-aware · fires hourly via global cron · <strong style={{ color: '#8C5A7A' }}>fully hands-off</strong>.
        </span>
      </div>
    </div>
  )
}

// ─── Module configs ────────────────────────────────────────────────────────

const MODULES: ModuleConfig[] = [
  {
    id: 'inspiration',
    eyebrow: 'Module · Inspiration',
    icon: 'IN',
    accent: '#5A8CA5',
    title: 'Paste any URL. We measure the design system.',
    description: 'Stripe, Linear, your competitor — paste the link. Inspiration captures a real screenshot via Microlink, scrapes the HTML for font preloads and CSS custom properties, runs Gemini Vision on the screenshot, and clamps every guess to ground truth. The output is a deterministic DesignTokens object: real hex codes, real font families, real radius and spacing scales.',
    bullets: [
      { label: 'Ground-truth tokens', detail: 'Vibrant palette + @font-face + CSS vars. Not LLM-eyeballed.' },
      { label: 'Auto-applied to landing', detail: 'The generated page sees the screenshot during generation.' },
      { label: 'Self-consistency vision', detail: 'Two parallel runs, reconciled — mood + qualitative output stabilizes.' },
      { label: 'Refine in plain English', detail: '"Make the primary button stronger on the features section."' },
    ],
    visualLabel: 'stripe.com · analyzed',
    render: (visible) => <InspirationVisual visible={visible} />,
  },
  {
    id: 'crm',
    eyebrow: 'Module · CRM',
    icon: 'CR',
    accent: '#6B8F71',
    title: 'A working CRM the moment your page goes live.',
    description: 'Every signup from your Forze landing page lands here, with full history, tagging, status, and per-lead reply tracking. Send 1:1 emails or bulk-dispatch from your connected Gmail. The CRM shares venture context with every other agent — Outreach can pull leads, Routines can drip to them, Investor Kit can cite the pipeline.',
    bullets: [
      { label: 'Built-in lead inbox', detail: 'Landing signups, outreach replies, direct-mail responses — all one feed.' },
      { label: 'Send from your inbox', detail: 'OAuth Gmail. Mail goes from you@yourcompany, not a third-party relay.' },
      { label: 'Reply scoring + sentiment', detail: 'Interested / Question / Uninterested, scored -1.0 to 1.0.' },
      { label: 'Cross-agent context', detail: 'Outreach campaigns + Routines + Direct Mail all pull from the same leads.' },
    ],
    visualLabel: 'lead inbox',
    reverse: true,
    render: (visible) => <CrmVisual visible={visible} />,
  },
  {
    id: 'outreach',
    eyebrow: 'Module · Outreach',
    icon: 'OR',
    accent: '#B8864E',
    title: 'Cold-email campaigns that actually go out.',
    description: 'Forze drafts the full sequence — subject lines, body copy, call to action — segmented by lead persona and rotated in tone across touches. HMAC-signed redirects and tracking pixels capture opens, clicks, and replies. The AI sentiment engine sorts incoming replies so you only see the ones that need a human.',
    bullets: [
      { label: 'Full-sequence generation', detail: 'Day 0, Day 3, Day 7 — different angle, different tone, same offer.' },
      { label: 'Lead enrichment', detail: 'Source from your CRM or upload a list. Forze enriches and segments.' },
      { label: 'Open / click / reply tracking', detail: 'HMAC-signed redirects and 1x1 pixels. No third-party tracker.' },
      { label: 'Inbox-warmed delivery', detail: 'Sends from your connected Gmail with proper headers and pacing.' },
    ],
    visualLabel: 'Insurance Agents · Q3',
    render: (visible) => <OutreachVisual visible={visible} />,
  },
  {
    id: 'routines',
    eyebrow: 'Module · Routines',
    icon: 'RT',
    accent: '#8C5A7A',
    title: 'Autonomous growth that runs while you sleep.',
    description: 'Set a routine once — newsletter, build logs, customer wins — pick a channel and a cadence. Forze fires it on a timezone-aware global cron, rotates the messaging angle across touches so the cadence never feels like spam, and tracks every run with success / failure metrics. Pause, edit, or archive at any time.',
    bullets: [
      { label: 'Gmail + Instagram channels', detail: 'Email newsletters and IG posts publish straight from your connected accounts.' },
      { label: 'Cadence in your timezone', detail: 'Every 3 days, weekly, or monthly — fired during local business hours.' },
      { label: 'Touch-aware tone rotation', detail: 'Run count drives angle changes. Touch #1 is curiosity, #10 is conviction.' },
      { label: 'Hands-off execution', detail: 'Hourly cron picks up due routines. You see results, not chores.' },
    ],
    visualLabel: 'autopilot · 3 routines firing',
    reverse: true,
    render: (visible) => <RoutinesVisual visible={visible} />,
  },
]

// ─── Section + parent component ────────────────────────────────────────────

function ModuleSection({ module, index }: { module: ModuleConfig; index: number }) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.12 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const sync = () => setIsNarrow(window.innerWidth < 900)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  const reverse = !!module.reverse && !isNarrow

  return (
    <div
      ref={sectionRef}
      id={module.id}
      style={{
        display: 'grid',
        gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
        gap: 'clamp(28px, 5vw, 64px)',
        alignItems: 'center',
        padding: 'clamp(64px, 8vw, 96px) 24px',
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
        background: `radial-gradient(circle, ${module.accent}14 0%, transparent 70%)`,
        animation: `blob-float ${14 + index * 2}s ease-in-out infinite`,
        pointerEvents: 'none',
        zIndex: 0,
        transform: 'translateY(-50%)',
      }} />

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
            background: `${module.accent}18`,
            border: `1px solid ${module.accent}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '12px',
            fontWeight: 700,
            color: module.accent,
          }}>
            {module.icon}
          </div>
          <p style={{
            fontFamily: 'var(--font-dm-sans), sans-serif',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: module.accent,
            textTransform: 'uppercase',
            margin: 0,
          }}>
            {module.eyebrow}
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
          {module.title}
        </h3>

        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '16px',
          color: 'var(--text-soft)',
          margin: '0 0 24px',
          lineHeight: 1.65,
        }}>
          {module.description}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {module.bullets.map((b, i) => (
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
                background: `${module.accent}25`,
                border: `1.5px solid ${module.accent}60`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 700,
                color: module.accent,
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
      </div>

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
          border: `1px solid ${module.accent}30`,
          boxShadow: `0 24px 60px -12px ${module.accent}25`,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: `${module.accent}08`,
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
              {module.visualLabel}
            </span>
            <div style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: module.accent,
              animation: 'pulse 1.8s ease-in-out infinite',
            }} />
          </div>
          <div style={{ padding: '20px' }}>
            {module.render(visible)}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ModuleShowcase() {
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerVisible, setHeaderVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setHeaderVisible(true) },
      { threshold: 0.2 }
    )
    if (headerRef.current) obs.observe(headerRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="modules" style={{
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      background: 'linear-gradient(180deg, var(--bg), var(--sidebar) 50%, var(--bg))',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div ref={headerRef} style={{
        maxWidth: '760px',
        margin: '0 auto',
        textAlign: 'center',
        padding: 'clamp(72px, 9vw, 112px) 24px 0',
        opacity: headerVisible ? 1 : 0,
        transform: headerVisible ? 'translateY(0)' : 'translateY(24px)',
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
          The Post-Launch Workforce
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
          The page is live. Now what?
        </h2>
        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '17px',
          color: 'var(--text-soft)',
          margin: '0 auto',
          lineHeight: 1.65,
          maxWidth: '620px',
        }}>
          Most AI tools stop at "we made a thing." Forze keeps going. Inspiration grounds your design in reality, CRM captures every lead, Outreach sends the cold-email campaigns, and Routines run the whole growth loop on autopilot.
        </p>
      </div>

      {MODULES.map((module, i) => (
        <ModuleSection key={module.id} module={module} index={i} />
      ))}
    </section>
  )
}
