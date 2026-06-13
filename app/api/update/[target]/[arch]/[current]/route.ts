// GET /api/update/[target]/[arch]/[current]
// Tauri v2 updater feed. The IDE's tauri.conf.json points its `endpoints` here
// with the {{target}}/{{arch}}/{{current_version}} template. We answer in
// Tauri's dynamic-update format:
//   • 204 No Content        → the client is already on the latest version.
//   • 200 { version, ... }  → an update exists; body carries the signed bundle.
//
// PUBLIC by design: the updater runs inside the desktop app with no web
// session, so it can't pass the user's auth cookie. The initial download
// (/api/download) is gated; updates are left open because the bundle is signed
// — a tampered payload fails signature verification on the client. To gate
// updates later, bake a per-user license token into the app and check it here.
import { NextRequest, NextResponse } from 'next/server'

import {
  getIdeManifest,
  isValidPlatformKey,
  isNewerVersion,
} from '@/lib/ide-release'

type RouteContext = {
  params: Promise<{ target: string; arch: string; current: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { target, arch, current } = await params

  // Tauri sends target ("windows"/"darwin"/"linux") and arch ("x86_64"/
  // "aarch64") separately; our manifest keys them as "{target}-{arch}".
  const key = `${target}-${arch}`
  if (!isValidPlatformKey(key)) {
    // Unknown platform → nothing to offer. 204 keeps the client quiet.
    return new NextResponse(null, { status: 204 })
  }

  const manifest = await getIdeManifest()
  if (!isNewerVersion(manifest.version, current)) {
    return new NextResponse(null, { status: 204 })
  }

  const update = manifest.platforms[key]
  if (!update?.url || !update.signature) {
    // We have a newer version but no signed bundle for this platform — don't
    // offer an unverifiable update.
    return new NextResponse(null, { status: 204 })
  }

  return NextResponse.json({
    version: manifest.version,
    pub_date: manifest.pubDate,
    url: update.url,
    signature: update.signature,
    notes: manifest.notes ?? '',
  })
}
