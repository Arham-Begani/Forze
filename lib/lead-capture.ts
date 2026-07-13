import 'server-only'

// ─── Landing-page lead capture + campaign auto-enroll ─────────────────────────
//
// The public capture endpoint (/api/ventures/[id]/leads) is hit by deployed
// landing pages — visitors have no session, so after migration 034 enabled
// RLS on `leads` (venture-members-only policies) the anon session client can
// no longer insert there. Public unauthenticated writes use the admin client,
// the same pattern as the HMAC-verified tracking routes.
//
// Capture also closes the "page → pipeline" loop (migration 041): any of the
// venture's campaigns with auto_enroll_landing_leads = true gets the new lead
// appended as a pending recipient with a lead_id back-link. The outreach cron
// then emails them on the campaign's schedule — no manual CSV round-trip.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendLeadCapturedMail } from '@/lib/forze-mail'
import { enforceAnonRateLimit } from '@/lib/rate-limit'
import type { Lead } from '@/lib/queries'

function deriveFirstName(email: string, name?: string | null): string {
  if (name && name.trim()) return name.trim().split(/\s+/)[0].slice(0, 100)
  const local = email.split('@')[0] ?? ''
  const token = local.split(/[._\-+]/).filter(Boolean)[0] ?? ''
  if (!token || /^\d+$/.test(token)) return 'Friend'
  return (token.charAt(0).toUpperCase() + token.slice(1)).slice(0, 100)
}

export async function captureLandingLead(
  ventureId: string,
  input: { email: string; name?: string; source?: string }
): Promise<Lead> {
  const db = createAdminClient()

  const { data: lead, error } = await db
    .from('leads')
    .insert({
      venture_id: ventureId,
      email: input.email,
      name: input.name ?? null,
      source: input.source ?? 'landing_page',
    })
    .select()
    .single()

  if (error) throw new Error(`captureLandingLead failed: ${error.message}`)

  // Best-effort — a failed enroll must never lose the captured lead.
  try {
    await autoEnrollLeadInCampaigns(ventureId, lead as Lead)
  } catch (err) {
    console.error('[lead-capture] auto-enroll failed:', err)
  }

  // Best-effort founder alert — the landing page visibly working is the
  // product's core promise. A failed email must never lose the lead.
  try {
    await notifyOwnerOfLead(ventureId, lead as Lead)
  } catch (err) {
    console.error('[lead-capture] lead alert failed:', err)
  }

  return lead as Lead
}

// Emails the venture OWNER (v1: owner only, not all members) that a lead just
// arrived. Capped at 5 alerts/hour/venture via the anon rate limiter — keyed
// on ventureId, not IP, so a busy launch day floods the CRM, not the inbox.
// Fails open if migration 044 isn't applied (the per-IP capture limit already
// bounds raw volume), and silently no-ops when Resend isn't configured.
async function notifyOwnerOfLead(ventureId: string, lead: Lead): Promise<void> {
  if (!lead.email) return

  const rl = await enforceAnonRateLimit(ventureId, 'lead-alert', 3600, 5)
  if (!rl.allowed) return

  const db = createAdminClient()
  const { data: venture } = await db
    .from('ventures')
    .select('name, user_id')
    .eq('id', ventureId)
    .maybeSingle()
  if (!venture?.user_id) return

  const { data: owner } = await db
    .from('users')
    .select('email, name')
    .eq('id', venture.user_id)
    .maybeSingle()
  if (!owner?.email) return

  await sendLeadCapturedMail({
    to: owner.email,
    ownerName: owner.name ?? '',
    ventureId,
    ventureName: venture.name ?? 'your venture',
    leadEmail: lead.email as string,
    leadName: (lead as { name?: string | null }).name ?? null,
    source: (lead as { source?: string | null }).source ?? null,
  })
}

// Appends a CRM lead to every campaign of the venture that opted into
// auto-enroll and is still in a sendable state. Upsert on (campaign_id,
// email) keeps this idempotent — re-submitting the landing form doesn't
// create duplicate recipients.
export async function autoEnrollLeadInCampaigns(ventureId: string, lead: Lead): Promise<number> {
  if (!lead.email) return 0
  const db = createAdminClient()

  const { data: campaigns } = await db
    .from('campaigns')
    .select('id, status')
    .eq('venture_id', ventureId)
    .eq('auto_enroll_landing_leads', true)
    .in('status', ['scheduled', 'active'])

  const targets = campaigns ?? []
  if (targets.length === 0) return 0

  const rows = targets.map((c) => ({
    campaign_id: c.id,
    lead_id: lead.id,
    first_name: deriveFirstName(lead.email as string, lead.name),
    email: (lead.email as string).trim().toLowerCase(),
    source: 'manual' as const,
    source_context: { enrolledFrom: 'landing_page_auto' },
    engagement_status: 'fresh' as const,
    send_status: 'pending' as const,
    verified: false,
  }))

  const { data, error } = await db
    .from('campaign_leads')
    .upsert(rows, { onConflict: 'campaign_id,email', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('[lead-capture] campaign enroll upsert failed:', error.message)
    return 0
  }
  return (data ?? []).length
}

// Forward-only CRM lead status advance, used by the outreach engine when a
// campaign send/reply concerns a campaign_lead with a lead_id back-link.
// Guarded by the `from` list so we never demote a manually-set won/lost.
export async function advanceCrmLeadStatus(
  leadId: string,
  from: Array<'new' | 'contacted' | 'qualified'>,
  to: 'contacted' | 'qualified'
): Promise<void> {
  const db = createAdminClient()
  await db
    .from('leads')
    .update({ status: to })
    .eq('id', leadId)
    .in('status', from)
    .then(() => {}, () => {})
}
