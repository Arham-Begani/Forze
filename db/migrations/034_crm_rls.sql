-- 034_crm_rls.sql
-- Row-Level Security for the CRM tables (leads, analytics_events,
-- outreach_campaigns, outreach_messages) plus testimonials/platform_feedback,
-- none of which have ever had RLS enabled (migrations 020, 022, 025 shipped
-- them without policies). Because the app queries these tables through the
-- anon-key, session-scoped Supabase client (see lib/supabase/server.ts), the
-- lack of RLS means any authenticated user could read/write another user's
-- venture data directly via Supabase's auto-generated PostgREST API,
-- bypassing every app-layer getVenture(id, session.userId) check.
--
-- Ownership model: venture_members (024_venture_collaborators.sql) already
-- backfills every venture's owner plus any invited collaborators, so we join
-- through it rather than a raw ventures.user_id check — this is the same
-- shape used for 015_campaign_rls.sql's ownership checks, extended to also
-- cover team members, not just the original creator.
--
-- platform_feedback is not venture-scoped (it's platform-level feedback tied
-- directly to a user), so it gets a direct auth.uid() = user_id policy
-- instead, mirroring 015_campaign_rls.sql's gmail_integrations policy.

-- ─── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.leads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feedback   ENABLE ROW LEVEL SECURITY;

-- ─── leads (direct venture_id) ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Venture members manage leads" ON public.leads;
CREATE POLICY "Venture members manage leads" ON public.leads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = leads.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = leads.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  );

-- ─── analytics_events (direct venture_id) ─────────────────────────────────────
DROP POLICY IF EXISTS "Venture members manage analytics events" ON public.analytics_events;
CREATE POLICY "Venture members manage analytics events" ON public.analytics_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = analytics_events.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = analytics_events.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  );

-- ─── outreach_campaigns (direct venture_id) ───────────────────────────────────
DROP POLICY IF EXISTS "Venture members manage outreach campaigns" ON public.outreach_campaigns;
CREATE POLICY "Venture members manage outreach campaigns" ON public.outreach_campaigns
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = outreach_campaigns.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = outreach_campaigns.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  );

-- ─── outreach_messages (child of outreach_campaigns) ──────────────────────────
DROP POLICY IF EXISTS "Venture members manage outreach messages" ON public.outreach_messages;
CREATE POLICY "Venture members manage outreach messages" ON public.outreach_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.outreach_campaigns
      JOIN public.venture_members
        ON venture_members.venture_id = outreach_campaigns.venture_id
      WHERE outreach_campaigns.id = outreach_messages.campaign_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outreach_campaigns
      JOIN public.venture_members
        ON venture_members.venture_id = outreach_campaigns.venture_id
      WHERE outreach_campaigns.id = outreach_messages.campaign_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  );

-- ─── testimonials (direct venture_id) ─────────────────────────────────────────
-- Note: testimonials are also created by an unauthenticated public form
-- (app/feedback/[ventureId]) via a service-role/server-side insert, which
-- bypasses RLS entirely — this policy only governs reads/writes made through
-- the user-session client (i.e. the venture owner/team viewing them in CRM).
DROP POLICY IF EXISTS "Venture members manage testimonials" ON public.testimonials;
CREATE POLICY "Venture members manage testimonials" ON public.testimonials
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = testimonials.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = testimonials.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  );

-- ─── platform_feedback (per-user, not venture-scoped) ─────────────────────────
DROP POLICY IF EXISTS "Users manage own platform feedback" ON public.platform_feedback;
CREATE POLICY "Users manage own platform feedback" ON public.platform_feedback
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
