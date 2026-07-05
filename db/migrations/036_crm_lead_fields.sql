-- 036_crm_lead_fields.sql
-- Extended lead fields for real CRM workflows: company/phone for context,
-- tags for segmentation, owner_id for assignment. All nullable/additive —
-- no backfill needed. owner_id is validated at the app layer against
-- venture_members for the lead's venture (not FK-constrained to
-- venture_members directly, since that's a join table, not an identity).

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
