// lib/billing-http.ts
// Thin Next.js adapters around the plain-throwing assertCanAccessFeature /
// assertCanPerformAction guards in lib/billing-queries.ts. Each helper takes
// the same arguments as the underlying assert plus converts a thrown
// BillingError into a NextResponse so route handlers can write:
//
//   const gate = await gateFeatureForResponse(session.userId, 'crm')
//   if (!gate.ok) return gate.response
//
// Non-BillingError failures rethrow so the route's existing catch (generic
// 500) still applies. Unlimited-override users always pass through.

import { NextResponse } from 'next/server'
import type { ActionId, FeatureId } from '@/lib/billing'
import {
  assertCanAccessFeature,
  assertCanPerformAction,
  BillingError,
  type BillingSnapshot,
} from '@/lib/billing-queries'

export type GateResult =
  | { ok: true; snapshot: BillingSnapshot }
  | { ok: false; response: NextResponse }

function billingErrorToResponse(err: BillingError): NextResponse {
  return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
}

export async function gateFeatureForResponse(userId: string, featureId: FeatureId): Promise<GateResult> {
  try {
    const snapshot = await assertCanAccessFeature(userId, featureId)
    return { ok: true, snapshot }
  } catch (err) {
    if (err instanceof BillingError) return { ok: false, response: billingErrorToResponse(err) }
    throw err
  }
}

export async function gateActionForResponse(userId: string, actionId: ActionId): Promise<GateResult> {
  try {
    const snapshot = await assertCanPerformAction(userId, actionId)
    return { ok: true, snapshot }
  } catch (err) {
    if (err instanceof BillingError) return { ok: false, response: billingErrorToResponse(err) }
    throw err
  }
}
