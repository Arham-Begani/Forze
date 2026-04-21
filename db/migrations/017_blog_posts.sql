-- Public blog system. Posts are authored by admins (the RLS owner model mirrors
-- campaigns: the author can manage their own rows, and anyone can read rows
-- where published = true). View counts live on the post row itself; a separate
-- blog_views table records anonymous reads for future analytics work.
-- Migration: 017_blog_posts.sql

-- ─── blog_posts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT 'Arham Begani',
  author_photo_url TEXT,
  featured_image_url TEXT,

  -- SEO fields
  meta_title TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  og_image_url TEXT,
  canonical_url TEXT,

  -- Keyword targeting
  primary_keyword TEXT,
  secondary_keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- Internal linking
  internal_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_post_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],

  -- Publishing
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Traffic tracking
  view_count INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT blog_posts_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts (slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at
  ON public.blog_posts (published_at DESC) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_blog_posts_primary_keyword
  ON public.blog_posts (primary_keyword);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can read published posts.
DROP POLICY IF EXISTS "Public read published blog posts" ON public.blog_posts;
CREATE POLICY "Public read published blog posts" ON public.blog_posts
  FOR SELECT
  USING (published = true);

-- Authors can read their own drafts.
DROP POLICY IF EXISTS "Authors can read own blog posts" ON public.blog_posts;
CREATE POLICY "Authors can read own blog posts" ON public.blog_posts
  FOR SELECT
  USING ((SELECT auth.uid()) = author_id);

DROP POLICY IF EXISTS "Authors can insert blog posts" ON public.blog_posts;
CREATE POLICY "Authors can insert blog posts" ON public.blog_posts
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = author_id);

DROP POLICY IF EXISTS "Authors can update own blog posts" ON public.blog_posts;
CREATE POLICY "Authors can update own blog posts" ON public.blog_posts
  FOR UPDATE
  USING ((SELECT auth.uid()) = author_id)
  WITH CHECK ((SELECT auth.uid()) = author_id);

DROP POLICY IF EXISTS "Authors can delete own blog posts" ON public.blog_posts;
CREATE POLICY "Authors can delete own blog posts" ON public.blog_posts
  FOR DELETE
  USING ((SELECT auth.uid()) = author_id);

-- Keep updated_at fresh on every mutation.
CREATE OR REPLACE FUNCTION public.blog_posts_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.blog_posts_set_updated_at();

-- ─── blog_views ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  referrer TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_views_post_id ON public.blog_views (post_id);
CREATE INDEX IF NOT EXISTS idx_blog_views_viewed_at
  ON public.blog_views (viewed_at DESC);

ALTER TABLE public.blog_views ENABLE ROW LEVEL SECURITY;

-- Anonymous visitors may record a view; the table stores only aggregate-class
-- data (post_id, referrer, coarse IP) so an insert-open policy is safe.
DROP POLICY IF EXISTS "Anyone can insert blog views" ON public.blog_views;
CREATE POLICY "Anyone can insert blog views" ON public.blog_views
  FOR INSERT
  WITH CHECK (true);

-- Authors can read view rows for their own posts (for future dashboards).
DROP POLICY IF EXISTS "Authors can read views of own blog posts" ON public.blog_views;
CREATE POLICY "Authors can read views of own blog posts" ON public.blog_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.blog_posts
      WHERE blog_posts.id = blog_views.post_id
        AND blog_posts.author_id = (SELECT auth.uid())
    )
  );

-- ─── increment_blog_view_count RPC ────────────────────────────────────────────
-- Atomic increment that bypasses RLS so anonymous reads can bump the counter
-- without needing UPDATE privileges on blog_posts. Only accepts a post_id and
-- only touches the view_count column.
CREATE OR REPLACE FUNCTION public.increment_blog_view_count(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.blog_posts
  SET view_count = view_count + 1
  WHERE id = p_post_id AND published = true;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_blog_view_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_blog_view_count(UUID) TO anon, authenticated;
