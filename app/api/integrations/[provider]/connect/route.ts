import { generateOpaqueToken } from '@/lib/marketing-crypto'
import {
  buildProviderAuthorizationUrl,
  encodePendingOAuthState,
  getOAuthCookieName,
  normalizeIntegrationReturnPath,
} from '@/lib/marketing-oauth'
import { marketingErrorResponse, parseSocialProvider, requireMarketingSession } from '@/lib/marketing-api'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const bodySchema = z.object({
  returnTo: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { session } = await requireMarketingSession()
    const { provider: rawProvider } = await params
    const provider = parseSocialProvider(rawProvider)
    if (!provider) {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 404 })
    }

    const payload = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!payload.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const state = generateOpaqueToken()
    const returnTo = normalizeIntegrationReturnPath(payload.data.returnTo)
    const redirectUri = `${request.nextUrl.origin}/api/integrations/${provider}/callback`
    const authUrl = buildProviderAuthorizationUrl(provider, { redirectUri, state })

    const response = NextResponse.json({ authUrl })
    response.cookies.set({
      name: getOAuthCookieName(provider),
      value: encodePendingOAuthState({
        state,
        provider,
        userId: session.userId,
        returnTo,
        createdAt: new Date().toISOString(),
      }),
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 60 * 10,
    })

    return response
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
