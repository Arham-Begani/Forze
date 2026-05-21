-- 029_landing_assets.sql
-- Per-venture, user-supplied image assets for the Landing Page module.
--
-- A founder uploads their logo, hero photo, product screenshots, team
-- portraits, customer logos — Forze persists them in a public Supabase
-- Storage bucket and surfaces them to the Production Pipeline agent. The
-- agent reads the asset URLs + labels from venture.context and threads
-- them into the generated component as <img src="..."> references.
--
-- One row = one uploaded image. `kind` is a hint the founder supplies
-- (logo, hero, product-screenshot, team, customer-logo, etc.) so the


-- agent knows where to slot it.

CREATE TABLE IF NOT EXISTS public.landing_assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id    UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  public_url    TEXT NOT NULL,
  label         TEXT NOT NULL DEFAULT '',
  alt_text      TEXT NOT NULL DEFAULT '',
  kind          TEXT NOT NULL DEFAULT 'image'
                  CHECK (kind IN ('logo','hero','product','team','customer-logo','background','testimonial','feature','image')),
  mime_type     TEXT NOT NULL,
  byte_size     INT  NOT NULL,
  width         INT,
  height        INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_assets_venture_created
  ON public.landing_assets (venture_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_assets_user_created
  ON public.landing_assets (user_id, created_at DESC);

ALTER TABLE public.landing_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS landing_assets_select_member ON public.landing_assets;
CREATE POLICY landing_assets_select_member
  ON public.landing_assets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.venture_members vm
      WHERE vm.venture_id = landing_assets.venture_id
        AND vm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.ventures v
      WHERE v.id = landing_assets.venture_id
        AND v.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS landing_assets_insert_editor ON public.landing_assets;
CREATE POLICY landing_assets_insert_editor
  ON public.landing_assets
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.venture_members vm
        WHERE vm.venture_id = landing_assets.venture_id
          AND vm.user_id = auth.uid()
          AND vm.role IN ('owner','admin','editor')
      )
      OR EXISTS (
        SELECT 1 FROM public.ventures v
        WHERE v.id = landing_assets.venture_id
          AND v.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS landing_assets_update_editor ON public.landing_assets;
CREATE POLICY landing_assets_update_editor
  ON public.landing_assets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.venture_members vm
      WHERE vm.venture_id = landing_assets.venture_id
        AND vm.user_id = auth.uid()
        AND vm.role IN ('owner','admin','editor')
    )
    OR EXISTS (
      SELECT 1 FROM public.ventures v
      WHERE v.id = landing_assets.venture_id
        AND v.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS landing_assets_delete_editor ON public.landing_assets;
CREATE POLICY landing_assets_delete_editor
  ON public.landing_assets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.venture_members vm
      WHERE vm.venture_id = landing_assets.venture_id
        AND vm.user_id = auth.uid()
        AND vm.role IN ('owner','admin','editor')
    )
    OR EXISTS (
      SELECT 1 FROM public.ventures v
      WHERE v.id = landing_assets.venture_id
        AND v.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.set_landing_assets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_landing_assets_updated_at ON public.landing_assets;
CREATE TRIGGER trg_landing_assets_updated_at
  BEFORE UPDATE ON public.landing_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_landing_assets_updated_at();
