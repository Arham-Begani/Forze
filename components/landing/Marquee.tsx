'use client'

import { useState } from 'react'

const ITEMS = [
  { label: 'Market Research', accent: '#5A8C6E' },
  { label: 'Brand Identity', accent: '#5A6E8C' },
  { label: 'Live Landing Page', accent: '#8C7A5A' },
  { label: 'Inspiration Engine', accent: '#5A8CA5' },
  { label: 'Go-to-Market Strategy', accent: '#8C5A7A' },
  { label: 'Feasibility Study', accent: '#7A5A8C' },
  { label: 'Smart CRM', accent: '#6B8F71' },
  { label: 'Outbound Campaigns', accent: '#B8864E' },
  { label: 'Direct Mail Generator', accent: '#A56B5A' },
  { label: 'LinkedIn + Instagram Publishing', accent: '#5A6E8C' },
  { label: 'Shadow Board Review', accent: '#E04848' },
  { label: 'Investor Kit', accent: '#7A8C5A' },
  { label: 'MVP Definition', accent: '#C45A5A' },
  { label: 'Financial Projections', accent: '#C4975A' },
  { label: 'Launch Autopilot', accent: '#C4975A' },
  { label: 'Advisor Co-pilot', accent: '#6B8F71' },
]

function Row({ reverse = false }: { reverse?: boolean }) {
  const doubled = [...ITEMS, ...ITEMS]
  const [paused, setPaused] = useState(false)
  return (
    <div
      style={{
        overflow: 'hidden',
        maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
        cursor: 'default',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div style={{
        display: 'flex',
        gap: '0',
        width: 'max-content',
        animation: `marquee ${reverse ? '35s' : '28s'} linear infinite ${reverse ? 'reverse' : ''}`,
        animationPlayState: paused ? 'paused' : 'running',
      }}>
        {doubled.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 24px',
              flexShrink: 0,
              transition: 'opacity var(--transition-fast)',
            }}
          >
            <span style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: item.accent,
              flexShrink: 0,
              boxShadow: `0 0 6px ${item.accent}60`,
              transition: `box-shadow var(--transition-fast)`,
            }} />
            <span style={{
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              color: paused ? 'var(--text)' : 'var(--text-soft)',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              transition: 'color var(--transition-fast)',
            }}>
              {item.label}
            </span>
            <span style={{ color: 'var(--border-strong)', fontSize: '14px', marginLeft: '14px' }}>·</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Marquee() {
  return (
    <section style={{
      background: 'var(--sidebar)',
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      padding: '16px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      overflow: 'hidden',
    }}>
      <Row />
      <Row reverse />
    </section>
  )
}
