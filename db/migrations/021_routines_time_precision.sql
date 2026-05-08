-- 020_routines_time_precision.sql
-- Add minute precision + per-routine timezone to routines.
--
-- Why this migration exists:
--   • Hour-only granularity (send_hour_utc 0-23) means a user can't say
--     "every Tuesday at 6:20 PM" — only on the hour. That's a hostile UX
--     for any thoughtful drip schedule.
--   • Forcing UTC on the user means picking a time they have to mentally
--     convert from their local time, including DST. Users in IST, ET, PT
--     all complained that 9 UTC ≠ 9 their time.
--
-- Strategy: keep next_run_at as TIMESTAMPTZ (always a UTC instant), but
-- store the user's intent (hour + minute + IANA timezone). The advance RPC
-- does cadence arithmetic in local time so DST transitions and month-length
-- variation work correctly, then converts back to UTC for storage.

-- ─── Add new columns ──────────────────────────────────────────────────────────
ALTER TABLE public.routines
  ADD COLUMN IF NOT EXISTS send_minute SMALLINT NOT NULL DEFAULT 0
    CHECK (send_minute BETWEEN 0 AND 59),
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

-- Rename send_hour_utc → send_hour. The column is now interpreted as
-- "hour in the routine's `timezone`," not "hour UTC" — keeping the old
-- name would be misleading for every future reader.
DO $$ BEGIN
  ALTER TABLE public.routines RENAME COLUMN send_hour_utc TO send_hour;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ─── Replace advance_routine_next_run with a tz-aware version ────────────────
-- Compute the next firing instant by:
--   1. Taking NOW() converted to the routine's local time.
--   2. Adding one cadence period (in local time so monthly handles 28-31 day
--      months correctly and weekly survives DST transitions intuitively).
--   3. Snapping to send_hour:send_minute that same local day.
--   4. Converting the local wall-clock back to a UTC timestamptz.
--   5. If snapping put us in the past (snap goes earlier in the day than
--      now+cadence), bump by one more cadence so we don't fire twice today.
CREATE OR REPLACE FUNCTION advance_routine_next_run(
  p_id UUID,
  p_clear_error BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cadence       routine_cadence;
  v_hour          SMALLINT;
  v_minute        SMALLINT;
  v_tz            TEXT;
  v_now_local     TIMESTAMP;     -- naive timestamp, interpreted in v_tz
  v_target_local  TIMESTAMP;
  v_next_utc      TIMESTAMPTZ;
BEGIN
  SELECT cadence, send_hour, send_minute, timezone
    INTO v_cadence, v_hour, v_minute, v_tz
    FROM public.routines
   WHERE id = p_id;

  IF v_cadence IS NULL THEN RETURN; END IF;
  -- Defend against a corrupt timezone value: fall back to UTC instead of
  -- raising, so a routine row with a stale tz string can still advance.
  BEGIN
    v_now_local := NOW() AT TIME ZONE v_tz;
  EXCEPTION WHEN OTHERS THEN
    v_tz := 'UTC';
    v_now_local := NOW() AT TIME ZONE v_tz;
  END;

  v_target_local := CASE v_cadence
    WHEN 'every_3_days' THEN v_now_local + INTERVAL '3 days'
    WHEN 'weekly'       THEN v_now_local + INTERVAL '7 days'
    WHEN 'monthly'      THEN v_now_local + INTERVAL '1 month'
  END;

  v_target_local := date_trunc('day', v_target_local)
                      + make_interval(hours => v_hour, mins => v_minute);

  v_next_utc := v_target_local AT TIME ZONE v_tz;

  IF v_next_utc <= NOW() THEN
    v_target_local := v_target_local + CASE v_cadence
      WHEN 'every_3_days' THEN INTERVAL '3 days'
      WHEN 'weekly'       THEN INTERVAL '7 days'
      WHEN 'monthly'      THEN INTERVAL '1 month'
    END;
    v_next_utc := v_target_local AT TIME ZONE v_tz;
  END IF;

  UPDATE public.routines
     SET next_run_at = v_next_utc,
         last_error  = CASE WHEN p_clear_error THEN NULL ELSE last_error END,
         updated_at  = NOW()
   WHERE id = p_id;
END;
$$;

-- ─── compute_routine_initial_next_run: used on insert ────────────────────────
-- Same logic as advance, but starts from "today" (not now+cadence) so a
-- routine created at 09:00 with send_time 17:00 fires today at 17:00 — not
-- next week. Falls back to one cadence forward if today's slot is past.
CREATE OR REPLACE FUNCTION compute_routine_initial_next_run(
  p_cadence       routine_cadence,
  p_send_hour     SMALLINT,
  p_send_minute   SMALLINT,
  p_timezone      TEXT
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_tz            TEXT := COALESCE(p_timezone, 'UTC');
  v_now_local     TIMESTAMP;
  v_target_local  TIMESTAMP;
  v_next_utc      TIMESTAMPTZ;
BEGIN
  BEGIN
    v_now_local := NOW() AT TIME ZONE v_tz;
  EXCEPTION WHEN OTHERS THEN
    v_tz := 'UTC';
    v_now_local := NOW() AT TIME ZONE v_tz;
  END;

  v_target_local := date_trunc('day', v_now_local)
                      + make_interval(hours => p_send_hour, mins => p_send_minute);
  v_next_utc := v_target_local AT TIME ZONE v_tz;

  IF v_next_utc <= NOW() THEN
    v_target_local := v_target_local + CASE p_cadence
      WHEN 'every_3_days' THEN INTERVAL '3 days'
      WHEN 'weekly'       THEN INTERVAL '7 days'
      WHEN 'monthly'      THEN INTERVAL '1 month'
    END;
    v_next_utc := v_target_local AT TIME ZONE v_tz;
  END IF;

  RETURN v_next_utc;
END;
$$;
