-- ============================================================================
-- apply-pending-033-045.sql  —  ONE-SHOT consolidated migration
-- ============================================================================
-- Paste this ENTIRE file into the Supabase SQL editor and Run. It is every
-- pending migration (033 through 045) in dependency order, all idempotent
-- (safe to run more than once).
--
-- If you hit an error mentioning "ADD VALUE" or "transaction block":
--   run JUST the first ALTER TYPE line below on its own first, then run the
--   rest of the file. (Postgres is picky about enum changes.)
--
-- After it succeeds, run db/RUNBOOK-2026-07-apply-033-045.md's final
-- all-clear query to confirm every object exists.
-- ============================================================================


-- ==================== 033_outreach_engine.sql ====================
-- 033_outreach_engine.sql
-- Phase 1 of the outreach overhaul: make scheduled sends, drip sending,
-- follow-up sequences, and automatic reply/bounce sync real.
--
-- 1. campaign_status gains 'scheduled' — a campaign whose approved copy is
--    stored and whose send is owned by the outreach cron, not a live request.
-- 2. campaign_leads gains gmail_message_id/gmail_thread_id captured at send
--    time so follow-ups thread correctly and reply matching is thread-based
--    instead of guessing by sender address.
-- 3. campaigns gains daily_send_cap (drip batches/day) and
--    last_replies_polled_at (fair rotation for cron reply polling).
-- 4. gmail_integrations daily_send_limit default drops 2000 → 500. Consumer
--    Gmail's real-world limit is ~500/day; assuming 2000 risked account
--    flagging. Existing rows still on the old default are migrated.

-- ── 1. Add 'scheduled' to campaign_status ────────────────────────────────────
-- Must be a TOP-LEVEL statement: Postgres forbids `ALTER TYPE ... ADD VALUE`
-- inside a DO block / function ("cannot be executed from a function or
-- multi-command string"). `ADD VALUE IF NOT EXISTS` (PG12+) is idempotent, so
-- it is safe to re-run and needs no guard. The new value is only referenced by
-- application code, never later in this file, so running it here is safe.
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'scheduled';

-- ── 2. Thread linkage on leads ────────────────────────────────────────────────
ALTER TABLE public.campaign_leads
  ADD COLUMN IF NOT EXISTS gmail_message_id TEXT,
  ADD COLUMN IF NOT EXISTS gmail_thread_id  TEXT;

-- Follow-up eligibility scans: sent leads within a campaign.
CREATE INDEX IF NOT EXISTS idx_campaign_leads_send_status
  ON public.campaign_leads (campaign_id, send_status);

-- ── 3. Drip + poll-rotation state on campaigns ───────────────────────────────
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS daily_send_cap         INTEGER,
  ADD COLUMN IF NOT EXISTS last_replies_polled_at TIMESTAMPTZ;

-- Cron pickup of due scheduled campaigns.
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_due
  ON public.campaigns (scheduled_send_time)
  WHERE scheduled_send_time IS NOT NULL;

-- ── 4. Realistic Gmail daily limit ───────────────────────────────────────────
ALTER TABLE public.gmail_integrations
  ALTER COLUMN daily_send_limit SET DEFAULT 500;

UPDATE public.gmail_integrations
  SET daily_send_limit = 500
  WHERE daily_send_limit = 2000;


-- ==================== 034_crm_rls.sql ====================
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


-- ==================== 035_crm_leads_unify_social.sql ====================
-- 035_crm_leads_unify_social.sql
-- Unify social leads (Instagram commenters) into the real `leads` table.
-- Previously, "social leads" were computed live on every request from
-- marketing_assets (see aggregateLeads/aggregateCrmInbox) — not persisted
-- rows, so they had no primary key to attach a status/notes/tags/bulk
-- actions to. This migration relaxes `email` to nullable and adds an
-- `external_identity` column (e.g. "instagram:handle") so a commenter can be
-- upserted idempotently without an email address, giving social and email
-- leads one shared model.

ALTER TABLE leads
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS external_identity TEXT;

-- A lead must be reachable by at least one identity (email OR external_identity).
ALTER TABLE leads
  ADD CONSTRAINT leads_has_identity CHECK (email IS NOT NULL OR external_identity IS NOT NULL);

-- Idempotent upsert target for social commenters: one lead per
-- (venture_id, external_identity) pair. Partial index since most rows
-- (email captures) have a null external_identity.
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_venture_external_identity
  ON leads (venture_id, external_identity)
  WHERE external_identity IS NOT NULL;


-- ==================== 036_crm_lead_fields.sql ====================
-- 036_crm_lead_fields.sql
-- Extended lead fields for real CRM workflows: company/phone for context,
-- tags for segmentation, owner_id for assignment. All nullable/additive —
-- no backfill needed. owner_id is validated at the app layer against
-- venture_members for the lead's venture (not FK-constrained to
-- venture_members directly, since that's a join table, not an identity).

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);


-- ==================== 037_crm_lead_activity.sql ====================
-- 037_crm_lead_activity.sql
-- Notes + activity timeline for leads. Also doubles as the deal-stage-change
-- log for the Phase 3 pipeline (type='deal_stage_change') so there's no need
-- for a second activity table there.
--
-- RLS is included in this same migration, not deferred — this is the one net
-- new table in the lead-depth phase, so it's the cheapest place to not
-- repeat the gap that 034_crm_rls.sql had to retroactively fix.

CREATE TABLE IF NOT EXISTS lead_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id),
  type TEXT NOT NULL CHECK (type IN ('note', 'status_change', 'field_change', 'email_sent', 'deal_stage_change')),
  body TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activity_lead_id ON lead_activity(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activity_venture_id ON lead_activity(venture_id);

ALTER TABLE lead_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venture members manage lead activity" ON public.lead_activity;
CREATE POLICY "Venture members manage lead activity" ON public.lead_activity
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = lead_activity.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = lead_activity.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  );


-- ==================== 038_crm_deals_and_stages.sql ====================
-- 038_crm_deals_and_stages.sql
-- Real sales pipeline: per-venture customizable stages + deals linked to
-- leads. Deals are only ever created via an explicit "Convert to Deal"
-- action (see app/api/ventures/[id]/crm/deals/route.ts) — this migration
-- does NOT backfill deals for existing leads, since that would fabricate
-- deal values/stages for historical data with no real signal.

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  title TEXT NOT NULL,
  value NUMERIC,
  probability INTEGER CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
  expected_close_date DATE,
  lost_reason TEXT,
  owner_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_venture ON pipeline_stages(venture_id, position);
CREATE INDEX IF NOT EXISTS idx_deals_venture ON deals(venture_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead ON deals(lead_id);

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venture members manage pipeline stages" ON public.pipeline_stages;
CREATE POLICY "Venture members manage pipeline stages" ON public.pipeline_stages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = pipeline_stages.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = pipeline_stages.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Venture members manage deals" ON public.deals;
CREATE POLICY "Venture members manage deals" ON public.deals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = deals.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = deals.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  );


-- ==================== 039_crm_outreach_replies.sql ====================
-- 039_crm_outreach_replies.sql
-- Persist CRM outreach replies instead of live-fetching Gmail on every
-- request (the pre-Phase-5 behavior in lib/gmail-replies.ts). Mirrors the
-- Campaigns system's already-working campaign_replies + poll-replies + cron
-- pattern. subject/body are added to outreach_messages because analyzeReply()
-- needs the original sent message to compare a reply against, and
-- outreach_messages previously stored only IDs/timestamps.

ALTER TABLE outreach_messages
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT;

CREATE TABLE IF NOT EXISTS outreach_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outreach_message_id UUID NOT NULL REFERENCES outreach_messages(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  from_email TEXT,
  subject TEXT,
  body TEXT,
  reply_type TEXT,
  sentiment_score NUMERIC,
  summary TEXT,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_replies_gmail_message_id
  ON outreach_replies(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_outreach_replies_message ON outreach_replies(outreach_message_id);
CREATE INDEX IF NOT EXISTS idx_outreach_replies_lead ON outreach_replies(lead_id);

ALTER TABLE outreach_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venture members manage outreach replies" ON public.outreach_replies;
CREATE POLICY "Venture members manage outreach replies" ON public.outreach_replies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.outreach_messages
      JOIN public.outreach_campaigns ON outreach_campaigns.id = outreach_messages.campaign_id
      JOIN public.venture_members ON venture_members.venture_id = outreach_campaigns.venture_id
      WHERE outreach_messages.id = outreach_replies.outreach_message_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outreach_messages
      JOIN public.outreach_campaigns ON outreach_campaigns.id = outreach_messages.campaign_id
      JOIN public.venture_members ON venture_members.venture_id = outreach_campaigns.venture_id
      WHERE outreach_messages.id = outreach_replies.outreach_message_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  );


-- ==================== 040_fix_venture_members_rls_recursion.sql ====================
-- 040_fix_venture_members_rls_recursion.sql
-- Fixes a pre-existing bug in 024_venture_collaborators.sql's RLS policy on
-- venture_members:
--
--   CREATE POLICY "Users can view members of their ventures" ON venture_members
--     FOR SELECT USING (
--       user_id = auth.uid() OR
--       venture_id IN (SELECT venture_id FROM venture_members WHERE user_id = auth.uid())
--     );
--
-- The subquery reads venture_members from WITHIN venture_members' own
-- policy — Postgres has to re-apply the same policy to evaluate that inner
-- SELECT, which requires evaluating the policy again, forever. This never
-- surfaced before because nothing else's RLS policy needed to read
-- venture_members as a dependency. 034_crm_rls.sql's policies (leads,
-- analytics_events, outreach_campaigns, outreach_messages, testimonials) —
-- and 036/037/038/039's — all join through venture_members, so they now hit
-- this the moment RLS actually evaluates: "infinite recursion detected in
-- policy for relation venture_members".
--
-- Fix: move the self-referential lookup into a SECURITY DEFINER function.
-- Such a function runs with the privileges of its owner (the migration
-- role, which owns the table) rather than the calling user — table owners
-- bypass RLS by default (ENABLE ROW LEVEL SECURITY does not restrict the
-- owner; only FORCE ROW LEVEL SECURITY would), so the function's internal
-- query does not re-trigger the policy. This is the standard fix for this
-- class of bug.

CREATE OR REPLACE FUNCTION public.is_venture_member(p_venture_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.venture_members
    WHERE venture_id = p_venture_id AND user_id = p_user_id
  );
$$;

DROP POLICY IF EXISTS "Users can view members of their ventures" ON public.venture_members;
CREATE POLICY "Users can view members of their ventures" ON public.venture_members
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR public.is_venture_member(venture_members.venture_id, (SELECT auth.uid()))
  );


-- ==================== 041_lead_campaign_bridge.sql ====================
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


-- ==================== 042_lead_scout_action.sql ====================
-- 042_lead_scout_action.sql
-- Phase 3 of the outreach overhaul: the AI Lead Scout (web-search prospect
-- finder) is metered as a weekly action like campaign sends — it is priced
-- in web-search Gemini calls, not credits. Widens the feature_id CHECK on
-- feature_usage_counters (030) to accept the new counter key.

ALTER TABLE public.feature_usage_counters
  DROP CONSTRAINT IF EXISTS feature_usage_counters_feature_id_check;

ALTER TABLE public.feature_usage_counters
  ADD CONSTRAINT feature_usage_counters_feature_id_check CHECK (feature_id IN (
    'inspiration_analyze',
    'crm_email_send',
    'campaign_send',
    'lead_scout'
  ));


-- ==================== 043_backfill_missing_venture_members.sql ====================
  -- 043_backfill_missing_venture_members.sql
  -- Heal ventures whose owner has no venture_members row.
  --
  -- Migration 024 backfilled venture_members from the ventures that existed when
  -- it ran, but createVenture never inserted an owner row afterward — so every
  -- venture created after 024 was applied had no membership row. Because
  -- getVentureAccess() (pre-fix) only fell back to ventures.user_id when the
  -- table was MISSING, those owners resolved to null access and every module run
  -- died with "Not found". The application now (a) seeds the owner row on create
  -- and (b) falls back to ventures.user_id ownership, so this only needs to run
  -- once to repair historical rows (and make them appear in member-scoped
  -- listings like getVenturesByUser). Idempotent — safe to re-run.

  INSERT INTO venture_members (venture_id, user_id, role, created_at)
  SELECT v.id, v.user_id, 'owner', v.created_at
  FROM ventures v
  WHERE NOT EXISTS (
    SELECT 1 FROM venture_members m
    WHERE m.venture_id = v.id
      AND m.user_id = v.user_id
  )
  ON CONFLICT (venture_id, user_id) DO NOTHING;


-- ==================== 044_anon_rate_limit.sql ====================
-- 044_anon_rate_limit.sql
--
-- IP-keyed sliding-window rate limiting for anonymous public endpoints
-- (landing-page feedback, analytics tracking, lead capture). Mirrors
-- record_rate_limit_event from migration 014 but keys on a TEXT identifier
-- (a hashed client IP) instead of a users(id) FK, since these callers are
-- unauthenticated visitors with no user row.
--
-- Additive + idempotent: safe to run repeatedly, touches nothing existing.
-- The lib/rate-limit.ts caller fails OPEN if this migration hasn't been
-- applied yet, so deploying code before SQL cannot break public endpoints.

CREATE TABLE IF NOT EXISTS anon_rate_limit_events (
  id         BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  event_key  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anon_rate_limit_events_ident_key_time
  ON anon_rate_limit_events(identifier, event_key, created_at DESC);

-- No direct table access for API roles — all reads/writes go through the
-- SECURITY DEFINER function below. RLS enabled with zero policies blocks
-- the anon/authenticated roles from touching rows directly.
ALTER TABLE anon_rate_limit_events ENABLE ROW LEVEL SECURITY;

-- Count events in the window and insert a new one atomically when under the
-- limit. Returns the resulting count so callers 429 when count > limit.
-- Also opportunistically clears expired rows for this bucket so the table
-- stays small without a scheduled vacuum job.
CREATE OR REPLACE FUNCTION record_anon_rate_limit_event(
  p_identifier  TEXT,
  p_key         TEXT,
  p_window_sec  INTEGER,
  p_limit       INTEGER
) RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH event_count AS (
    SELECT COUNT(*)::INTEGER AS count_value
    FROM anon_rate_limit_events
    WHERE identifier = p_identifier
      AND event_key = p_key
      AND created_at > NOW() - (p_window_sec || ' seconds')::interval
  ),
  inserted AS (
    INSERT INTO anon_rate_limit_events (identifier, event_key)
    SELECT p_identifier, p_key
    WHERE (SELECT count_value FROM event_count) < p_limit
    RETURNING 1
  ),
  cleaned AS (
    DELETE FROM anon_rate_limit_events
    WHERE identifier = p_identifier
      AND event_key = p_key
      AND created_at < NOW() - (p_window_sec * 4 || ' seconds')::interval
    RETURNING 1
  )
  SELECT CASE
    WHEN (SELECT count_value FROM event_count) >= p_limit
      THEN (SELECT count_value FROM event_count)
    ELSE (SELECT count_value FROM event_count) + 1
  END;
$$;


-- ==================== 045_conversations_indexes.sql ====================
-- 045_conversations_indexes.sql
--
-- Hot-path indexes + a hardened merge_venture_context.
--
-- `conversations` has had ZERO secondary indexes since 001 — every module
-- workspace load filters by (venture_id, module_id) and the admin analytics
-- and the stuck-run sweeper filter by status. `ventures(project_id)` backs
-- the dashboard project tree on every layout load.
--
-- Additive + idempotent: safe to run repeatedly, no code dependency — the
-- app merely gets faster; nothing breaks if this migration isn't applied.

-- Hot path: getConversationsByModule (lib/queries.ts) — loaded on every
-- module workspace open and every co-pilot run.
CREATE INDEX IF NOT EXISTS idx_conversations_venture_module_time
  ON conversations(venture_id, module_id, created_at DESC);

-- Partial: only rows currently 'running' (a handful at any moment, so the
-- index stays tiny). Backs the stuck-run sweeper cron
-- (/api/cron/sweep-stuck-runs) and any admin running-runs metric.
CREATE INDEX IF NOT EXISTS idx_conversations_running_created
  ON conversations(created_at)
  WHERE status = 'running';

-- Dashboard project tree: ventures are listed per project on every load.
CREATE INDEX IF NOT EXISTS idx_ventures_project
  ON ventures(project_id);

-- ── Harden merge_venture_context (from migration 008) ────────────────────────
--
-- ventures.context is nullable (001 defines it as JSONB DEFAULT '{}' with no
-- NOT NULL), and jsonb_set(NULL, ...) returns NULL — so the original function
-- would silently wipe context for a legacy null-context row. COALESCE makes
-- the merge safe regardless of the row's state. CREATE OR REPLACE is
-- idempotent and keeps the exact signature lib/queries.ts calls.
CREATE OR REPLACE FUNCTION merge_venture_context(
  venture_id_val UUID,
  context_key TEXT,
  context_value JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE ventures
  SET context = jsonb_set(COALESCE(context, '{}'::jsonb), ARRAY[context_key], context_value),
      updated_at = NOW()
  WHERE id = venture_id_val;
END;
$$ LANGUAGE plpgsql;

-- Heal any legacy null-context rows so even the pre-045 function (or direct
-- jsonb_set callers) can never hit the NULL case again. Idempotent.
UPDATE ventures SET context = '{}'::jsonb WHERE context IS NULL;

