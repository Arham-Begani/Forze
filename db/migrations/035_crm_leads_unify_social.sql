-- 035_crm_leads_unify_social.sql
-- Unify social leads (Instagram commenters) into the real `leads` table.
-- Previously, "social leads" were computed live on every request from
-- marketing_assets (see aggregateLeads/aggregateCrmInbox) — not persisted
-- rows, so they had no primary key to attach a status/notes/tags/bulk
-- actions to. This migration relaxes `email` to nullable and adds an
-- `external_identity` column (e.g. "instagram:handle") so a commenter can be
-- upserted idempotently without an email address, giving social and email
-- leads one shared model.

ALTER TABLE leads
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS external_identity TEXT;

-- A lead must be reachable by at least one identity (email OR external_identity).
ALTER TABLE leads
  ADD CONSTRAINT leads_has_identity CHECK (email IS NOT NULL OR external_identity IS NOT NULL);

-- Idempotent upsert target for social commenters: one lead per
-- (venture_id, external_identity) pair. Partial index since most rows
-- (email captures) have a null external_identity.
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_venture_external_identity
  ON leads (venture_id, external_identity)
  WHERE external_identity IS NOT NULL;
