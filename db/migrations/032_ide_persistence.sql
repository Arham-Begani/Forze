-- 032_ide_persistence.sql
-- Forze IDE — account-gated persistence for the desktop (Tauri) app.
--
-- The IDE is a SEPARATE Tauri repo. It signs into the SAME Supabase project
-- the web app uses (native email/password + Google form inside the app), so a
-- Forze account is the access gate: no session → the IDE stays locked.
--
-- STORAGE SPLIT (this is the whole point — do not break it):
--   • Source code / file contents NEVER touch this database. They stay on the
--     user's machine (local SQLite + disk) to honour the "local-first,
--     sovereign — your data stays on your machine" promise on the landing page.
--   • Only the lightweight, cross-device-useful slices sync here:
--       - the PROJECT LIST (names/paths/last-opened, NOT contents)
--       - AI agent CONVERSATIONS + messages (so chat history survives a reinstall
--         or a new machine).
--
-- Every row is owned by exactly one auth.users id and protected by RLS keyed to
-- auth.uid(), identical to the pattern in 027_inspiration_analyses.sql. The IDE
-- talks to Supabase directly with the anon key (safe to ship — RLS is the
-- boundary), so a logged-in user can only ever see their own projects/chats.
--
-- Additive only: no existing table shape changes, so all current web flows keep
-- working unchanged.

-- ───────────────────────────────────────────────────────────────────────────
-- Projects opened in the IDE. METADATA ONLY — never file contents.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ide_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  -- Last known absolute path on the user's machine. Purely a convenience for
  -- "reopen where I left off" on the SAME device; it is just a string, never
  -- the directory's contents. Different devices for the same project can hold
  -- different paths — that's expected and fine.
  local_path      TEXT,
  -- Optional stable identity so the same project can be recognised across
  -- machines (e.g. its git origin URL). Lets the IDE dedupe the project list
  -- when a founder works from two laptops.
  git_remote      TEXT,

  color           TEXT,                                  -- UI accent, optional
  icon            TEXT DEFAULT '🚀',
  archived        BOOLEAN NOT NULL DEFAULT FALSE,

  last_opened_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ide_projects_user_opened
  ON public.ide_projects (user_id, last_opened_at DESC NULLS LAST);
-- Partial unique index: when a git_remote is set, a user keeps ONE row per repo
-- (cross-device dedupe). Projects without a remote are not constrained.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ide_projects_user_remote
  ON public.ide_projects (user_id, git_remote)
  WHERE git_remote IS NOT NULL;

ALTER TABLE public.ide_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ide_projects_select_own ON public.ide_projects;
CREATE POLICY ide_projects_select_own
  ON public.ide_projects FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ide_projects_insert_own ON public.ide_projects;
CREATE POLICY ide_projects_insert_own
  ON public.ide_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ide_projects_update_own ON public.ide_projects;
CREATE POLICY ide_projects_update_own
  ON public.ide_projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ide_projects_delete_own ON public.ide_projects;
CREATE POLICY ide_projects_delete_own
  ON public.ide_projects FOR DELETE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- AI agent conversation threads. project_id is nullable: a thread can be tied
-- to a project or be a free-floating "global" chat.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ide_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES public.ide_projects(id) ON DELETE CASCADE,

  title           TEXT NOT NULL DEFAULT 'New conversation',
  agent           TEXT,                                  -- 'claude-code' | 'codex' | 'gemini' | ...
  archived        BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ide_conversations_user_updated
  ON public.ide_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ide_conversations_project
  ON public.ide_conversations (project_id, updated_at DESC);

ALTER TABLE public.ide_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ide_conversations_select_own ON public.ide_conversations;
CREATE POLICY ide_conversations_select_own
  ON public.ide_conversations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ide_conversations_insert_own ON public.ide_conversations;
CREATE POLICY ide_conversations_insert_own
  ON public.ide_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ide_conversations_update_own ON public.ide_conversations;
CREATE POLICY ide_conversations_update_own
  ON public.ide_conversations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ide_conversations_delete_own ON public.ide_conversations;
CREATE POLICY ide_conversations_delete_own
  ON public.ide_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Messages within a conversation. user_id is denormalised so RLS stays a cheap
-- single-column check (no join back to ide_conversations on the hot path).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ide_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.ide_conversations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content          TEXT NOT NULL DEFAULT '',
  -- Model, token counts, tool-call payloads, etc. Keep this free of file
  -- contents — store references (paths/line ranges), not the source itself.
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ide_messages_conversation_created
  ON public.ide_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ide_messages_user
  ON public.ide_messages (user_id);

ALTER TABLE public.ide_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ide_messages_select_own ON public.ide_messages;
CREATE POLICY ide_messages_select_own
  ON public.ide_messages FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ide_messages_insert_own ON public.ide_messages;
CREATE POLICY ide_messages_insert_own
  ON public.ide_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ide_messages_update_own ON public.ide_messages;
CREATE POLICY ide_messages_update_own
  ON public.ide_messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ide_messages_delete_own ON public.ide_messages;
CREATE POLICY ide_messages_delete_own
  ON public.ide_messages FOR DELETE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Shared updated_at trigger for the IDE tables.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_ide_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ide_projects_updated_at ON public.ide_projects;
CREATE TRIGGER trg_ide_projects_updated_at
  BEFORE UPDATE ON public.ide_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_ide_updated_at();

DROP TRIGGER IF EXISTS trg_ide_conversations_updated_at ON public.ide_conversations;
CREATE TRIGGER trg_ide_conversations_updated_at
  BEFORE UPDATE ON public.ide_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_ide_updated_at();
