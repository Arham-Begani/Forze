// Server layout for tenant landing pages. Exists solely to attach real
// server-rendered <head> metadata (title/description/OG/Twitter/canonical +
// JSON-LD) sourced from the venture's generated seoMetadata. The page itself
// stays a client component that renders the landing page in an iframe — but
// crawlers and social unfurlers read THIS head, so shared tenant links finally
// show a real title/description instead of nothing.

import type { Metadata } from 'next'
import { getVentureBySubdomain } from '@/lib/queries'

interface LayoutParams {
  params: Promise<{ subdomain: string }>
}

function canonicalUrl(subdomain: string | null | undefined): string | undefined {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '')
  if (!raw || !subdomain) return undefined
  try {
    const host = new URL(raw).host.replace(/^www\./, '')
    return `https://${subdomain}.${host}`
  } catch {
    return undefined
  }
}

export async function generateMetadata({ params }: LayoutParams): Promise<Metadata> {
  const { subdomain } = await params
  const venture = await getVentureBySubdomain(subdomain).catch(() => null)

  const landing = (venture?.context as { landing?: { seoMetadata?: { title?: string; description?: string; keywords?: string[] } } } | undefined)?.landing
  const seo = landing?.seoMetadata ?? {}
  const title = (seo.title || venture?.name || 'Landing Page').slice(0, 120)
  const description = seo.description ? seo.description.slice(0, 300) : undefined
  const keywords = Array.isArray(seo.keywords) && seo.keywords.length > 0 ? seo.keywords.slice(0, 15) : undefined
  const url = canonicalUrl(venture?.subdomain ?? subdomain)

  return {
    title,
    description,
    keywords,
    robots: venture ? { index: true, follow: true } : { index: false, follow: false },
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: venture?.name || undefined,
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function SubdomainLayout({ children, params }: LayoutParams & { children: React.ReactNode }) {
  const { subdomain } = await params
  const venture = await getVentureBySubdomain(subdomain).catch(() => null)
  const url = canonicalUrl(venture?.subdomain ?? subdomain)

  const jsonLd = venture
    ? {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: venture.name,
        ...(url ? { url } : {}),
      }
    : null

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          // Server-rendered, venture-name only — no user-controlled HTML.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      {children}
    </>
  )
}
