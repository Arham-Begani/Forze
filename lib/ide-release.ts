// lib/ide-release.ts
// Single source of truth for Forze IDE releases. The IDE lives in a separate
// repo (a Tauri app); its CI uploads installers + signed update bundles to a
// bucket and writes ONE combined manifest.json in the `IdeManifest` shape
// below. This module reads that manifest. Nothing about the IDE's build lives
// here — the only link between the two projects is the manifest URL.
//
// Two consumers read this:
//   • /download + /api/download/[platform]  — the gated installer download.
//   • /api/update/[target]/[arch]/[current] — the public Tauri updater feed.
//
// NOTE: deliberately NOT marked `server-only`. The reader uses env + fetch
// (server-only at runtime), but the constants/types are imported (type-only)
// by the client download UI. Never call getIdeManifest() from a client module.

// Platform keys are Tauri's `{target}-{arch}` identifiers, reused verbatim for
// the installer map so the download page and the updater speak one vocabulary.
export const IDE_PLATFORM_KEYS = [
  'windows-x86_64',
  'darwin-aarch64',
  'darwin-x86_64',
  'linux-x86_64',
] as const

export type IdePlatformKey = (typeof IDE_PLATFORM_KEYS)[number]

export type IdeOs = 'windows' | 'macos' | 'linux'

export interface IdePlatformMeta {
  label: string
  os: IdeOs
  arch: string
  // File extension shown on the button (informational only).
  ext: string
}

export const IDE_PLATFORM_META: Record<IdePlatformKey, IdePlatformMeta> = {
  'windows-x86_64': { label: 'Windows', os: 'windows', arch: 'x64', ext: '.exe' },
  'darwin-aarch64': { label: 'macOS — Apple Silicon', os: 'macos', arch: 'arm64', ext: '.dmg' },
  'darwin-x86_64': { label: 'macOS — Intel', os: 'macos', arch: 'x64', ext: '.dmg' },
  'linux-x86_64': { label: 'Linux — AppImage', os: 'linux', arch: 'x64', ext: '.AppImage' },
}

// One installer file per platform — what the download button hands the user.
export interface IdeInstaller {
  url: string
  size?: number | null
}

// One update bundle per platform — what the Tauri updater downloads. Different
// file from the installer (e.g. macOS update = .app.tar.gz, not the .dmg) and
// carries a detached signature from the IDE's private signing key.
export interface IdeUpdateTarget {
  signature: string
  url: string
}

export interface IdeManifest {
  version: string
  // ISO 8601. Shown on the download page and passed through to the updater.
  pubDate: string
  notes?: string
  installers: Partial<Record<IdePlatformKey, IdeInstaller>>
  platforms: Partial<Record<IdePlatformKey, IdeUpdateTarget>>
}

// Returned before the IDE pipeline has published anything (no IDE_MANIFEST_URL).
// Lets /download render ("coming soon" buttons) and the routes 503 cleanly
// instead of throwing during local dev.
const STUB_MANIFEST: IdeManifest = {
  version: '0.0.0',
  pubDate: '1970-01-01T00:00:00.000Z',
  notes: 'No build published yet — set IDE_MANIFEST_URL to the IDE CI manifest.',
  installers: {},
  platforms: {},
}

export function isManifestConfigured(): boolean {
  return Boolean(process.env.IDE_MANIFEST_URL)
}

// Fetches the combined manifest the IDE CI publishes. Cached 60s — new releases
// surface within a minute without hammering the bucket on every download click.
export async function getIdeManifest(): Promise<IdeManifest> {
  const url = process.env.IDE_MANIFEST_URL
  if (!url) return STUB_MANIFEST

  const res = await fetch(url, { next: { revalidate: 60 } })
  // 404 = no release published yet (the bucket key doesn't exist until the IDE
  // CI runs once). That's an expected pre-launch state, not an error — fall
  // back to the stub so /download shows "coming soon" and the routes 503/204
  // cleanly instead of 500-ing. Other failures still throw so a genuinely
  // broken URL surfaces in logs (callers catch and degrade).
  if (res.status === 404) return STUB_MANIFEST
  if (!res.ok) {
    throw new Error(`IDE manifest fetch failed: ${res.status} ${res.statusText}`)
  }
  // Trust-but-shape: the CI writes this file, so we don't Zod-validate the
  // whole tree, but we do guarantee the two maps exist so callers can index
  // safely.
  const data = (await res.json()) as Partial<IdeManifest>
  return {
    version: typeof data.version === 'string' ? data.version : '0.0.0',
    pubDate: typeof data.pubDate === 'string' ? data.pubDate : STUB_MANIFEST.pubDate,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    installers: data.installers ?? {},
    platforms: data.platforms ?? {},
  }
}

export function isValidPlatformKey(value: string): value is IdePlatformKey {
  return (IDE_PLATFORM_KEYS as readonly string[]).includes(value)
}

// Strict-greater dotted-numeric compare (1.2.0 > 1.1.9). Pre-release tags are
// ignored — fine for the updater's "is there something newer?" question.
export function isNewerVersion(latest: string, current: string): boolean {
  const a = latest.split('.').map((n) => parseInt(n, 10) || 0)
  const b = current.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}
