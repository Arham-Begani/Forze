CREATE TABLE IF NOT EXISTS public.google_calendar_integrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address     TEXT,
  calendar_id       TEXT NOT NULL DEFAULT 'primary',
  access_token      TEXT NOT NULL DEFAULT '',
  refresh_token     TEXT NOT NULL DEFAULT '',
  token_expires_at  TIMESTAMPTZ,
  scope             TEXT[] NOT NULL DEFAULT '{}',
  connected         BOOLEAN NOT NULL DEFAULT TRUE,
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'expired', 'error', 'disconnected')),
  error_message     TEXT,
  last_verified_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.google_calendar_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_calendar_integrations_select_own ON public.google_calendar_integrations;
CREATE POLICY google_calendar_integrations_select_own
  ON public.google_calendar_integrations
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS google_calendar_integrations_insert_own ON public.google_calendar_integrations;
CREATE POLICY google_calendar_integrations_insert_own
  ON public.google_calendar_integrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS google_calendar_integrations_update_own ON public.google_calendar_integrations;
CREATE POLICY google_calendar_integrations_update_own
  ON public.google_calendar_integrations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS google_calendar_integrations_delete_own ON public.google_calendar_integrations;
CREATE POLICY google_calendar_integrations_delete_own
  ON public.google_calendar_integrations
  FOR DELETE
  USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'routine_channel'
      AND e.enumlabel = 'instagram_comment_reply'
  ) THEN
    ALTER TYPE routine_channel ADD VALUE 'instagram_comment_reply';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'routine_channel'
      AND e.enumlabel = 'comment_suggestions'
  ) THEN
    ALTER TYPE routine_channel ADD VALUE 'comment_suggestions';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'routine_channel'
      AND e.enumlabel = 'agenda'
  ) THEN
    ALTER TYPE routine_channel ADD VALUE 'agenda';
  END IF;
END $$;

ALTER TABLE public.routines
  ADD COLUMN IF NOT EXISTS approval_window_hours SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE public.routines
  DROP CONSTRAINT IF EXISTS routine_approval_window_range;

ALTER TABLE public.routines
  ADD CONSTRAINT routine_approval_window_range
  CHECK (approval_window_hours >= 0 AND approval_window_hours <= 168);

CREATE TABLE IF NOT EXISTS public.venture_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id         UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  url                TEXT,
  url_key            TEXT NOT NULL,
  source_url         TEXT,
  starts_at          TIMESTAMPTZ,
  ends_at            TIMESTAMPTZ,
  city               TEXT,
  venue              TEXT,
  format             TEXT NOT NULL DEFAULT 'in_person'
                       CHECK (format IN ('in_person', 'virtual', 'hybrid')),
  price_note         TEXT,
  audience           TEXT,
  why_relevant       TEXT,
  score              SMALLINT NOT NULL DEFAULT 0,
  conflicts          JSONB NOT NULL DEFAULT '[]'::jsonb,
  status             TEXT NOT NULL DEFAULT 'suggested'
                       CHECK (status IN ('suggested', 'saved', 'dismissed', 'added_to_calendar')),
  calendar_event_id  TEXT,
  discovered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_venture_events_dedup
  ON public.venture_events (venture_id, url_key);

CREATE INDEX IF NOT EXISTS idx_venture_events_venture_starts
  ON public.venture_events (venture_id, starts_at);

ALTER TABLE public.venture_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venture_events_select_own ON public.venture_events;
CREATE POLICY venture_events_select_own
  ON public.venture_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS venture_events_insert_own ON public.venture_events;
CREATE POLICY venture_events_insert_own
  ON public.venture_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS venture_events_update_own ON public.venture_events;
CREATE POLICY venture_events_update_own
  ON public.venture_events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS venture_events_delete_own ON public.venture_events;
CREATE POLICY venture_events_delete_own
  ON public.venture_events
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.suggested_actions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id   UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id   UUID REFERENCES public.routines(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL
                 CHECK (kind IN ('comment_suggestion', 'comment_escalation', 'event_rsvp', 'other')),
  channel      TEXT,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  target_url   TEXT,
  context      JSONB NOT NULL DEFAULT '{}'::jsonb,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'done', 'dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggested_actions_venture_status
  ON public.suggested_actions (venture_id, status, created_at DESC);

ALTER TABLE public.suggested_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suggested_actions_select_own ON public.suggested_actions;
CREATE POLICY suggested_actions_select_own
  ON public.suggested_actions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS suggested_actions_insert_own ON public.suggested_actions;
CREATE POLICY suggested_actions_insert_own
  ON public.suggested_actions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS suggested_actions_update_own ON public.suggested_actions;
CREATE POLICY suggested_actions_update_own
  ON public.suggested_actions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS suggested_actions_delete_own ON public.suggested_actions;
CREATE POLICY suggested_actions_delete_own
  ON public.suggested_actions
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.instagram_comment_replies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venture_id      UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  routine_id      UUID REFERENCES public.routines(id) ON DELETE SET NULL,
  comment_id      TEXT NOT NULL,
  media_id        TEXT,
  comment_text    TEXT,
  reply_text      TEXT,
  classification  TEXT NOT NULL DEFAULT 'ambiguous'
                    CHECK (classification IN ('positive', 'question', 'negative', 'spam', 'ambiguous')),
  outcome         TEXT NOT NULL DEFAULT 'skipped'
                    CHECK (outcome IN ('replied', 'escalated', 'skipped', 'failed')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_instagram_comment_replies_comment
  ON public.instagram_comment_replies (comment_id);

CREATE INDEX IF NOT EXISTS idx_instagram_comment_replies_venture
  ON public.instagram_comment_replies (venture_id, created_at DESC);

ALTER TABLE public.instagram_comment_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_comment_replies_select_own ON public.instagram_comment_replies;
CREATE POLICY instagram_comment_replies_select_own
  ON public.instagram_comment_replies
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS instagram_comment_replies_insert_own ON public.instagram_comment_replies;
CREATE POLICY instagram_comment_replies_insert_own
  ON public.instagram_comment_replies
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.venture_autopilot_settings (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id                     UUID NOT NULL UNIQUE REFERENCES public.ventures(id) ON DELETE CASCADE,
  user_id                        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location                       TEXT,
  default_approval_window_hours  SMALLINT NOT NULL DEFAULT 12,
  event_radar_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  max_comment_replies_per_run    SMALLINT NOT NULL DEFAULT 10,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.venture_autopilot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venture_autopilot_settings_select_own ON public.venture_autopilot_settings;
CREATE POLICY venture_autopilot_settings_select_own
  ON public.venture_autopilot_settings
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS venture_autopilot_settings_insert_own ON public.venture_autopilot_settings;
CREATE POLICY venture_autopilot_settings_insert_own
  ON public.venture_autopilot_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS venture_autopilot_settings_update_own ON public.venture_autopilot_settings;
CREATE POLICY venture_autopilot_settings_update_own
  ON public.venture_autopilot_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS venture_autopilot_settings_delete_own ON public.venture_autopilot_settings;
CREATE POLICY venture_autopilot_settings_delete_own
  ON public.venture_autopilot_settings
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_venture_events_updated_at ON public.venture_events;
CREATE TRIGGER trg_venture_events_updated_at
  BEFORE UPDATE ON public.venture_events
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_updated_at();

DROP TRIGGER IF EXISTS trg_suggested_actions_updated_at ON public.suggested_actions;
CREATE TRIGGER trg_suggested_actions_updated_at
  BEFORE UPDATE ON public.suggested_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_updated_at();

DROP TRIGGER IF EXISTS trg_venture_autopilot_settings_updated_at ON public.venture_autopilot_settings;
CREATE TRIGGER trg_venture_autopilot_settings_updated_at
  BEFORE UPDATE ON public.venture_autopilot_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_updated_at();

DROP TRIGGER IF EXISTS trg_google_calendar_integrations_updated_at ON public.google_calendar_integrations;
CREATE TRIGGER trg_google_calendar_integrations_updated_at
  BEFORE UPDATE ON public.google_calendar_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_updated_at();

ALTER TABLE public.feature_usage_counters
  DROP CONSTRAINT IF EXISTS feature_usage_counters_feature_id_check;

ALTER TABLE public.feature_usage_counters
  ADD CONSTRAINT feature_usage_counters_feature_id_check CHECK (feature_id IN (
    'inspiration_analyze',
    'crm_email_send',
    'campaign_send',
    'lead_scout',
    'event_radar',
    'comment_reply'
  ));
