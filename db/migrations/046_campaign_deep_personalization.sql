-- 046_campaign_deep_personalization.sql
-- Per-lead opening-line personalization for cold outreach. When enabled, the
-- outreach executor rewrites only the first line of the approved body using
-- what is actually known about each recipient (title, company, and the
-- source_context captured when the lead was scouted).
--
-- Additive and idempotent. The send path reads `deep_personalize ?? false`,
-- so campaigns keep sending normally on a database where this has not run.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS deep_personalize BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.campaigns.deep_personalize IS
  'When true, the outreach executor rewrites each email''s first line per lead. Falls back to plain {{token}} substitution on any AI failure.';
