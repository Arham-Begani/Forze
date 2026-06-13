// /download — gated installer download page for Forze IDE.
// Server component: enforces "logged-in users only" before rendering, then
// hands the manifest to a client child for OS auto-detection. Unauthenticated
// visitors bounce to /signin and return here after login.
import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth'
import {
  getIdeManifest,
  isManifestConfigured,
  IDE_PLATFORM_KEYS,
  IDE_PLATFORM_META,
} from '@/lib/ide-release'
import { DownloadClient, type DownloadItem } from '@/components/download/DownloadClient'

export const metadata = {
  title: 'Download Forze IDE',
  description: 'Download the Forze IDE desktop app.',
}

export default async function DownloadPage() {
  const session = await getSession()
  if (!session) {
    redirect('/signin?redirect=/download')
  }

  // Never let a transient manifest-fetch failure 500 the page — degrade to
  // "coming soon" buttons instead.
  const manifest = await getIdeManifest().catch(() => null)

  const items: DownloadItem[] = IDE_PLATFORM_KEYS.map((key) => ({
    key,
    ...IDE_PLATFORM_META[key],
    available: Boolean(manifest?.installers?.[key]?.url),
  }))

  return (
    <DownloadClient
      version={manifest?.version ?? null}
      pubDate={manifest?.pubDate ?? null}
      items={items}
      configured={isManifestConfigured()}
    />
  )
}
