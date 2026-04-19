import 'server-only'

import { encryptSecret, decryptSecret } from '@/lib/marketing-crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── State signing for OAuth CSRF protection ─────────────────────────────────
// We sign `{ userId, nonce, exp }` using the same AES-GCM key that protects
// stored tokens. The resulting opaque string is passed to Google as `state` and
// verified on callback — this ties the callback to the browser that initiated
// the flow and prevents a logged-in victim from having an attacker's Google
// account linked to their Forze user.

const STATE_TTL_SEC = 600 // 10 minutes

interface OAuthStatePayload {
  userId: string
  nonce: string
  exp: number
}

export function signOAuthState(userId: string): string {
  const payload: OAuthStatePayload = {
    userId,
    nonce: Math.random().toString(36).slice(2, 14),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SEC,
  }
  const encoded = encryptSecret(JSON.stringify(payload))
  if (!encoded) throw new Error('Failed to sign OAuth state')
  return encoded
}

export function verifyOAuthState(state: string, expectedUserId: string): boolean {
  try {
    const raw = decryptSecret(state)
    if (!raw) return false
    const payload = JSON.parse(raw) as OAuthStatePayload
    if (payload.userId !== expectedUserId) return false
    if (payload.exp < Math.floor(Date.now() / 1000)) return false
    return true
  } catch {
    return false
  }
}

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

const NO_REFRESH_TOKEN_SENTINEL = '__NO_REFRESH_TOKEN__'

function getGoogleClientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID
  if (!v) throw new Error('GOOGLE_CLIENT_ID is required for Gmail integration')
  return v
}

function getGoogleClientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET
  if (!v) throw new Error('GOOGLE_CLIENT_SECRET is required for Gmail integration')
  return v
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

function getRedirectUri(): string {
  return `${getAppUrl()}/api/integrations/gmail/callback`
}

// ─── Auth URL ─────────────────────────────────────────────────────────────────

export function getGmailAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    ...(state ? { state } : {}),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

// ─── Code exchange ────────────────────────────────────────────────────────────

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
    throw new Error(`Gmail token exchange failed: ${body}`)
  }

  return res.json() as Promise<TokenResponse>
}

async function getGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Google user info')
  const info = (await res.json()) as { email: string }
  return info.email
}

export async function handleGmailCallback(
  userId: string,
  code: string
): Promise<{ emailAddress: string; dailyLimit: number; needsReauth: boolean }> {
  const tokens = await exchangeCodeForTokens(code)
  const db = createAdminClient()
  const { data: existingIntegration } = await db
    .from('gmail_integrations')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  const emailAddress = await getGoogleEmail(tokens.access_token)
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const existingRefreshToken = existingIntegration ? decryptSecret(existingIntegration.refresh_token) : null

  // Google omits refresh_token on re-consent when the user's previous grant
  // is still valid. We preserve the old one rather than overwriting it with
  // the sentinel — that keeps long-lived refresh ability intact across UI
  // reconnect clicks. Only when we have neither the new nor the old token do
  // we fall back to the sentinel, which flags `needs_reauth` downstream so
  // the UI can ask the user to re-consent with `prompt=consent`.
  const hasRealRefreshToken =
    Boolean(tokens.refresh_token) ||
    (existingRefreshToken !== null && existingRefreshToken !== NO_REFRESH_TOKEN_SENTINEL)
  const refreshToken = tokens.refresh_token ?? existingRefreshToken ?? NO_REFRESH_TOKEN_SENTINEL

  const { error } = await db.from('gmail_integrations').upsert(
    {
      user_id: userId,
      email_address: emailAddress,
      access_token: encryptSecret(tokens.access_token) ?? '',
      refresh_token: encryptSecret(refreshToken) ?? '',
      token_expires_at: expiresAt,
      scope: tokens.scope.split(' '),
      connected: true,
      status: 'active',
      error_message: hasRealRefreshToken ? null : 'Missing refresh token — Google did not return one on reconnect',
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) {
    throw new Error(`Failed to save Gmail integration: ${error.message}`)
  }

  return { emailAddress, dailyLimit: 2000, needsReauth: !hasRealRefreshToken }
}

// ─── Token retrieval + refresh ────────────────────────────────────────────────

export interface GmailTokens {
  accessToken: string
  emailAddress: string
}

export async function getGmailAccessToken(userId: string): Promise<GmailTokens> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('gmail_integrations')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) throw new Error('Gmail not connected for this user')
  if (data.status === 'disconnected') throw new Error('Gmail has been disconnected')

  const expiresAt = new Date(data.token_expires_at).getTime()
  const isExpired = expiresAt - Date.now() < 60_000 // refresh if expiring in < 1 min

  if (isExpired) {
    const refreshToken = decryptSecret(data.refresh_token)
    if (!refreshToken || refreshToken === NO_REFRESH_TOKEN_SENTINEL) {
      // No usable refresh token. Rather than silently returning the expired
      // access token (which will 401 at the Gmail API and look like a bug),
      // flip status to 'expired' so getGmailStatus surfaces `needs_reauth` to
      // the UI. The user gets one clear action — reconnect — instead of a
      // string of opaque send failures.
      await db
        .from('gmail_integrations')
        .update({
          status: 'expired',
          error_message: 'Access token expired and no refresh token available — reconnect required',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
      throw new Error('Gmail access token expired — please reconnect Gmail')
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
      // A 400 `invalid_grant` means the refresh token was revoked (user
      // removed the app from their Google account, changed password, or the
      // grant simply timed out after 6 months of non-use). In every such
      // case only a fresh OAuth consent can recover — surface that as
      // 'expired' so the UI asks for reauth rather than retrying forever.
      const isInvalidGrant = res.status === 400 && body.includes('invalid_grant')
      await db
        .from('gmail_integrations')
        .update({
          status: isInvalidGrant ? 'expired' : 'error',
          error_message: `Refresh failed: ${body.slice(0, 500)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
      throw new Error(`Gmail token refresh failed: ${body}`)
    }

    const refreshed = (await res.json()) as TokenResponse
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

    await db.from('gmail_integrations').update({
      access_token: encryptSecret(refreshed.access_token) ?? '',
      token_expires_at: newExpiry,
      status: 'active',
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)

    return { accessToken: refreshed.access_token, emailAddress: data.email_address }
  }

  const accessToken = decryptSecret(data.access_token)
  if (!accessToken) throw new Error('Gmail access token could not be decrypted')

  return { accessToken, emailAddress: data.email_address }
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

export async function disconnectGmail(userId: string): Promise<void> {
  const db = createAdminClient()

  // Try to revoke the token with Google
  try {
    const { data } = await db
      .from('gmail_integrations')
      .select('access_token')
      .eq('user_id', userId)
      .single()

    if (data?.access_token) {
      const token = decryptSecret(data.access_token)
      if (token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' })
      }
    }
  } catch {
    // Revocation failure is non-fatal
  }

  await db
    .from('gmail_integrations')
    .update({ connected: false, status: 'disconnected', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
}

// ─── Status ───────────────────────────────────────────────────────────────────

export type GmailConnectionState = 'not_connected' | 'active' | 'needs_reauth' | 'error' | 'disconnected'

export interface GmailStatus {
  connected: boolean
  email: string | null
  dailyLimit: number
  dailySentToday: number
  canSend: boolean
  state: GmailConnectionState
  errorMessage: string | null
}

export async function getGmailStatus(userId: string): Promise<GmailStatus> {
  const db = createAdminClient()
  const { data } = await db
    .from('gmail_integrations')
    .select('connected, email_address, daily_send_limit, daily_sent_count, status, daily_count_reset_at, refresh_token, error_message')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) {
    return {
      connected: false, email: null, dailyLimit: 2000, dailySentToday: 0, canSend: false,
      state: 'not_connected', errorMessage: null,
    }
  }

  if (!data.connected || data.status === 'disconnected') {
    return {
      connected: false, email: data.email_address ?? null, dailyLimit: 2000, dailySentToday: 0, canSend: false,
      state: 'disconnected', errorMessage: data.error_message ?? null,
    }
  }

  // Decide whether the stored refresh token is a real one. The sentinel is
  // written when Google withheld the refresh token on reconnect AND we had
  // no prior token to preserve — the user has to re-consent to fix it.
  const refreshToken = decryptSecret(data.refresh_token)
  const hasRealRefreshToken = Boolean(refreshToken) && refreshToken !== NO_REFRESH_TOKEN_SENTINEL

  // Reset daily count if it's a new day
  const today = new Date().toISOString().split('T')[0]
  let dailySentToday = data.daily_sent_count ?? 0
  if (data.daily_count_reset_at !== today) {
    await db
      .from('gmail_integrations')
      .update({ daily_sent_count: 0, daily_count_reset_at: today, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    dailySentToday = 0
  }

  const dailyLimit = data.daily_send_limit ?? 2000

  // needs_reauth covers three situations that all require the user to click
  // "Reconnect Gmail":
  //   1. stored status is 'expired' (refresh returned invalid_grant or we
  //      already flagged the token unusable)
  //   2. integration is tagged 'active' but the refresh token is the
  //      sentinel — Google never gave us one and the old one ran out
  //   3. status was forced to 'error' by a prior refresh failure
  let state: GmailConnectionState
  if (data.status === 'expired') {
    state = 'needs_reauth'
  } else if (data.status === 'active' && !hasRealRefreshToken) {
    state = 'needs_reauth'
  } else if (data.status === 'error') {
    state = 'error'
  } else {
    state = 'active'
  }

  const canSend = state === 'active' && dailySentToday < dailyLimit

  return {
    connected: state === 'active',
    email: data.email_address,
    dailyLimit,
    dailySentToday,
    canSend,
    state,
    errorMessage: data.error_message ?? null,
  }
}
