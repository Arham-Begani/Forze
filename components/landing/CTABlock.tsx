'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export function CTABlock() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.2 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={sectionRef} style={{
      padding: 'clamp(80px, 10vw, 128px) 24px',
      position: 'relative',
      overflow: 'hidden',
      textAlign: 'center',
    }}>
      {/* Gradient background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, hsla(28,62%,42%,0.10) 0%, hsla(210,50%,50%,0.05) 100%)',
        animation: 'gradient-shift 8s ease infinite',
      }} />
      {/* Center glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, hsla(28,62%,42%,0.18) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* Floating particles */}
      {[
        { top: '15%', left: '8%', size: 5, delay: '0s', duration: '4s' },
        { top: '72%', left: '12%', size: 3, delay: '0.8s', duration: '5s' },
        { top: '25%', left: '88%', size: 4, delay: '0.3s', duration: '4.5s' },
        { top: '65%', left: '82%', size: 6, delay: '1.2s', duration: '3.8s' },
        { top: '45%', left: '5%', size: 3, delay: '0.5s', duration: '5.2s' },
        { top: '80%', left: '55%', size: 4, delay: '1.8s', duration: '4.2s' },
      ].map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: p.top,
          left: p.left,
          width: `${p.size}px`,
          height: `${p.size}px`,
          borderRadius: '50%',
          background: 'var(--accent)',
          opacity: 0.3,
          pointerEvents: 'none',
          animation: `blob-float ${p.duration} ease-in-out infinite`,
          animationDelay: p.delay,
        }} />
      ))}

      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: '640px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--accent-soft)',
          border: '1px solid hsla(28,62%,42%,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '30px',
          color: 'var(--accent)',
          animation: 'glow-pulse 3s ease-in-out infinite',
        }}>
          ⬡
        </div>

        <h2 style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(32px, 5vw, 56px)',
          fontWeight: 800,
          color: 'var(--text)',
          margin: 0,
          letterSpacing: '-0.025em',
          lineHeight: 1.1,
        }}>
          Don't wait months to validate.<br />
          <span style={{
            background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Validate in 5 minutes.
          </span>
        </h2>

        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '18px',
          color: 'var(--text-soft)',
          margin: 0,
          lineHeight: 1.6,
        }}>
          Get market research, landing page, brand, and financial model instantly.
        </p>

        <button
          onClick={() => router.push('/signup')}
          style={{
            padding: '16px 40px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: '17px',
            fontWeight: 700,
            fontFamily: 'var(--font-dm-sans), sans-serif',
            boxShadow: '0 12px 36px -4px hsla(28,62%,42%,0.45)',
            transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
            letterSpacing: '0.01em',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-3px)'
            e.currentTarget.style.boxShadow = '0 20px 48px -4px hsla(28,62%,42%,0.55)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 12px 36px -4px hsla(28,62%,42%,0.45)'
          }}
        >
          Validate Your Idea Now →
        </button>

        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '13px',
          color: 'var(--muted)',
          margin: 0,
        }}>
          No card required. Free tier included.
        </p>
      </div>
    </section>
  )
}
