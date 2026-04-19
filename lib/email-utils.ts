// lib/email-utils.ts
// Stateless email utility functions — no DB access, no API calls

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// Replace {{firstName}}, {{company}}, {{jobTitle}} etc. in a template
export function personalizeTemplate(
  template: string,
  data: Record<string, string | undefined | null>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return data[key] ?? data[key.toLowerCase()] ?? match
  })
}

// Escape characters that would break out of an HTML attribute value.
// Used for URLs we inject into src/href so an attacker can't e.g. embed a
// double quote to escape the attribute and inject script tags.
function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Inject a 1x1 transparent tracking pixel before </body> or at the end.
// Hardened vs the previous version in three ways:
//   1. Case-insensitive </body> match — Gemini-generated HTML sometimes emits
//      uppercase or mixed-case close tags.
//   2. Only replaces the first occurrence; if the body somehow contains
//      multiple </body> the pixel ends up at the outermost one exactly once.
//   3. Idempotent — calling this twice with the same URL does not embed two
//      pixels. Matters for manual retries in the send route.
export function addTrackingPixel(htmlBody: string, pixelUrl: string): string {
  if (htmlBody.includes(pixelUrl)) return htmlBody
  const safeUrl = escapeHtmlAttribute(pixelUrl)
  const pixel = `<img src="${safeUrl}" width="1" height="1" border="0" alt="" style="display:none;" />`

  const match = htmlBody.match(/<\/body\s*>/i)
  if (match && typeof match.index === 'number') {
    return htmlBody.slice(0, match.index) + pixel + htmlBody.slice(match.index)
  }
  return htmlBody + pixel
}

// Rewrite href anchors to go through the click-tracking route. Handles
// href="…" and href='…' variants and skips:
//   • links that already point at our /api/track/ routes (idempotent)
//   • non-http(s) schemes (mailto:, tel:, javascript:, sms:, fragment-only)
// The earlier version only matched double-quoted hrefs with http(s) schemes,
// so single-quoted hrefs (which Gemini sometimes emits) silently bypassed
// click tracking. Also narrows the URL capture to exclude whitespace that
// could smuggle extra attributes into the rewritten tag.
export function rewriteLinksForTracking(
  htmlBody: string,
  campaignId: string,
  leadId: string,
  baseUrl: string,
  sig?: string
): string {
  return htmlBody.replace(/href\s*=\s*(["'])([^"']+)\1/gi, (match, quote: string, url: string) => {
    const trimmed = url.trim()
    if (!/^https?:\/\//i.test(trimmed)) return match
    if (trimmed.includes('/api/track/')) return match

    const encoded = encodeURIComponent(trimmed)
    const sigParam = sig ? `&sig=${encodeURIComponent(sig)}` : ''
    const trackingUrl = `${baseUrl}/api/track/click/${campaignId}/${leadId}?url=${encoded}${sigParam}`
    return `href=${quote}${escapeHtmlAttribute(trackingUrl)}${quote}`
  })
}

// Extract all absolute http(s) hrefs. Same widening as above — both quote styles.
export function extractLinksFromHtml(htmlBody: string): string[] {
  const matches = htmlBody.matchAll(/href\s*=\s*(["'])(https?:\/\/[^"']+)\1/gi)
  return [...matches].map((m) => m[2])
}

// Build unsubscribe footer HTML block (CAN-SPAM compliance)
export function buildUnsubscribeFooter(
  campaignId: string,
  leadId: string,
  baseUrl: string
): string {
  const unsubUrl = escapeHtmlAttribute(`${baseUrl}/api/track/unsubscribe/${campaignId}/${leadId}`)
  return `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;">
  You received this email because you opted into outreach for this campaign.
  <a href="${unsubUrl}" style="color:#999;">Unsubscribe</a>
</div>`
}

// Inject the unsubscribe footer immediately before </body>, falling back to
// append if no body tag exists. Same resilience properties as
// addTrackingPixel — case-insensitive match, only first occurrence, and
// idempotent against a repeat call with the same campaign/lead ids.
export function injectUnsubscribeFooter(
  htmlBody: string,
  campaignId: string,
  leadId: string,
  baseUrl: string
): string {
  const marker = `/api/track/unsubscribe/${campaignId}/${leadId}`
  if (htmlBody.includes(marker)) return htmlBody

  const footer = buildUnsubscribeFooter(campaignId, leadId, baseUrl)
  const match = htmlBody.match(/<\/body\s*>/i)
  if (match && typeof match.index === 'number') {
    return htmlBody.slice(0, match.index) + footer + htmlBody.slice(match.index)
  }
  return htmlBody + footer
}

// Wrap plain-text email body in minimal HTML
export function wrapInHtml(plainText: string): string {
  const escaped = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#222;">${escaped}</body></html>`
}
