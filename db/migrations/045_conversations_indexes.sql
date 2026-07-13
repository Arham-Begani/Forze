-- 045_conversations_indexes.sql
--
-- Hot-path indexes + a hardened merge_venture_context.
--
-- `conversations` has had ZERO secondary indexes since 001 — every module
-- workspace load filters by (venture_id, module_id) and the admin analytics
-- and the stuck-run sweeper filter by status. `ventures(project_id)` backs
-- the dashboard project tree on every layout load.
--
-- Additive + idempotent: safe to run repeatedly, no code dependency — the
-- app merely gets faster; nothing breaks if this migration isn't applied.

-- Hot path: getConversationsByModule (lib/queries.ts) — loaded on every
-- module workspace open and every co-pilot run.
CREATE INDEX IF NOT EXISTS idx_conversations_venture_module_time
  ON conversations(venture_id, module_id, created_at DESC);

-- Partial: only rows currently 'running' (a handful at any moment, so the
-- index stays tiny). Backs the stuck-run sweeper cron
-- (/api/cron/sweep-stuck-runs) and any admin running-runs metric.
CREATE INDEX IF NOT EXISTS idx_conversations_running_created
  ON conversations(created_at)
  WHERE status = 'running';

-- Dashboard project tree: ventures are listed per project on every load.
CREATE INDEX IF NOT EXISTS idx_ventures_project
  ON ventures(project_id);

-- ── Harden merge_venture_context (from migration 008) ────────────────────────
--
-- ventures.context is nullable (001 defines it as JSONB DEFAULT '{}' with no
-- NOT NULL), and jsonb_set(NULL, ...) returns NULL — so the original function
-- would silently wipe context for a legacy null-context row. COALESCE makes
-- the merge safe regardless of the row's state. CREATE OR REPLACE is
-- idempotent and keeps the exact signature lib/queries.ts calls.
CREATE OR REPLACE FUNCTION merge_venture_context(
  venture_id_val UUID,
  context_key TEXT,
  context_value JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE ventures
  SET context = jsonb_set(COALESCE(context, '{}'::jsonb), ARRAY[context_key], context_value),
      updated_at = NOW()
  WHERE id = venture_id_val;
END;
$$ LANGUAGE plpgsql;

-- Heal any legacy null-context rows so even the pre-045 function (or direct
-- jsonb_set callers) can never hit the NULL case again. Idempotent.
UPDATE ventures SET context = '{}'::jsonb WHERE context IS NULL;
