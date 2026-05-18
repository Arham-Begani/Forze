import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function getEncryptionSecret(): string {
  const secret = process.env.MARKETING_TOKEN_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('MARKETING_TOKEN_ENCRYPTION_KEY is required for marketing integrations')
  }
  return secret
}

function getKey(): Buffer {
  return createHash('sha256').update(getEncryptionSecret()).digest()
}

function toBase64Url(value: Buffer): string {
  return value.toString('base64url')
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

export function encryptSecret(value: string | null | undefined): string | null {
  if (!value) return null

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return ['v1', toBase64Url(iv), toBase64Url(tag), toBase64Url(encrypted)].join('.')
}

// Typed error so callers (especially the publish dispatcher) can detect a
// key mismatch and mark the integration as reauth_required, rather than
// bubbling Node's cryptic "Unsupported state or unable to authenticate data"
// message into routine_runs and the UI.
export class SecretDecryptError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'SecretDecryptError'
  }
}

export function isSecretDecryptError(err: unknown): err is SecretDecryptError {
  return err instanceof SecretDecryptError || (err instanceof Error && err.name === 'SecretDecryptError')
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null

  const [version, ivEncoded, tagEncoded, payloadEncoded] = value.split('.')
  if (version !== 'v1' || !ivEncoded || !tagEncoded || !payloadEncoded) {
    throw new SecretDecryptError('Invalid encrypted secret payload')
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', getKey(), fromBase64Url(ivEncoded))
    decipher.setAuthTag(fromBase64Url(tagEncoded))
    const decrypted = Buffer.concat([
      decipher.update(fromBase64Url(payloadEncoded)),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  } catch (err) {
    // GCM auth failure → key changed since this secret was encrypted.
    // The only recovery is for the user to reconnect the integration so a
    // fresh token gets re-encrypted with the current key.
    throw new SecretDecryptError(
      'Stored token could not be decrypted — the integration must be reconnected.',
      err
    )
  }
}

export function generateOpaqueToken(bytes = 24): string {
  return toBase64Url(randomBytes(bytes))
}
