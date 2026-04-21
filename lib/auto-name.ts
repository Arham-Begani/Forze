// Auto-detect a reasonable display first name from an email address so the
// Direct Mail flow can address recipients by name without the operator having
// to type each one. Pure + deterministic — no network, no LLM. Safe to run on
// the client as a preview and again on the server as the source of truth.

const GENERIC_LOCAL_PARTS = new Set([
  'info', 'hello', 'hi', 'contact', 'support', 'admin', 'team', 'sales',
  'hr', 'office', 'help', 'service', 'noreply', 'no-reply', 'mail', 'mailer',
  'webmaster', 'postmaster', 'marketing', 'press', 'careers', 'jobs',
  'billing', 'accounts', 'finance', 'enquiries', 'inquiries',
])

function titleCase(word: string): string {
  if (!word) return ''
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

// Given `arham.begani2@gmail.com` → `Arham`.
// Given `john_doe+promo@acme.io`  → `John`.
// Given `info@acme.io`            → `there` (generic mailbox — no personal name).
// Given `j`                       → `J`.
export function deriveFirstNameFromEmail(email: string): string {
  if (typeof email !== 'string') return 'there'
  const trimmed = email.trim()
  const atIndex = trimmed.indexOf('@')
  const local = (atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed).toLowerCase()
  if (!local) return 'there'

  // Drop the "+tag" suffix used for per-signup aliases (john+deals@...).
  const withoutPlus = local.split('+')[0]

  // Split on common separators and take the first non-empty token.
  const tokens = withoutPlus.split(/[._\-]/).filter(Boolean)
  const first = tokens[0] ?? withoutPlus

  // Strip trailing digits so arham2 → arham. If the whole token is digits (a
  // numeric-only local part like `1234567@...`), bail to the generic greeting.
  const noTrailingDigits = first.replace(/\d+$/, '')
  if (!noTrailingDigits) return 'there'

  // Role-based inboxes don't have a human first name — use the generic fallback
  // so the email still reads naturally ("Hi there,").
  if (GENERIC_LOCAL_PARTS.has(noTrailingDigits)) return 'there'

  // Keep only letters so we don't end up with emoji / non-ascii punctuation in
  // the greeting line; strip anything left that isn't a-z.
  const cleaned = noTrailingDigits.replace(/[^a-zA-Z]/g, '')
  if (!cleaned) return 'there'

  return titleCase(cleaned)
}
