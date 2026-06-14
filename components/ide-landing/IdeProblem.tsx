'use client'

import { useEffect, useRef, useState } from 'react'

const SCATTERED = ['IDE', 'Deploy dashboard', 'Task tool', 'Analytics', 'Scheduler', 'Terminal', 'Terminal', 'Terminal', 'Terminal']

export function IdeProblem() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.25 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={sectionRef} style={{
      padding: 'clamp(56px, 7vw, 96px) 24px',
      maxWidth: '900px',
      margin: '0 auto',
      textAlign: 'center',
    }}>
      <div style={{
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
          The problem
        </p>
        <h2 style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(28px, 4.4vw, 48px)',
          fontWeight: 800,
          color: 'var(--text)',
          margin: '0 0 18px',
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
        }}>
          One window. Not twelve tabs.
        </h2>
        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '17px',
          color: 'var(--text-soft)',
          maxWidth: '640px',
          margin: '0 auto 36px',
          lineHeight: 1.65,
        }}>
          Your IDE. Plus a deploy dashboard. Plus a task tool. Plus an analytics tool. Plus a scheduler. Plus four terminals running AI agents that don&apos;t talk to each other.
        </p>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '520px' }}>
          {SCATTERED.map((tool, i) => (
            <span key={`${tool}-${i}`} style={{
              padding: '7px 14px',
              borderRadius: '999px',
              background: 'var(--glass-bg)',
              border: '1px dashed var(--border-strong)',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontSize: '13px',
              color: 'var(--muted)',
              textDecoration: 'line-through',
              textDecorationColor: 'var(--border-strong)',
              opacity: visible ? 0.7 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(8px)',
              transition: `opacity 0.4s ${0.2 + i * 0.05}s ease, transform 0.4s ${0.2 + i * 0.05}s ease`,
            }}>
              {tool}
            </span>
          ))}
        </div>

        <span style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '18px',
          color: 'var(--accent)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.5s 0.7s ease',
        }}>
          →
        </span>

        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          borderRadius: '999px',
          background: 'var(--accent)',
          color: '#fff',
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '15px',
          fontWeight: 700,
          boxShadow: 'var(--shadow-accent)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.9)',
          transition: 'opacity 0.5s 0.8s ease, transform 0.5s 0.8s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '12px', opacity: 0.85 }}>⬡</span>
          Forze
        </span>
      </div>
    </section>
  )
}
