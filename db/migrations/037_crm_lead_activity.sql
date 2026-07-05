-- 037_crm_lead_activity.sql
-- Notes + activity timeline for leads. Also doubles as the deal-stage-change
-- log for the Phase 3 pipeline (type='deal_stage_change') so there's no need
-- for a second activity table there.
--
-- RLS is included in this same migration, not deferred — this is the one net
-- new table in the lead-depth phase, so it's the cheapest place to not
-- repeat the gap that 034_crm_rls.sql had to retroactively fix.

CREATE TABLE IF NOT EXISTS lead_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id),
  type TEXT NOT NULL CHECK (type IN ('note', 'status_change', 'field_change', 'email_sent', 'deal_stage_change')),
  body TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activity_lead_id ON lead_activity(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activity_venture_id ON lead_activity(venture_id);

ALTER TABLE lead_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venture members manage lead activity" ON public.lead_activity;
CREATE POLICY "Venture members manage lead activity" ON public.lead_activity
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = lead_activity.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venture_members
      WHERE venture_members.venture_id = lead_activity.venture_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  );
