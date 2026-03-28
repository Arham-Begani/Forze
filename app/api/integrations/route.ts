import { listSocialConnectionsByUser } from '@/lib/marketing-queries'
import { marketingErrorResponse, requireMarketingSession } from '@/lib/marketing-api'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { session } = await requireMarketingSession()
    const connections = await listSocialConnectionsByUser(session.userId)
    return NextResponse.json({ connections })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}
