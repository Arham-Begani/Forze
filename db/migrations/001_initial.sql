-- 001_initial.sql — Forge schema

-- Users (Synchronized with auth.users via 000_supabase_auth_sync.sql)
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  plan        TEXT DEFAULT 'free',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Ventures
CREATE TABLE IF NOT EXISTS ventures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  context     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id    UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  module_id     TEXT NOT NULL CHECK (module_id IN (
    'research',
    'branding',
    'marketing',
    'landing',
    'feasibility',
    'full-launch',
    'general',
    'shadow-board',
    'investor-kit',
    'launch-autopilot',
    'mvp-scalpel'
  )),
  prompt        TEXT NOT NULL,
  status        TEXT DEFAULT 'running' CHECK (status IN ('running','complete','failed')),
  stream_output JSONB DEFAULT '[]',
  result        JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update ventures.updated_at
CREATE OR REPLACE FUNCTION update_ventures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ventures_updated_at
  BEFORE UPDATE ON ventures
  FOR EACH ROW
  EXECUTE FUNCTION update_ventures_updated_at();
