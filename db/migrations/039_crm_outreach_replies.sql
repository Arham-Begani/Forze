-- 039_crm_outreach_replies.sql
-- Persist CRM outreach replies instead of live-fetching Gmail on every
-- request (the pre-Phase-5 behavior in lib/gmail-replies.ts). Mirrors the
-- Campaigns system's already-working campaign_replies + poll-replies + cron
-- pattern. subject/body are added to outreach_messages because analyzeReply()
-- needs the original sent message to compare a reply against, and
-- outreach_messages previously stored only IDs/timestamps.

ALTER TABLE outreach_messages
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT;

CREATE TABLE IF NOT EXISTS outreach_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outreach_message_id UUID NOT NULL REFERENCES outreach_messages(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  from_email TEXT,
  subject TEXT,
  body TEXT,
  reply_type TEXT,
  sentiment_score NUMERIC,
  summary TEXT,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_replies_gmail_message_id
  ON outreach_replies(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_outreach_replies_message ON outreach_replies(outreach_message_id);
CREATE INDEX IF NOT EXISTS idx_outreach_replies_lead ON outreach_replies(lead_id);

ALTER TABLE outreach_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venture members manage outreach replies" ON public.outreach_replies;
CREATE POLICY "Venture members manage outreach replies" ON public.outreach_replies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.outreach_messages
      JOIN public.outreach_campaigns ON outreach_campaigns.id = outreach_messages.campaign_id
      JOIN public.venture_members ON venture_members.venture_id = outreach_campaigns.venture_id
      WHERE outreach_messages.id = outreach_replies.outreach_message_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outreach_messages
      JOIN public.outreach_campaigns ON outreach_campaigns.id = outreach_messages.campaign_id
      JOIN public.venture_members ON venture_members.venture_id = outreach_campaigns.venture_id
      WHERE outreach_messages.id = outreach_replies.outreach_message_id
        AND venture_members.user_id = (SELECT auth.uid())
    )
  );
