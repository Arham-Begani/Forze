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
