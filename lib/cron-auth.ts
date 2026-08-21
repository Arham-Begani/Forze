import 'server-only'

import crypto from 'crypto'

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

/**
 * Authorize scheduled jobs using a configured secret only. Platform marker
 * headers are metadata, not credentials, and must never authorize a request.
 */
export function isCronAuthorized(
  request: { headers: { get(name: string): string | null } },
  secretNames: string[],
): boolean {
  const configuredSecrets = secretNames
    .map((name) => process.env[name])
    .filter((value): value is string => Boolean(value))

  if (configuredSecrets.length === 0) return false

  const customHeaders = ['x-cron-secret', 'x-routines-cron-secret', 'x-outreach-cron-secret', 'x-marketing-cron-secret']
  const headerSecret = customHeaders
    .map((name) => request.headers.get(name))
    .find((value): value is string => Boolean(value))
  const authorization = request.headers.get('authorization') ?? ''
  const bearerSecret = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null

  return configuredSecrets.some((secret) =>
    (headerSecret ? timingSafeEqual(headerSecret, secret) : false) ||
    (bearerSecret ? timingSafeEqual(bearerSecret, secret) : false),
  )
}
