import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://forze.in'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep crawlers out of app/auth/private surfaces — they redirect or
        // require a session and carry no SEO value.
        disallow: ['/dashboard/', '/api/', '/auth/', '/investor/', '/feedback/', '/v/', '/sites/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
