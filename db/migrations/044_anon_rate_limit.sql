-- 044_anon_rate_limit.sql
--
-- IP-keyed sliding-window rate limiting for anonymous public endpoints
-- (landing-page feedback, analytics tracking, lead capture). Mirrors
-- record_rate_limit_event from migration 014 but keys on a TEXT identifier
-- (a hashed client IP) instead of a users(id) FK, since these callers are
-- unauthenticated visitors with no user row.
--
-- Additive + idempotent: safe to run repeatedly, touches nothing existing.
-- The lib/rate-limit.ts caller fails OPEN if this migration hasn't been
-- applied yet, so deploying code before SQL cannot break public endpoints.

CREATE TABLE IF NOT EXISTS anon_rate_limit_events (
  id         BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  event_key  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anon_rate_limit_events_ident_key_time
  ON anon_rate_limit_events(identifier, event_key, created_at DESC);

-- No direct table access for API roles — all reads/writes go through the
-- SECURITY DEFINER function below. RLS enabled with zero policies blocks
-- the anon/authenticated roles from touching rows directly.
ALTER TABLE anon_rate_limit_events ENABLE ROW LEVEL SECURITY;

-- Count events in the window and insert a new one atomically when under the
-- limit. Returns the resulting count so callers 429 when count > limit.
-- Also opportunistically clears expired rows for this bucket so the table
-- stays small without a scheduled vacuum job.
CREATE OR REPLACE FUNCTION record_anon_rate_limit_event(
  p_identifier  TEXT,
  p_key         TEXT,
  p_window_sec  INTEGER,
  p_limit       INTEGER
) RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH event_count AS (
    SELECT COUNT(*)::INTEGER AS count_value
    FROM anon_rate_limit_events
    WHERE identifier = p_identifier
      AND event_key = p_key
      AND created_at > NOW() - (p_window_sec || ' seconds')::interval
  ),
  inserted AS (
    INSERT INTO anon_rate_limit_events (identifier, event_key)
    SELECT p_identifier, p_key
    WHERE (SELECT count_value FROM event_count) < p_limit
    RETURNING 1
  ),
  cleaned AS (
    DELETE FROM anon_rate_limit_events
    WHERE identifier = p_identifier
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
