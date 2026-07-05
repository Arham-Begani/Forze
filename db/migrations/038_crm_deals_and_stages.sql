-- 038_crm_deals_and_stages.sql
-- Real sales pipeline: per-venture customizable stages + deals linked to
-- leads. Deals are only ever created via an explicit "Convert to Deal"
-- action (see app/api/ventures/[id]/crm/deals/route.ts) — this migration
-- does NOT backfill deals for existing leads, since that would fabricate
-- deal values/stages for historical data with no real signal.

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  title TEXT NOT NULL,
  value NUMERIC,
  probability INTEGER CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
  expected_close_date DATE,
  lost_reason TEXT,
  owner_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_venture ON pipeline_stages(venture_id, position);
CREATE INDEX IF NOT EXISTS idx_deals_venture ON deals(venture_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead ON deals(lead_id);

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venture members manage pipeline stages" ON public.pipeline_stages;
CREATE POLICY "Venture members manage pipeline stages" ON public.pipeline_stages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = pipeline_stages.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = pipeline_stages.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Venture members manage deals" ON public.deals;
CREATE POLICY "Venture members manage deals" ON public.deals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = deals.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = deals.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  );
