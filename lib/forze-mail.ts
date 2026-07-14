import 'server-only'

export type ForzeAuthMailEvent = 'login' | 'email_confirmed' | 'password_changed'

type ForzeMailContext = {
  event: ForzeAuthMailEvent
  name: string
  email: string
}

type ForzeMailResult =
  | { sent: true }
  | { sent: false; reason: 'not_configured' | 'request_failed' | 'invalid_response' }

const FORZE_FROM_EMAIL = process.env.FORZE_FROM_EMAIL ?? 'Forze <no-reply@tryforze.ai>'
const RESEND_API_KEY = process.env.FORZE_RESEND_API_KEY

export async function sendForzeAuthMail(context: ForzeMailContext): Promise<ForzeMailResult> {
  if (!RESEND_API_KEY) {
    return { sent: false, reason: 'not_configured' }
  }

  const payload = buildForzeMail(context)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    return { sent: false, reason: 'request_failed' }
  }

  return { sent: true }
}

// ─── Lead-captured alert ───────────────────────────────────────────────────────
//
// Sent (best-effort, rate-capped by the caller) to the venture owner when a
// visitor submits the lead form on their published landing page. This is the
// product's core promise made visible — the page the AI built actually works.

type ForzeLeadAlertContext = {
  to: string
  ownerName: string
  ventureId: string
  ventureName: string
  leadEmail: string
  leadName?: string | null
  source?: string | null
}

export async function sendLeadCapturedMail(context: ForzeLeadAlertContext): Promise<ForzeMailResult> {
  if (!RESEND_API_KEY) {
    return { sent: false, reason: 'not_configured' }
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://tryforze.ai').trim().replace(/\/+$/, '')
  const crmUrl = `${appUrl}/dashboard/venture/${context.ventureId}/crm`
  const ventureName = context.ventureName.trim() || 'your venture'
  const leadName = context.leadName?.trim() ?? ''
  const source = context.source?.trim() ?? ''
  // Lead fields arrive from a public endpoint — renderHtml escapes the
  // message, so visitor-controlled text can never inject markup.
  const leadDescriptor = leadName ? `${leadName} (${context.leadEmail})` : context.leadEmail
  const message = `${leadDescriptor} just left their details on the ${ventureName} landing page${source ? ` (via ${source})` : ''}. They're waiting in your CRM — reach out while the interest is fresh.`
  const subject = `New lead for ${ventureName}`
  const greetingName = context.ownerName.trim() || 'there'

  const payload = {
    from: FORZE_FROM_EMAIL,
    to: [context.to],
    subject,
    text: `Hi ${greetingName},\n\n${message}\n\nOpen your CRM: ${crmUrl}\nThe Forze team`,
    html: renderHtml({
      title: subject,
      headline: 'You captured a new lead',
      message,
      ctaLabel: 'Open your CRM',
      ctaHref: crmUrl,
      footer: 'The Forze team',
      greetingName: escapeHtml(greetingName),
    }),
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    return { sent: false, reason: 'request_failed' }
  }

  return { sent: true }
}

// ─── Outreach reply alert ──────────────────────────────────────────────────────
//
// Sent (best-effort, rate-capped by the caller) to the venture owner when the
// CRM reply-sync cron persists a new inbound reply to their outreach. A reply
// is the highest-value event in the outreach product — getting the founder
// back in fast is the whole point.

type ForzeReplyAlertContext = {
  to: string
  ownerName: string
  ventureId: string
  ventureName: string
  fromEmail: string
  subject?: string | null
  summary?: string | null
  replyType?: string | null
}

export async function sendReplyReceivedMail(context: ForzeReplyAlertContext): Promise<ForzeMailResult> {
  if (!RESEND_API_KEY) {
    return { sent: false, reason: 'not_configured' }
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://tryforze.ai').trim().replace(/\/+$/, '')
  const crmUrl = `${appUrl}/dashboard/venture/${context.ventureId}/crm`
  const ventureName = context.ventureName.trim() || 'your venture'
  const subject = context.subject?.trim() ?? ''
  const summary = context.summary?.trim() ?? ''
  // All fields below reach renderHtml, which escapes them — inbound email
  // content (attacker-influenced) can never inject markup into the alert.
  const parts = [`${context.fromEmail} replied to your ${ventureName} outreach`]
  if (subject) parts.push(`Subject: "${subject}".`)
  if (summary) parts.push(summary)
  parts.push('Open your CRM to read the full thread and respond while it’s warm.')
  const message = parts.join(' ')
  const mailSubject = `New reply for ${ventureName}`
  const greetingName = context.ownerName.trim() || 'there'

  const payload = {
    from: FORZE_FROM_EMAIL,
    to: [context.to],
    subject: mailSubject,
    text: `Hi ${greetingName},\n\n${message}\n\nOpen your CRM: ${crmUrl}\nThe Forze team`,
    html: renderHtml({
      title: mailSubject,
      headline: 'You got a reply',
      message,
      ctaLabel: 'Read the reply',
      ctaHref: crmUrl,
      footer: 'The Forze team',
      greetingName: escapeHtml(greetingName),
    }),
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    return { sent: false, reason: 'request_failed' }
  }

  return { sent: true }
}

// ─── Weekly founder digest ─────────────────────────────────────────────────────
//
// Sent (best-effort, once-per-week-capped by the caller) to founders who had
// any landing-page activity in the past week. The recurring "here's what
// happened" touch is the retention loop the platform was missing.

type ForzeDigestContext = {
  to: string
  ownerName: string
  leads: number
  pageviews: number
  topVentureName?: string | null
  ctaUrl: string
}

export async function sendWeeklyDigestMail(context: ForzeDigestContext): Promise<ForzeMailResult> {
  if (!RESEND_API_KEY) {
    return { sent: false, reason: 'not_configured' }
  }

  const greetingName = context.ownerName.trim() || 'there'
  const leadWord = context.leads === 1 ? 'new lead' : 'new leads'
  const viewWord = context.pageviews === 1 ? 'page view' : 'page views'
  const venturePhrase = context.topVentureName?.trim() ? ` Most of the action was on ${context.topVentureName.trim()}.` : ''
  const message = `Here's your week on Forze: ${context.leads} ${leadWord} and ${context.pageviews} ${viewWord} across your landing pages.${venturePhrase} Keep the momentum going.`

  const payload = {
    from: FORZE_FROM_EMAIL,
    to: [context.to],
    subject: `Your Forze week: ${context.leads} ${leadWord}, ${context.pageviews} ${viewWord}`,
    text: `Hi ${greetingName},\n\n${message}\n\nOpen Forze: ${context.ctaUrl}\nThe Forze team`,
    html: renderHtml({
      title: 'Your weekly Forze digest',
      headline: 'Your week on Forze',
      message,
      ctaLabel: 'Open your dashboard',
      ctaHref: context.ctaUrl,
      footer: 'The Forze team',
      greetingName: escapeHtml(greetingName),
    }),
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    return { sent: false, reason: 'request_failed' }
  }

  return { sent: true }
}

function buildForzeMail(context: ForzeMailContext) {
  const greetingName = context.name.trim() || 'there'
  const subject = getSubject(context.event)
  const body = getBody(context)

  return {
    from: FORZE_FROM_EMAIL,
    to: [context.email],
    subject,
    text: body.text,
    html: body.html,
  }
}

function getSubject(event: ForzeAuthMailEvent) {
  switch (event) {
    case 'login':
      return 'Forze sign-in alert'
    case 'email_confirmed':
      return 'Welcome to Forze'
    case 'password_changed':
      return 'Your Forze password was updated'
  }
}

function getBody({ event, name }: ForzeMailContext) {
  const greetingName = escapeHtml(name.trim() || 'there')
  const closing = 'The Forze team'
  const appUrl = 'https://tryforze.ai'

  if (event === 'login') {
    return {
      text: `Hi ${name.trim() || 'there'},\n\nYour Forze account just signed in successfully. If this was you, no action is needed.\n\nIf you do not recognize this sign-in, please reset your password right away.\n\nOpen Forze: ${appUrl}\n${closing}`,
      html: renderHtml({
        title: 'New sign-in to your Forze account',
        headline: 'Your account just signed in',
        message:
          'If this was you, no action is needed. If it was not, reset your password immediately from the sign-in page.',
        ctaLabel: 'Open Forze',
        ctaHref: appUrl,
        footer: closing,
        greetingName,
      }),
    }
  }

  if (event === 'email_confirmed') {
    return {
      text: `Hi ${name.trim() || 'there'},\n\nYour email address is now confirmed for Forze. Your account is ready to use.\n\nOpen Forze: ${appUrl}\n${closing}`,
      html: renderHtml({
        title: 'Your Forze email is confirmed',
        headline: 'Welcome to Forze',
        message: 'Your email address is verified and your account is ready to use.',
        ctaLabel: 'Go to Forze',
        ctaHref: appUrl,
        footer: closing,
        greetingName,
      }),
    }
  }

  return {
    text: `Hi ${name.trim() || 'there'},\n\nYour Forze password was changed successfully. If this was you, no action is needed.\n\nIf you did not change your password, reset it immediately and review your account activity.\n\nOpen Forze: ${appUrl}\n${closing}`,
    html: renderHtml({
      title: 'Your Forze password changed',
      headline: 'Password updated',
      message:
        'If this was you, no action is needed. If you did not make this change, reset your password immediately and review your account activity.',
      ctaLabel: 'Open Forze',
      ctaHref: appUrl,
      footer: closing,
      greetingName,
    }),
  }
}

function renderHtml({
  title,
  headline,
  message,
  ctaLabel,
  ctaHref,
  footer,
  greetingName,
}: {
  title: string
  headline: string
  message: string
  ctaLabel: string
  ctaHref: string
  footer: string
  greetingName: string
}) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0b0f14;font-family:Arial,Helvetica,sans-serif;color:#f5f7fb;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(title)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0f14;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:linear-gradient(180deg,#101722 0%,#0e131b 100%);border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px;">
                <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#c4975a;font-weight:700;">Forze</div>
                <h1 style="margin:14px 0 0;font-size:28px;line-height:1.2;color:#ffffff;">${escapeHtml(headline)}</h1>
                <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#d7dce4;">Hi ${greetingName},</p>
                <p style="margin:12px 0 0;font-size:16px;line-height:1.7;color:#d7dce4;">${escapeHtml(message)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px;">
                <a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#c4975a;color:#111111;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:999px;">${escapeHtml(ctaLabel)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 28px;color:#8d96a6;font-size:13px;line-height:1.6;">
                ${escapeHtml(footer)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
