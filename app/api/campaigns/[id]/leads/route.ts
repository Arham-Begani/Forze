// POST /api/campaigns/:campaignId/leads — upload leads
// GET  /api/campaigns/:campaignId/leads — list leads with pagination
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { UploadLeadsSchema } from '@/lib/schemas/campaign'
import { getCampaignForUser, createCampaignLeads, getCampaignLeads, getLeadEmailsForCampaign } from '@/lib/queries/campaign-queries'
import { validateEmail, normalizeEmail } from '@/lib/email-utils'
import { gateFeatureForResponse } from '@/lib/billing-http'
import { logError } from '@/lib/log'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(
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

    const { searchParams } = req.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)))

    const { leads, total } = await getCampaignLeads(id, page, limit)
    return NextResponse.json({ leads, total, page, limit, pages: Math.ceil(total / limit) })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('campaigns/id/leads', e, { msg: '[campaigns/leads] GET error' })
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

    const body = await req.json()
    const input = UploadLeadsSchema.safeParse(body)
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    // Get existing emails to detect duplicates
    const existingEmails = new Set(await getLeadEmailsForCampaign(id))

    const valid: typeof input.data.leads = []
    const invalidEmails: string[] = []
    const duplicatesSkipped: string[] = []

    for (const lead of input.data.leads) {
      const normalized = normalizeEmail(lead.email)
      if (!validateEmail(normalized)) {
        invalidEmails.push(lead.email)
        continue
      }
      if (existingEmails.has(normalized)) {
        duplicatesSkipped.push(normalized)
        continue
      }
      existingEmails.add(normalized)
      valid.push({ ...lead, email: normalized })
    }

    let leadsCreated = 0
    if (valid.length > 0) {
      await createCampaignLeads(id, valid)
      leadsCreated = valid.length
    }

    return NextResponse.json({
      leadsCreated,
      duplicatesSkipped: duplicatesSkipped.length,
      invalidEmails,
    }, { status: 201 })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('campaigns/id/leads', e, { msg: '[campaigns/leads] POST error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
