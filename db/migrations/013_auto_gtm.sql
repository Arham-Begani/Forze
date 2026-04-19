  -- Auto-GTM Layer: Campaign Management Schema
  -- Migration: 013_auto_gtm.sql

  -- Enums
  DO $$ BEGIN
    CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    CREATE TYPE campaign_data_source AS ENUM ('youtube', 'twitter', 'linkedin', 'manual', 'subreddit');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    CREATE TYPE campaign_lead_source AS ENUM ('youtube_comment', 'twitter_follower', 'reddit_comment', 'linkedin', 'manual');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    CREATE TYPE lead_engagement_status AS ENUM ('fresh', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    CREATE TYPE gmail_integration_status AS ENUM ('active', 'disconnected', 'expired', 'error');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    CREATE TYPE campaign_reply_type AS ENUM ('interested', 'uninterested', 'question', 'spam', 'ooo', 'unknown');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  -- Campaigns table
  CREATE TABLE IF NOT EXISTS campaigns (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venture_id           UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    created_by           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    description          TEXT,
    status               campaign_status NOT NULL DEFAULT 'draft',
    data_source          campaign_data_source NOT NULL DEFAULT 'manual',
    data_source_config   JSONB DEFAULT '{}',
    target_count         INTEGER DEFAULT 0,
    subject_line         TEXT,
    subject_line_variants TEXT[] DEFAULT '{}',
    email_body           TEXT,
    email_body_variants  TEXT[] DEFAULT '{}',
    send_mode            TEXT DEFAULT 'all_now',
    stagger_days         INTEGER,
    scheduled_send_time  TIMESTAMPTZ,
    enable_followups     BOOLEAN DEFAULT FALSE,
    followup_delay_hours INTEGER DEFAULT 72,
    followup_message     TEXT,
    max_followups        INTEGER DEFAULT 2,
    sent_count           INTEGER DEFAULT 0,
    opened_count         INTEGER DEFAULT 0,
    clicked_count        INTEGER DEFAULT 0,
    replied_count        INTEGER DEFAULT 0,
    bounced_count        INTEGER DEFAULT 0,
    unsubscribed_count   INTEGER DEFAULT 0,
    started_at           TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
  );

  -- Campaign leads table
  CREATE TABLE IF NOT EXISTS campaign_leads (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id          UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    first_name           TEXT NOT NULL,
    last_name            TEXT,
    email                TEXT NOT NULL,
    company              TEXT,
    job_title            TEXT,
    profile_url          TEXT,
    source               campaign_lead_source NOT NULL DEFAULT 'manual',
    source_context       JSONB DEFAULT '{}',
    email_sent_at        TIMESTAMPTZ,
    email_opened_at      TIMESTAMPTZ,
    email_clicked_at     TIMESTAMPTZ,
    email_replied_at     TIMESTAMPTZ,
    email_subject_sent   TEXT,
    email_body_sent      TEXT,
    personalization_data JSONB DEFAULT '{}',
    followup_count       INTEGER DEFAULT 0,
    last_followup_sent_at TIMESTAMPTZ,
    engagement_status    lead_engagement_status NOT NULL DEFAULT 'fresh',
    verified             BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
  );

  -- Gmail integrations table (one per user)
  CREATE TABLE IF NOT EXISTS gmail_integrations (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    email_address        TEXT NOT NULL,
    access_token         TEXT NOT NULL,
    refresh_token        TEXT NOT NULL,
    token_expires_at     TIMESTAMPTZ NOT NULL,
    scope                TEXT[] DEFAULT '{}',
    connected            BOOLEAN DEFAULT TRUE,
    last_verified_at     TIMESTAMPTZ DEFAULT NOW(),
    status               gmail_integration_status NOT NULL DEFAULT 'active',
    error_message        TEXT,
    daily_send_limit     INTEGER DEFAULT 2000,
    daily_sent_count     INTEGER DEFAULT 0,
    daily_count_reset_at DATE DEFAULT CURRENT_DATE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
  );

  -- Campaign analytics table (daily/hourly snapshots)
  CREATE TABLE IF NOT EXISTS campaign_analytics (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    date         DATE NOT NULL,
    hour         INTEGER,
    sent         INTEGER DEFAULT 0,
    opened       INTEGER DEFAULT 0,
    clicked      INTEGER DEFAULT 0,
    replied      INTEGER DEFAULT 0,
    bounced      INTEGER DEFAULT 0,
    open_rate    FLOAT DEFAULT 0,
    click_rate   FLOAT DEFAULT 0,
    reply_rate   FLOAT DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  );

  -- Campaign replies table
  CREATE TABLE IF NOT EXISTS campaign_replies (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id       UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    campaign_lead_id  UUID REFERENCES campaign_leads(id) ON DELETE SET NULL,
    from_email        TEXT NOT NULL,
    from_name         TEXT,
    subject           TEXT NOT NULL DEFAULT '',
    body              TEXT NOT NULL DEFAULT '',
    gmail_message_id  TEXT NOT NULL UNIQUE,
    gmail_thread_id   TEXT,
    received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reply_type        campaign_reply_type NOT NULL DEFAULT 'unknown',
    sentiment_score   FLOAT DEFAULT 0,
    summary           TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_campaigns_venture_id ON campaigns(venture_id);
  CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON campaigns(created_by);
  CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
  CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_campaign_leads_email ON campaign_leads(email);
  CREATE INDEX IF NOT EXISTS idx_campaign_leads_engagement ON campaign_leads(campaign_id, engagement_status);
  CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign_date ON campaign_analytics(campaign_id, date);
  CREATE INDEX IF NOT EXISTS idx_campaign_replies_campaign_id ON campaign_replies(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_gmail_integrations_user_id ON gmail_integrations(user_id);
