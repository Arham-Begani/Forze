'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'

// The review step used to show a 300-character slice of the raw template with
// {{firstName}} still in it, so a lead missing a company or title only turned
// up as "your company" in a live inbox. This renders the real message for a
// real recipient and lets you scrub through the list before sending.

export interface PreviewLead {
  first_name: string
  email: string
  company?: string
  job_title?: string
  last_name?: string
}

// Mirrors personalizeEmail/personalizeSubject in lib/email-generator.ts. Kept
// deliberately simple — the server is authoritative, this only has to show
// the founder what substitution will produce.
function substitute(template: string, lead: PreviewLead, ventureName: string) {
  const missing: string[] = []

  const value = (raw: string | undefined, fallback: string, label: string) => {
    if (raw && raw.trim()) return raw.trim()
    missing.push(label)
    return fallback
  }

  const rendered = template
    .replace(/\{\{firstName\}\}/gi, () => value(lead.first_name, 'there', 'first name'))
    .replace(/\{\{lastName\}\}/gi, () => value(lead.last_name, '', 'last name'))
    .replace(/\{\{company\}\}/gi, () => value(lead.company, 'your company', 'company'))
    .replace(/\{\{jobTitle\}\}/gi, () => value(lead.job_title, 'your role', 'job title'))
    .replace(/\{\{ventureName\}\}/gi, ventureName)

  // De-duplicate: a template using {{company}} twice is one missing field.
  return { rendered, missing: Array.from(new Set(missing)) }
}

export function EmailPreview({
  subject,
  body,
  leads,
  ventureName,
  fromEmail,
}: {
  subject: string
  body: string
  leads: PreviewLead[]
  ventureName: string
  fromEmail?: string | null
}) {
  const [index, setIndex] = useState(0)

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-xs font-medium text-[var(--muted)]">Preview</p>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Add recipients to preview the email as they will receive it.
        </p>
      </div>
    )
  }

  const safeIndex = Math.min(index, leads.length - 1)
  const lead = leads[safeIndex]
  const renderedSubject = substitute(subject, lead, ventureName)
  const renderedBody = substitute(body, lead, ventureName)
  const missing = Array.from(new Set([...renderedSubject.missing, ...renderedBody.missing]))

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
        <p className="text-xs font-medium text-[var(--muted)]">
          Previewing as{' '}
          <span className="font-semibold text-[var(--text)]">{lead.first_name}</span>
          {lead.company ? ` at ${lead.company}` : ''}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
            disabled={safeIndex === 0}
            aria-label="Previous recipient"
            className="rounded-md p-1 text-[var(--text-soft)] hover:bg-[var(--nav-active)] disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs tabular-nums text-[var(--muted)]">
            {safeIndex + 1} of {leads.length}
          </span>
          <button
            type="button"
            onClick={() => setIndex((prev) => Math.min(leads.length - 1, prev + 1))}
            disabled={safeIndex >= leads.length - 1}
            aria-label="Next recipient"
            className="rounded-md p-1 text-[var(--text-soft)] hover:bg-[var(--nav-active)] disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-1 border-b border-[var(--border)] px-4 py-3 text-xs">
        <div className="flex gap-2">
          <span className="w-14 shrink-0 text-[var(--muted)]">From</span>
          <span className="truncate text-[var(--text-soft)]">{fromEmail || 'your connected Gmail'}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-14 shrink-0 text-[var(--muted)]">To</span>
          <span className="truncate text-[var(--text-soft)]">{lead.email}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-14 shrink-0 text-[var(--muted)]">Subject</span>
          <span className="font-semibold text-[var(--text)]">{renderedSubject.rendered}</span>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="flex items-start gap-2 border-b border-[var(--border)] bg-amber-500/10 px-4 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-xs text-[var(--text-soft)]">
            This recipient has no {missing.join(' or ')} — the email falls back to generic wording.
          </p>
        </div>
      )}

      <div className="whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-[var(--text)]">
        {renderedBody.rendered}
      </div>
    </div>
  )
}
