import { z } from 'zod'

// ─── Lead status / update ──────────────────────────────────────────────────────

export const LeadStatus = z.enum(['new', 'contacted', 'qualified', 'lost', 'won'])
export type LeadStatusValue = z.infer<typeof LeadStatus>

// Extended in Phase 2 to cover the new lead fields (company/phone/tags/owner)
// alongside status — all optional so a PATCH can update just one field.
export const UpdateLeadSchema = z.object({
  status: LeadStatus.optional(),
  company: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  owner_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().max(200).nullable().optional(),
})
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>

export const BulkLeadStatusSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(200),
  status: LeadStatus,
})
export type BulkLeadStatusInput = z.infer<typeof BulkLeadStatusSchema>

export const BulkLeadDeleteSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(200),
})
export type BulkLeadDeleteInput = z.infer<typeof BulkLeadDeleteSchema>

export const CreateLeadNoteSchema = z.object({
  body: z.string().trim().min(1).max(4000),
})
export type CreateLeadNoteInput = z.infer<typeof CreateLeadNoteSchema>

// ─── Pipeline: stages & deals ──────────────────────────────────────────────────

export const CreateDealSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  value: z.number().min(0).nullable().optional(),
})
export type CreateDealInput = z.infer<typeof CreateDealSchema>

export const UpdateDealSchema = z.object({
  stageId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  value: z.number().min(0).nullable().optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  expectedCloseDate: z.string().nullable().optional(),
  lostReason: z.string().trim().max(500).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
})
export type UpdateDealInput = z.infer<typeof UpdateDealSchema>

export const CreatePipelineStageSchema = z.object({
  name: z.string().trim().min(1).max(60),
  position: z.number().int().min(0),
  color: z.string().trim().max(20).nullable().optional(),
})
export type CreatePipelineStageInput = z.infer<typeof CreatePipelineStageSchema>

export const UpdatePipelineStageSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  position: z.number().int().min(0).optional(),
  color: z.string().trim().max(20).nullable().optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
})
export type UpdatePipelineStageInput = z.infer<typeof UpdatePipelineStageSchema>

// ─── Leads CSV export ───────────────────────────────────────────────────────────

export const ExportQuerySchema = z.object({
  type: z.enum(['email', 'social']).default('email'),
})
export type ExportQueryInput = z.infer<typeof ExportQuerySchema>

// ─── Outreach dispatch ──────────────────────────────────────────────────────────

export const DispatchSchema = z.object({
  campaignType: z.enum(['initial_outreach', 'follow_up', 'newsletter']),
  emailSubject: z.string().trim().min(1),
  emailBody: z.string().trim().min(1),
})
export type DispatchInput = z.infer<typeof DispatchSchema>

// ─── Public lead capture (unauthenticated, called from generated landing pages) ─
// Preserves the exact validation/error behavior of the previous hand-rolled
// regex version: email is required and must be a valid address under 254
// chars ("Email is required" / "Invalid email"); an overlong name is
// rejected ("Name is too long"); an overlong source is silently truncated
// rather than rejected — matching the original route's asymmetric handling.

export const PublicLeadCaptureSchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.string().min(1, 'Email is required').max(254, 'Invalid email').email('Invalid email')
  ),
  name: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : undefined),
    z.string().max(200, 'Name is too long').optional()
  ),
  source: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().slice(0, 120) : undefined),
    z.string().optional()
  ),
})
export type PublicLeadCaptureInput = z.infer<typeof PublicLeadCaptureSchema>
