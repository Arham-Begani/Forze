import type { Metadata } from 'next'

import { IdeLandingPage } from '@/components/ide-landing/IdeLandingPage'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://forze.in'

export const metadata: Metadata = {
  title: 'Forze IDE — The Sovereign OS for Startup Founders',
  description:
    'Forze is a local-first desktop IDE for founders: code, run AI agents, deploy to Vercel, track analytics, manage tasks, and build in public — all in one window. macOS, Windows & Linux.',
  keywords: [
    'founder IDE',
    'AI coding agents desktop',
    'all-in-one developer tool',
    'local-first IDE',
    'Claude Code orchestration',
    'indie hacker tools',
    'vibe coding',
  ],
  alternates: { canonical: `${BASE_URL}/ide` },
  openGraph: {
    title: 'Forze IDE — The Sovereign OS for Startup Founders',
    description:
      'A real desktop IDE that doesn\'t stop at the editor — code, command AI agents, deploy, track, and build in public from one local-first window. macOS, Windows & Linux.',
    type: 'website',
    url: `${BASE_URL}/ide`,
    images: [
      {
        url: `${BASE_URL}/api/og`,
        width: 1200,
        height: 630,
        alt: 'Forze IDE — the Sovereign OS for startup founders',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Forze IDE — The Sovereign OS for Startup Founders',
    description:
      'Code, command AI agents, deploy to Vercel, track, and build in public — all in one local-first window. macOS, Windows & Linux.',
    images: [`${BASE_URL}/api/og`],
  },
}

export default function IdeRoutePage() {
  return <IdeLandingPage />
}
