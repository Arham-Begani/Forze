'use client'

import { useEffect, useRef, useState } from 'react'

const ROWS = [
  { feature: 'Market Research', forze: true, freelancers: 'weeks', chatbots: 'partial', tools: 'manual' },
  { feature: 'Brand Identity', forze: true, freelancers: 'expensive', chatbots: 'partial', tools: 'manual' },
  { feature: 'Live Landing Page', forze: true, freelancers: 'weeks', chatbots: false, tools: false },
  { feature: 'Feasibility Study', forze: true, freelancers: 'expensive', chatbots: false, tools: false },
  { feature: 'Go-to-Market Plan', forze: true, freelancers: 'weeks', chatbots: 'partial', tools: false },
  { feature: 'Shadow Board Review', forze: true, freelancers: false, chatbots: false, tools: false },
  { feature: 'Cross-agent context', forze: true, freelancers: 'manual', chatbots: false, tools: false },
  { feature: 'Financial Projections', forze: true, freelancers: 'expensive', chatbots: false, tools: false },
]

const META = [
  { key: 'time', label: 'Time to complete', forze: '~5 minutes', freelancers: '6–12 weeks', chatbots: 'Hours', tools: 'Days' },
  { key: 'cost', label: 'Cost', forze: 'From ₹0', freelancers: '₹4L–₹16L', chatbots: '₹1,700/mo', tools: '₹4,000–20K/mo' },
]

type CellValue = boolean | string

function Cell({ value, isForze, animDelay }: { value: CellValue; isForze?: boolean; animDelay?: string }) {
  if (value === true) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: isForze ? '#22c55e20' : '#22c55e15',
          border: `1.5px solid ${isForze ? '#22c55e' : '#22c55e60'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: '#22c55e',
          flexShrink: 0,
          animation: `badge-pop 0.4s ${animDelay ?? '0s'} cubic-bezier(0.34,1.56,0.64,1) both`,
        }}>
          ✓
        </div>
      </div>
    )
  }
  if (value === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: '#ef444410',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: 'var(--muted)',
          flexShrink: 0,
        }}>
          —
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <span style={{
        fontFamily: 'var(--font-dm-sans), sans-serif',
        fontSize: '12px',
        color: 'var(--muted)',
        fontWeight: 500,
      }}>
        {value as string}
      </span>
    </div>
  )
}

export function ComparisonTable() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Mobile: card-based layout
  if (isMobile) {
    const COLS = [
      { label: 'Freelancers', key: 'freelancers' as const },
      { label: 'AI Chatbots', key: 'chatbots' as const },
      { label: 'Other Tools', key: 'tools' as const },
    ]
    return (
      <section id="compare" ref={sectionRef} style={{
        padding: 'clamp(48px, 8vw, 112px) 16px',
        maxWidth: '1000px',
        margin: '0 auto',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '36px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}>
          <p style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 12px' }}>
            Compared
          </p>
          <h2 style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: 'clamp(24px, 6vw, 44px)', fontWeight: 800, color: 'var(--text)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            5 minutes vs everything else.
          </h2>
          <p style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '15px', color: 'var(--text-soft)', margin: '0 auto', lineHeight: 1.6 }}>
            Forze replaces months of work.
          </p>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: '12px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s 0.15s ease, transform 0.6s 0.15s ease',
        }}>
          {ROWS.map((row, i) => (
            <div key={i} style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              background: 'var(--glass-bg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                  {row.feature}
                </span>
                <Cell value={row.forze} isForze animDelay={`${0.1 + i * 0.06}s`} />
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {COLS.map(col => (
                  <div key={col.key} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px', borderRadius: '999px',
                    background: 'var(--sidebar)', fontSize: '11px',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    color: 'var(--muted)',
                  }}>
                    <span style={{ fontWeight: 600 }}>{col.label}:</span>
                    {row[col.key] === true ? <span style={{ color: '#22c55e' }}>✓</span> :
                     row[col.key] === false ? <span>—</span> :
                     <span>{row[col.key] as string}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Meta cards */}
          {META.map(row => (
            <div key={row.key} style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              background: 'var(--sidebar)',
              padding: '16px',
            }}>
              <div style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                {row.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '11px', color: 'var(--muted)' }}>Forze</span>
                <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>{row.forze}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Freelancers', val: row.freelancers },
                  { label: 'AI Chatbots', val: row.chatbots },
                  { label: 'Other Tools', val: row.tools },
                ].map(item => (
                  <span key={item.label} style={{
                    padding: '3px 8px', borderRadius: '999px',
                    background: 'var(--bg)', fontSize: '11px',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    color: 'var(--muted)',
                  }}>
                    {item.label}: {item.val}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section id="compare" ref={sectionRef} style={{
      padding: 'clamp(64px, 8vw, 112px) 24px',
      maxWidth: '1000px',
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
        <p style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 12px' }}>
          Why Forze
        </p>
        <h2 style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: 'var(--text)', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
          Everything else is a fragment.
        </h2>
        <p style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '17px', color: 'var(--text-soft)', maxWidth: '440px', margin: '0 auto', lineHeight: 1.6 }}>
          Forze is the whole picture.
        </p>
      </div>

      {/* Table */}
      <div style={{
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.6s 0.15s ease, transform 0.6s 0.15s ease',
      }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr',
          background: 'var(--sidebar)',
          borderBottom: '1px solid var(--border)',
          padding: '0',
        }}>
          <div style={{ padding: '16px 20px', fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Feature
          </div>
          {[
            { label: 'Forze', highlight: true },
            { label: 'Freelancers', highlight: false },
            { label: 'AI Chatbots', highlight: false },
            { label: 'Other Tools', highlight: false },
          ].map((col) => (
            <div key={col.label} style={{
              padding: '16px 12px',
              textAlign: 'center',
              background: col.highlight ? 'hsla(28,62%,42%,0.06)' : 'transparent',
              borderLeft: col.highlight ? '1px solid hsla(28,62%,42%,0.2)' : '1px solid var(--border)',
              borderRight: col.highlight ? '1px solid hsla(28,62%,42%,0.2)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span style={{
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                color: col.highlight ? 'var(--accent)' : 'var(--text)',
              }}>
                {col.label}
              </span>
              {col.highlight && (
                <span style={{
                  padding: '1px 8px',
                  borderRadius: '999px',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                }}>
                  BEST
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Feature rows */}
        {ROWS.map((row, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr',
            borderBottom: '1px solid var(--border)',
            background: i % 2 === 0 ? 'transparent' : 'hsla(0,0%,0%,0.015)',
            transition: 'background var(--transition-fast)',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-soft)')}
            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'hsla(0,0%,0%,0.015)')}
          >
            <div style={{ padding: '13px 20px', fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '14px', color: 'var(--text-soft)', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
              {row.feature}
            </div>
            <div style={{ padding: '13px 12px', display: 'flex', alignItems: 'center', background: 'hsla(28,62%,42%,0.04)', borderLeft: '1px solid hsla(28,62%,42%,0.15)', borderRight: '1px solid hsla(28,62%,42%,0.15)' }}>
              <Cell value={row.forze} isForze animDelay={`${0.1 + i * 0.06}s`} />
            </div>
            <div style={{ padding: '13px 12px', display: 'flex', alignItems: 'center', borderLeft: '1px solid var(--border)' }}>
              <Cell value={row.freelancers} animDelay={`${0.15 + i * 0.06}s`} />
            </div>
            <div style={{ padding: '13px 12px', display: 'flex', alignItems: 'center', borderLeft: '1px solid var(--border)' }}>
              <Cell value={row.chatbots} animDelay={`${0.2 + i * 0.06}s`} />
            </div>
            <div style={{ padding: '13px 12px', display: 'flex', alignItems: 'center', borderLeft: '1px solid var(--border)' }}>
              <Cell value={row.tools} />
            </div>
          </div>
        ))}

        {/* Meta rows */}
        {META.map((row, i) => (
          <div key={row.key} style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr',
            borderBottom: i < META.length - 1 ? '1px solid var(--border)' : 'none',
            background: 'var(--sidebar)',
          }}>
            <div style={{ padding: '14px 20px', fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '13px', color: 'var(--muted)', fontWeight: 600, display: 'flex', alignItems: 'center', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {row.label}
            </div>
            <div style={{ padding: '14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'hsla(28,62%,42%,0.06)', borderLeft: '1px solid hsla(28,62%,42%,0.2)', borderRight: '1px solid hsla(28,62%,42%,0.2)' }}>
              <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>{row.forze}</span>
            </div>
            {[row.freelancers, row.chatbots, row.tools].map((val, j) => (
              <div key={j} style={{ padding: '14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '12px', color: 'var(--muted)' }}>{val}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
