-- 043_backfill_missing_venture_members.sql
-- Heal ventures whose owner has no venture_members row.
--
-- Migration 024 backfilled venture_members from the ventures that existed when
-- it ran, but createVenture never inserted an owner row afterward — so every
-- venture created after 024 was applied had no membership row. Because
-- getVentureAccess() (pre-fix) only fell back to ventures.user_id when the
-- table was MISSING, those owners resolved to null access and every module run
-- died with "Not found". The application now (a) seeds the owner row on create
-- and (b) falls back to ventures.user_id ownership, so this only needs to run
-- once to repair historical rows (and make them appear in member-scoped
-- listings like getVenturesByUser). Idempotent — safe to re-run.

INSERT INTO venture_members (venture_id, user_id, role, created_at)
SELECT v.id, v.user_id, 'owner', v.created_at
FROM ventures v
WHERE NOT EXISTS (
  SELECT 1 FROM venture_members m
  WHERE m.venture_id = v.id
    AND m.user_id = v.user_id
)
ON CONFLICT (venture_id, user_id) DO NOTHING;
