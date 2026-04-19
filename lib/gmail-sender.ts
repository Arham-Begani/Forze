import 'server-only'

import { getGmailAccessToken } from '@/lib/gmail-oauth'
import { createDb } from '@/lib/db'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string
  subject: string
  htmlBody: string
  replyTo?: string
  // Fully-qualified URL that mailbox providers hit for one-click unsubscribe.
  // When present we emit BOTH `List-Unsubscribe: <url>` (RFC 5322) and the
  // existing `List-Unsubscribe-Post` (RFC 8058) — both are required; Gmail
  // ignores the Post header without the primary one.
  listUnsubscribeUrl?: string
}

export interface SendEmailResult {
  messageId: string | null
  status: 'sent' | 'failed'
  error?: string
}

export interface GmailMessage {
  id: string
  threadId: string
  from: string
  subject: string
  body: string
  receivedAt: string
  gmailMessageId: string
}

// ─── Encode email as base64url RFC 2822 ───────────────────────────────────────

function buildRawEmail(
  fromEmail: string,
  to: string,
  subject: string,
  htmlBody: string,
  replyTo?: string,
  listUnsubscribeUrl?: string
): string {
  const headers = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    // CAN-SPAM + RFC 8058 one-click unsubscribe. Both headers required.
    ...(listUnsubscribeUrl ? [`List-Unsubscribe: <${listUnsubscribeUrl}>`] : []),
    'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
  ].join('\r\n')

  const message = `${headers}\r\n\r\n${htmlBody}`
  return Buffer.from(message).toString('base64url')
}

// ─── Send a single email via Gmail REST API ───────────────────────────────────

export async function sendEmailViaGmail(
  userId: string,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  try {
    const { accessToken, emailAddress } = await getGmailAccessToken(userId)

    const raw = buildRawEmail(
      emailAddress,
      options.to,
      options.subject,
      options.htmlBody,
      options.replyTo,
      options.listUnsubscribeUrl
    )

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    })

    if (res.status === 429) {
      return { messageId: null, status: 'failed', error: 'Gmail rate limit reached — try again later' }
    }

    if (!res.ok) {
      const body = await res.text()
      return { messageId: null, status: 'failed', error: `Gmail API error ${res.status}: ${body}` }
    }

    const result = (await res.json()) as { id: string }

    // Increment daily sent count (best effort)
    const db = await createDb()
    await db.rpc('increment_gmail_daily_count', { p_user_id: userId }).then(() => {}, () => {})

    return { messageId: result.id, status: 'sent' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { messageId: null, status: 'failed', error: message }
  }
}

// ─── Poll Gmail inbox for replies from campaign leads ────────────────────────

interface PollRepliesResult {
  from: string
  subject: string
  body: string
  receivedAt: string
  gmailMessageId: string
  gmailThreadId: string
}

export async function pollGmailForReplies(
  userId: string,
  campaignId: string,
  leadEmails: string[]
): Promise<PollRepliesResult[]> {
  if (leadEmails.length === 0) return []

  try {
    const { accessToken } = await getGmailAccessToken(userId)

    // Build a query: look for messages from any lead email in the INBOX
    const emailQuery = leadEmails.slice(0, 50).map((e) => `from:${e}`).join(' OR ')
    const query = `(${emailQuery}) in:inbox newer_than:7d`

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!listRes.ok) return []

    const listData = (await listRes.json()) as { messages?: Array<{ id: string; threadId: string }> }
    const messages = listData.messages ?? []

    const results: PollRepliesResult[] = []

    for (const msg of messages) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!msgRes.ok) continue

        const msgData = (await msgRes.json()) as {
          id: string
          threadId: string
          internalDate: string
          payload: {
            headers: Array<{ name: string; value: string }>
            body: { data?: string }
            parts?: Array<{ mimeType: string; body: { data?: string } }>
          }
        }

        const headers = msgData.payload.headers ?? []
        const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? ''
        const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? ''

        // Extract body — prefer plain text, fall back to html
        let body = ''
        const parts = msgData.payload.parts ?? []
        const textPart = parts.find((p) => p.mimeType === 'text/plain')
        const htmlPart = parts.find((p) => p.mimeType === 'text/html')
        const bodyData = textPart?.body?.data ?? htmlPart?.body?.data ?? msgData.payload.body?.data

        if (bodyData) {
          body = Buffer.from(bodyData, 'base64url').toString('utf8').slice(0, 5000)
        }

        const receivedAt = new Date(Number(msgData.internalDate)).toISOString()

        results.push({
          from,
          subject,
          body,
          receivedAt,
          gmailMessageId: msgData.id,
          gmailThreadId: msgData.threadId,
        })
      } catch {
        // Skip malformed messages
        continue
      }
    }

    return results
  } catch (err) {
    console.error('[gmail-sender] pollGmailForReplies error:', err)
    return []
  }
}
