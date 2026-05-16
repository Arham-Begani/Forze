-- 023_venture_subdomains.sql
-- Add per-venture subdomain for wildcard subdomain routing.

ALTER TABLE public.ventures
  ADD COLUMN IF NOT EXISTS subdomain TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ventures_subdomain_unique
  ON public.ventures (LOWER(subdomain))
  WHERE subdomain IS NOT NULL;

-- Slugify a venture name into a URL-safe subdomain label.
-- Lowercased, alphanumeric + hyphens, collapsed, trimmed, max 32 chars.
CREATE OR REPLACE FUNCTION public.slugify_venture_name(input TEXT)
RETURNS TEXT AS $$
DECLARE
  slug TEXT;
BEGIN
  slug := LOWER(COALESCE(input, ''));
  slug := REGEXP_REPLACE(slug, '[^a-z0-9]+', '-', 'g');
  slug := REGEXP_REPLACE(slug, '(^-+|-+$)', '', 'g');
  slug := SUBSTRING(slug FROM 1 FOR 32);
  IF slug IS NULL OR slug = '' THEN
    slug := 'venture';
  END IF;
  RETURN slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill: generate a unique subdomain for each existing venture.
DO $$
DECLARE
  v RECORD;
  base TEXT;
  candidate TEXT;
  attempt INT;
BEGIN
  FOR v IN
    SELECT id, name FROM public.ventures WHERE subdomain IS NULL
  LOOP
    base := public.slugify_venture_name(v.name);
    candidate := base;
    attempt := 0;

    WHILE EXISTS (
      SELECT 1 FROM public.ventures
      WHERE LOWER(subdomain) = LOWER(candidate) AND id <> v.id
    ) LOOP
      attempt := attempt + 1;
      candidate := SUBSTRING(base FROM 1 FOR 26) || '-' || SUBSTRING(MD5(v.id::TEXT || attempt::TEXT) FROM 1 FOR 5);
    END LOOP;

    UPDATE public.ventures SET subdomain = candidate WHERE id = v.id;
  END LOOP;
END $$;
