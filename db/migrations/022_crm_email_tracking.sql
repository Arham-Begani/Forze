-- 022_crm_email_tracking.sql
-- Track Gmail message/thread IDs for CRM outreach campaigns.

ALTER TABLE outreach_campaigns
  ADD COLUMN IF NOT EXISTS thread_ids TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  google_message_id TEXT NOT NULL,
  google_thread_id TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_messages_campaign_id
  ON outreach_messages(campaign_id);

CREATE INDEX IF NOT EXISTS idx_outreach_messages_lead_id
  ON outreach_messages(lead_id);

CREATE INDEX IF NOT EXISTS idx_outreach_messages_thread_id
  ON outreach_messages(google_thread_id);
