-- 028_inspiration_enhancements.sql
-- Extend inspiration_analyses with the multi-pass vision outputs, accessibility
-- validation, quality scoring, and merge-weighting columns described in
-- docs/INSPIRATION_SYSTEM_IMPROVEMENTS.md. Pure additive — every new column is
-- nullable / has a default so existing rows (and existing API routes) continue
-- working untouched.
--
-- The hand-off to the pipeline agent still rides on `tokens` JSONB (no schema
-- change to ventures.context.inspirationTokens). The new columns are read by
-- the editor UI to give founders accessibility warnings, score recommendations,
-- and per-pass evidence for why a given token was chosen.

ALTER TABLE public.inspiration_analyses
  -- Multi-pass vision evidence (each Gemini call writes one).
  ADD COLUMN IF NOT EXISTS pass1_design_system     JSONB,
  ADD COLUMN IF NOT EXISTS pass2_components        JSONB,
  ADD COLUMN IF NOT EXISTS pass3_antipatterns      JSONB,
  ADD COLUMN IF NOT EXISTS detected_sections       JSONB,
  ADD COLUMN IF NOT EXISTS interaction_states      JSONB,
  ADD COLUMN IF NOT EXISTS context_relevance       JSONB,

  -- Accessibility audit output (WCAG contrast + readability + focus state).
  ADD COLUMN IF NOT EXISTS accessibility_report    JSONB,
  ADD COLUMN IF NOT EXISTS has_contrast_issues     BOOLEAN,
  ADD COLUMN IF NOT EXISTS requires_manual_review  BOOLEAN,

  -- Quality scoring + recommendations.
  ADD COLUMN IF NOT EXISTS quality_score           JSONB,
  ADD COLUMN IF NOT EXISTS recommendations         TEXT[] NOT NULL DEFAULT '{}',

  -- Multi-URL weighting (when 2-3 URLs were blended). Shape:
  --   { "stripe.com": 0.6, "vercel.com": 0.3, "linear.com": 0.1 }
  ADD COLUMN IF NOT EXISTS merge_weights           JSONB,

  -- Lifecycle / cost tracking.
  ADD COLUMN IF NOT EXISTS extracted_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gemini_cost_tokens      INT;

-- Helpful filter for the dashboard's "needs review" badge.
CREATE INDEX IF NOT EXISTS idx_inspiration_analyses_needs_review
  ON public.inspiration_analyses (venture_id)
  WHERE requires_manual_review = TRUE;
