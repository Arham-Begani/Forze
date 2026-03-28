import { encryptSecret } from '@/lib/marketing-crypto'
import {
  decodePendingOAuthState,
  exchangeProviderCode,
  getOAuthCookieName,
} from '@/lib/marketing-oauth'
import { parseSocialProvider, requireMarketingSession } from '@/lib/marketing-api'
import { upsertSocialConnection } from '@/lib/marketing-queries'
import { NextRequest, NextResponse } from 'next/server'

function buildRedirect(request: NextRequest, path: string, status: 'success' | 'error', provider: string, message?: string) {
  const url = new URL(path, request.url)
  url.searchParams.set('integrationStatus', status)
  url.searchParams.set('integrationProvider', provider)
  if (message) {
    url.searchParams.set('integrationMessage', message)
  }
  return url
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await params
  const provider = parseSocialProvider(rawProvider)
  if (!provider) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const cookieName = getOAuthCookieName(provider)
  const pendingState = decodePendingOAuthState(request.cookies.get(cookieName)?.value)
  const returnTo = pendingState?.returnTo ?? '/dashboard'

  try {
    const { session } = await requireMarketingSession()
    const error = request.nextUrl.searchParams.get('error')
    const errorDescription = request.nextUrl.searchParams.get('error_description')
    const state = request.nextUrl.searchParams.get('state')
    const code = request.nextUrl.searchParams.get('code')

    if (error) {
      const response = NextResponse.redirect(buildRedirect(request, returnTo, 'error', provider, errorDescription || error))
      response.cookies.delete(cookieName)
      return response
    }

    if (!pendingState || pendingState.provider !== provider || pendingState.userId !== session.userId || pendingState.state !== state || !code) {
      const response = NextResponse.redirect(buildRedirect(request, returnTo, 'error', provider, 'OAuth state validation failed'))
      response.cookies.delete(cookieName)
      return response
    }

    const redirectUri = `${request.nextUrl.origin}/api/integrations/${provider}/callback`
    const exchange = await exchangeProviderCode(provider, { code, redirectUri })

    await upsertSocialConnection({
      userId: session.userId,
      provider,
      providerAccountId: exchange.providerAccountId,
      providerAccountLabel: exchange.providerAccountLabel,
      accessTokenEncrypted: encryptSecret(exchange.accessToken),
      refreshTokenEncrypted: exchange.refreshToken === undefined ? undefined : encryptSecret(exchange.refreshToken),
      tokenExpiresAt: typeof exchange.expiresIn === 'number'
        ? new Date(Date.now() + exchange.expiresIn * 1000).toISOString()
        : null,
      scopes: exchange.scopes,
      metadata: exchange.metadata,
      status: 'active',
    })

    const response = NextResponse.redirect(buildRedirect(request, returnTo, 'success', provider))
    response.cookies.delete(cookieName)
    return response
  } catch (error) {
    const response = NextResponse.redirect(buildRedirect(
      request,
      returnTo,
      'error',
      provider,
      error instanceof Error ? error.message : 'Failed to connect account'
    ))
    response.cookies.delete(cookieName)
    return response
  }
}
