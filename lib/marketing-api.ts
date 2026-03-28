import 'server-only'

import { AuthError, isAuthError, requireAuth } from '@/lib/auth'
import { BillingError, assertCanAccessMarketingAutomation } from '@/lib/billing-queries'
import { isSocialProvider, type SocialProvider } from '@/lib/marketing.shared'
import { getVenture } from '@/lib/queries'
import { NextResponse } from 'next/server'

export function parseSocialProvider(value: string): SocialProvider | null {
  return isSocialProvider(value) ? value : null
}

export function marketingErrorResponse(error: unknown): NextResponse {
  if (isAuthError(error)) return error.toResponse()

  if (error instanceof BillingError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }

  const message = error instanceof Error ? error.message : 'Internal error'
  return NextResponse.json({ error: message }, { status: 500 })
}

export async function requireMarketingSession() {
  const session = await requireAuth()
  const billing = await assertCanAccessMarketingAutomation(session.userId)
  return { session, billing }
}

export async function requireMarketingVenture(ventureId: string) {
  const { session, billing } = await requireMarketingSession()
  const venture = await getVenture(ventureId, session.userId)
  if (!venture) {
    throw new AuthError()
  }

  return { session, billing, venture }
}
