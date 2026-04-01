'use client'

import { useRouter } from 'next/navigation'

const LINKS = {
  Product: [
    { label: 'Features', id: 'features' },
    { label: 'Agents', id: 'agents' },
    { label: 'Pricing', id: 'pricing' },
    { label: 'Compare', id: 'compare' },
  ],
  Resources: [
    { label: 'Sign Up', href: '/signup' },
    { label: 'Sign In', href: '/signin' },
    { label: 'Dashboard', href: '/dashboard' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/legal/privacy-policy' },
    { label: 'Terms of Service', href: '/legal/terms-of-service' },
    { label: 'Refund Policy', href: '/pricing' },
  ],
}

const CONTACT_EMAILS = [
  { label: 'Support', email: 'support@forze.ai' },
  { label: 'Business', email: 'business@forze.ai' },
]

const SOCIAL_LINKS = [
  { label: '𝕏', href: 'https://x.com/ArhamBegani', title: 'Twitter/X' },
  { label: 'in', href: 'https://www.linkedin.com/in/arhambegani/', title: 'LinkedIn' },
]

export function Footer() {
  const router = useRouter()

  const handleLink = (item: { id?: string; href?: string }) => {
    if (item.id) {
      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
    } else if (item.href && item.href !== '#') {
      router.push(item.href)
    }
  }

  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--sidebar)',
    }}>
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '64px 24px 32px',
      }}>
        {/* Top section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr repeat(4, 1fr)',
          gap: '40px',
          marginBottom: '56px',
        }}>
          {/* Brand column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px', color: 'var(--accent)', filter: 'drop-shadow(0 0 6px var(--accent-glow))' }}>⬡</span>
              <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontWeight: 700, fontSize: '16px', letterSpacing: '0.12em', color: 'var(--text)' }}>FORZE</span>
            </div>
            <p style={{
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontSize: '14px',
              color: 'var(--muted)',
              lineHeight: 1.65,
              margin: 0,
              maxWidth: '260px',
            }}>
              Your Startup Workforce. Transform a raw idea into a market-validated venture in under 5 minutes.
            </p>
            {/* Social & Contact Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Social Links */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {SOCIAL_LINKS.map(s => (
                  <a
                    key={s.label}
                    href={s.href}
                    title={s.title}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--text-soft)',
                      textDecoration: 'none',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.color = 'var(--accent)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.color = 'var(--text-soft)'
                    }}
                  >
                    {s.label}
                  </a>
                ))}
              </div>
              {/* Contact Emails */}
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                {CONTACT_EMAILS.map(c => (
                  <a
                    key={c.email}
                    href={`mailto:${c.email}`}
                    style={{
                      color: 'var(--muted)',
                      textDecoration: 'none',
                      transition: 'color var(--transition-fast)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text-soft)' }}>{c.label}:</span> {c.email}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([col, items]) => (
            <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '4px',
              }}>
                {col}
              </div>
              {items.map(item => (
                <button
                  key={item.label}
                  onClick={() => handleLink(item)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    fontSize: '14px',
                    color: 'var(--muted)',
                    textAlign: 'left',
                    transition: 'color var(--transition-fast)',
                    fontWeight: 400,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          paddingTop: '24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          <span style={{
            fontFamily: 'var(--font-dm-sans), sans-serif',
            fontSize: '13px',
            color: 'var(--muted)',
          }}>
            © 2026 Forze. All rights reserved.
          </span>
          <span style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '12px',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span style={{ color: 'var(--accent)' }}>⬡</span>
            Built with AI · Powered by Gemini
          </span>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          footer > div > div:first-child {
            grid-template-columns: 1fr 1fr !important;
            gap: 28px !important;
          }
        }
        @media (max-width: 480px) {
          footer > div > div:first-child {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
        }
      `}</style>
    </footer>
  )
}
