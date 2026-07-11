import 'server-only'

import crypto from 'crypto'

type RazorpayMethod = 'GET' | 'POST'

function requireRazorpayKeys() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured')
  }

  return { keyId, keySecret }
}

async function razorpayRequest<T>(
  method: RazorpayMethod,
  path: string,
  payload?: Record<string, unknown>
): Promise<T> {
  const { keyId, keySecret } = requireRazorpayKeys()

  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: payload ? JSON.stringify(payload) : undefined,
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Razorpay API error (${res.status}): ${body}`)
  }

  return res.json() as Promise<T>
}

export interface RazorpaySubscriptionResponse {
  id: string
  plan_id: string
  status: string
  short_url?: string
}

export interface RazorpayOrderResponse {
  id: string
  amount: number
  currency: string
  status: string
}

export async function createRazorpaySubscription(input: {
  planId: string
  totalCount?: number
  notes: Record<string, string>
}): Promise<RazorpaySubscriptionResponse> {
  return razorpayRequest<RazorpaySubscriptionResponse>('POST', '/subscriptions', {
    plan_id: input.planId,
    total_count: input.totalCount ?? 60,
    customer_notify: 1,
    notes: input.notes,
  })
}

export async function createRazorpayOrder(input: {
  amountInr: number
  receipt: string
  notes: Record<string, string>
}): Promise<RazorpayOrderResponse> {
  return razorpayRequest<RazorpayOrderResponse>('POST', '/orders', {
    amount: input.amountInr * 100,
    currency: 'INR',
    receipt: input.receipt,
    notes: input.notes,
  })
}

export async function cancelRazorpaySubscription(subscriptionId: string) {
  return razorpayRequest('POST', `/subscriptions/${subscriptionId}/cancel`, {
    cancel_at_cycle_end: 1,
  })
}

export function verifyRazorpayPaymentSignature(input: {
  orderId?: string | null
  paymentId: string
  subscriptionId?: string | null
  signature: string
}): boolean {
  const { keySecret } = requireRazorpayKeys()
  const payload = input.subscriptionId
    ? `${input.paymentId}|${input.subscriptionId}`
    : `${input.orderId}|${input.paymentId}`

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(payload)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature))
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET must be configured')
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export function hashWebhookPayload(rawBody: string): string {
  return crypto.createHash('sha256').update(rawBody).digest('hex')
}
