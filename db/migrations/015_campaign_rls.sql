-- Row-Level Security for the Auto-GTM layer.
-- Migration 013 shipped the tables without policies, which means every INSERT
-- fails with "new row violates row-level security policy" the moment RLS is
-- enabled on the project (Supabase auto-enables RLS for tables exposed through
-- the PostgREST API). This migration declares the same ownership model used
-- throughout the rest of the codebase (see 009_marketing_automation.sql):
--   • direct-owned rows gate on auth.uid() = <owner column>
--   • child rows gate via EXISTS on the parent campaign's ownership
-- Migration: 015_campaign_rls.sql

-- ─── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_analytics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_replies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_integrations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_events    ENABLE ROW LEVEL SECURITY;

-- ─── campaigns ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own campaigns" ON public.campaigns;
CREATE POLICY "Users can manage own campaigns" ON public.campaigns
  FOR ALL
  USING ((SELECT auth.uid()) = created_by)
  WITH CHECK ((SELECT auth.uid()) = created_by);

-- ─── campaign_leads (child of campaigns) ──────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage leads in own campaigns" ON public.campaign_leads;
CREATE POLICY "Users can manage leads in own campaigns" ON public.campaign_leads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_leads.campaign_id
        AND campaigns.created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_leads.campaign_id
        AND campaigns.created_by = (SELECT auth.uid())
    )
  );

-- ─── campaign_analytics (child of campaigns) ──────────────────────────────────
DROP POLICY IF EXISTS "Users can manage analytics in own campaigns" ON public.campaign_analytics;
CREATE POLICY "Users can manage analytics in own campaigns" ON public.campaign_analytics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_analytics.campaign_id
        AND campaigns.created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_analytics.campaign_id
        AND campaigns.created_by = (SELECT auth.uid())
    )
  );

-- ─── campaign_replies (child of campaigns) ────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage replies in own campaigns" ON public.campaign_replies;
CREATE POLICY "Users can manage replies in own campaigns" ON public.campaign_replies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_replies.campaign_id
        AND campaigns.created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_replies.campaign_id
        AND campaigns.created_by = (SELECT auth.uid())
    )
  );

-- ─── gmail_integrations (per-user) ────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own gmail integration" ON public.gmail_integrations;
CREATE POLICY "Users can manage own gmail integration" ON public.gmail_integrations
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ─── rate_limit_events (per-user) ─────────────────────────────────────────────
-- The sliding-window counter is written from a SECURITY DEFINER RPC, so the
-- function bypasses RLS. The policy exists so direct user reads (e.g., for
-- debugging) are still scoped to their own events.
DROP POLICY IF EXISTS "Users can view own rate limit events" ON public.rate_limit_events;
CREATE POLICY "Users can view own rate limit events" ON public.rate_limit_events
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
