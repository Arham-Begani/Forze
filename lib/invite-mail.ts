// lib/invite-mail.ts
// Sends venture-collaborator invite emails via Resend.

export type SendInviteResult =
  | { sent: true }
  | { sent: false; reason: 'not_configured' | 'request_failed' | 'invalid_response' }

type SendInviteInput = {
  to: string
  inviteUrl: string
  ventureName: string
  inviterName: string
  role: 'admin' | 'editor' | 'viewer'
}

const FORZE_FROM_EMAIL = process.env.FORZE_FROM_EMAIL ?? 'Forze <no-reply@tryforze.ai>'
const RESEND_API_KEY = process.env.FORZE_RESEND_API_KEY

export async function sendVentureInviteMail(input: SendInviteInput): Promise<SendInviteResult> {
  if (!RESEND_API_KEY) {
    return { sent: false, reason: 'not_configured' }
  }

  const payload = buildInviteMail(input)

  try {
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
  } catch {
    return { sent: false, reason: 'request_failed' }
  }
}

function buildInviteMail({ to, inviteUrl, ventureName, inviterName, role }: SendInviteInput) {
  const inviter = inviterName.trim() || 'A Forze teammate'
  const subject = `${inviter} invited you to collaborate on ${ventureName}`
  const greetingName = escapeHtml(to.split('@')[0] || 'there')
  const safeInviter = escapeHtml(inviter)
  const safeVenture = escapeHtml(ventureName)
  const safeRole = escapeHtml(role)
  const safeUrl = escapeHtml(inviteUrl)

  const text =
    `Hi,\n\n${inviter} invited you to join the venture "${ventureName}" on Forze as a ${role}.\n\n` +
    `Accept the invite here:\n${inviteUrl}\n\n` +
    `This link expires in 7 days.\n\nThe Forze team`

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0b0f14;font-family:Arial,Helvetica,sans-serif;color:#f5f7fb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0f14;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:linear-gradient(180deg,#101722 0%,#0e131b 100%);border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px;">
                <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#c4975a;font-weight:700;">Forze</div>
                <h1 style="margin:14px 0 0;font-size:26px;line-height:1.25;color:#ffffff;">You've been invited to ${safeVenture}</h1>
                <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#d7dce4;">Hi ${greetingName},</p>
                <p style="margin:12px 0 0;font-size:16px;line-height:1.7;color:#d7dce4;">
                  <strong style="color:#ffffff;">${safeInviter}</strong> invited you to collaborate on the venture
                  <strong style="color:#ffffff;">${safeVenture}</strong> as a <strong style="color:#c4975a;">${safeRole}</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px;">
                <a href="${safeUrl}" style="display:inline-block;background:#c4975a;color:#111111;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px;">Accept invite</a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 8px;color:#8d96a6;font-size:13px;line-height:1.6;">
                Or paste this link into your browser:<br>
                <a href="${safeUrl}" style="color:#c4975a;word-break:break-all;">${safeUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 28px;color:#8d96a6;font-size:13px;line-height:1.6;">
                This invite expires in 7 days.<br>
                The Forze team
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return {
    from: FORZE_FROM_EMAIL,
    to: [to],
    subject,
    text,
    html,
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
