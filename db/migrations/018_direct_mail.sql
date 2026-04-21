-- Direct Mail channel — extend the campaign_data_source enum so a campaign
-- created from the "Direct Mail" tab can be distinguished from cold outreach
-- sources (youtube, twitter, linkedin, manual, subreddit). Everything else
-- (leads, analytics, tracking, RLS) already works for any campaign regardless
-- of its declared source, so this is the only schema change required.
--
-- Migration: 018_direct_mail.sql

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'campaign_data_source'
          AND e.enumlabel = 'direct'
    ) THEN
        ALTER TYPE campaign_data_source ADD VALUE 'direct';
    END IF;
END $$;
