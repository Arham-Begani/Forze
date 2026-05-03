-- 010_instagram.sql
-- Expand provider CHECK constraints to include Instagram.

ALTER TABLE social_connections DROP CONSTRAINT IF EXISTS social_connections_provider_check;
ALTER TABLE social_connections ADD CONSTRAINT social_connections_provider_check
  CHECK (provider IN ('youtube', 'linkedin', 'instagram'));

ALTER TABLE marketing_assets DROP CONSTRAINT IF EXISTS marketing_assets_provider_check;
ALTER TABLE marketing_assets ADD CONSTRAINT marketing_assets_provider_check
  CHECK (provider IN ('youtube', 'linkedin', 'instagram'));

ALTER TABLE marketing_assets DROP CONSTRAINT IF EXISTS marketing_assets_asset_type_check;
ALTER TABLE marketing_assets ADD CONSTRAINT marketing_assets_asset_type_check
  CHECK (asset_type IN ('youtube_video', 'linkedin_post', 'instagram_post'));

ALTER TABLE marketing_publish_jobs DROP CONSTRAINT IF EXISTS marketing_publish_jobs_provider_check;
ALTER TABLE marketing_publish_jobs ADD CONSTRAINT marketing_publish_jobs_provider_check
  CHECK (provider IN ('youtube', 'linkedin', 'instagram'));

ALTER TABLE marketing_publish_attempts DROP CONSTRAINT IF EXISTS marketing_publish_attempts_provider_check;
ALTER TABLE marketing_publish_attempts ADD CONSTRAINT marketing_publish_attempts_provider_check
  CHECK (provider IN ('youtube', 'linkedin', 'instagram'));
