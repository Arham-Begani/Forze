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
