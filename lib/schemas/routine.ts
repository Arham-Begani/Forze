import { z } from 'zod'

// ─── Enums (match db/migrations/019_routines.sql) ─────────────────────────────

export const ROUTINE_CHANNELS = ['gmail', 'instagram', 'linkedin'] as const
export const ROUTINE_CADENCES = ['every_3_days', 'weekly', 'monthly'] as const
export const ROUTINE_STATUSES = ['active', 'paused', 'archived'] as const
export const ROUTINE_RUN_STATUSES = ['success', 'failed', 'skipped'] as const

export const RoutineChannelSchema = z.enum(ROUTINE_CHANNELS)
export const RoutineCadenceSchema = z.enum(ROUTINE_CADENCES)
export const RoutineStatusSchema = z.enum(ROUTINE_STATUSES)
export const RoutineRunStatusSchema = z.enum(ROUTINE_RUN_STATUSES)

// Curated timezone list — the most-used IANA names. Keeping it short on
// purpose: the full tzdb is ~600 entries and overwhelms a dropdown. The DB
// itself accepts any IANA name, so power users can patch via API to set a
// timezone outside this list and the executor will still honor it.
export const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Sao_Paulo', label: 'Brazil (São Paulo)' },
  { value: 'Europe/London', label: 'UK (London)' },
  { value: 'Europe/Berlin', label: 'Central Europe (Berlin)' },
  { value: 'Europe/Athens', label: 'Eastern Europe (Athens)' },
  { value: 'Asia/Dubai', label: 'Gulf (Dubai)' },
  { value: 'Asia/Kolkata', label: 'India (Kolkata)' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Shanghai', label: 'China (Shanghai)' },
  { value: 'Asia/Tokyo', label: 'Japan (Tokyo)' },
  { value: 'Australia/Sydney', label: 'Australia (Sydney)' },
] as const

// Validate any IANA-looking string. Real IANA validation lives in the DB
// (advance_routine_next_run falls back to UTC on bad strings) — this regex
// catches obvious typos before they ever reach Postgres.
const IANA_TZ_REGEX = /^[A-Za-z]+(?:\/[A-Za-z0-9_+\-]+){0,2}$|^UTC$/

// ─── Row shapes ───────────────────────────────────────────────────────────────

export const RoutineSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  venture_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  channel: RoutineChannelSchema,
  cadence: RoutineCadenceSchema,
  status: RoutineStatusSchema,
  campaign_id: z.string().uuid().nullable(),
  angle_hint: z.string().nullable(),
  send_hour: z.number().int().min(0).max(23),
  send_minute: z.number().int().min(0).max(59),
  timezone: z.string(),
  next_run_at: z.string(),
  last_run_at: z.string().nullable(),
  last_error: z.string().nullable(),
  run_count: z.number().int().min(0),
  created_at: z.string(),
  updated_at: z.string(),
})

export const RoutineRunSchema = z.object({
  id: z.string().uuid(),
  routine_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: RoutineRunStatusSchema,
  channel: RoutineChannelSchema,
  metadata: z.record(z.unknown()),
  error_message: z.string().nullable(),
  ran_at: z.string(),
})

// ─── Input shapes (API boundary) ──────────────────────────────────────────────

export const CreateRoutineInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    channel: RoutineChannelSchema,
    cadence: RoutineCadenceSchema,
    campaign_id: z.string().uuid().nullable().optional(),
    angle_hint: z.string().trim().max(400).nullable().optional(),
    send_hour: z.number().int().min(0).max(23).optional().default(9),
    send_minute: z.number().int().min(0).max(59).optional().default(0),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(IANA_TZ_REGEX, 'Invalid timezone (use an IANA name like Asia/Kolkata)')
      .optional()
      .default('UTC'),
  })
  .superRefine((input, ctx) => {
    if (input.channel === 'gmail' && !input.campaign_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['campaign_id'],
        message: 'Gmail routines must be linked to a campaign',
      })
    }
  })

export const UpdateRoutineInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    cadence: RoutineCadenceSchema.optional(),
    status: RoutineStatusSchema.optional(),
    angle_hint: z.string().trim().max(400).nullable().optional(),
    send_hour: z.number().int().min(0).max(23).optional(),
    send_minute: z.number().int().min(0).max(59).optional(),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(IANA_TZ_REGEX, 'Invalid timezone (use an IANA name like Asia/Kolkata)')
      .optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.cadence !== undefined ||
      v.status !== undefined ||
      v.angle_hint !== undefined ||
      v.send_hour !== undefined ||
      v.send_minute !== undefined ||
      v.timezone !== undefined,
    { message: 'At least one field must be provided' }
  )

// ─── TypeScript types ─────────────────────────────────────────────────────────

export type RoutineChannel = z.infer<typeof RoutineChannelSchema>
export type RoutineCadence = z.infer<typeof RoutineCadenceSchema>
export type RoutineStatus = z.infer<typeof RoutineStatusSchema>
export type RoutineRunStatus = z.infer<typeof RoutineRunStatusSchema>
export type Routine = z.infer<typeof RoutineSchema>
export type RoutineRun = z.infer<typeof RoutineRunSchema>
export type CreateRoutineInput = z.infer<typeof CreateRoutineInputSchema>
export type UpdateRoutineInput = z.infer<typeof UpdateRoutineInputSchema>

// ─── Wall-clock-in-timezone → UTC helpers ─────────────────────────────────────

// Returns the UTC offset (in minutes) the given timezone is observing at the
// given UTC instant. Positive = east of UTC. Used to convert a local wall
// clock back to a UTC instant without pulling in a tz library.
//
// The trick: ask Intl what the wall clock looks like in `timeZone` for our
// UTC instant, treat that wall clock as if it were UTC, and compare the
// gap. The gap *is* the offset, with the right sign.
function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const parts = Object.fromEntries(
      dtf.formatToParts(date).map((p) => [p.type, p.value])
    ) as Record<string, string>

    // Some Intl impls emit "24" for midnight; normalize to "00" so Date.UTC
    // doesn't roll over.
    const hour = parts.hour === '24' ? '00' : parts.hour
    const wallAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(hour),
      Number(parts.minute),
      Number(parts.second)
    )
    return Math.round((wallAsUtc - date.getTime()) / 60_000)
  } catch {
    // Bad tz name → treat as UTC. The DB does the same fallback so the two
    // sides agree on degenerate input.
    return 0
  }
}

// Build a Date representing "wall-clock HH:MM on Y-M-D in `timeZone`."
// Iterates once to handle DST: the offset can change between the initial
// guess and the final instant (e.g. a wall clock right at the spring-forward
// boundary). One correction pass is enough for any tz that doesn't have
// multi-hour DST jumps — which is all real tzs.
function fromTzWallClock(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, monthIndex, day, hour, minute, 0, 0))
  const offset1 = getTimeZoneOffsetMinutes(utcGuess, timeZone)
  const adjusted = new Date(utcGuess.getTime() - offset1 * 60_000)
  const offset2 = getTimeZoneOffsetMinutes(adjusted, timeZone)
  if (offset2 === offset1) return adjusted
  return new Date(utcGuess.getTime() - offset2 * 60_000)
}

// Returns "today" in `timeZone` as a struct of wall-clock parts. Used to
// figure out which day to anchor the next-run computation to.
function getLocalDateParts(now: Date, timeZone: string): { year: number; monthIndex: number; day: number } {
  try {
    const dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = Object.fromEntries(
      dtf.formatToParts(now).map((p) => [p.type, p.value])
    ) as Record<string, string>
    return {
      year: Number(parts.year),
      monthIndex: Number(parts.month) - 1,
      day: Number(parts.day),
    }
  } catch {
    return {
      year: now.getUTCFullYear(),
      monthIndex: now.getUTCMonth(),
      day: now.getUTCDate(),
    }
  }
}

function addCadence(date: Date, cadence: RoutineCadence): Date {
  const out = new Date(date.getTime())
  switch (cadence) {
    case 'every_3_days':
      out.setUTCDate(out.getUTCDate() + 3)
      break
    case 'weekly':
      out.setUTCDate(out.getUTCDate() + 7)
      break
    case 'monthly':
      out.setUTCMonth(out.getUTCMonth() + 1)
      break
  }
  return out
}

// Mirrors compute_routine_initial_next_run() in 020. Anchor on today's
// wall-clock in the routine's tz, snap to the requested HH:MM, and bump
// forward one cadence if that's already past.
export function computeInitialNextRunAt(
  cadence: RoutineCadence,
  sendHour: number,
  sendMinute: number,
  timeZone: string,
  now: Date = new Date()
): Date {
  const tz = timeZone || 'UTC'
  const { year, monthIndex, day } = getLocalDateParts(now, tz)
  const candidate = fromTzWallClock(year, monthIndex, day, sendHour, sendMinute, tz)
  if (candidate.getTime() > now.getTime()) return candidate
  return addCadence(candidate, cadence)
}
