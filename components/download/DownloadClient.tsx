'use client'

import React, { useEffect, useMemo, useState } from 'react'

import type { IdeOs, IdePlatformKey } from '@/lib/ide-release'

export interface DownloadItem {
  key: IdePlatformKey
  label: string
  os: IdeOs
  arch: string
  ext: string
  available: boolean
}

interface DownloadClientProps {
  version: string | null
  pubDate: string | null
  items: DownloadItem[]
  // False until IDE_MANIFEST_URL is wired — drives the "coming soon" notice.
  configured: boolean
}

// Best-effort OS guess from the browser. Apple Silicon vs Intel can't be told
// apart from the UA reliably, so on macOS we default the primary CTA to Apple
// Silicon (the overwhelming majority of new Macs) and surface Intel below.
function detectPrimaryKey(): IdePlatformKey | null {
  if (typeof navigator === 'undefined') return null
  const uaData = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData
  const platform = (uaData?.platform || navigator.platform || '').toLowerCase()
  const ua = navigator.userAgent.toLowerCase()

  if (platform.includes('win') || ua.includes('windows')) return 'windows-x86_64'
  if (platform.includes('mac') || ua.includes('mac os') || ua.includes('macintosh')) {
    return 'darwin-aarch64'
  }
  if (platform.includes('linux') || ua.includes('linux')) return 'linux-x86_64'
  return null
}

export function DownloadClient({ version, pubDate, items, configured }: DownloadClientProps) {
  const [primaryKey, setPrimaryKey] = useState<IdePlatformKey | null>(null)

  useEffect(() => {
    setPrimaryKey(detectPrimaryKey())
  }, [])

  const primary = useMemo(
    () => items.find((i) => i.key === primaryKey) ?? null,
    [items, primaryKey]
  )
  // Everything that isn't the detected primary, for the "other platforms" row.
  const others = useMemo(
    () => items.filter((i) => i.key !== primary?.key),
    [items, primary]
  )

  const releasedOn = useMemo(() => {
    if (!pubDate) return null
    const t = new Date(pubDate).getTime()
    if (!Number.isFinite(t) || t <= 0) return null
    return new Date(t).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }, [pubDate])

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-16 text-[var(--text)]">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--text-soft)]">
          Forze IDE
          {version && version !== '0.0.0' && (
            <span className="font-mono text-[var(--accent)]">v{version}</span>
          )}
        </span>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Download Forze IDE
        </h1>
        <p className="mt-3 max-w-xl text-sm text-[var(--text-soft)] sm:text-base">
          Your venture workforce, on the desktop. Pick your platform below — the
          IDE keeps itself up to date automatically after install.
        </p>

        {!configured && (
          <div className="mt-8 w-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-soft)]">
            No build has been published yet. Downloads light up here as soon as
            the first release lands.
          </div>
        )}

        {/* Primary CTA — the detected platform. */}
        {primary && (
          <div className="mt-10 w-full">
            <PrimaryButton item={primary} />
          </div>
        )}

        {/* Other platforms. */}
        <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
          {others.map((item) => (
            <SecondaryButton key={item.key} item={item} />
          ))}
        </div>

        {releasedOn && (
          <p className="mt-8 text-xs text-[var(--muted)]">Released {releasedOn}</p>
        )}
      </div>
    </main>
  )
}

function PrimaryButton({ item }: { item: DownloadItem }) {
  const disabled = !item.available
  return (
    <a
      href={disabled ? undefined : `/api/download/${item.key}`}
      aria-disabled={disabled}
      className={`flex w-full flex-col items-center gap-1 rounded-xl px-6 py-4 text-center transition-opacity ${
        disabled
          ? 'cursor-not-allowed border border-[var(--border)] bg-[var(--card)] text-[var(--muted)]'
          : 'bg-[var(--accent)] text-white hover:opacity-90'
      }`}
    >
      <span className="text-base font-semibold">
        {disabled ? 'Coming soon' : `Download for ${item.label}`}
      </span>
      <span className="text-xs opacity-80">
        {item.arch} · {item.ext}
      </span>
    </a>
  )
}

function SecondaryButton({ item }: { item: DownloadItem }) {
  const disabled = !item.available
  return (
    <a
      href={disabled ? undefined : `/api/download/${item.key}`}
      aria-disabled={disabled}
      className={`flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3 text-sm transition-colors ${
        disabled
          ? 'cursor-not-allowed text-[var(--muted)]'
          : 'text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--text)]'
      }`}
    >
      <span className="font-medium">{item.label}</span>
      <span className="font-mono text-xs text-[var(--muted)]">
        {disabled ? '—' : item.ext}
      </span>
    </a>
  )
}
