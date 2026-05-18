// GET /api/admin/integrations/instagram-debug
//
// Admin-only. Returns the exact values Forze would send to Instagram when a
// user clicks "Connect Instagram" right now: the literal META_CLIENT_ID env
// var, the redirect_uri this request would build, the full authorize URL.
//
// Reading the actual server-side values is the only way to rule out:
//   • Vercel env var not updated (or scope/redeploy issue)
//   • Whitespace/quote characters that look identical but aren't
//   • host mismatch between www.forze.in / forze.in / preview URL
//   • client_id pointing at the wrong Meta app
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAuthError } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function mask(value: string | undefined | null): string {
  if (!value) return '(unset)'
  if (value.length <= 6) return value
  return `${value.slice(0, 4)}…${value.slice(-4)}  (len=${value.length})`
}

function nonPrintable(value: string | undefined | null): string {
  if (!value) return '(unset)'
  // Surface invisible chars: trailing whitespace, smart quotes, BOM, etc.
  const bytes: string[] = []
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    if (code < 32 || code === 127 || code > 126) {
      bytes.push(`U+${code.toString(16).padStart(4, '0').toUpperCase()}`)
    }
  }
  return bytes.length === 0 ? '(none)' : bytes.join(', ')
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const metaClientId = process.env.META_CLIENT_ID
    const metaClientSecret = process.env.META_CLIENT_SECRET
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    const requestOrigin = request.nextUrl.origin
    const redirectUri = `${requestOrigin}/api/integrations/instagram/callback`

    const params = new URLSearchParams({
      response_type: 'code',
      redirect_uri: redirectUri,
      state: 'DEBUG_STATE_DO_NOT_USE',
      client_id: metaClientId ?? '',
      scope: [
        'instagram_business_basic',
        'instagram_business_content_publish',
        'instagram_business_manage_comments',
        'instagram_business_manage_messages',
      ].join(','),
    })
    const authorizeUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`

    return NextResponse.json({
      server: {
        requestOrigin,
        redirectUri,
      },
      env: {
        META_CLIENT_ID_value: metaClientId ?? null,
        META_CLIENT_ID_masked: mask(metaClientId),
        META_CLIENT_ID_invisibleChars: nonPrintable(metaClientId),
        META_CLIENT_SECRET_present: Boolean(metaClientSecret),
        META_CLIENT_SECRET_length: metaClientSecret?.length ?? 0,
        NEXT_PUBLIC_APP_URL: appUrl ?? null,
      },
      authorizeUrlForzeWouldBuild: authorizeUrl,
      instructions: [
        '1. Compare META_CLIENT_ID_value EXACTLY against the "Instagram app ID" shown in Meta → your app → Instagram → API setup with Instagram business login.',
        '2. Confirm redirectUri is registered verbatim in Meta → Business login settings → OAuth redirect URIs.',
        '3. Open authorizeUrlForzeWouldBuild directly in the browser (in an incognito window, signed into the Instagram account you want to connect) — if you get the same "Invalid platform app" error, the client_id is wrong or the app is in Dev mode without you as a tester.',
        '4. If META_CLIENT_ID_invisibleChars shows anything other than "(none)", you have hidden whitespace or BOM in the env var — re-paste it cleanly.',
      ],
    })
  } catch (error) {
    if (isAuthError(error)) return error.toResponse()
    const message = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
