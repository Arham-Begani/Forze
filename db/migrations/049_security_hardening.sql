-- 049_security_hardening.sql
-- Security boundary hardening for public Supabase access, billing writes,
-- checkout intent binding, and server-only rate-limit accounting.

-- ---------------------------------------------------------------------------
-- Owner-scoped RLS for legacy user-owned tables.
-- ---------------------------------------------------------------------------

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projects_select_own ON public.projects;
CREATE POLICY projects_select_own ON public.projects
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS projects_insert_own ON public.projects;
CREATE POLICY projects_insert_own ON public.projects
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS projects_update_own ON public.projects;
CREATE POLICY projects_update_own ON public.projects
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS projects_delete_own ON public.projects;
CREATE POLICY projects_delete_own ON public.projects
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

ALTER TABLE public.user_ideas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_ideas_select_own ON public.user_ideas;
CREATE POLICY user_ideas_select_own ON public.user_ideas
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS user_ideas_insert_own ON public.user_ideas;
CREATE POLICY user_ideas_insert_own ON public.user_ideas
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS user_ideas_update_own ON public.user_ideas;
CREATE POLICY user_ideas_update_own ON public.user_ideas
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS user_ideas_delete_own ON public.user_ideas;
CREATE POLICY user_ideas_delete_own ON public.user_ideas
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cohorts_select_own ON public.cohorts;
CREATE POLICY cohorts_select_own ON public.cohorts
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS cohorts_insert_own ON public.cohorts;
CREATE POLICY cohorts_insert_own ON public.cohorts
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS cohorts_update_own ON public.cohorts;
CREATE POLICY cohorts_update_own ON public.cohorts
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS cohorts_delete_own ON public.cohorts;
CREATE POLICY cohorts_delete_own ON public.cohorts
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Billing state is server-maintained. Clients may inspect their own history,
-- but may not mint or alter plans, payments, credits, or usage.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can manage own billing customer" ON public.billing_customers;
DROP POLICY IF EXISTS billing_customers_select_own ON public.billing_customers;
CREATE POLICY billing_customers_select_own ON public.billing_customers
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own payments" ON public.payments;
DROP POLICY IF EXISTS payments_select_own ON public.payments;
CREATE POLICY payments_select_own ON public.payments
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own credit ledger" ON public.credit_ledger;
DROP POLICY IF EXISTS credit_ledger_select_own ON public.credit_ledger;
CREATE POLICY credit_ledger_select_own ON public.credit_ledger
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own usage ledger" ON public.usage_ledger;
DROP POLICY IF EXISTS usage_ledger_select_own ON public.usage_ledger;
CREATE POLICY usage_ledger_select_own ON public.usage_ledger
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Profile rows contain billing/admin fields. Do not expose every profile or
-- permit clients to update plan, email, or credit-period state.
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);

-- Feature counters are also server-maintained. Keep read access for the
-- billing UI, but move increments to the service-role client.
DROP POLICY IF EXISTS feature_usage_counters_insert_own ON public.feature_usage_counters;
DROP POLICY IF EXISTS feature_usage_counters_update_own ON public.feature_usage_counters;
REVOKE INSERT, UPDATE, DELETE ON public.feature_usage_counters FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shareable investor kits are served by the exact-code server route, which
-- uses the service-role client. Never make the whole active table public.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public can read active kits by code" ON public.investor_kits;
DROP POLICY IF EXISTS "Users can manage own investor kits" ON public.investor_kits;
DROP POLICY IF EXISTS investor_kits_owner_all ON public.investor_kits;
CREATE POLICY investor_kits_owner_all ON public.investor_kits
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Server-only checkout intents bind a Razorpay object to the product selected
-- on the server. This prevents a valid cheap payment being relabeled as a
-- more expensive plan or top-up during confirmation.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.billing_checkout_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('subscription', 'topup')),
  product_slug TEXT NOT NULL,
  billing_period TEXT CHECK (billing_period IN ('monthly', 'yearly')),
  provider_id TEXT NOT NULL UNIQUE,
  provider_plan_id TEXT,
  amount_inr INTEGER NOT NULL CHECK (amount_inr > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
);

CREATE INDEX IF NOT EXISTS idx_billing_checkout_intents_user
  ON public.billing_checkout_intents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_checkout_intents_provider
  ON public.billing_checkout_intents(provider_id, kind, status);

ALTER TABLE public.billing_checkout_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_checkout_intents FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rate-limit storage and atomic credit charging are internal-only operations.
-- ---------------------------------------------------------------------------

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_rate_limit_event(
  p_user_id UUID,
  p_key TEXT,
  p_window_sec INTEGER,
  p_limit INTEGER
) RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH event_count AS (
    SELECT COUNT(*)::INTEGER AS count_value
    FROM public.rate_limit_events
    WHERE user_id = p_user_id
      AND event_key = p_key
      AND created_at > NOW() - (p_window_sec || ' seconds')::interval
  ),
  inserted AS (
    INSERT INTO public.rate_limit_events (user_id, event_key)
    SELECT p_user_id, p_key
    WHERE (SELECT count_value FROM event_count) < p_limit
    RETURNING 1
  ),
  cleaned AS (
    DELETE FROM public.rate_limit_events
    WHERE user_id = p_user_id
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

REVOKE EXECUTE ON FUNCTION public.record_rate_limit_event(UUID, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_rate_limit_event(UUID, TEXT, INTEGER, INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.charge_module_run(
  p_user_id UUID,
  p_conversation_id UUID,
  p_module_id TEXT,
  p_plan_slug TEXT,
  p_subscription_id UUID,
  p_hourly_limit INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  required_credits INTEGER;
  current_balance BIGINT;
  recent_runs BIGINT;
BEGIN
  required_credits := CASE p_module_id
    WHEN 'general' THEN 1
    WHEN 'landing' THEN 10
    WHEN 'shadow-board' THEN 10
    WHEN 'investor-kit' THEN 10
    ELSE NULL
  END;

  IF required_credits IS NULL THEN
    RAISE EXCEPTION 'INVALID_MODULE' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.ventures v ON v.id = c.venture_id
    WHERE c.id = p_conversation_id
      AND v.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'CONVERSATION_NOT_OWNED' USING ERRCODE = '42501';
  END IF;

  -- Serialize charges per account so concurrent requests cannot overspend.
  PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.usage_ledger WHERE conversation_id = p_conversation_id
  ) THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO recent_runs
  FROM public.usage_ledger
  WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '1 hour';

  IF p_hourly_limit > 0 AND recent_runs >= p_hourly_limit THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED' USING ERRCODE = '53400';
  END IF;

  SELECT COALESCE(SUM(credits), 0) INTO current_balance
  FROM public.credit_ledger
  WHERE user_id = p_user_id;

  IF current_balance < required_credits THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.usage_ledger (
    user_id, subscription_id, conversation_id, module_id, credits, plan_slug
  ) VALUES (
    p_user_id, p_subscription_id, p_conversation_id, p_module_id,
    required_credits, p_plan_slug
  );

  INSERT INTO public.credit_ledger (
    user_id, subscription_id, conversation_id, kind, credits, metadata
  ) VALUES (
    p_user_id, p_subscription_id, p_conversation_id, 'usage',
    -required_credits,
    jsonb_build_object('moduleId', p_module_id, 'planSlug', p_plan_slug)
  );

  RETURN required_credits;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.charge_module_run(UUID, UUID, TEXT, TEXT, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_module_run(UUID, UUID, TEXT, TEXT, UUID, INTEGER)
  TO service_role;
