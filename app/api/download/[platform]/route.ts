// GET /api/download/[platform]
// Gated installer download. requireAuth() enforces "logged-in users only", then
// we 302 to the installer URL from the IDE manifest. The browser downloads
// directly from the bucket — the platform never proxies the bytes.
//
// HARDENING (v1.5): swap `installer.url` for a freshly-generated short-lived
// signed bucket URL so a leaked redirect target expires. Auth is already
// enforced here, so the current redirect is only ever issued to a signed-in
// user; the signed-URL step just shrinks the window on the resolved link.
import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, isAuthError } from '@/lib/auth'
import { getIdeManifest, isValidPlatformKey } from '@/lib/ide-release'

type RouteContext = { params: Promise<{ platform: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  // Browser navigation, not fetch() — on 401 send the user to sign in and
  // bounce back to the download page rather than returning bare JSON.
  try {
    await requireAuth()
  } catch (e) {
    if (isAuthError(e)) {
      const signin = new URL('/signin', req.url)
      signin.searchParams.set('redirect', '/download')
      return NextResponse.redirect(signin)
    }
    throw e
  }

  const { platform } = await params
  if (!isValidPlatformKey(platform)) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 404 })
  }

  const manifest = await getIdeManifest()
  const installer = manifest.installers[platform]
  if (!installer?.url) {
    return NextResponse.json(
      { error: 'No build is available for this platform yet.' },
      { status: 503 }
    )
  }

  return NextResponse.redirect(installer.url, 302)
}
