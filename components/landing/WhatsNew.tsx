'use client'

import { useEffect, useRef, useState } from 'react'

const RELEASES = [
  {
    icon: '◎',
    accent: '#C4975A',
    tag: 'Autopilot',
    title: 'A weekly agenda that runs itself',
    description: 'Connect Google Calendar and Autopilot builds your week: what is booked, which posts are waiting on approval, how many new leads landed, and which replies still have nobody on them.',
    proof: 'Calendar sync · approval queue · one operating view',
  },
  {
    icon: '⊙',
    accent: '#5A8CA5',
    tag: 'Autopilot',
    title: 'Event Radar finds the rooms worth being in',
    description: 'A web-search pass surfaces real conferences, meetups, and demo days for your market, scores each one against your venture, and flags the ones that collide with something already on your calendar.',
    proof: 'Real URLs only · relevance score · conflict detection',
  },
  {
    icon: '❞',
    accent: '#8C5A7A',
    tag: 'Autopilot',
    title: 'Comment Scout drafts the reply, you send it',
    description: 'It finds live discussions on LinkedIn, Reddit, Hacker News, and industry forums where your experience actually helps, then writes the comment in your voice — a contribution, not an advert.',
    proof: '40-120 words · no pitch in the opener · first person',
  },
  {
    icon: '◇',
    accent: '#B8864E',
    tag: 'Outreach',
    title: 'AI Lead Scout builds the list for you',
    description: 'Forze drafts your ideal customer profile, then runs a web-search pass to find real prospects that match it. An email is only ever returned if it literally appeared in a source the scout read.',
    proof: 'Never pattern-guesses an address · every lead marked unverified',
  },
  {
    icon: '◈',
    accent: '#7A5A8C',
    tag: 'Brand',
    title: 'One voice across every channel',
    description: 'Brand Voice plus the real palette Inspiration measured now feed the cold-email, LinkedIn, and Instagram generators — so a generated post image uses your actual brand colors instead of a generic guess.',
    proof: 'Shared by email · LinkedIn · Instagram · generated art',
  },
  {
    icon: '❝',
    accent: '#B86A8E',
    tag: 'Proof',
    title: 'Collect testimonials, publish the wall',
    description: 'Request testimonials, review what comes back, and publish the ones you want straight onto your live landing page. Social proof stops being a thing you keep meaning to chase.',
    proof: 'Request · approve · publish to the live page',
  },
  {
    icon: '◍',
    accent: '#5A8C6E',
    tag: 'Teams',
    title: 'Bring the rest of the founding team',
    description: 'Invite co-founders and collaborators into a venture as admin, editor, or viewer. Everyone works against the same venture context, the same CRM, and the same live page.',
    proof: 'Admin · editor · viewer roles',
  },
]

export function WhatsNew() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="whats-new" ref={sectionRef} style={{
      padding: 'clamp(64px, 8vw, 112px) 24px',
      maxWidth: '1200px',
      margin: '0 auto',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        top: '4%',
        left: '-10%',
        width: '520px',
        height: '520px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, hsla(28,62%,42%,0.10) 0%, transparent 70%)',
        animation: 'blob-float 16s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        marginBottom: '56px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px 6px 8px',
          borderRadius: '999px',
          background: 'var(--accent-soft)',
          border: '1px solid var(--accent-glow)',
          marginBottom: '16px',
        }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: '999px',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}>
            NEW
          </span>
          <span style={{
            fontFamily: 'var(--font-dm-sans), sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--accent)',
          }}>
            Shipped since your last look
          </span>
        </div>
        <h2 style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 800,
          color: 'var(--text)',
          margin: '0 0 16px',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}>
          Forze stopped waiting for you to log in
        </h2>
        <p style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '17px',
          color: 'var(--text-soft)',
          maxWidth: '640px',
          margin: '0 auto',
          lineHeight: 1.6,
        }}>
          The newest work is all about the days between runs — the events worth attending, the threads worth replying to, the leads worth chasing, and the week worth planning.
        </p>
      </div>

      <div className="whats-new-grid" style={{
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px',
      }}>
        {RELEASES.map((item, i) => (
          <div
            key={item.title}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--glass-border)',
              borderTop: `2px solid ${hovered === i ? item.accent : `${item.accent}70`}`,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              opacity: visible ? 1 : 0,
              transform: visible
                ? (hovered === i ? 'translateY(-5px)' : 'translateY(0)')
                : 'translateY(32px)',
              transition: `opacity 0.5s ${0.1 + i * 0.06}s ease, transform 0.5s ${0.1 + i * 0.06}s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease, border-top-color 0.2s ease`,
              boxShadow: hovered === i ? `0 18px 44px -10px ${item.accent}35` : 'none',
              cursor: 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-sm)',
                background: `${item.accent}18`,
                border: `1px solid ${item.accent}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
                color: item.accent,
                flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <span style={{
                padding: '2px 9px',
                borderRadius: '999px',
                background: `${item.accent}15`,
                color: item.accent,
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}>
                {item.tag}
              </span>
              <span style={{
                marginLeft: 'auto',
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: '9px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                flexShrink: 0,
              }}>
                NEW
              </span>
            </div>

            <h3 style={{
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
            }}>
              {item.title}
            </h3>

            <p style={{
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontSize: '14px',
              color: 'var(--text-soft)',
              margin: 0,
              lineHeight: 1.6,
              flex: 1,
            }}>
              {item.description}
            </p>

            <p style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '11px',
              color: item.accent,
              margin: 0,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: `${item.accent}10`,
              border: `1px solid ${item.accent}20`,
              lineHeight: 1.5,
            }}>
              {item.proof}
            </p>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .whats-new-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
