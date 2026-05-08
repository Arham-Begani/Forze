import 'server-only'

import { getGmailAccessToken } from '@/lib/gmail-oauth'
import { getOutreachMessagesForVenture } from '@/lib/queries'

interface GmailPart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
}

interface GmailThreadMessage {
  id: string
  threadId: string
  labelIds?: string[]
  internalDate?: string
  snippet?: string
  payload?: GmailPart & {
    headers?: Array<{ name: string; value: string }>
  }
}

interface GmailThreadResponse {
  id: string
  messages?: GmailThreadMessage[]
}

export interface CrmGmailReply {
  leadName: string | null
  leadEmail: string
  snippet: string
  timestamp: string
  gmailMessageId: string
  gmailThreadId: string
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function findBodyData(part: GmailPart | undefined, mimeType: string): string | null {
  if (!part) return null
  if (part.mimeType === mimeType && part.body?.data) return part.body.data
  for (const child of part.parts ?? []) {
    const found = findBodyData(child, mimeType)
    if (found) return found
  }
  return null
}

function htmlToText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function extractBody(message: GmailThreadMessage): string {
  const textData = findBodyData(message.payload, 'text/plain')
  if (textData) return decodeBase64Url(textData)

  const htmlData = findBodyData(message.payload, 'text/html')
  if (htmlData) return htmlToText(decodeBase64Url(htmlData))

  if (message.payload?.body?.data) return decodeBase64Url(message.payload.body.data)
  return message.snippet ?? ''
}

function stripQuotedReply(value: string): string {
  const lines = value.replace(/\r\n/g, '\n').split('\n')
  const kept: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('>')) break
    if (/^On .+ wrote:$/i.test(trimmed)) break
    if (/^From:\s/i.test(trimmed)) break
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(trimmed)) break
    kept.push(line)
  }

  return kept.join('\n').trim()
}

function messageTimestamp(message: GmailThreadMessage): string {
  const millis = Number(message.internalDate ?? 0)
  return Number.isFinite(millis) && millis > 0
    ? new Date(millis).toISOString()
    : new Date().toISOString()
}

export async function fetchCrmGmailReplies(userId: string, ventureId: string): Promise<CrmGmailReply[]> {
  const outreachMessages = await getOutreachMessagesForVenture(ventureId)
  if (outreachMessages.length === 0) return []

  const { accessToken } = await getGmailAccessToken(userId)
  const byThread = new Map<string, typeof outreachMessages[number]>()
  for (const message of outreachMessages) {
    if (!byThread.has(message.google_thread_id)) {
      byThread.set(message.google_thread_id, message)
    }
  }

  const replies: CrmGmailReply[] = []

  for (const [threadId, tracked] of byThread) {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!response.ok) continue

    const thread = (await response.json()) as GmailThreadResponse
    for (const message of thread.messages ?? []) {
      if (message.labelIds?.includes('SENT')) continue
      if (message.id === tracked.google_message_id) continue

      const body = stripQuotedReply(extractBody(message))
      if (!body) continue

      replies.push({
        leadName: tracked.lead?.name ?? null,
        leadEmail: tracked.lead?.email ?? '',
        snippet: body.slice(0, 1000),
        timestamp: messageTimestamp(message),
        gmailMessageId: message.id,
        gmailThreadId: message.threadId,
      })
    }
  }

  replies.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  return replies
}
