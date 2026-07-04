-- 041_lead_campaign_bridge.sql
-- Phase 2 of the outreach overhaul: connect the two lead systems.
--
-- Before this, a lead captured by a venture's own landing page (`leads`,
-- CRM) could never be enrolled in an outreach campaign (`campaign_leads`) —
-- the pools were fully disjoint. This adds:
--
--   1. campaign_leads.lead_id — back-link to the CRM lead a campaign row was
--      enrolled from. Lets sends/replies advance the CRM lead's status
--      (new → contacted → qualified) and gives the CRM a per-lead outreach
--      history. Nullable: CSV-pasted campaign leads have no CRM counterpart.
--   2. campaigns.auto_enroll_landing_leads — when true, every NEW lead the
--      landing page captures is automatically added to this campaign as a
--      pending recipient; the outreach cron then sends to them on the
--      campaign's drip schedule. This is the "page → pipeline" loop.

ALTER TABLE public.campaign_leads
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_id
  ON public.campaign_leads (lead_id)
  WHERE lead_id IS NOT NULL;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS auto_enroll_landing_leads BOOLEAN NOT NULL DEFAULT false;

-- Auto-enroll lookup: "which campaigns of this venture want new leads?"
CREATE INDEX IF NOT EXISTS idx_campaigns_auto_enroll
  ON public.campaigns (venture_id)
  WHERE auto_enroll_landing_leads = true;
