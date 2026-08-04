import { describe, expect, it } from 'vitest'

import { findConflicts, rankEvents, type RawEvent } from '@/lib/event-radar'
import { containsLink, shouldAutoReply } from '@/lib/instagram-comments'
import { buildEventKey, getRoutineApprovalWindowHours } from '@/lib/queries/autopilot-queries'
import {
  ACTION_TO_FEATURE,
  ALL_FEATURES,
  BILLING_PLANS,
  getWeeklyActionLimit,
  isFeatureIncluded,
} from '@/lib/billing'
import { ROUTINE_CHANNELS } from '@/lib/schemas/routine'
import type { CalendarEvent } from '@/lib/google-calendar'

// The claims worth locking down are the ones the no-regression rules rest on:
// a comment can only be auto-answered when it is unambiguously safe, an event
// with an unverifiable date never reaches the founder, and the autopilot
// feature does not leak onto plans that did not buy it.

function calendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'cal-1',
    title: 'Board call',
    description: null,
    location: null,
    start: '2026-09-10T10:00:00.000Z',
    end: '2026-09-10T11:00:00.000Z',
    allDay: false,
    htmlLink: null,
    attendeeCount: 2,
    isForzeCreated: false,
    ventureId: null,
    ...overrides,
  }
}

function rawEvent(overrides: Partial<RawEvent> = {}): RawEvent {
  return {
    name: 'SaaS Summit',
    url: 'https://example.com/saas-summit',
    startDate: '2026-09-10',
    endDate: null,
    city: 'Bangalore',
    venue: null,
    format: 'in_person',
    priceNote: null,
    audience: null,
    whyRelevant: null,
    relevance: 80,
    ...overrides,
  }
}

const NOW = new Date('2026-08-04T00:00:00.000Z')

describe('comment auto-reply gate', () => {
  it('detects links in every shape a spammer actually uses', () => {
    expect(containsLink('check https://evil.example')).toBe(true)
    expect(containsLink('go to www.evil.example')).toBe(true)
    expect(containsLink('buy at cheapshoes.shop now')).toBe(true)
    expect(containsLink('this is genuinely great work')).toBe(false)
  })

  it('never auto-replies to anything carrying a link, even when classed positive', () => {
    expect(shouldAutoReply('positive', 'love this https://evil.example').autoReply).toBe(false)
  })

  it('escalates negative, spam and ambiguous comments instead of answering them', () => {
    expect(shouldAutoReply('negative', 'this is a scam').autoReply).toBe(false)
    expect(shouldAutoReply('spam', 'follow for follow').autoReply).toBe(false)
    expect(shouldAutoReply('ambiguous', 'sure. great.').autoReply).toBe(false)
  })

  it('allows a reply only for clean positive and question comments', () => {
    expect(shouldAutoReply('positive', 'this is genuinely useful').autoReply).toBe(true)
    expect(shouldAutoReply('question', 'does this work for teams?').autoReply).toBe(true)
  })

  it('always gives a reason when it refuses, so the escalation card can explain itself', () => {
    expect(shouldAutoReply('negative', 'awful').reason).toBeTruthy()
    expect(shouldAutoReply('positive', 'nice www.x.com').reason).toBeTruthy()
  })
})

describe('event ranking', () => {
  it('drops events whose date is not a parseable ISO date', () => {
    const ranked = rankEvents([rawEvent({ startDate: 'sometime this autumn' })], [], NOW)
    expect(ranked).toHaveLength(0)
  })

  it('drops events that already happened', () => {
    const ranked = rankEvents([rawEvent({ startDate: '2026-01-01' })], [], NOW)
    expect(ranked).toHaveLength(0)
  })

  it('de-duplicates on normalized url regardless of casing, query or trailing slash', () => {
    const ranked = rankEvents(
      [
        rawEvent({ url: 'https://example.com/saas-summit' }),
        rawEvent({ url: 'https://WWW.example.com/saas-summit/?utm_source=x' }),
      ],
      [],
      NOW
    )
    expect(ranked).toHaveLength(1)
  })

  it('penalises an event that collides with the calendar', () => {
    const clean = rankEvents([rawEvent()], [], NOW)[0]
    const clashing = rankEvents([rawEvent()], [calendarEvent()], NOW)[0]
    expect(clashing.score).toBeLessThan(clean.score)
    expect(clashing.conflicts).toHaveLength(1)
    expect(clashing.conflicts[0].title).toBe('Board call')
  })

  it('penalises an event with no verifiable source url', () => {
    const sourced = rankEvents([rawEvent()], [], NOW)[0]
    const unsourced = rankEvents([rawEvent({ url: null })], [], NOW)[0]
    expect(unsourced.score).toBeLessThan(sourced.score)
    expect(unsourced.url).toBeNull()
  })

  it('rejects a non-http url rather than passing it through to the UI', () => {
    const ranked = rankEvents([rawEvent({ url: 'javascript:alert(1)' })], [], NOW)
    expect(ranked[0].url).toBeNull()
  })

  it('sorts by score first and start date second', () => {
    const ranked = rankEvents(
      [
        rawEvent({ name: 'Low', url: 'https://example.com/low', relevance: 20 }),
        rawEvent({ name: 'High', url: 'https://example.com/high', relevance: 95 }),
      ],
      [],
      NOW
    )
    expect(ranked.map((event) => event.name)).toEqual(['High', 'Low'])
  })
})

describe('calendar conflict detection', () => {
  it('counts a real overlap', () => {
    const conflicts = findConflicts(
      '2026-09-10T10:30:00.000Z',
      '2026-09-10T12:00:00.000Z',
      [calendarEvent()]
    )
    expect(conflicts).toHaveLength(1)
  })

  it('does not count an adjacent, non-overlapping slot', () => {
    const conflicts = findConflicts(
      '2026-09-10T11:00:00.000Z',
      '2026-09-10T12:00:00.000Z',
      [calendarEvent()]
    )
    expect(conflicts).toHaveLength(0)
  })

  it('ignores calendar entries with no usable start', () => {
    const conflicts = findConflicts('2026-09-10T10:30:00.000Z', null, [
      calendarEvent({ start: null }),
    ])
    expect(conflicts).toHaveLength(0)
  })
})

describe('event dedup key', () => {
  it('normalizes protocol, www, query and trailing slash', () => {
    expect(buildEventKey('X', 'https://www.Example.com/a/?b=1#c')).toBe('example.com/a')
  })

  it('falls back to the name when there is no url', () => {
    expect(buildEventKey('  SaaS   Summit ', null)).toBe('saas summit')
  })
})

// The approve window is the one change that touches the existing publish path,
// so the "0 means exactly today's behavior" claim is asserted at the decision
// point rather than assumed. A stub client stands in for Supabase.
function stubRoutineDb(result: { data?: unknown; error?: unknown }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => result,
        }),
      }),
    }),
  } as never
}

describe('approval window resolution', () => {
  it('returns 0 when the column is missing, which is the pre-048 inline publish path', async () => {
    const window = await getRoutineApprovalWindowHours(
      'routine-1',
      stubRoutineDb({ error: { message: 'column routines.approval_window_hours does not exist' } })
    )
    expect(window).toBe(0)
  })

  it('returns 0 when the routine row is absent', async () => {
    const window = await getRoutineApprovalWindowHours('routine-1', stubRoutineDb({ data: null }))
    expect(window).toBe(0)
  })

  it('returns 0 for a zero or negative stored value', async () => {
    expect(
      await getRoutineApprovalWindowHours(
        'r',
        stubRoutineDb({ data: { approval_window_hours: 0 } })
      )
    ).toBe(0)
    expect(
      await getRoutineApprovalWindowHours(
        'r',
        stubRoutineDb({ data: { approval_window_hours: -5 } })
      )
    ).toBe(0)
  })

  it('passes a real window through', async () => {
    expect(
      await getRoutineApprovalWindowHours(
        'r',
        stubRoutineDb({ data: { approval_window_hours: 12 } })
      )
    ).toBe(12)
  })

  it('clamps an absurd window to one week rather than scheduling a post into next year', async () => {
    expect(
      await getRoutineApprovalWindowHours(
        'r',
        stubRoutineDb({ data: { approval_window_hours: 99999 } })
      )
    ).toBe(168)
  })

  it('falls back to 0 when the row holds a non-numeric value', async () => {
    expect(
      await getRoutineApprovalWindowHours(
        'r',
        stubRoutineDb({ data: { approval_window_hours: 'soon' } })
      )
    ).toBe(0)
  })
})

describe('autopilot billing', () => {
  it('is not available on free or starter', () => {
    expect(isFeatureIncluded('free', 'autopilot')).toBe(false)
    expect(isFeatureIncluded('starter', 'autopilot')).toBe(false)
  })

  it('is available from builder up', () => {
    expect(isFeatureIncluded('builder', 'autopilot')).toBe(true)
    expect(isFeatureIncluded('pro', 'autopilot')).toBe(true)
    expect(isFeatureIncluded('studio', 'autopilot')).toBe(true)
  })

  it('maps both new actions onto the autopilot feature', () => {
    expect(ACTION_TO_FEATURE.event_radar).toBe('autopilot')
    expect(ACTION_TO_FEATURE.comment_reply).toBe('autopilot')
  })

  it('gives every plan an explicit ceiling for the new actions', () => {
    for (const plan of Object.values(BILLING_PLANS)) {
      expect(typeof plan.weeklyActionLimits.eventRadarRuns).toBe('number')
      expect(typeof plan.weeklyActionLimits.commentReplies).toBe('number')
    }
    expect(getWeeklyActionLimit('free', 'event_radar')).toBe(0)
    expect(getWeeklyActionLimit('builder', 'event_radar')).toBeGreaterThan(0)
  })

  it('keeps the existing feature set intact', () => {
    expect(ALL_FEATURES).toContain('crm')
    expect(ALL_FEATURES).toContain('inspiration')
    expect(ALL_FEATURES).toContain('outreach')
  })
})

describe('routine channels', () => {
  it('keeps the three original channels', () => {
    expect(ROUTINE_CHANNELS).toContain('gmail')
    expect(ROUTINE_CHANNELS).toContain('instagram')
    expect(ROUTINE_CHANNELS).toContain('linkedin')
  })

  it('adds the three operator channels', () => {
    expect(ROUTINE_CHANNELS).toContain('instagram_comment_reply')
    expect(ROUTINE_CHANNELS).toContain('comment_suggestions')
    expect(ROUTINE_CHANNELS).toContain('agenda')
  })
})
