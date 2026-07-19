// Read-only document rendering for the Landing module's result panel.
//
// Split out of page.tsx: this is a pure presentation tree — it takes a result
// object and renders it. Only LandingDoc is exported; the small Doc* helpers
// stay private to this file so the page can't grow new dependencies on them.

import React from 'react'
import ReactMarkdown from 'react-markdown'

import { docTitleStyle } from './_styles'

// ─── Document Sub-Components ─────────────────────────────────────────────────

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>{title}</h2>
      {children}
    </div>
  )
}

function DocKV({ label, value }: { label: string; value: any }) {
  if (!value) return null
  const str = typeof value === 'object' ? (value.value || value.name || JSON.stringify(value)) : String(value)
  return (
    <div style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
      <span style={{ width: 100, flexShrink: 0, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em', paddingTop: 2 }}>{label}</span>
      <span style={{ color: 'var(--text-soft)', lineHeight: 1.5 }}>{str}</span>
    </div>
  )
}

function DocList({ items }: { items: any[] }) {
  if (!items || items.length === 0) return null
  return (
    <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>
          {typeof item === 'object' ? (item.name || item.description || item.title || JSON.stringify(item)) : String(item)}
        </li>
      ))}
    </ul>
  )
}

function MarkdownBlock({ content }: { content: string }) {
  if (!content) return null
  return (
    <div className="doc-markdown" style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.7 }}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

export function LandingDoc({ result }: { result: Record<string, any> }) {
  if (!result) return <div style={{ color: 'var(--muted)', fontSize: 12 }}>No result data available yet.</div>
  const l = result.landing || result
  const copy = l.landingPageCopy || l.copy || {}
  const hero = copy.hero || {}
  const features = Array.isArray(copy.features) ? copy.features : []
  const socialProof = Array.isArray(copy.socialProof) ? copy.socialProof : []
  const pricing = Array.isArray(copy.pricing) ? copy.pricing : []
  const faq = Array.isArray(copy.faq) ? copy.faq : []
  const sitemap = Array.isArray(l.sitemap) ? l.sitemap : []
  const seo = l.seoMetadata || {}
  const deployUrl = l.deploymentUrl || result.deploymentUrl

  return (
    <>
      <h1 style={docTitleStyle}>Production Pipeline</h1>

      {/* Deployment Status Banner */}
      {deployUrl && (
        <div style={{ background: '#8C7A5A10', borderRadius: 10, padding: '14px 16px', border: '1px solid #8C7A5A24', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#8C7A5A', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em' }}>Live Preview</div>
            <a href={deployUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, textDecoration: 'none', wordBreak: 'break-all' }}>
              {deployUrl}
            </a>
          </div>
          <a href={deployUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 14px', background: '#8C7A5A', color: '#fff', borderRadius: 7, fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
            Open Site
          </a>
        </div>
      )}

      {/* Hero Section */}
      <DocSection title="Hero Section">
        <DocKV label="Headline" value={hero.headline} />
        <DocKV label="Subheadline" value={hero.subheadline} />
        <DocKV label="Primary CTA" value={hero.ctaPrimary} />
        <DocKV label="Secondary CTA" value={hero.ctaSecondary} />
      </DocSection>

      {/* Features */}
      {features.length > 0 && (
        <DocSection title={`Features (${features.length})`}>
          {features.map((f: any, i: number) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: i < features.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {f.icon && <span style={{ fontSize: 14 }}>{f.icon}</span>}
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{f.title}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6, margin: 0 }}>{f.description}</p>
            </div>
          ))}
        </DocSection>
      )}

      {/* Social Proof */}
      {socialProof.length > 0 && (
        <DocSection title="Social Proof">
          {socialProof.map((t: string, i: number) => (
            <div key={i} style={{ padding: '10px 12px', background: 'var(--glass-bg)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: i < socialProof.length - 1 ? 8 : 0 }}>
              <p style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{t}</p>
            </div>
          ))}
        </DocSection>
      )}

      {/* Pricing */}
      {pricing.length > 0 && (
        <DocSection title="Pricing Tiers">
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(pricing.length, 3)}, 1fr)`, gap: 10 }}>
            {pricing.map((p: any, i: number) => (
              <div key={i} style={{ padding: '14px', background: 'var(--glass-bg)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.tier}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#8C7A5A', letterSpacing: '-0.02em' }}>{p.price}</div>
                <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {(p.features || []).map((f: string, j: number) => (
                    <li key={j} style={{ fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.4 }}>{f}</li>
                  ))}
                </ul>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#8C7A5A', textTransform: 'uppercase', marginTop: 'auto', letterSpacing: '0.04em' }}>{p.cta}</div>
              </div>
            ))}
          </div>
        </DocSection>
      )}

      {/* FAQ */}
      {faq.length > 0 && (
        <DocSection title={`FAQ (${faq.length})`}>
          {faq.map((f: any, i: number) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: i < faq.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{f.question}</div>
              <p style={{ fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.6, margin: 0 }}>{f.answer}</p>
            </div>
          ))}
        </DocSection>
      )}

      {/* Sitemap */}
      {sitemap.length > 0 && (
        <DocSection title="Sitemap">
          {sitemap.map((s: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <span style={{ width: 100, flexShrink: 0, fontWeight: 600, color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', paddingTop: 2 }}>{s.path || s.page}</span>
              <div>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{s.page}</span>
                {s.purpose && <p style={{ fontSize: 11, color: 'var(--text-soft)', margin: '2px 0 0', lineHeight: 1.4 }}>{s.purpose}</p>}
              </div>
            </div>
          ))}
        </DocSection>
      )}

      {/* SEO */}
      {(seo.title || seo.description) && (
        <DocSection title="SEO Metadata">
          <DocKV label="Title" value={seo.title} />
          <DocKV label="Description" value={seo.description} />
          {Array.isArray(seo.keywords) && seo.keywords.length > 0 && (
            <div style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 12 }}>
              <span style={{ width: 100, flexShrink: 0, fontWeight: 600, color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', paddingTop: 2 }}>Keywords</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {seo.keywords.map((k: string, i: number) => (
                  <span key={i} style={{ padding: '2px 8px', background: 'var(--glass-bg)', borderRadius: 4, fontSize: 10, color: 'var(--text-soft)', border: '1px solid var(--border)' }}>{k}</span>
                ))}
              </div>
            </div>
          )}
        </DocSection>
      )}

      {/* Tech Stack */}
      <DocSection title="Tech Stack & Infrastructure">
        <DocKV label="Framework" value="Next.js 15 (App Router)" />
        <DocKV label="Styling" value="Tailwind CSS" />
        <DocKV label="Language" value="TypeScript / React" />
        <DocKV label="Hosting" value="Vercel (Edge)" />
        <DocKV label="Pipeline" value={deployUrl ? 'Deployed' : 'Generating...'} />
        <DocKV label="Lead Capture" value={l.leadCaptureActive ? 'Active' : 'Inactive'} />
        <DocKV label="Analytics" value={l.analyticsActive ? 'Active' : 'Ready for integration'} />
      </DocSection>
    </>
  )
}
