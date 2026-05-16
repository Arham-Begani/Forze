-- 025_testimonials.sql
-- Adds testimonials (venture-scoped, public submissions) and platform_feedback
-- (Forze platform-level feedback from authenticated users).

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  quote TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'testimonial' CHECK (kind IN ('testimonial', 'feedback')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_venture ON testimonials(venture_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimonials_lead ON testimonials(lead_id);

CREATE TABLE IF NOT EXISTS platform_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'praise', 'other')),
  message TEXT NOT NULL,
  page_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_feedback_user ON platform_feedback(user_id, created_at DESC);
