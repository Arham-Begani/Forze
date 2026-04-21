'use client'

import { useEffect, useRef, useState } from 'react'

const BARS = [
  { label: 'TAM', value: '$2.4B', pct: 100, color: '#5A8C6E' },
  { label: 'SAM', value: '$180M', pct: 75, color: '#6B9F80' },
  { label: 'SOM', value: '$4.2M', pct: 40, color: '#7AAF90' },
]

const TABS = [
  { id: 'research', label: 'Research', icon: 'R', accent: '#5A8C6E' },
  { id: 'branding', label: 'Branding', icon: 'B', accent: '#5A6E8C' },
  { id: 'landing', label: 'Landing Page', icon: 'L', accent: '#8C7A5A' },
  { id: 'feasibility', label: 'Feasibility', icon: 'F', accent: '#7A5A8C' },
  { id: 'shadow', label: 'Shadow Board', icon: 'SB', accent: '#E04848' },
  { id: 'investor', label: 'Investor Kit', icon: 'IK', accent: '#7A8C5A' },
]

function ResearchPreview({ barsVisible }: { barsVisible: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Market Sizing
        </p>
        {BARS.map((bar, index) => (
          <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', color: 'var(--muted)', width: '32px', flexShrink: 0 }}>{bar.label}</span>
            <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: barsVisible ? `${bar.pct}%` : '0%', background: bar.color, borderRadius: '4px', transition: `width 1s ${0.1 + index * 0.18}s ease` }} />
            </div>
            <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '12px', color: 'var(--text-soft)', fontWeight: 600, width: '48px', textAlign: 'right', flexShrink: 0 }}>{bar.value}</span>
          </div>
        ))}
      </div>

      <div>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Top Competitors
        </p>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {[
            { name: 'Notion AI', gap: 'No market validation', score: '6/10' },
            { name: 'Canva AI', gap: 'Design-only, no research', score: '4/10' },
            { name: 'Copy.ai', gap: 'Copy only, no strategy', score: '3/10' },
          ].map((row, i) => (
            <div key={row.name} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              gap: '8px',
              padding: '10px 12px',
              borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
              alignItems: 'center',
              fontSize: '12px',
            }}>
              <span style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text)', fontWeight: 500 }}>{row.name}</span>
              <span style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--muted)', fontSize: '12px' }}>{row.gap}</span>
              <span style={{ fontFamily: 'var(--font-jetbrains-mono)', color: '#5A8C6E', fontWeight: 700, fontSize: '12px' }}>{row.score}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: '#5A8C6E15', border: '1px solid #5A8C6E25' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#5A8C6E', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>01</span>
        <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '14px', color: 'var(--text-soft)' }}>
          <strong style={{ color: '#5A8C6E' }}>10 scored concepts and angles</strong> ranked by opportunity, competitive whitespace, and execution risk
        </span>
      </div>
    </div>
  )
}

function BrandingPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Brand Palette
        </p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { hex: '#1A1F2E' },
            { hex: '#2D6BE4' },
            { hex: '#6ECFF6' },
            { hex: '#F5F7FF' },
            { hex: '#FFB547' },
          ].map(c => (
            <div key={c.hex} style={{ flex: '1 1 40px', minWidth: '40px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <div style={{ height: '40px', borderRadius: 'var(--radius-sm)', background: c.hex, width: '100%', border: '1px solid var(--border)' }} />
              <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '8px', color: 'var(--muted)', textAlign: 'center' }}>{c.hex}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Name Candidates
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { name: 'Vela', score: 'Recommended', tag: '#2D6BE4' },
            { name: 'Arclo', score: 'Strong', tag: '#5A8C6E' },
            { name: 'Nuvro', score: 'Creative', tag: '#7A5A8C' },
          ].map((n, i) => (
            <div key={n.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: i === 0 ? '#2D6BE415' : 'var(--glass-bg)', border: `1px solid ${i === 0 ? '#2D6BE430' : 'var(--border)'}` }}>
              <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{n.name}</span>
              <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', fontWeight: 600, color: n.tag }}>{n.score}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Brand Tone
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {['Confident', 'Approachable', 'Forward-thinking', 'Direct', 'Empowering'].map(t => (
            <span key={t} style={{ padding: '4px 12px', borderRadius: '999px', background: '#5A6E8C15', border: '1px solid #5A6E8C30', color: '#5A6E8C', fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-dm-sans)' }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function LandingPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--sidebar)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            {['#ef4444', '#f59e0b', '#22c55e'].map(c => <div key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.7 }} />)}
          </div>
          <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>
            vela.app · Deployed by Forze
          </div>
        </div>
        <div style={{ background: '#0f1117', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
            <div style={{ width: '60%', height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg, #2D6BE4, #6ECFF6)' }} />
            <div style={{ width: '85%', height: '6px', borderRadius: '3px', background: '#ffffff15' }} />
            <div style={{ width: '70%', height: '6px', borderRadius: '3px', background: '#ffffff10' }} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <div style={{ padding: '6px 16px', borderRadius: '6px', background: '#2D6BE4', fontSize: '10px', color: '#fff', fontFamily: 'var(--font-dm-sans)', fontWeight: 600 }}>Get Started</div>
              <div style={{ padding: '6px 16px', borderRadius: '6px', background: 'transparent', border: '1px solid #ffffff30', fontSize: '10px', color: '#ffffff70', fontFamily: 'var(--font-dm-sans)' }}>Learn More</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ padding: '12px', borderRadius: '8px', background: '#ffffff06', border: '1px solid #ffffff10' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: '#2D6BE420', marginBottom: '8px' }} />
                <div style={{ width: '80%', height: '5px', borderRadius: '3px', background: '#ffffff20', marginBottom: '4px' }} />
                <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: '#ffffff10' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['sitemap.xml', 'schema.org', 'lead capture', 'validation-ready'].map(tag => (
          <span key={tag} style={{ padding: '4px 10px', borderRadius: '999px', background: '#8C7A5A15', border: '1px solid #8C7A5A25', color: '#8C7A5A', fontSize: '11px', fontFamily: 'var(--font-dm-sans)', fontWeight: 500 }}>{tag}</span>
        ))}
      </div>
    </div>
  )
}

function FeasibilityPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: 'var(--radius-lg)', background: '#22c55e12', border: '1px solid #22c55e30' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#22c55e20', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, animation: 'glow-pulse 2s ease-in-out infinite', flexShrink: 0, color: '#22c55e', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>GO</div>
        <div>
          <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '22px', fontWeight: 800, color: '#22c55e', letterSpacing: '-0.01em' }}>GO</div>
          <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '13px', color: 'var(--text-soft)' }}>Market timing score 8.2/10 · Low competitive density</div>
        </div>
      </div>

      <div>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          3-Year Projections
        </p>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {[
            { year: 'Year 1', rev: '$120K', net: '-$48K', customers: '85' },
            { year: 'Year 2', rev: '$680K', net: '$142K', customers: '420' },
            { year: 'Year 3', rev: '$2.1M', net: '$890K', customers: '1,240' },
          ].map((row, i) => (
            <div key={row.year} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', gap: '6px', padding: '10px 12px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', color: 'var(--muted)' }}>{row.year}</span>
              <span style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text)', fontWeight: 600 }}>{row.rev}</span>
              <span style={{ fontFamily: 'var(--font-dm-sans)', color: i === 0 ? '#ef4444' : '#22c55e', fontSize: '12px' }}>{row.net}</span>
              <span style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--muted)', fontSize: '12px' }}>{row.customers} users</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ShadowPreview() {
  const personas = [
    { initials: 'SS', name: 'Silicon Skeptic', color: '#E04848', quote: 'Your CAC assumptions are fantasy. Show me a funnel.' },
    { initials: 'UX', name: 'UX Evangelist', color: '#7A5A8C', quote: 'The onboarding will lose 60% of users in the first 5 minutes.' },
    { initials: 'GA', name: 'Growth Alchemist', color: '#5A8C6E', quote: 'There is a viral loop buried in this. You are ignoring it.' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', borderRadius: 'var(--radius-lg)', background: '#E0484812', border: '1px solid #E0484830' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="var(--border)" strokeWidth="6" />
            <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              stroke="#E04848"
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 30 * 0.74} ${2 * Math.PI * 30 * 0.26}`}
              strokeDashoffset={2 * Math.PI * 30 * 0.25}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-dm-sans)', fontWeight: 800, fontSize: '20px', color: '#E04848' }}>74</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>Venture Survival Score</div>
          <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '13px', color: 'var(--text-soft)' }}>74/100 · Viable with pivots</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {personas.map((p) => (
          <div key={p.initials} style={{ display: 'flex', gap: '12px', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `${p.color}20`, border: `2px solid ${p.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-dm-sans)', fontSize: '10px', fontWeight: 700, color: p.color, flexShrink: 0 }}>{p.initials}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: p.color, fontWeight: 600, marginBottom: '2px' }}>{p.name}</div>
              <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '13px', color: 'var(--text-soft)', lineHeight: 1.4 }}>"{p.quote}"</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InvestorPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ padding: '18px 20px', borderRadius: 'var(--radius-lg)', background: '#7A8C5A15', border: '1px solid #7A8C5A30' }}>
        <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: '#7A8C5A', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
          Executive Summary
        </div>
        <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '15px', color: 'var(--text)', lineHeight: 1.6 }}>
          A venture thesis built from research, feasibility, landing proof, and the clearest investment story.
        </div>
      </div>

      <div>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Deck Structure
        </p>
        <div style={{ display: 'grid', gap: '8px' }}>
          {[
            'Problem and market gap',
            'Why now and why this wedge',
            'Validation signals and feasibility verdict',
            'Go-to-market plan and funding ask',
          ].map((item, i) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px', color: '#7A8C5A', width: '18px', flexShrink: 0 }}>{`0${i + 1}`}</span>
              <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '13px', color: 'var(--text-soft)' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['memo', 'deck outline', 'ask details', 'data room summary'].map(tag => (
          <span key={tag} style={{ padding: '4px 10px', borderRadius: '999px', background: '#7A8C5A15', border: '1px solid #7A8C5A25', color: '#7A8C5A', fontSize: '11px', fontFamily: 'var(--font-dm-sans)', fontWeight: 500 }}>{tag}</span>
        ))}
      </div>
    </div>
  )
}

function getPreviewMap(barsVisible: boolean): Record<string, React.ReactNode> {
  return {
    research: <ResearchPreview barsVisible={barsVisible} />,
    branding: <BrandingPreview />,
    landing: <LandingPreview />,
    feasibility: <FeasibilityPreview />,
    shadow: <ShadowPreview />,
    investor: <InvestorPreview />,
  }
}

export function OutputTabs() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [activeTab, setActiveTab] = useState('research')
  const [barsVisible, setBarsVisible] = useState(false)
  const [userSelected, setUserSelected] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setBarsVisible(true), 300)
      return () => clearTimeout(t)
    }
  }, [visible])

  useEffect(() => {
    if (!visible || userSelected) return
    const id = setInterval(() => {
      setActiveTab(prev => {
        const idx = TABS.findIndex(t => t.id === prev)
        return TABS[(idx + 1) % TABS.length].id
      })
    }, 5000)
    return () => clearInterval(id)
  }, [visible, userSelected])

  const active = TABS.find(t => t.id === activeTab)!

  return (
    <section id="features" ref={sectionRef} style={{
      padding: 'clamp(64px, 8vw, 112px) 24px',
      background: 'var(--sidebar)',
    }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '48px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}>
          <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 12px' }}>
            Deliverables
          </p>
          <h2 style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: 'var(--text)', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Validation Assets, Not AI Fluff
          </h2>
          <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '17px', color: 'var(--text-soft)', maxWidth: '620px', margin: '0 auto', lineHeight: 1.6 }}>
            Every output strengthens the same case: is this venture real, should you pursue it, and how do you explain it clearly to the market and investors?
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '4px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          marginBottom: '24px',
          flexWrap: 'wrap',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.6s 0.1s ease',
        }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setUserSelected(true) }}
              style={{
                flex: '1 1 auto',
                padding: '10px 16px',
                borderRadius: 'calc(var(--radius-lg) - 4px)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans)',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all var(--transition-smooth)',
                background: activeTab === tab.id ? tab.accent : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text-soft)',
                boxShadow: activeTab === tab.id ? `0 4px 12px -2px ${tab.accent}50` : 'none',
                transform: activeTab === tab.id ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ minHeight: '460px' }}>
        <div
          key={activeTab}
          style={{
            borderRadius: 'var(--radius-xl)',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))',
            WebkitBackdropFilter: 'blur(var(--glass-blur))',
            border: `1px solid ${active.accent}30`,
            boxShadow: `0 16px 48px -8px ${active.accent}15`,
            overflow: 'hidden',
            opacity: visible ? 1 : 0,
            animation: 'fade-in-scale 0.35s ease both',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', background: `${active.accent}08`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%', background: `linear-gradient(to right, transparent, ${active.accent}10)`, pointerEvents: 'none' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: active.accent, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>{active.icon}</span>
            <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{active.label} Output</span>
            <span style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: '999px', background: '#22c55e20', color: '#22c55e', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-dm-sans)' }}>Live</span>
          </div>
          <div style={{ padding: '24px' }}>
            {getPreviewMap(barsVisible)[activeTab]}
          </div>
        </div>
        </div>
      </div>
    </section>
  )
}
