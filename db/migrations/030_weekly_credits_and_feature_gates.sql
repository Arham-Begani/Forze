-- 030_weekly_credits_and_feature_gates.sql
-- Weekly credit refresh (replaces monthly) + per-plan feature gating for
-- Outreach (campaigns + direct-mail + launch-autopilot), CRM, and Inspiration.
--
-- Three concerns, one migration:
--
--   1. credit_ledger.kind gains 'weekly_grant' and 'weekly_expiry' so the
--      refresh function can (a) insert the new week's grant and (b) drain
--      any leftover non-topup balance from the previous week. Top-ups
--      (kind = 'topup') are deliberately untouched — they never expire.
--
--   2. users.weekly_credit_period_start anchors when the user's current
--      weekly window began. The refresh logic is lazy (fires inside
--      getBillingSnapshot on read) so a missing column or null value just
--      means "refresh on next access" — no cron required, no orphan state
--      if a user goes inactive for weeks.
--
--   3. feature_usage_counters tracks weekly action ceilings on the
--      un-credited gated surfaces (inspiration_analyze, crm_email_send,
--      campaign_send). One row per (user, feature, weekly_period_start).
--      Independent of the credit balance; works even for unlimited users
--      so we can monitor without enforcing.
--
-- Backward-compat: every change is additive. The CHECK widening is
-- idempotent. Routes that don't yet call assertCanAccessFeature /
-- assertCanPerformAction continue to work exactly as before — gating is
-- enforced at the route level, not the DB level.

-- ── 1. credit_ledger.kind widening ─────────────────────────────────────────
-- The original constraint from 007_billing.sql is named credit_ledger_kind_check
-- by Postgres convention. Drop + re-add to include the two new kinds.
ALTER TABLE public.credit_ledger
  DROP CONSTRAINT IF EXISTS credit_ledger_kind_check;

ALTER TABLE public.credit_ledger
  ADD CONSTRAINT credit_ledger_kind_check
  CHECK (kind IN (
    'monthly_grant',    -- legacy: pre-030 subscription grants, kept for history
    'weekly_grant',     -- new: per-week grant inserted by refreshWeeklyCreditsIfDue
    'weekly_expiry',    -- new: negative entry that drains last week's non-topup balance
    'topup',            -- pay-as-you-go top-up purchases (never expire)
    'usage',            -- module run charge (already negative)
    'manual_adjustment' -- admin grants / refunds / initial free-tier seed
  ));

-- ── 2. users.weekly_credit_period_start ────────────────────────────────────
-- Anchors the start of the user's current weekly credit window
-- (Monday 00:00 IST). NULL = needs refresh on next read.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS weekly_credit_period_start TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_weekly_credit_period_start
  ON public.users (weekly_credit_period_start)
  WHERE weekly_credit_period_start IS NOT NULL;

-- ── 3. feature_usage_counters ──────────────────────────────────────────────
-- Per-(user, feature, week) action counter for weekly ceilings on
-- non-credit-billed gated features. The period_start is always the
-- Monday-00:00-IST anchor for the week the action occurred in.
CREATE TABLE IF NOT EXISTS public.feature_usage_counters (
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feature_id      TEXT        NOT NULL CHECK (feature_id IN (
    'inspiration_analyze',
    'crm_email_send',
    'campaign_send'
  )),
  period_start    TIMESTAMPTZ NOT NULL,
  count           INTEGER     NOT NULL DEFAULT 0 CHECK (count >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, feature_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_counters_user_period
  ON public.feature_usage_counters (user_id, period_start DESC);

ALTER TABLE public.feature_usage_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_usage_counters_select_own ON public.feature_usage_counters;
CREATE POLICY feature_usage_counters_select_own
  ON public.feature_usage_counters
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS feature_usage_counters_insert_own ON public.feature_usage_counters;
CREATE POLICY feature_usage_counters_insert_own
  ON public.feature_usage_counters
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS feature_usage_counters_update_own ON public.feature_usage_counters;
CREATE POLICY feature_usage_counters_update_own
  ON public.feature_usage_counters
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at trigger reuses the billing one from 007_billing.sql
DROP TRIGGER IF EXISTS trg_feature_usage_counters_updated_at ON public.feature_usage_counters;
CREATE TRIGGER trg_feature_usage_counters_updated_at
  BEFORE UPDATE ON public.feature_usage_counters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_billing_updated_at();
