-- 040_fix_venture_members_rls_recursion.sql
-- Fixes a pre-existing bug in 024_venture_collaborators.sql's RLS policy on
-- venture_members:
--
--   CREATE POLICY "Users can view members of their ventures" ON venture_members
--     FOR SELECT USING (
--       user_id = auth.uid() OR
--       venture_id IN (SELECT venture_id FROM venture_members WHERE user_id = auth.uid())
--     );
--
-- The subquery reads venture_members from WITHIN venture_members' own
-- policy — Postgres has to re-apply the same policy to evaluate that inner
-- SELECT, which requires evaluating the policy again, forever. This never
-- surfaced before because nothing else's RLS policy needed to read
-- venture_members as a dependency. 034_crm_rls.sql's policies (leads,
-- analytics_events, outreach_campaigns, outreach_messages, testimonials) —
-- and 036/037/038/039's — all join through venture_members, so they now hit
-- this the moment RLS actually evaluates: "infinite recursion detected in
-- policy for relation venture_members".
--
-- Fix: move the self-referential lookup into a SECURITY DEFINER function.
-- Such a function runs with the privileges of its owner (the migration
-- role, which owns the table) rather than the calling user — table owners
-- bypass RLS by default (ENABLE ROW LEVEL SECURITY does not restrict the
-- owner; only FORCE ROW LEVEL SECURITY would), so the function's internal
-- query does not re-trigger the policy. This is the standard fix for this
-- class of bug.

CREATE OR REPLACE FUNCTION public.is_venture_member(p_venture_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.venture_members
    WHERE venture_id = p_venture_id AND user_id = p_user_id
  );
$$;

DROP POLICY IF EXISTS "Users can view members of their ventures" ON public.venture_members;
CREATE POLICY "Users can view members of their ventures" ON public.venture_members
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR public.is_venture_member(venture_members.venture_id, (SELECT auth.uid()))
  );
