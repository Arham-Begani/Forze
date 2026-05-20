-- 027_inspiration_analyses.sql
-- "Generate from Inspiration" — design-token extraction pipeline.
--
-- A founder pastes 1–3 inspiration URLs (e.g. stripe.com, vercel.com).
-- Forze captures a representative image of each (og:image → favicon → uploaded
-- image), runs it through Gemini Vision, distills a deterministic
-- DesignTokens object, lets the founder refine the tokens, then applies them
-- to the venture's next landing-page generation run.
--
-- This migration only adds storage; it does not change any existing table
-- shape, so existing flows (landing page agent, ventures, conversations)
-- continue working unchanged. The actual "use these tokens" hand-off to the
-- pipeline agent rides on the existing `ventures.context` JSONB column via a
-- new `inspirationTokens` key — no schema migration needed for that part.

-- Per-venture, per-user audit of every inspiration run.
-- One row = one (URL set → tokens → optional generated landing page) cycle.
CREATE TABLE IF NOT EXISTS public.inspiration_analyses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id        UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Inputs
  urls              TEXT[] NOT NULL DEFAULT '{}',
  capture_tier      SMALLINT,                            -- which fallback tier produced the image (1..5)
  capture_metadata  JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { perUrl: [{ url, tier, contentType, bytes }] }

  -- Outputs
  raw_vision        JSONB,                               -- per-URL Gemini output before merge
  tokens            JSONB,                               -- final merged DesignTokens (after user edits)
  user_adjustments  JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { "colors.primary": "#0055ff", ... }
  locked_paths      TEXT[] NOT NULL DEFAULT '{}',        -- paths the user pinned ("don't overwrite")
  confidence        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { colors: 92, typography: 88, overall: 88 }
  mood              TEXT,                                -- modern-minimal | corporate-formal | ...

  -- Lifecycle
  status            TEXT NOT NULL DEFAULT 'analyzing'
                       CHECK (status IN ('analyzing', 'complete', 'failed')),
  error_message     TEXT,
  applied_at        TIMESTAMPTZ,                         -- when the founder pushed these tokens to ventures.context

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspiration_analyses_venture_created
  ON public.inspiration_analyses (venture_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspiration_analyses_user_created
  ON public.inspiration_analyses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspiration_analyses_status
  ON public.inspiration_analyses (status);

ALTER TABLE public.inspiration_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inspiration_analyses_select_own ON public.inspiration_analyses;
CREATE POLICY inspiration_analyses_select_own
  ON public.inspiration_analyses
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS inspiration_analyses_insert_own ON public.inspiration_analyses;
CREATE POLICY inspiration_analyses_insert_own
  ON public.inspiration_analyses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS inspiration_analyses_update_own ON public.inspiration_analyses;
CREATE POLICY inspiration_analyses_update_own
  ON public.inspiration_analyses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS inspiration_analyses_delete_own ON public.inspiration_analyses;
CREATE POLICY inspiration_analyses_delete_own
  ON public.inspiration_analyses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Per-user/per-venture daily rate limit. Plain counter table — no expensive
-- joins on the hot path. Window resets every UTC day (the createdAt timestamp
-- is purely informational; the unique row is anchored by window_date).
CREATE TABLE IF NOT EXISTS public.inspiration_rate_limits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venture_id      UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  analysis_count  INT  NOT NULL DEFAULT 0,
  window_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, venture_id, window_date)
);

CREATE INDEX IF NOT EXISTS idx_inspiration_rate_limits_window
  ON public.inspiration_rate_limits (window_date);

ALTER TABLE public.inspiration_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inspiration_rate_limits_select_own ON public.inspiration_rate_limits;
CREATE POLICY inspiration_rate_limits_select_own
  ON public.inspiration_rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS inspiration_rate_limits_insert_own ON public.inspiration_rate_limits;
CREATE POLICY inspiration_rate_limits_insert_own
  ON public.inspiration_rate_limits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS inspiration_rate_limits_update_own ON public.inspiration_rate_limits;
CREATE POLICY inspiration_rate_limits_update_own
  ON public.inspiration_rate_limits
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger keeps updated_at fresh on inspiration_analyses + rate_limits.
CREATE OR REPLACE FUNCTION public.set_inspiration_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspiration_analyses_updated_at ON public.inspiration_analyses;
CREATE TRIGGER trg_inspiration_analyses_updated_at
  BEFORE UPDATE ON public.inspiration_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_inspiration_updated_at();

DROP TRIGGER IF EXISTS trg_inspiration_rate_limits_updated_at ON public.inspiration_rate_limits;
CREATE TRIGGER trg_inspiration_rate_limits_updated_at
  BEFORE UPDATE ON public.inspiration_rate_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_inspiration_updated_at();
