-- Auto-GTM hardening: durable lead send-lifecycle, dedupe constraint,
-- suppression fields, and an observability event log.
-- Migration: 016_auto_gtm_hardening.sql
--
-- Why this migration exists:
--   • The existing send pipeline relied on (email_sent_at IS NULL AND
--     engagement_status = 'fresh') to decide who to send to. That's fine for a
--     happy path but leaves no room for retries, partial failures, or
--     background-job claim semantics — two concurrent send requests for the
--     same campaign would both observe the same "unsent" set and double-send.
--   • Lead dedupe was enforced in the POST /leads route with an in-memory Set.
--     If two uploads landed at once, both would pass the check and we'd insert
--     duplicates. Only a DB-level UNIQUE fixes that.
--   • Unsubscribes were only reflected via engagement_status — the next send
--     cycle would still include those rows because the send filter never
--     checked status for the 'unsubscribed' value. A dedicated timestamp
--     column makes the filter explicit and survives future status-enum edits.
--   • We had no event log. Debugging a failed send required reading request
--     logs that rotate away in hours.

-- ─── Lead send-lifecycle enum ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE lead_send_status AS ENUM (
    'pending',    -- eligible for a future send
    'sending',    -- claimed by an in-flight send worker
    'sent',       -- Gmail accepted the message
    'failed',     -- send attempt exhausted retries
    'suppressed'  -- unsubscribed or bounced — never send again
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── New columns on campaign_leads ───────────────────────────────────────────
ALTER TABLE public.campaign_leads
  ADD COLUMN IF NOT EXISTS send_status      lead_send_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS unsubscribed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_send_error  TEXT,
  ADD COLUMN IF NOT EXISTS send_attempts    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at  TIMESTAMPTZ;

-- Backfill send_status from the prior source of truth (email_sent_at +
-- engagement_status). Only touch rows that are still at the column default
-- so a re-run of this migration is a no-op.
UPDATE public.campaign_leads
SET send_status = 'suppressed',
    unsubscribed_at = COALESCE(unsubscribed_at, updated_at, NOW())
WHERE engagement_status = 'unsubscribed'
  AND send_status = 'pending';

UPDATE public.campaign_leads
SET send_status = 'suppressed',
    bounced_at = COALESCE(bounced_at, updated_at, NOW())
WHERE engagement_status = 'bounced'
  AND send_status = 'pending';

UPDATE public.campaign_leads
SET send_status = 'sent'
WHERE email_sent_at IS NOT NULL
  AND send_status = 'pending';

-- ─── Dedupe: UNIQUE (campaign_id, email) ─────────────────────────────────────
-- Normalize existing rows so the unique index build doesn't fail on legacy
-- casing differences ("Foo@x.com" vs "foo@x.com").
UPDATE public.campaign_leads
SET email = LOWER(TRIM(email))
WHERE email <> LOWER(TRIM(email));

-- Collapse any duplicates that slipped in before the constraint existed:
-- keep the earliest row per (campaign_id, email) and delete the rest. In
-- practice this matches almost nothing — every upload path already dedupes
-- in-memory — but we must guarantee zero duplicates before adding the index.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY campaign_id, email
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.campaign_leads
)
DELETE FROM public.campaign_leads
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_leads_campaign_email
  ON public.campaign_leads(campaign_id, email);

-- Indexes that support the new hot paths.
CREATE INDEX IF NOT EXISTS idx_campaign_leads_send_status
  ON public.campaign_leads(campaign_id, send_status);

-- ─── campaign_events: observability log ──────────────────────────────────────
-- Minimal shape on purpose. Structured enough to query, loose enough that new
-- event types don't require a migration.
CREATE TABLE IF NOT EXISTS public.campaign_events (
  id          BIGSERIAL PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id     UUID REFERENCES public.campaign_leads(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'info', -- info | warn | error
  message     TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign_time
  ON public.campaign_events(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_events_type_time
  ON public.campaign_events(event_type, created_at DESC);

ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own campaign events. Writes come from SECURITY DEFINER
-- RPCs / admin client, so no write policy is needed for end-user sessions.
DROP POLICY IF EXISTS "Users can view events in own campaigns" ON public.campaign_events;
CREATE POLICY "Users can view events in own campaigns" ON public.campaign_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_events.campaign_id
        AND campaigns.created_by = (SELECT auth.uid())
    )
  );

-- ─── claim_lead_for_sending: atomic pending → sending transition ─────────────
-- Returns TRUE exactly once per lead, no matter how many concurrent callers
-- race on the same row. This is the primitive that makes the send pipeline
-- safe to retry, run in parallel, or migrate to a background queue later
-- without duplicating messages.
CREATE OR REPLACE FUNCTION claim_lead_for_sending(
  p_lead_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claimed INTEGER;
BEGIN
  UPDATE public.campaign_leads
  SET send_status    = 'sending',
      send_attempts  = COALESCE(send_attempts, 0) + 1,
      last_attempt_at = NOW(),
      updated_at     = NOW()
  WHERE id = p_lead_id
    AND send_status = 'pending'
    AND unsubscribed_at IS NULL
    AND bounced_at IS NULL;

  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  RETURN v_claimed = 1;
END;
$$;

-- ─── log_campaign_event: structured write helper ─────────────────────────────
-- Lets server code emit events without having to enumerate the NOT NULL
-- columns every time. Keeps metadata as jsonb so callers can throw arbitrary
-- payloads (stack traces, Gmail response bodies, etc.).
CREATE OR REPLACE FUNCTION log_campaign_event(
  p_campaign_id UUID,
  p_lead_id     UUID,
  p_user_id     UUID,
  p_event_type  TEXT,
  p_severity    TEXT,
  p_message     TEXT,
  p_metadata    JSONB
) RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO public.campaign_events
    (campaign_id, lead_id, user_id, event_type, severity, message, metadata)
  VALUES
    (p_campaign_id, p_lead_id, p_user_id, p_event_type,
     COALESCE(p_severity, 'info'),
     p_message,
     COALESCE(p_metadata, '{}'::jsonb));
$$;
