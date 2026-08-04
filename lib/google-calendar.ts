import 'server-only'

import { decryptSecret, encryptSecret } from '@/lib/marketing-crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { signOAuthState, verifyOAuthState, getReturnToFromState } from '@/lib/gmail-oauth'

export { signOAuthState, verifyOAuthState, getReturnToFromState }

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
]

const NO_REFRESH_TOKEN_SENTINEL = '__NO_REFRESH_TOKEN__'
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const DEFAULT_CALENDAR_ID = 'primary'

export type CalendarConnectionState =
  | 'not_connected'
  | 'active'
  | 'needs_reauth'
  | 'error'
  | 'disconnected'

export interface CalendarStatus {
  connected: boolean
  email: string | null
  calendarId: string
  state: CalendarConnectionState
  errorMessage: string | null
}

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  location: string | null
  start: string | null
  end: string | null
  allDay: boolean
  htmlLink: string | null
  attendeeCount: number
  isForzeCreated: boolean
  ventureId: string | null
}

export interface CreateCalendarEventInput {
  title: string
  description?: string | null
  location?: string | null
  start: string
  end: string
  allDay?: boolean
  ventureId?: string | null
  sourceUrl?: string | null
}

function getGoogleClientId(): string {
  const value = process.env.GOOGLE_CLIENT_ID
  if (!value) throw new Error('GOOGLE_CLIENT_ID is required for Google Calendar integration')
  return value
}

function getGoogleClientSecret(): string {
  const value = process.env.GOOGLE_CLIENT_SECRET
  if (!value) throw new Error('GOOGLE_CLIENT_SECRET is required for Google Calendar integration')
  return value
}

function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return raw.trim().replace(/\/+$/, '')
}

function getRedirectUri(): string {
  return `${getAppUrl()}/api/integrations/google-calendar/callback`
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string }
  if (candidate.code === '42P01' || candidate.code === 'PGRST205') return true
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  return (
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('schema cache')
  )
}

export function getCalendarAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: CALENDAR_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    ...(state ? { state } : {}),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google Calendar token exchange failed: ${body.slice(0, 500)}`)
  }

  return res.json() as Promise<TokenResponse>
}

async function getGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const info = (await res.json()) as { email?: string }
    return typeof info.email === 'string' ? info.email : null
  } catch {
    return null
  }
}

export async function handleCalendarCallback(
  userId: string,
  code: string
): Promise<{ emailAddress: string | null; needsReauth: boolean }> {
  const tokens = await exchangeCodeForTokens(code)
  const db = createAdminClient()

  const { data: existing } = await db
    .from('google_calendar_integrations')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  const emailAddress = await getGoogleEmail(tokens.access_token)
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const existingRefreshToken = existing ? decryptSecret(existing.refresh_token) : null

  const hasRealRefreshToken =
    Boolean(tokens.refresh_token) ||
    (existingRefreshToken !== null && existingRefreshToken !== NO_REFRESH_TOKEN_SENTINEL)
  const refreshToken = tokens.refresh_token ?? existingRefreshToken ?? NO_REFRESH_TOKEN_SENTINEL

  const { error } = await db.from('google_calendar_integrations').upsert(
    {
      user_id: userId,
      email_address: emailAddress,
      calendar_id: DEFAULT_CALENDAR_ID,
      access_token: encryptSecret(tokens.access_token) ?? '',
      refresh_token: encryptSecret(refreshToken) ?? '',
      token_expires_at: expiresAt,
      scope: tokens.scope ? tokens.scope.split(' ') : CALENDAR_SCOPES,
      connected: true,
      status: 'active',
      error_message: hasRealRefreshToken
        ? null
        : 'Missing refresh token — Google did not return one on reconnect',
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    throw new Error(`Failed to save Google Calendar integration: ${error.message}`)
  }

  return { emailAddress, needsReauth: !hasRealRefreshToken }
}

export interface CalendarTokens {
  accessToken: string
  calendarId: string
  emailAddress: string | null
}

export async function getCalendarAccessToken(userId: string): Promise<CalendarTokens> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('google_calendar_integrations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error && isMissingTableError(error)) {
    throw new Error('Google Calendar is not set up on this environment')
  }
  if (error || !data) throw new Error('Google Calendar not connected for this user')
  if (data.status === 'disconnected') throw new Error('Google Calendar has been disconnected')

  const calendarId = data.calendar_id ?? DEFAULT_CALENDAR_ID
  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0
  const isExpired = expiresAt - Date.now() < 60_000

  if (!isExpired) {
    const accessToken = decryptSecret(data.access_token)
    if (!accessToken) throw new Error('Google Calendar access token could not be decrypted')
    return { accessToken, calendarId, emailAddress: data.email_address ?? null }
  }

  const refreshToken = decryptSecret(data.refresh_token)
  if (!refreshToken || refreshToken === NO_REFRESH_TOKEN_SENTINEL) {
    await db
      .from('google_calendar_integrations')
      .update({
        status: 'expired',
        error_message:
          'Access token expired and no refresh token available — reconnect required',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    throw new Error('Google Calendar access token expired — please reconnect')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    const isInvalidGrant = res.status === 400 && body.includes('invalid_grant')
    await db
      .from('google_calendar_integrations')
      .update({
        status: isInvalidGrant ? 'expired' : 'error',
        error_message: `Refresh failed: ${body.slice(0, 500)}`,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    throw new Error(`Google Calendar token refresh failed: ${body.slice(0, 300)}`)
  }

  const refreshed = (await res.json()) as TokenResponse
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

  await db
    .from('google_calendar_integrations')
    .update({
      access_token: encryptSecret(refreshed.access_token) ?? '',
      token_expires_at: newExpiry,
      status: 'active',
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return {
    accessToken: refreshed.access_token,
    calendarId,
    emailAddress: data.email_address ?? null,
  }
}

export async function disconnectCalendar(userId: string): Promise<void> {
  const db = createAdminClient()

  try {
    const { data } = await db
      .from('google_calendar_integrations')
      .select('access_token')
      .eq('user_id', userId)
      .maybeSingle()

    if (data?.access_token) {
      const token = decryptSecret(data.access_token)
      if (token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' })
      }
    }
  } catch {
    // revocation is best effort
  }

  await db
    .from('google_calendar_integrations')
    .update({
      connected: false,
      status: 'disconnected',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
}

export async function getCalendarStatus(userId: string): Promise<CalendarStatus> {
  const notConnected: CalendarStatus = {
    connected: false,
    email: null,
    calendarId: DEFAULT_CALENDAR_ID,
    state: 'not_connected',
    errorMessage: null,
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('google_calendar_integrations')
    .select('connected, email_address, calendar_id, status, refresh_token, error_message')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return notConnected
    return { ...notConnected, state: 'error', errorMessage: 'Calendar status unavailable' }
  }

  if (!data) return notConnected

  const calendarId = data.calendar_id ?? DEFAULT_CALENDAR_ID

  if (!data.connected || data.status === 'disconnected') {
    return {
      connected: false,
      email: data.email_address ?? null,
      calendarId,
      state: 'disconnected',
      errorMessage: data.error_message ?? null,
    }
  }

  let refreshToken: string | null = null
  try {
    refreshToken = decryptSecret(data.refresh_token)
  } catch {
    refreshToken = null
  }
  const hasRealRefreshToken = Boolean(refreshToken) && refreshToken !== NO_REFRESH_TOKEN_SENTINEL

  let state: CalendarConnectionState
  if (data.status === 'expired') {
    state = 'needs_reauth'
  } else if (data.status === 'active' && !hasRealRefreshToken) {
    state = 'needs_reauth'
  } else if (data.status === 'error') {
    state = 'error'
  } else {
    state = 'active'
  }

  return {
    connected: state === 'active',
    email: data.email_address ?? null,
    calendarId,
    state,
    errorMessage: data.error_message ?? null,
  }
}

interface GoogleApiEvent {
  id?: string
  summary?: string
  description?: string
  location?: string
  htmlLink?: string
  status?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: unknown[]
  extendedProperties?: { private?: Record<string, string> }
}

function normalizeEvent(raw: GoogleApiEvent): CalendarEvent | null {
  if (!raw.id) return null
  const allDay = Boolean(raw.start?.date && !raw.start?.dateTime)
  const privateProps = raw.extendedProperties?.private ?? {}
  return {
    id: raw.id,
    title: typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary : '(no title)',
    description: typeof raw.description === 'string' ? raw.description : null,
    location: typeof raw.location === 'string' ? raw.location : null,
    start: raw.start?.dateTime ?? raw.start?.date ?? null,
    end: raw.end?.dateTime ?? raw.end?.date ?? null,
    allDay,
    htmlLink: typeof raw.htmlLink === 'string' ? raw.htmlLink : null,
    attendeeCount: Array.isArray(raw.attendees) ? raw.attendees.length : 0,
    isForzeCreated: privateProps.forzeCreated === 'true',
    ventureId: privateProps.forzeVentureId ?? null,
  }
}

export async function listUpcomingEvents(
  userId: string,
  options: { timeMin?: string; timeMax?: string; maxResults?: number } = {}
): Promise<CalendarEvent[]> {
  const { accessToken, calendarId } = await getCalendarAccessToken(userId)

  const now = new Date()
  const timeMin = options.timeMin ?? now.toISOString()
  const timeMax =
    options.timeMax ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const maxResults = Math.min(Math.max(options.maxResults ?? 50, 1), 250)

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  })

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google Calendar list failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const payload = (await res.json()) as { items?: GoogleApiEvent[] }
  return (payload.items ?? [])
    .filter((item) => item.status !== 'cancelled')
    .map(normalizeEvent)
    .filter((event): event is CalendarEvent => event !== null)
}

function toEventTime(value: string, allDay: boolean): Record<string, string> {
  if (allDay) return { date: value.slice(0, 10) }
  return { dateTime: new Date(value).toISOString() }
}

export async function createCalendarEvent(
  userId: string,
  input: CreateCalendarEventInput
): Promise<CalendarEvent> {
  const { accessToken, calendarId } = await getCalendarAccessToken(userId)
  const allDay = Boolean(input.allDay)

  const body = {
    summary: input.title.slice(0, 300),
    description: [input.description ?? '', input.sourceUrl ? `Source: ${input.sourceUrl}` : '']
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 6000) || undefined,
    location: input.location ? input.location.slice(0, 300) : undefined,
    start: toEventTime(input.start, allDay),
    end: toEventTime(input.end, allDay),
    extendedProperties: {
      private: {
        forzeCreated: 'true',
        ...(input.ventureId ? { forzeVentureId: input.ventureId } : {}),
      },
    },
  }

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Calendar insert failed (${res.status}): ${text.slice(0, 300)}`)
  }

  const created = normalizeEvent((await res.json()) as GoogleApiEvent)
  if (!created) throw new Error('Google Calendar returned an event without an id')
  return created
}

export async function deleteForzeEvent(userId: string, eventId: string): Promise<void> {
  const { accessToken, calendarId } = await getCalendarAccessToken(userId)

  const lookup = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!lookup.ok) {
    const text = await lookup.text()
    throw new Error(`Google Calendar lookup failed (${lookup.status}): ${text.slice(0, 300)}`)
  }

  const event = (await lookup.json()) as GoogleApiEvent
  if (event.extendedProperties?.private?.forzeCreated !== 'true') {
    throw new Error('Refusing to delete a calendar event that Forze did not create')
  }

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text()
    throw new Error(`Google Calendar delete failed (${res.status}): ${text.slice(0, 300)}`)
  }
}
