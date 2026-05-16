# CRM Dashboard — Build Plan

> **Audience:** any AI model (Claude, Codex, Gemini, GPT) executing the build. Self‑contained — no other docs required.
> **Repo:** `C:\Users\arham\Documents\Github\Forge` · Next.js 15 App Router · TS strict · CSS vars + inline styles · Antigravity DB · Gemini.
> **Route:** `/dashboard/venture/[id]/crm`
> **Constraint from CLAUDE.md:** surgical edits, one file per prompt, never rewrite full files, use CSS vars, no Tailwind purple gradients, follow design system.

---

## Context — Why this work

The CRM route is half‑built. Two competing components exist; the active one (`CrmDashboardClient.tsx`) has placeholder text (`"(Leads fetched from actual DB, rendering list here...)"`), uses Tailwind classes mixed with CSS vars (some undefined), and ignores the polished `CrmDashboard.tsx` component already shipped (Inbox/Leads/Pipeline). The 6 backend endpoints are all live but only 2 are surfaced. The DB has lead status columns the UI never exposes.

**Goal:** one cohesive, working CRM dashboard that surfaces every existing endpoint, manages lead status, and matches the Forze design language. No new agents, no schema changes, no new endpoints beyond what's listed below.

---

## Existing infrastructure (reuse — do not rebuild)

### Endpoints (all live)
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/ventures/[id]/crm/analytics` | `app/api/ventures/[id]/crm/analytics/route.ts` | Visitors, leads, conversion %, social breakdown, IG comments |
| GET | `/api/ventures/[id]/crm/inbox` | `app/api/ventures/[id]/crm/inbox/route.ts` | Aggregated social comments (`CrmInboxItem[]`) |
| GET | `/api/ventures/[id]/crm/leads` | `app/api/ventures/[id]/crm/leads/route.ts` | Deduplicated **social** leads (commenters) |
| POST | `/api/ventures/[id]/crm/dispatch` | `app/api/ventures/[id]/crm/dispatch/route.ts` | Send outreach campaign to email leads |
| POST | `/api/ventures/[id]/leads` | `app/api/ventures/[id]/leads/route.ts` | Landing page lead capture (CORS) |
| POST | `/api/ventures/[id]/track` | `app/api/ventures/[id]/track/route.ts` | Landing page event capture (CORS) |
| GET | `/api/campaigns?venture_id=…` | existing | List campaigns for pipeline view |

### DB tables (already in `lib/queries.ts`)
- `leads` — id, venture_id, email, name, status (`new`/`contacted`/`qualified`/`lost`/`won`), source, created_at
- `analytics_events` — id, venture_id, event_type, metadata, created_at
- `outreach_campaigns` — id, venture_id, type, status, sent_count, created_at
- Helpers: `createLead`, `getLeadsForVenture`, `updateLeadStatus`, `createAnalyticsEvent`, `getAnalyticsForVenture`, `createOutreachCampaign`, `getOutreachCampaignsForVenture`

### Design tokens (verified in `app/globals.css`)
- Bg: `--bg`, `--sidebar`, `--card-solid`, `--bg-elev`
- Text: `--text`, `--text-soft`, `--muted`
- Lines: `--border`
- Accent: `--accent`, `--accent-soft`, `--accent-glow`
- Module accents (hex): Full Launch `#C4975A` · Research `#5A8C6E` · Branding `#5A6E8C` · Marketing `#8C5A7A` · Landing `#8C7A5A` · Feasibility `#7A5A8C`

### Two distinct "lead" concepts (do not merge)
1. **Email leads** — table `leads`, captured from landing page, used for outreach dispatch.
2. **Social leads** — deduplicated Instagram commenters from `/crm/leads`, used for engagement, no email.

---

## Critical files

| File | Action |
|---|---|
| `components/venture/CrmDashboardClient.tsx` | **Rewrite as the single source of truth** (surgical, section‑by‑section) |
| `components/venture/CrmDashboard.tsx` | **Delete** after migration (orphan, duplicate) |
| `app/dashboard/venture/[id]/crm/page.tsx` | No change (already imports `CrmDashboardClient`) |
| `app/api/ventures/[id]/crm/leads/email/route.ts` | **NEW** — GET email leads from DB (separate from social leads) |
| `app/api/ventures/[id]/crm/leads/[leadId]/route.ts` | **NEW** — PATCH for status updates, DELETE for removal |
| `app/api/ventures/[id]/crm/leads/export/route.ts` | **NEW** — GET CSV export |
| `lib/queries.ts` | **Add 2 helpers**: `deleteLead(id)`, `getLeadById(id)` |

---

## Final UI structure

Single page at `/dashboard/venture/[id]/crm` with a header, KPI strip, and 5 tabs.

```
┌──────────────────────────────────────────────────────────┐
│  VENTURE NAME                                            │
│  CRM Dashboard                                           │
│  Track inbound signal, manage leads, run outreach.       │
├──────────────────────────────────────────────────────────┤
│  Channel pills: Instagram · LinkedIn · Gmail · Reddit*  │
├──────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Visitors │ │ E-Leads  │ │ Conv %   │ │ Replies  │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
├──────────────────────────────────────────────────────────┤
│  [Overview] [Inbox] [Leads] [Outreach] [Pipeline]        │
├──────────────────────────────────────────────────────────┤
│  ...tab content...                                       │
└──────────────────────────────────────────────────────────┘
```

### Tab 1 — Overview (default)
- **Conversion funnel** — 3 stat tiles in a row: `Visitors → Leads → Conversion %` with arrow connectors. Source: `/crm/analytics`.
- **Traffic source attribution** — 3 cards (Twitter/LinkedIn/Instagram), each shows reach/clicks + leads generated. Source: `socialBreakdown` from `/crm/analytics`.
- **7‑day trend sparkline** — tiny inline SVG of pageviews per day, derived client‑side from `rawAnalytics`. No chart library — pure SVG path.
- **Recent activity list** — last 5 events of any kind (leads captured + comments received), sorted by time.

### Tab 2 — Inbox
- Card list of social comments from `/crm/inbox` (already implemented in orphan `CrmDashboard.tsx` — port the `InboxItemRow` component verbatim, lines 391–436).
- Filters: source dropdown (all/instagram/linkedin/gmail), text search.
- Empty/loading/error states.

### Tab 3 — Leads
- **Two sub‑sections** (segmented control, no nested tabs):
  - **Email leads** (default) — table from new `/crm/leads/email` endpoint. Columns: name · email · source · status (editable dropdown) · captured · row action menu (mark won/lost, delete). PATCH `/crm/leads/[leadId]`.
  - **Social leads** — table from existing `/crm/leads`. Columns: handle · source badge · interactions · last touch (port `LeadsTab` from `CrmDashboard.tsx` lines 438–533).
- Header right side: "Export CSV" button → `/crm/leads/export?type=email`.

### Tab 4 — Outreach
- Reuse the existing form in `CrmDashboardClient.tsx` lines 211–268 (campaign type, subject, body, dispatch button).
- **Add three things:**
  1. Recipient summary card *above* the form: "Will send to N qualified email leads (status ≠ lost)" — pulled from email leads list.
  2. Live preview pane to the right showing `{{name}}` interpolated with the first lead.
  3. Confirmation modal before send: "Send to N leads? This cannot be undone." Use existing `Toast` component for post‑send feedback.

### Tab 5 — Pipeline
- Port the entire `PipelineTab` from orphan `CrmDashboard.tsx` lines 535–693.
- 4 metric tiles: Sent · Opened · Clicked · Replied (totals across all campaigns).
- Campaign list table linking to `/dashboard/venture/[id]/campaigns/[campaignId]`.
- "View all →" link to campaigns page.

---

## Implementation order (one PR per step, one commit each)

> CLAUDE.md rule: each step = one file, one commit, attribute to `arhambegani2@gmail.com`, no co‑authors.

1. **Add `deleteLead` and `getLeadById`** in `lib/queries.ts` (2 small helpers, mirror existing pattern at lines 759–874).
2. **Create** `app/api/ventures/[id]/crm/leads/email/route.ts` → GET, returns `getLeadsForVenture(id)`. Validates session via `getSession()`.
3. **Create** `app/api/ventures/[id]/crm/leads/[leadId]/route.ts` → PATCH (Zod: `{ status: enum }`) + DELETE. Verify lead belongs to venture.
4. **Create** `app/api/ventures/[id]/crm/leads/export/route.ts` → GET `?type=email|social`, returns `text/csv`.
5. **Rewrite** `components/venture/CrmDashboardClient.tsx` step‑by‑step:
   - 5a. Replace inconsistent Tailwind with CSS‑var inline styles (match `CrmDashboard.tsx` style).
   - 5b. Add KPI strip + Overview tab (move existing analytics content here).
   - 5c. Add Inbox tab — port `InboxTab` + `InboxItemRow` from orphan.
   - 5d. Replace placeholder Leads tab with the two‑segment Email/Social view.
   - 5e. Enhance Outreach tab with recipient summary + preview + confirm modal.
   - 5f. Add Pipeline tab — port `PipelineTab` + `PipelineMetric` + `PipelineCell` from orphan.
6. **Delete** `components/venture/CrmDashboard.tsx` (orphan).
7. **Update** `PROGRESS.md` per CLAUDE.md rule.

Each step ≤ ~150 lines diff. Total ≈ 7 commits.

---

## Hard rules for the implementer

- **No new agents.** CRM is data + UI only.
- **No schema changes.** All needed columns exist.
- **No Tailwind classes for new code.** Use inline styles + CSS vars (`var(--text)`, `var(--accent)`, etc.) as `CrmDashboard.tsx` already does.
- **No `localStorage`.** State lives in component state + DB.
- **All POST/PATCH inputs validated with Zod.**
- **All routes wrapped in `try/catch`** with consistent `NextResponse.json({ error }, { status })`.
- **Loading + error + empty states for every async block.** Reuse `emptyStateStyle` from orphan (lines 695–703).
- **No external chart library.** 7‑day sparkline = inline SVG.
- **`requireAuth()` on the page (already done).** API routes use `getSession()` and verify `venture.user_id === session.userId` before mutation.
- **Lead deletion is hard delete** (not soft) — keep schema unchanged.
- **CSV export** uses simple string concat; no library.

---

## Verification (end‑to‑end test)

After each step and at the end:

1. `npm run build` — must pass with zero TS errors.
2. `npm run dev` and open `/dashboard/venture/<real-id>/crm`.
3. **Overview**: KPI tiles render. Sparkline visible if any pageviews exist.
4. **Inbox**: With Instagram connected and a published asset, comments appear. Without → empty state (not error).
5. **Leads → Email**:
   - `curl -X POST http://localhost:3000/api/ventures/<id>/leads -H "Content-Type: application/json" -d '{"email":"test@x.com","name":"T"}'` → row appears.
   - Change status dropdown → refresh, status persisted.
   - Delete row → row removed.
   - "Export CSV" downloads `leads-<ventureId>.csv` with header row + data.
6. **Leads → Social**: rows match `/api/ventures/<id>/crm/leads` JSON.
7. **Outreach**: Recipient count matches qualified email leads. Preview shows interpolated body. Confirm modal appears. After dispatch, toast shows "Sent to N leads", `outreach_campaigns` row exists in DB.
8. **Pipeline**: Totals are sum of all campaign counts. Clicking a campaign navigates to `/dashboard/venture/[id]/campaigns/[campaignId]`.
9. **Dark mode toggle**: every panel readable, no hardcoded white/black.
10. **Mobile (375px)**: tabs scroll horizontally, tables become card lists OR horizontal scroll (whichever is simpler).

---

## Out of scope (do not build)

- Lead enrichment / Clearbit lookups
- AI‑assisted reply suggestions
- Multi‑step drip sequences (single dispatch only)
- Webhooks / Zapier
- Lead scoring algorithms
- Bulk import from CSV
- Per‑lead notes/timeline view
- Calendar / meeting booking
- A/B test on email copy

These can come later. Today: ship a clean, complete, working surface for what already exists in the DB.

---

## Done means

- One file controls the CRM UI (`CrmDashboardClient.tsx`); the orphan is gone.
- All 7 endpoints (4 existing + 3 new) are surfaced.
- Lead status is editable; CSV exports.
- All design tokens come from `globals.css`.
- `npm run build` is green.
- 7 commits on `main`, all by `arhambegani2@gmail.com`, no co‑authors.
