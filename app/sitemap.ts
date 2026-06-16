import type { MetadataRoute } from 'next'

// Public, indexable routes. Auth-gated/app routes (dashboard, api, auth, the
// gated /download, per-venture pages) are intentionally excluded — they redirect
// or require a session, so they shouldn't be in the sitemap.
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://forze.in'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const routes: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
    { path: '', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/ide', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/pricing', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/blog', priority: 0.6, changeFrequency: 'daily' },
    { path: '/legal/privacy-policy', priority: 0.3, changeFrequency: 'monthly' },
    { path: '/legal/terms-of-service', priority: 0.3, changeFrequency: 'monthly' },
  ]

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }))
}
