import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createOutreachCampaign, getLeadsForVenture, getVenture } from '@/lib/queries'

const DispatchSchema = z.object({
  campaignType: z.enum(['initial_outreach', 'follow_up', 'newsletter']),
  emailSubject: z.string().trim().min(1),
  emailBody: z.string().trim().min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ventureId = (await params).id
    const venture = await getVenture(ventureId, session.userId)
    if (!venture) return NextResponse.json({ error: 'Venture not found' }, { status: 404 })

    const input = DispatchSchema.safeParse(await req.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.flatten() }, { status: 400 })
    }
    const { campaignType, emailSubject, emailBody } = input.data

    // Fetch leads to send to
    const leads = await getLeadsForVenture(ventureId)
    const targetLeads = leads.filter(l => l.status !== 'lost' && Boolean(l.email))

    let sentCount = 0
    for (const lead of targetLeads) {
      if (lead.email) {
        // Dispatch logic would go here
        try {
          const text = emailBody.replace(/{{\s*name\s*}}/g, lead.name || 'there')
          console.log(`Mock dispatch to ${lead.email}: ${emailSubject}`, text)
          sentCount++
        } catch (e) {
          console.error(`Failed to send to ${lead.email}`, e)
        }
      }
    }

    const campaign = await createOutreachCampaign(ventureId, campaignType, {
      status: 'complete',
      sentCount,
    })
    
    return NextResponse.json({ success: true, campaign, sentCount })
  } catch (error: any) {
    console.error('Error dispatching outreach:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
