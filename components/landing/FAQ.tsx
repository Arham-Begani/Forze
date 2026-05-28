'use client'

import { useEffect, useRef, useState } from 'react'

const FAQS = [
  {
    q: 'What does Forze actually do?',
    a: 'Forze is an autonomous startup workforce. You describe an idea once and 11 connected AI agents take it through research, branding, a live landing page, feasibility analysis, multi-channel marketing, a CRM, and cold outreach. You walk away with a deployed venture — not a folder of prompts and PDFs.',
  },
  {
    q: 'How is Forze different from ChatGPT?',
    a: 'ChatGPT gives you disconnected answers. Forze gives you a connected venture. Research drives positioning, positioning drives the brand, the brand drives the landing page, the landing page captures leads into a real CRM, and outreach sends real campaigns to those leads. Every agent shares the same venture context — the value is the continuity, not just the text.',
  },
  {
    q: 'Do I need technical skills to use Forze?',
    a: 'None. You describe your idea in plain English. Forze handles the research, positioning, deployed landing page, CRM, outreach campaigns, feasibility modeling, and investor materials. If you can explain the problem clearly, you can run a venture on Forze.',
  },
  {
    q: 'How long does a Full Launch take?',
    a: 'Typically 3-7 minutes. Research, branding, landing page deployment, and feasibility analysis run in parallel and stay context-connected — so you get a usable launched venture in one pass instead of stitching outputs together manually.',
  },
  {
    q: 'What can the landing page actually do?',
    a: 'It is a real deployed page on a real URL with lead capture, analytics, and design grounded in your inspiration sources (paste Stripe, Linear, anything — Forze measures the real fonts and colors and applies them). Leads land directly in the built-in CRM. You can edit any section by chatting with the agent.',
  },
  {
    q: 'How do the CRM and Outreach modules work?',
    a: 'The CRM is your lead inbox — every signup from your landing page lands here, with history, tags, and 1:1 or bulk email send. Outreach builds full cold-email campaigns: lead enrichment, sequence drafting, dispatch, and reply tracking. You can also publish drafts directly to LinkedIn and Instagram from your connected accounts.',
  },
  {
    q: 'What does the Shadow Board do?',
    a: 'Three adversarial AI personas — Silicon Skeptic, UX Evangelist, Growth Alchemist — simulate a hard board review. They attack CAC assumptions, onboarding risk, and strategic weakness so you find the cracks before the market does. You get a Venture Survival Score, pivot recommendations, and synthetic user feedback.',
  },
  {
    q: 'Is the Investor Kit based on my real venture data?',
    a: 'Yes. It is not a generic template. Investor Kit pulls from your venture research, feasibility findings, brand context, and live landing-page proof — then packages a memo, deck outline, ask details, and data room summary that defends itself in a real conversation.',
  },
  {
    q: 'How do credits and plans work?',
    a: 'Credits refresh every Monday 00:00 IST. Free gets 10/week, Builder gets 60/week with Outreach + CRM + Inspiration unlocked, Studio gets 600/week with unlimited sends. Top-ups never expire. Simple agents cost 1 credit, Full Launch costs 30. Free + Starter focus on validation; Builder and up run the full workforce.',
  },
  {
    q: 'Can I edit the outputs?',
    a: 'Yes. Every agent supports edit mode — describe the change you want and Forze updates only the relevant section instead of regenerating from scratch. Re-run any single module without losing the rest of the venture context.',
  },
  {
    q: 'What happens to my venture data?',
    a: 'Your data is stored securely in your account and is not shared with other users. You own the outputs — the research, landing page, CRM leads, campaigns, and investor materials. Delete your account at any time to remove everything.',
  },
]

export function FAQ() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={sectionRef} style={{
      padding: 'clamp(64px, 8vw, 112px) 24px',
      maxWidth: '760px',
      margin: '0 auto',
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '56px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        <p style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 12px' }}>
          FAQ
        </p>
        <h2 style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
          Questions answered
        </h2>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {FAQS.map((faq, i) => {
          const isOpen = openIdx === i
          return (
            <div
              key={faq.q}
              style={{
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                borderLeft: isOpen ? '3px solid var(--accent)' : '3px solid transparent',
                background: isOpen ? 'var(--glass-bg)' : 'transparent',
                backdropFilter: isOpen ? 'blur(var(--glass-blur))' : 'none',
                WebkitBackdropFilter: isOpen ? 'blur(var(--glass-blur))' : 'none',
                overflow: 'hidden',
                transition: 'background var(--transition-smooth), border-color var(--transition-smooth), border-left-color var(--transition-smooth), transform var(--transition-fast), box-shadow var(--transition-fast)',
                borderColor: isOpen ? 'hsla(28,62%,42%,0.25)' : 'var(--border)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(16px)',
                transitionDelay: visible ? `${i * 0.07}s` : '0s',
                boxShadow: isOpen ? '0 8px 24px -4px hsla(28,62%,42%,0.12)' : 'none',
                animation: isOpen ? 'border-glow 3s ease-in-out infinite' : 'none',
              }}
            >
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                onMouseEnter={e => {
                  if (!isOpen) (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'hsla(28,62%,42%,0.25)'
                }}
                onMouseLeave={e => {
                  if (!isOpen) (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'var(--border)'
                }}
                style={{
                  width: '100%',
                  padding: '18px 20px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: isOpen ? 'var(--accent)' : 'var(--text)',
                  transition: 'color var(--transition-fast)',
                  lineHeight: 1.4,
                }}>
                  {faq.q}
                </span>
                <span style={{
                  fontSize: '18px',
                  color: isOpen ? 'var(--accent)' : 'var(--muted)',
                  flexShrink: 0,
                  transition: 'transform var(--transition-smooth), color var(--transition-fast)',
                  transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                  display: 'inline-block',
                  lineHeight: 1,
                }}>
                  +
                </span>
              </button>

              {isOpen && (
                <div style={{
                  padding: '0 20px 20px',
                  animation: 'slide-down 0.25s ease both',
                }}>
                  <p style={{
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-soft)',
                    margin: 0,
                    lineHeight: 1.7,
                    paddingTop: '16px',
                    borderTop: '1px solid var(--border)',
                  }}>
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
