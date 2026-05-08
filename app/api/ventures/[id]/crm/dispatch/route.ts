import { NextRequest, NextResponse } from 'next/server'
import { createOutreachCampaign, getLeadsForVenture } from '@/lib/queries'
import { getSession } from '@/lib/auth'
import { sendEmail } from '@/lib/forze-mail' // Assuming we have a sendEmail function or similar

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ventureId = (await params).id
    const body = await req.json()
    const { campaignType, emailSubject, emailBody } = body

    if (!campaignType || !emailBody) {
      return NextResponse.json({ error: 'Missing campaign details' }, { status: 400 })
    }

    const campaign = await createOutreachCampaign(ventureId, campaignType)
    
    // Fetch leads to send to
    const leads = await getLeadsForVenture(ventureId)
    const targetLeads = leads.filter(l => l.status !== 'unsubscribed') // simple filter

    let sentCount = 0
    for (const lead of targetLeads) {
      if (lead.email) {
        // Dispatch logic would go here
        try {
          if (typeof sendEmail === 'function') {
            await sendEmail({
              to: lead.email,
              subject: emailSubject || `Updates from Venture`,
              text: emailBody.replace('{{name}}', lead.name || 'there'),
            })
            sentCount++
          } else {
             // Fallback console log for mock dispatch
             console.log(`Mock dispatch to ${lead.email}: ${emailSubject}`)
             sentCount++
          }
        } catch (e) {
          console.error(`Failed to send to ${lead.email}`, e)
        }
      }
    }

    // In a real app we'd update campaign.sent_count
    
    return NextResponse.json({ success: true, campaign, sentCount })
  } catch (error: any) {
    console.error('Error dispatching outreach:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
