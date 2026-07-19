import { NextRequest, NextResponse } from 'next/server'
import { createAnalyticsEvent } from '@/lib/queries'
import { clientIpKey, enforceAnonRateLimit, PUBLIC_TRACK_LIMIT, PUBLIC_WINDOW_SEC } from '@/lib/rate-limit'
import { logError } from '@/lib/log'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const EVENT_TYPE_RE = /^[a-z0-9_.\-:]{1,64}$/i
const MAX_METADATA_BYTES = 4 * 1024 // 4 KB cap so visitors can't bloat the row

function sanitizeMetadata(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {}
  try {
    const json = JSON.stringify(meta)
    if (json.length > MAX_METADATA_BYTES) return {}
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ventureId = (await params).id

    if (!UUID_RE.test(ventureId)) {
      // Tracking is fire-and-forget — never fail the page over an invalid id
      return NextResponse.json({ success: false, ignored: true }, { status: 200, headers: corsHeaders })
    }

    // Anonymous endpoint — cap per IP so bots can't bloat analytics rows.
    // Tracking is fire-and-forget, so over-limit still returns 200 (ignored)
    // rather than erroring the visitor's page.
    const rl = await enforceAnonRateLimit(
      clientIpKey(req),
      `public-track:${ventureId}`,
      PUBLIC_WINDOW_SEC,
      PUBLIC_TRACK_LIMIT
    )
    if (!rl.allowed) {
      return NextResponse.json({ success: false, ignored: true }, { status: 200, headers: corsHeaders })
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const eventType = typeof body.event_type === 'string' ? body.event_type.trim() : ''

    if (!eventType || !EVENT_TYPE_RE.test(eventType)) {
      return NextResponse.json({ error: 'event_type is required' }, { status: 400, headers: corsHeaders })
    }

    const safeMetadata = sanitizeMetadata((body as Record<string, unknown>).metadata)
    const event = await createAnalyticsEvent(ventureId, eventType, safeMetadata)

    return NextResponse.json({ success: true, event }, { headers: corsHeaders })
  } catch (error) {
    logError('ventures/id/track', error, { msg: 'Error creating analytics event' })
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500, headers: corsHeaders })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
