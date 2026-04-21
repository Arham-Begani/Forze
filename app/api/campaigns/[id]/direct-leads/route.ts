// POST /api/campaigns/:campaignId/direct-leads — upload recipients for the
// Direct Mail channel. Unlike /leads, a name is not required: the route runs
// deriveFirstNameFromEmail() on every row the caller left blank so the
// downstream send path (which always personalizes {{firstName}}) still has a
// sensible value.
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { UploadDirectRecipientsSchema } from '@/lib/schemas/campaign'
import {
  getCampaignForUser,
  createCampaignLeads,
  getLeadEmailsForCampaign,
} from '@/lib/queries/campaign-queries'
import { validateEmail, normalizeEmail } from '@/lib/email-utils'
import { deriveFirstNameFromEmail } from '@/lib/auto-name'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await requireAuth()
    const { id } = await params

    const campaign = await getCampaignForUser(id, session.userId)
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const body = await req.json()
    const input = UploadDirectRecipientsSchema.safeParse(body)
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }

    const existingEmails = new Set(await getLeadEmailsForCampaign(id))

    const valid: Array<{ first_name: string; email: string }> = []
    const invalidEmails: string[] = []
    const duplicatesSkipped: string[] = []

    for (const r of input.data.recipients) {
      const normalized = normalizeEmail(r.email)
      if (!validateEmail(normalized)) {
        invalidEmails.push(r.email)
        continue
      }
      if (existingEmails.has(normalized)) {
        duplicatesSkipped.push(normalized)
        continue
      }
      existingEmails.add(normalized)

      // Operator-supplied names win; otherwise derive from the local part so
      // {{firstName}} substitutions don't emit the literal "there" fallback
      // unless the email truly is role-based (info@, support@, …).
      const first_name = (r.first_name && r.first_name.trim()) || deriveFirstNameFromEmail(normalized)

      valid.push({ first_name, email: normalized })
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
    console.error('[campaigns/direct-leads] POST error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
