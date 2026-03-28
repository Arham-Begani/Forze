'use client'

import { useEffect, useRef, useState } from 'react'

const FEATURED = {
  icon: '⬡',
  accent: '#C4975A',
  title: 'Full Launch',
  tagline: 'Your Startup Workforce in one command',
  description: 'Runs Research, Branding, Landing Page, and Feasibility as a coordinated Agent Team. All outputs share context — brand voice matches research positioning, landing page uses branding colors, feasibility cites the research data.',
  subAgents: [
    { icon: '◎', label: 'Genesis Engine', accent: '#5A8C6E' },
    { icon: '◇', label: 'Identity Architect', accent: '#5A6E8C' },
    { icon: '▣', label: 'Production Pipeline', accent: '#8C7A5A' },
    { icon: '◈', label: 'Deep Validation', accent: '#7A5A8C' },
  ],
}

const AGENTS = [
  {
    icon: '◎',
    accent: '#5A8C6E',
    title: 'Research',
    description: 'Real-time market intelligence with TAM/SAM/SOM, SWOT analysis, and 10 ranked high-alpha concepts.',
    outputs: ['Market sizing with cited sources', 'Competitor gap analysis', '12-risk risk matrix'],
  },
  {
    icon: '◇',
    accent: '#5A6E8C',
    title: 'Branding',
    description: 'Full Brand Bible — 5 name candidates, color psychology, typography pairing, tone of voice.',
    outputs: ['5 brand name candidates', 'Complete UI Kit spec', 'Logo concept descriptions'],
  },
  {
    icon: '▲',
    accent: '#8C5A7A',
    title: 'Marketing',
    description: '30-day Go-to-Market strategy, 90 platform-specific social captions, and a 7-part email launch sequence.',
    outputs: ['Week-by-week GTM plan', '90 social captions (X, LinkedIn, IG)', '5 SEO blog outlines'],
  },
  {
    icon: '▣',
    accent: '#8C7A5A',
    title: 'Landing Page',
    description: 'High-conversion copy + full Next.js component + live deployed URL with lead capture wired.',
    outputs: ['Deployed URL in minutes', 'Hero, features, pricing, FAQ copy', 'Lead capture + analytics'],
  },
  {
    icon: '◈',
    accent: '#7A5A8C',
    title: 'Feasibility',
    description: '20-page study with 3-year financial model, unit economics, and a clear GO/NO-GO verdict.',
    outputs: ['3-year P&L projections', 'Market timing score (1–10)', 'GO/NO-GO with rationale'],
  },
  {
    icon: '◉',
    accent: '#6B8F71',
    title: 'Co-pilot',
    description: 'Context-aware venture advisor. Knows everything your agents produced. Answers questions, refines strategy.',
    outputs: ['Cross-agent context synthesis', 'Strategic Q&A', 'Module re-run suggestions'],
  },
  {
    icon: '⚔',
    accent: '#E04848',
    title: 'Shadow Board',
    description: 'Three AI personas deliver brutal, honest feedback. Venture Survival Score. Synthetic user interviews.',
    outputs: ['Venture Survival Score (0–100)', '3 strategic pivot recommendations', '5 synthetic user interviews'],
  },
  {
    icon: '✂',
    accent: '#C45A5A',
    title: 'MVP Scalpel',
    description: 'Cuts your idea to its essential core. Defines the smallest version that earns your first dollar.',
    outputs: ['Feature kill list', 'Weekend sprint spec', 'Time-to-first-dollar estimate'],
  },
]

export function AgentGrid() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [hoveredAgent, setHoveredAgent] = useState<number | null>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="agents" ref={sectionRef} style={{
      padding: 'clamp(64px, 8vw, 112px) 24px',
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      {/* Header */}
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
          The Workforce
        </p>
        <h2 style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 800,
          color: 'var(--text)',
          margin: '0 0 16px',
          letterSpacing: '-0.02em',
        }}>
          Your Startup Workforce
        </h2>
        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '17px',
          color: 'var(--text-soft)',
          maxWidth: '480px',
          margin: '0 auto',
          lineHeight: 1.6,
        }}>
          9 specialized agents. One coherent outcome. Every output builds on the last.
        </p>
      </div>

      {/* Featured Full Launch card */}
      <div
        style={{
          borderRadius: 'var(--radius-xl)',
          background: `linear-gradient(135deg, ${FEATURED.accent}12, ${FEATURED.accent}06)`,
          border: `1px solid ${FEATURED.accent}30`,
          padding: 'clamp(20px, 4vw, 36px)',
          marginBottom: '24px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 'clamp(16px, 3vw, 32px)',
          alignItems: 'center',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s 0.1s ease, transform 0.6s 0.1s ease, border-color var(--transition-fast), box-shadow var(--transition-fast)',
          cursor: 'default',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = `${FEATURED.accent}60`
          e.currentTarget.style.boxShadow = `0 24px 48px -12px ${FEATURED.accent}20`
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = `${FEATURED.accent}30`
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--radius-md)',
              background: `${FEATURED.accent}20`,
              border: `1px solid ${FEATURED.accent}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              color: FEATURED.accent,
              flexShrink: 0,
            }}>
              {FEATURED.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  fontSize: '22px',
                  fontWeight: 800,
                  color: 'var(--text)',
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}>
                  {FEATURED.title}
                </h3>
                <span style={{
                  padding: '2px 10px',
                  borderRadius: '999px',
                  background: `${FEATURED.accent}20`,
                  color: FEATURED.accent,
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                }}>
                  RECOMMENDED
                </span>
              </div>
              <p style={{
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '13px',
                color: 'var(--muted)',
                margin: '2px 0 0',
              }}>
                {FEATURED.tagline}
              </p>
            </div>
          </div>
          <p style={{
            fontFamily: 'var(--font-dm-sans), sans-serif',
            fontSize: '15px',
            color: 'var(--text-soft)',
            margin: 0,
            lineHeight: 1.65,
            maxWidth: '560px',
          }}>
            {FEATURED.description}
          </p>
        </div>

        {/* Sub-agents */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}>
          {FEATURED.subAgents.map((sub, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              background: `${sub.accent}12`,
              border: `1px solid ${sub.accent}25`,
            }}>
              <span style={{ fontSize: '14px', color: sub.accent }}>{sub.icon}</span>
              <span style={{
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-soft)',
                whiteSpace: 'nowrap',
              }}>
                {sub.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Agent grid */}
      <div className="agent-grid-cards" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '16px',
      }}>
        {AGENTS.map((agent, i) => (
          <div
            key={i}
            onMouseEnter={() => setHoveredAgent(i)}
            onMouseLeave={() => setHoveredAgent(null)}
            style={{
              borderRadius: 'var(--radius-lg)',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--glass-border)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              opacity: visible ? 1 : 0,
              transform: visible
                ? (hoveredAgent === i ? 'translateY(-5px) scale(1.01)' : 'translateY(0) scale(1)')
                : 'translateY(32px) scale(1)',
              transition: `opacity 0.5s ${0.15 + i * 0.05}s ease, transform 0.5s ${0.15 + i * 0.05}s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease, border-color 0.2s ease`,
              boxShadow: hoveredAgent === i ? `0 16px 40px -8px ${agent.accent}30` : 'none',
              borderLeft: `3px solid ${hoveredAgent === i ? agent.accent : agent.accent + '80'}`,
              cursor: 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px', color: agent.accent }}>{agent.icon}</span>
                <span style={{
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--text)',
                }}>
                  {agent.title}
                </span>
              </div>
              <span style={{
                padding: '2px 8px',
                borderRadius: '999px',
                background: `${agent.accent}15`,
                color: agent.accent,
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                flexShrink: 0,
              }}>
                AI
              </span>
            </div>

            <p style={{
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontSize: '14px',
              color: 'var(--text-soft)',
              margin: 0,
              lineHeight: 1.55,
            }}>
              {agent.description}
            </p>

            {/* Outputs — always shown */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              paddingTop: '8px',
              borderTop: '1px solid var(--border)',
            }}>
              {agent.outputs.map((out, j) => (
                <div key={j} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  fontSize: '12px',
                  color: 'var(--muted)',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                }}>
                  <span style={{ color: agent.accent, fontSize: '10px', flexShrink: 0 }}>▸</span>
                  {out}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 640px) {
          #agents > div:nth-child(2) {
            grid-template-columns: 1fr !important;
          }
          .agent-grid-cards {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
