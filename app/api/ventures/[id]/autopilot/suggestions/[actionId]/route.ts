import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth, isAuthError } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { updateSuggestedActionStatus } from '@/lib/queries/autopilot-queries'
import { logError } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string; actionId: string }> }

const patchSchema = z.object({
  status: z.enum(['done', 'dismissed']),
})

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'autopilot')
    if (!gate.ok) return gate.response

    const { id, actionId } = await params
    const venture = await getVenture(id, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    const body = await req.json().catch(() => null)
    const input = patchSchema.safeParse(body)
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const updated = await updateSuggestedActionStatus(actionId, session.userId, input.data.status)
    if (!updated) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('ventures/autopilot/suggestions', e, { msg: 'suggestion update failed' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
