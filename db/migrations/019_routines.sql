-- 019_routines.sql
-- Routines: recurring outreach (gmail) and posting (instagram) on a fixed
-- cadence. The routine row is the schedule; the actual send/publish reuses
-- the existing campaign send pipeline (gmail) and marketing_publish_jobs
-- pipeline (instagram).
--
-- Why this migration exists:
--   • There is no concept of "fire on a cadence" anywhere yet. Every email
--     send and every instagram publish today is a one-shot user action.
--   • We need an atomic claim primitive so two overlapping cron invocations
--     can't double-fire the same routine. Pattern mirrors
--     claim_lead_for_sending in 016 — UPDATE … RETURNING with row-level
--     locking via SELECT … FOR UPDATE SKIP LOCKED in a CTE.
--   • Cadence advancement also needs to be a single statement so a routine
--     that's mid-execute doesn't observe a stale next_run_at.

-- ─── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE routine_channel AS ENUM ('gmail', 'instagram');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE routine_cadence AS ENUM ('every_3_days', 'weekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE routine_status AS ENUM ('active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE routine_run_status AS ENUM ('success', 'failed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── routines table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.routines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  venture_id      UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  channel         routine_channel NOT NULL,
  cadence         routine_cadence NOT NULL,
  status          routine_status NOT NULL DEFAULT 'active',

  -- Email-only audience link. NULLable on instagram routines.
  -- ON DELETE SET NULL so the routine survives a campaign delete; the
  -- executor will detect the null and self-pause with last_error set.
  campaign_id     UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,

  -- Optional creative steering for the AI generator.
  angle_hint      TEXT,

  -- Hour-of-day to fire (0-23 UTC). Default 9 = 09:00 UTC.
  send_hour_utc   SMALLINT NOT NULL DEFAULT 9
                  CHECK (send_hour_utc BETWEEN 0 AND 23),

  next_run_at     TIMESTAMPTZ NOT NULL,
  last_run_at     TIMESTAMPTZ,
  last_error      TEXT,
  run_count       INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Gmail routines must be linked to a campaign (audience source). Instagram
  -- routines never need one. Enforce at the DB layer so a malformed insert
  -- can't slip past the API.
  CONSTRAINT routine_channel_audience CHECK (
    (channel = 'gmail' AND campaign_id IS NOT NULL)
    OR channel = 'instagram'
  )
);

CREATE INDEX IF NOT EXISTS idx_routines_due
  ON public.routines(next_run_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_routines_venture
  ON public.routines(venture_id);

CREATE INDEX IF NOT EXISTS idx_routines_user
  ON public.routines(user_id);

-- ─── routine_runs audit log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.routine_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id    UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status        routine_run_status NOT NULL,
  channel       routine_channel NOT NULL,
  -- For gmail: { lead_id, lead_email, subject, message_id }.
  -- For instagram: { asset_id, job_id }.
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  ran_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routine_runs_routine_ranat
  ON public.routine_runs(routine_id, ran_at DESC);

-- ─── updated_at trigger ──────────────────────────────────────────────────────
-- Reuse the existing update_marketing_updated_at function defined in 009.
DROP TRIGGER IF EXISTS trg_routines_updated_at ON public.routines;
CREATE TRIGGER trg_routines_updated_at
  BEFORE UPDATE ON public.routines
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own routines" ON public.routines;
CREATE POLICY "Users manage own routines" ON public.routines
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- routine_runs are written exclusively by SECURITY DEFINER paths (the cron
-- executor). End users only need read access, gated via the parent routine.
DROP POLICY IF EXISTS "Users read own routine runs" ON public.routine_runs;
CREATE POLICY "Users read own routine runs" ON public.routine_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_runs.routine_id
        AND r.user_id = (SELECT auth.uid())
    )
  );

-- ─── claim_due_routines: atomic batch claim ──────────────────────────────────
-- Picks up to p_limit active routines whose next_run_at has passed, marks
-- them as just-run (last_run_at + run_count + 1), and returns enough fields
-- for the executor to dispatch without a second query. The CTE + FOR UPDATE
-- SKIP LOCKED prevents double-fire when two cron invocations overlap, while
-- still letting other cron jobs pick non-overlapping rows.
CREATE OR REPLACE FUNCTION claim_due_routines(p_limit INT DEFAULT 50)
RETURNS TABLE(
  id          UUID,
  user_id     UUID,
  venture_id  UUID,
  channel     routine_channel,
  cadence     routine_cadence,
  campaign_id UUID,
  angle_hint  TEXT,
  name        TEXT,
  run_count   INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT r.id
    FROM public.routines r
    WHERE r.status = 'active'
      AND r.next_run_at <= NOW()
    ORDER BY r.next_run_at ASC
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.routines r
     SET last_run_at = NOW(),
         run_count   = r.run_count + 1,
         updated_at  = NOW()
    FROM due
   WHERE r.id = due.id
  RETURNING r.id, r.user_id, r.venture_id, r.channel, r.cadence,
            r.campaign_id, r.angle_hint, r.name, r.run_count;
END;
$$;

-- ─── advance_routine_next_run: roll the schedule forward ─────────────────────
-- Called by the executor after every fire, success or failure. Always
-- advancing on failure prevents a broken routine from locking the queue —
-- the user sees last_error in the UI and can pause/fix without us looping.
CREATE OR REPLACE FUNCTION advance_routine_next_run(p_id UUID, p_clear_error BOOLEAN DEFAULT TRUE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cadence routine_cadence;
  v_hour    SMALLINT;
  v_next    TIMESTAMPTZ;
BEGIN
  SELECT cadence, send_hour_utc INTO v_cadence, v_hour
  FROM public.routines
  WHERE id = p_id;

  IF v_cadence IS NULL THEN RETURN; END IF;

  -- Advance from "now" so a routine that runs late doesn't immediately
  -- re-fire to "catch up." Then snap to the user's preferred hour-of-day.
  v_next := CASE v_cadence
    WHEN 'every_3_days' THEN NOW() + INTERVAL '3 days'
    WHEN 'weekly'       THEN NOW() + INTERVAL '7 days'
    WHEN 'monthly'      THEN NOW() + INTERVAL '1 month'
  END;

  v_next := date_trunc('day', v_next AT TIME ZONE 'UTC')
              + (v_hour || ' hours')::INTERVAL;
  v_next := v_next AT TIME ZONE 'UTC';

  -- If snapping pushed us back in time (e.g. cadence=3d at 09:00 UTC and
  -- the routine fired at 10:00 UTC three days from now), bump forward by
  -- one cadence increment so we don't fire twice the same day.
  IF v_next <= NOW() THEN
    v_next := v_next + CASE v_cadence
      WHEN 'every_3_days' THEN INTERVAL '3 days'
      WHEN 'weekly'       THEN INTERVAL '7 days'
      WHEN 'monthly'      THEN INTERVAL '1 month'
    END;
  END IF;

  UPDATE public.routines
     SET next_run_at = v_next,
         last_error  = CASE WHEN p_clear_error THEN NULL ELSE last_error END,
         updated_at  = NOW()
   WHERE id = p_id;
END;
$$;

-- ─── record_routine_run: structured write helper ─────────────────────────────
-- Lets the executor log one row without enumerating NOT NULL columns. Also
-- updates the parent routine's last_error when status='failed' so the UI
-- doesn't have to join routine_runs to show the most recent failure.
CREATE OR REPLACE FUNCTION record_routine_run(
  p_routine_id    UUID,
  p_user_id       UUID,
  p_status        routine_run_status,
  p_channel       routine_channel,
  p_metadata      JSONB,
  p_error_message TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.routine_runs
    (routine_id, user_id, status, channel, metadata, error_message)
  VALUES
    (p_routine_id, p_user_id, p_status, p_channel,
     COALESCE(p_metadata, '{}'::jsonb),
     p_error_message)
  RETURNING id INTO v_id;

  IF p_status = 'failed' THEN
    UPDATE public.routines
       SET last_error = p_error_message,
           updated_at = NOW()
     WHERE id = p_routine_id;
  END IF;

  RETURN v_id;
END;
$$;
