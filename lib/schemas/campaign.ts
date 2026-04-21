import { z } from 'zod'

// ─── Base schemas ──────────────────────────────────────────────────────────────

export const CampaignSchema = z.object({
  id: z.string().uuid(),
  venture_id: z.string().uuid(),
  created_by: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']),
  data_source: z.enum(['youtube', 'twitter', 'linkedin', 'manual', 'subreddit', 'direct']),
  data_source_config: z.record(z.unknown()).optional().default({}),
  target_count: z.number().int().min(0).optional(),
  subject_line: z.string().nullable().optional(),
  subject_line_variants: z.array(z.string()).optional().default([]),
  email_body: z.string().nullable().optional(),
  email_body_variants: z.array(z.string()).optional().default([]),
  send_mode: z.enum(['all_now', 'staggered']).optional().default('all_now'),
  stagger_days: z.number().int().min(1).nullable().optional(),
  scheduled_send_time: z.string().nullable().optional(),
  enable_followups: z.boolean().optional().default(false),
  followup_delay_hours: z.number().int().min(1).optional().default(72),
  followup_message: z.string().nullable().optional(),
  max_followups: z.number().int().min(1).max(5).optional().default(2),
  sent_count: z.number().int().min(0).optional().default(0),
  opened_count: z.number().int().min(0).optional().default(0),
  clicked_count: z.number().int().min(0).optional().default(0),
  replied_count: z.number().int().min(0).optional().default(0),
  bounced_count: z.number().int().min(0).optional().default(0),
  unsubscribed_count: z.number().int().min(0).optional().default(0),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export const CampaignLeadSchema = z.object({
  id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().nullable().optional(),
  email: z.string().email(),
  company: z.string().nullable().optional(),
  job_title: z.string().nullable().optional(),
  profile_url: z.string().url().nullable().optional(),
  source: z.enum(['youtube_comment', 'twitter_follower', 'reddit_comment', 'linkedin', 'manual']),
  source_context: z.record(z.unknown()).optional().default({}),
  email_sent_at: z.string().nullable().optional(),
  email_opened_at: z.string().nullable().optional(),
  email_clicked_at: z.string().nullable().optional(),
  email_replied_at: z.string().nullable().optional(),
  email_subject_sent: z.string().nullable().optional(),
  email_body_sent: z.string().nullable().optional(),
  personalization_data: z.record(z.unknown()).optional().default({}),
  followup_count: z.number().int().min(0).optional().default(0),
  last_followup_sent_at: z.string().nullable().optional(),
  engagement_status: z.enum(['fresh', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed']),
  send_status: z.enum(['pending', 'sending', 'sent', 'failed', 'suppressed']).optional().default('pending'),
  unsubscribed_at: z.string().nullable().optional(),
  bounced_at: z.string().nullable().optional(),
  last_send_error: z.string().nullable().optional(),
  send_attempts: z.number().int().min(0).optional().default(0),
  last_attempt_at: z.string().nullable().optional(),
  verified: z.boolean().optional().default(false),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export const GmailIntegrationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  email_address: z.string().email(),
  access_token: z.string(),
  refresh_token: z.string(),
  token_expires_at: z.string(),
  scope: z.array(z.string()).optional().default([]),
  connected: z.boolean().optional().default(true),
  last_verified_at: z.string().optional(),
  status: z.enum(['active', 'disconnected', 'expired', 'error']),
  error_message: z.string().nullable().optional(),
  daily_send_limit: z.number().int().optional().default(2000),
  daily_sent_count: z.number().int().optional().default(0),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export const CampaignReplySchema = z.object({
  id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  campaign_lead_id: z.string().uuid().nullable().optional(),
  from_email: z.string().email(),
  from_name: z.string().nullable().optional(),
  subject: z.string(),
  body: z.string(),
  gmail_message_id: z.string(),
  gmail_thread_id: z.string().nullable().optional(),
  received_at: z.string(),
  reply_type: z.enum(['interested', 'uninterested', 'question', 'spam', 'ooo', 'unknown']),
  sentiment_score: z.number().min(-1).max(1).optional().default(0),
  summary: z.string().nullable().optional(),
  created_at: z.string().optional(),
})

// ─── Input schemas ─────────────────────────────────────────────────────────────

export const CreateCampaignSchema = z.object({
  venture_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  data_source: z.enum(['youtube', 'twitter', 'linkedin', 'manual', 'subreddit', 'direct']).default('manual'),
  data_source_config: z.record(z.unknown()).optional().default({}),
})

// Direct Mail — the "mail anyone" channel. Accepts just an email per row;
// the API route will derive a display first name when the caller omits it.
export const UploadDirectRecipientsSchema = z.object({
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        first_name: z.string().min(1).max(100).optional(),
      })
    )
    .min(1)
    .max(2000),
})

export const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional(),
  subject_line: z.string().optional(),
  subject_line_variants: z.array(z.string()).optional(),
  email_body: z.string().optional(),
  email_body_variants: z.array(z.string()).optional(),
  enable_followups: z.boolean().optional(),
  followup_delay_hours: z.number().int().min(1).optional(),
  followup_message: z.string().optional(),
  max_followups: z.number().int().min(1).max(5).optional(),
})

export const SendCampaignSchema = z.object({
  subjectLineApproved: z.string().min(1),
  emailBodyApproved: z.string().min(1),
  sendMode: z.enum(['all_now', 'staggered']).default('all_now'),
  staggerDays: z.number().int().min(1).optional(),
  scheduledTime: z.string().optional(),
})

export const UploadLeadsSchema = z.object({
  leads: z
    .array(
      z.object({
        first_name: z.string().min(1).max(100),
        last_name: z.string().optional(),
        email: z.string().email(),
        company: z.string().optional(),
        job_title: z.string().optional(),
      })
    )
    .min(1)
    .max(2000),
})

export const GenerateEmailSchema = z.object({
  ventureDescription: z.string().min(1).max(2000),
  targetAudience: z.string().min(1).max(500),
  exampleLeads: z
    .array(
      z.object({
        firstName: z.string().max(100),
        company: z.string().max(200).optional(),
        jobTitle: z.string().max(200).optional(),
      })
    )
    .max(10)
    .optional()
    .default([]),
})

// ─── TypeScript interfaces ─────────────────────────────────────────────────────

export type Campaign = z.infer<typeof CampaignSchema>
export type CampaignLead = z.infer<typeof CampaignLeadSchema>
export type GmailIntegration = z.infer<typeof GmailIntegrationSchema>
export type CampaignReply = z.infer<typeof CampaignReplySchema>
export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>
export type SendCampaignInput = z.infer<typeof SendCampaignSchema>
export type UploadLeadsInput = z.infer<typeof UploadLeadsSchema>
export type UploadDirectRecipientsInput = z.infer<typeof UploadDirectRecipientsSchema>
export type GenerateEmailInput = z.infer<typeof GenerateEmailSchema>

export interface GeneratedEmail {
  subject_line: string
  subject_line_variants: string[]
  email_body: string
  email_body_variants: string[]
}

export interface ReplyAnalysis {
  type: CampaignReply['reply_type']
  sentiment_score: number
  summary: string
}

export interface CampaignMetrics {
  sent: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  open_rate: number
  click_rate: number
  reply_rate: number
}

export interface LeadsByStatus {
  fresh: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  unsubscribed: number
}
