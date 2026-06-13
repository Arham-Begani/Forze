-- 031_routines_linkedin.sql
-- Add LinkedIn as a routine channel. LinkedIn posting already works end-to-end
-- in the marketing pipeline (publishLinkedInAsset in lib/marketing-publish.ts);
-- this migration just lets a routine fire it on a cadence, mirroring the
-- existing Instagram channel.
--
-- Two schema changes:
--   1. Extend the routine_channel enum with 'linkedin'. The claim/record RPCs
--      already return/accept `routine_channel`, so they pick up the new value
--      with no signature change.
--   2. Relax the routine_channel_audience CHECK. The original constraint
--      (019) only whitelisted gmail (needs a campaign) and instagram. LinkedIn
--      — like instagram — never needs a campaign, so generalise the second
--      branch to "any non-gmail channel" instead of hard-coding each one.

-- ─── 1. Enum value ─────────────────────────────────────────────────────────────
-- ALTER TYPE … ADD VALUE can't run inside a txn that later uses the value, but
-- we only reference 'linkedin' from application code, never in this file, so the
-- guarded ADD VALUE is safe on its own.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'routine_channel'
      AND e.enumlabel = 'linkedin'
  ) THEN
    ALTER TYPE routine_channel ADD VALUE 'linkedin';
  END IF;
END $$;

-- ─── 2. Audience constraint ────────────────────────────────────────────────────
-- Gmail routines must point at a campaign (audience source); every social
-- channel generates its own content and needs none.
ALTER TABLE public.routines
  DROP CONSTRAINT IF EXISTS routine_channel_audience;

ALTER TABLE public.routines
  ADD CONSTRAINT routine_channel_audience CHECK (
    (channel = 'gmail' AND campaign_id IS NOT NULL)
    OR channel <> 'gmail'
  );
