import { disconnectSocialConnection } from '@/lib/marketing-queries'
import { marketingErrorResponse, parseSocialProvider, requireMarketingSession } from '@/lib/marketing-api'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { session } = await requireMarketingSession()
    const { provider: rawProvider } = await params
    const provider = parseSocialProvider(rawProvider)
    if (!provider) {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 404 })
    }

    await disconnectSocialConnection(session.userId, provider)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
