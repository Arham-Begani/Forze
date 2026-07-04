// GET  /api/campaigns/:campaignId/leads/from-crm — CRM leads eligible to enroll
// POST /api/campaigns/:campaignId/leads/from-crm — enroll selected CRM leads
//
// The bridge between the venture's CRM lead pool (`leads`, populated by the
// landing page) and campaign recipients (`campaign_leads`). Enrolled rows
// carry a lead_id back-link (migration 041) so sends and replies advance the
// CRM lead's status automatically.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, isAuthError } from '@/lib/auth'
import { getCampaignForUser } from '@/lib/queries/campaign-queries'
import { createDb } from '@/lib/db'
import { gateFeatureForResponse } from '@/lib/billing-http'

type RouteContext = { params: Promise<{ id: string }> }

const EnrollSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(2000),
})

function deriveFirstName(email: string, name?: string | null): string {
  if (name && name.trim()) return name.trim().split(/\s+/)[0].slice(0, 100)
  const token = (email.split('@')[0] ?? '').split(/[._\-+]/).filter(Boolean)[0] ?? ''
  if (!token || /^\d+$/.test(token)) return 'Friend'
  return (token.charAt(0).toUpperCase() + token.slice(1)).slice(0, 100)
}

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'outreach')
    if (!gate.ok) return gate.response

    const { id } = await params
    const campaign = await getCampaignForUser(id, session.userId)
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const db = await createDb()

    // Emails already in this campaign — surfaced so the UI can show
    // "already enrolled" instead of a silent dedupe surprise at send time.
    const { data: existingRows } = await db
      .from('campaign_leads')
      .select('email')
      .eq('campaign_id', id)
    const enrolledEmails = new Set(
      (existingRows ?? []).map((r: { email: string }) => r.email.toLowerCase())
    )

    // Only email-reachable CRM leads qualify (social-only leads have no email).
    const { data: leadRows, error } = await db
      .from('leads')
      .select('id, email, name, status, source, company, created_at')
      .eq('venture_id', campaign.venture_id)
      .not('email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (error) throw new Error(error.message)

    const leads = (leadRows ?? []).map((l) => ({
      ...l,
      alreadyEnrolled: enrolledEmails.has(((l.email as string) ?? '').toLowerCase()),
    }))

    return NextResponse.json({ leads })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[campaigns/leads/from-crm] GET error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const gate = await gateFeatureForResponse(session.userId, 'outreach')
    if (!gate.ok) return gate.response

    const { id } = await params
    const campaign = await getCampaignForUser(id, session.userId)
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const input = EnrollSchema.safeParse(await req.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const db = await createDb()

    // Scope the requested ids to this campaign's venture — an id belonging
    // to someone else's venture is silently dropped (RLS is the backstop).
    const { data: leadRows, error } = await db
      .from('leads')
      .select('id, email, name, company')
      .eq('venture_id', campaign.venture_id)
      .in('id', input.data.leadIds)
      .not('email', 'is', null)

    if (error) throw new Error(error.message)
    const leads = leadRows ?? []
    if (leads.length === 0) {
      return NextResponse.json({ error: 'No matching email-reachable leads' }, { status: 404 })
    }

    const rows = leads.map((l) => ({
      campaign_id: id,
      lead_id: l.id,
      first_name: deriveFirstName(l.email as string, l.name),
      email: (l.email as string).trim().toLowerCase(),
      company: l.company ?? null,
      source: 'manual' as const,
      source_context: { enrolledFrom: 'crm' },
      engagement_status: 'fresh' as const,
      send_status: 'pending' as const,
      verified: false,
    }))

    const { data: inserted, error: upsertError } = await db
      .from('campaign_leads')
      .upsert(rows, { onConflict: 'campaign_id,email', ignoreDuplicates: true })
      .select('id')

    if (upsertError) throw new Error(upsertError.message)

    const enrolled = (inserted ?? []).length
    return NextResponse.json({
      enrolled,
      duplicatesSkipped: rows.length - enrolled,
      requested: input.data.leadIds.length,
    })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    console.error('[campaigns/leads/from-crm] POST error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
