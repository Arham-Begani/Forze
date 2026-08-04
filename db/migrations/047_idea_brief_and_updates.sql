-- 047_idea_brief_and_updates.sql
-- Conversational idea intake + living idea updates.
--
-- Today a venture is seeded from one free-text column (`projects.global_idea`)
-- and there is no way to change it afterwards. This migration adds:
--
--   1. `projects.idea_brief`   — the STRUCTURED brief produced by the intake
--                                chatbot (problem / customer / solution /
--                                differentiator / model / features).
--   2. `projects.idea_version` — monotonically increasing counter, bumped every
--                                time the founder logs an idea update.
--   3. `conversations.idea_version` — the idea version a module run was built
--                                from, so the UI can flag stale output.
--   4. `idea_updates`          — append-only changelog of idea tweaks/pivots.
--
-- Everything here is ADDITIVE and IDEMPOTENT. `global_idea` keeps its exact
-- current meaning and stays the source of truth for every existing consumer
-- (run route, questions route, investor-kit, lead-scout, outreach-brief) — the
-- intake flow simply writes a better-synthesized paragraph into it. Code that
-- reads these new columns must tolerate NULL so the app keeps working if this
-- migration has not been applied yet.

-- ─── 1 + 2. Structured brief + version counter on projects ───────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS idea_brief JSONB;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS idea_version INTEGER NOT NULL DEFAULT 1;

-- ─── 3. Stamp each module run with the idea version it was built from ────────
-- Nullable on purpose: every pre-existing conversation reads as "unknown",
-- which the staleness check treats as NOT stale. No false badges on old data.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS idea_version INTEGER;

-- ─── 4. Idea changelog ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.idea_updates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- How the founder framed the change. Drives the chip in the timeline UI.
  kind          TEXT NOT NULL DEFAULT 'other'
                  CHECK (kind IN ('feature', 'pivot', 'scope', 'audience', 'tweak', 'other')),

  raw_text      TEXT NOT NULL,   -- the founder's own words
  ai_summary    TEXT,            -- one-line normalisation of raw_text

  -- { modules: ['landing', 'shadow-board'], rationale: '...' }
  impact        JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- projects.idea_version AFTER this update was folded in.
  brief_version INTEGER NOT NULL DEFAULT 1,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idea_updates_project_created
  ON public.idea_updates (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_idea_updates_user_created
  ON public.idea_updates (user_id, created_at DESC);

ALTER TABLE public.idea_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS idea_updates_select_own ON public.idea_updates;
CREATE POLICY idea_updates_select_own
  ON public.idea_updates
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS idea_updates_insert_own ON public.idea_updates;
CREATE POLICY idea_updates_insert_own
  ON public.idea_updates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS idea_updates_update_own ON public.idea_updates;
CREATE POLICY idea_updates_update_own
  ON public.idea_updates
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS idea_updates_delete_own ON public.idea_updates;
CREATE POLICY idea_updates_delete_own
  ON public.idea_updates
  FOR DELETE
  USING (auth.uid() = user_id);

-- ─── 5. Atomic version bump ──────────────────────────────────────────────────
-- Two updates logged at the same moment must not both read version N and both
-- write N+1. This does the read and the write in one statement and returns the
-- new version. Callers fall back to a read-modify-write if the RPC is absent
-- (i.e. this migration has not been applied to that environment yet).

CREATE OR REPLACE FUNCTION public.bump_project_idea(
  project_id_val UUID,
  new_brief      JSONB,
  new_summary    TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  next_version INTEGER;
BEGIN
  UPDATE public.projects
     SET idea_version = COALESCE(idea_version, 1) + 1,
         idea_brief   = new_brief,
         global_idea  = COALESCE(new_summary, global_idea),
         updated_at   = NOW()
   WHERE id = project_id_val
   RETURNING idea_version INTO next_version;

  RETURN next_version;
END;
$$;
