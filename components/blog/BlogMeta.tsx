import type { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || 'https://forze.in'

export interface BlogMetaInput {
  title: string
  description: string
  slug: string
  ogImage?: string | null
  canonicalUrl?: string | null
  publishedAt?: string | null
  authorName: string
}

export function generateBlogMetadata(meta: BlogMetaInput): Metadata {
  const canonical = meta.canonicalUrl || `${BASE_URL}/blog/${meta.slug}`

  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonical,
      type: 'article',
      images: meta.ogImage ? [{ url: meta.ogImage, width: 1200, height: 630 }] : undefined,
      authors: [meta.authorName],
      publishedTime: meta.publishedAt ?? undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: meta.ogImage ? [meta.ogImage] : undefined,
    },
  }
}

interface BlogSchemaProps extends BlogMetaInput {
  publishedAt: string
  modifiedAt?: string | null
}

export function BlogSchemaMarkup({
  title,
  description,
  slug,
  publishedAt,
  modifiedAt,
  authorName,
  ogImage,
}: BlogSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    image: ogImage || `${BASE_URL}/api/og`,
    datePublished: publishedAt,
    dateModified: modifiedAt || publishedAt,
    author: {
      '@type': 'Person',
      name: authorName,
      url: `${BASE_URL}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Forze',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/favicon.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/blog/${slug}`,
    },
  }

  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
