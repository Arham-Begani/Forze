-- 026_routines_per_user_claim.sql
-- Per-user variant of claim_due_routines so a logged-in user can self-trigger
-- their own due routines from the dashboard without affecting other tenants.
--
-- Why this migration exists:
--   • Vercel Cron firing /api/cron/run-routines is the primary scheduler,
--     but on Hobby plans or when CRON_SECRET isn't wired, the hourly tick
--     never lands and routines silently stall. The user complaint was
--     "routines only run when I press the admin Fire button."
--   • Adding a user-scoped claim lets the Routines panel opportunistically
--     fire any due routines on page load — so the experience stops depending
--     on cron infrastructure that the user can't easily debug.
--
-- Same atomicity guarantees as claim_due_routines (FOR UPDATE SKIP LOCKED
-- inside a CTE + UPDATE…RETURNING), but the candidate set is filtered to a
-- single user_id. Two overlapping requests for the same user never see the
-- same row.

CREATE OR REPLACE FUNCTION claim_due_routines_for_user(
  p_user_id UUID,
  p_limit   INT DEFAULT 25
)
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
    WHERE r.user_id = p_user_id
      AND r.status = 'active'
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
