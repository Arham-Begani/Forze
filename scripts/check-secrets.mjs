#!/usr/bin/env node

import { execSync } from 'node:child_process'

const SECRET_ENV_NAMES = [
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'GEMINI_API_KEY',
  'XAI_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_CLIENT_SECRET',
  'MARKETING_TOKEN_ENCRYPTION_KEY',
  'FORZE_RESEND_API_KEY',
  'CRON_SECRET',
  'ROUTINES_CRON_SECRET',
  'OUTREACH_CRON_SECRET',
  'MARKETING_PUBLISH_CRON_SECRET',
]

const PLACEHOLDER = /^(your|<|\.\.\.|xxx|placeholder|changeme|todo|\$\{|whsec_your|example)/i

const LITERAL_PATTERNS = [
  { name: 'Razorpay live key id', re: /rzp_live_[A-Za-z0-9]{10,}/ },
  { name: 'Razorpay test key id', re: /rzp_test_[A-Za-z0-9]{10,}/ },
  { name: 'Google API key', re: /AIzaSy[A-Za-z0-9_\-]{20,}/ },
  { name: 'Stripe secret key', re: /sk_(live|test)_[A-Za-z0-9]{16,}/ },
  { name: 'xAI key', re: /xai-[A-Za-z0-9]{20,}/ },
  { name: 'Resend key', re: /\bre_[A-Za-z0-9]{20,}/ },
  { name: 'Supabase service-role JWT', re: /eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{20,}\./ },
  { name: 'Private key block', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
]

const assignmentRe = new RegExp(`\\b(${SECRET_ENV_NAMES.join('|')})\\s*[=:]\\s*["']?([^"'\\s]+)`)

function stagedFiles() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
  return out.split('\n').map((line) => line.trim()).filter(Boolean)
}

function stagedContent(file) {
  try {
    return execSync(`git show :${JSON.stringify(file)}`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  } catch {
    return ''
  }
}

const findings = []

for (const file of stagedFiles()) {
  if (file.startsWith('scripts/check-secrets')) continue

  const content = stagedContent(file)
  if (!content) continue

  const lines = content.split('\n')
  lines.forEach((line, index) => {
    for (const pattern of LITERAL_PATTERNS) {
      if (pattern.re.test(line)) {
        findings.push({ file, line: index + 1, reason: pattern.name })
      }
    }

    const match = line.match(assignmentRe)
    if (match) {
      const value = match[2]
      if (value.length >= 12 && !PLACEHOLDER.test(value)) {
        findings.push({ file, line: index + 1, reason: `${match[1]} assigned a real-looking value` })
      }
    }
  })
}

if (findings.length > 0) {
  console.error('\nBlocked: staged changes look like they contain real secrets.\n')
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}  ${finding.reason}`)
  }
  console.error('\nSecrets belong in .env.local or the Vercel dashboard, never in the repo.')
  console.error('A committed secret stays in git history even if you delete the file later.')
  console.error('\nIf this is genuinely a placeholder, commit with --no-verify.\n')
  process.exit(1)
}

process.exit(0)
