# Forze — Claude Code Rules

## What Forze Is
An Autonomous Venture Orchestrator. A coordinated swarm of AI agents that transforms a raw business concept into a production-ready, market-validated venture in minutes. Not a chatbot. Not a wrapper. Your Startup Workforce.

**This file is the source of truth.** `PRD.md` is aspirational and stale — read it for product *tone*, never for what exists. When they conflict, this file wins.

---

## Current Surface (verified August 2026)

### Venture modules — runnable via `POST /api/ventures/[id]/run`
| Module | `moduleId` | Agent | Accent |
|---|---|---|---|
| Landing Page | `landing` | `agents/pipeline.ts` | `#8C7A5A` |
| Shadow Board | `shadow-board` | `agents/shadow.ts` | `#E04848` |
| Co-pilot (general chat) | `general` | `agents/general.ts` | `#6B8F71` |
| Investor Kit | `investor-kit` | `agents/investor-kit.ts` | own page, not a chat tab |

Only `landing`, `shadow-board`, and `general` appear in the `MODULES` array on `app/dashboard/venture/[id]/[module]/page.tsx`. Investor Kit lives at `/dashboard/venture/[id]/investor-kit`. `VENTURE_TABS` in `components/venture/VentureHeader.tsx` carries only `landing` and `shadow-board`.

`agents/lead-scout.ts` is a fifth agent, driven by Campaigns rather than the run route.

### Gated non-module features
`crm`, `inspiration`, `outreach` — see `FeatureId` in `lib/billing.ts`. Free gets none; Starter unlocks `inspiration`; Builder/Pro/Studio get all three.

### Idea intake (August 2026)
Venture creation runs a conversational interview before anything is written:
- `POST /api/idea/interview` — stateless, one turn per call (`lib/idea-intake.ts`)
- `components/dashboard/IdeaIntakeChat.tsx` — mounted on `/dashboard/new` and `/dashboard/greeting`
- Produces an `IdeaBrief` (`lib/schemas/idea.ts`) stored in `projects.idea_brief`
- `GET/POST /api/projects/[id]/idea` — the living changelog; folds "what changed" notes into the next brief version
- `projects.idea_version` + `conversations.idea_version` drive the stale-module badge

**`projects.global_idea` remains the source of truth for every agent.** `idea_brief` is additive enrichment appended by the run route via `renderBriefForPrompt`. Never invert that relationship.

### Deleted — do NOT reintroduce without instruction
Pre-pivot Research/Genesis, Branding/Identity, Marketing/Content-Factory, Feasibility, Full-Launch. Removed July 2026: Launch Autopilot, MVP Scalpel.

Their `venture.context` keys (`research`, `branding`, `marketing`, `feasibility`, `launchAutopilot`, `mvpScalpel`) still exist in `createVenture` and in old rows. **Keep reading them; never write them.**

---

## Non-Negotiable Rules

### Before every task
- Check `PROGRESS.md` for current state — it is the running build log, newest entry at the bottom
- Read the actual file before editing it. There is no `ARCHITECTURE.md`, no `VENTURE_OBJECT.md`, and no `ForzeUI.jsx` — earlier versions of this file referenced them; they do not exist

### While building
- Surgical edits only — never rewrite entire files
- Never touch files outside the explicit task scope
- Never change the `venture.context` schema without explicit instruction
- Never accept or offer a full file rewrite — always prefer targeted edits
- Never build two agents in a single session — finish and test one at a time
- Never hardcode business logic inside API routes — agent logic belongs in `/agents`, AI helpers that run outside the run route belong in `/lib` (see `lib/email-generator.ts`, `lib/idea-brief.ts`)
- Never use `localStorage` or `sessionStorage` — persist to Postgres

### After every task
- Update `PROGRESS.md`: what was built, what broke, what was verified, what's next

---

## Robustness & No-Regression (Non-Negotiable)

The #1 rule: **shipping a change to one feature must never break another.** Every edit is made as if the whole app is in production with live users.

### Isolate failures — one feature down must never take the app down
- Every feature surface must **fail independently**. A failed fetch, a null field, or a thrown agent error shows an error/empty state for *that* feature — it never blanks the page or unmounts siblings.
- The route error boundary at `app/dashboard/error.tsx` is the only one. Do not delete it. Add finer-grained boundaries around risky new surfaces rather than letting errors bubble.
- **Guard every external result:** wrap every `fetch().json()` in `.catch(() => fallback)`; treat every API/agent response as possibly `null`/malformed (`data?.field ?? default`); Zod-validate agent output before use.
- Never let a component throw during render on missing data — render a fallback.

### Additive over destructive
- Do **not** rename or remove a shared type field, API response key, `venture.context` key, or DB column without updating **every** consumer in the *same* change. Prefer adding over changing.
- Migrations are **additive and idempotent** (`ADD COLUMN IF NOT EXISTS`, guarded `ALTER TYPE`, `INSERT ... WHERE NOT EXISTS`).
- **Never assume a migration was applied.** Keep a runtime fallback. Reference patterns: `getVentureAccess`'s owner fallback, `createVenture`'s subdomain retry, `createConversation`'s `idea_version` retry, and `lib/queries/idea-queries.ts` (every helper degrades to a no-op).
- Old ventures' legacy context keys must stay readable forever.

### High-blast-radius files
`lib/auth.ts`, `lib/supabase/*`, `lib/db.ts`, `lib/queries.ts`, `lib/billing*.ts`, `proxy.ts`, `app/dashboard/layout.tsx`, `app/api/ventures/[id]/run/route.ts` run on nearly every request or page. Touch them only when the task requires it, keep the change minimal, re-verify a full build plus an unrelated feature afterward, and keep expensive work (extra DB round-trips) off their hot path.

### Verify before "done" — every task
- `npx tsc --noEmit` **and** `npm run build` must both exit 0. No exceptions.
- `npm run test` (vitest, `test/**/*.test.ts`) must pass. Pure `lib/` logic only — no DB, no network, no React. `server-only` is aliased to a stub in `vitest.config.ts`.
- Exercise the flow you changed **and** smoke-test one unrelated feature. State what you verified in `PROGRESS.md`.
- If you can't runtime-test a risky change (auth/session/data-shape), say so and prefer the smallest, most reversible version.
- Touching auth, billing, cron, webhook, or public endpoints means re-confirming the Security invariants below.

---

## Stack (verified against `package.json`)
- **Framework:** Next.js 16.2 (App Router, Turbopack), React 19
- **Language:** TypeScript 5.7, strict mode
- **Styling:** Tailwind 3.4 utilities + HSL CSS variables in `app/globals.css`. Inline `style={{}}` with `var(--token)` is the established pattern on dashboard pages — match the file you're in.
- **Database:** Supabase Postgres. Cookie-scoped client `createDb()` (`lib/db.ts`) by default; `createAdminClient()` (`lib/supabase/admin.ts`) is a scalpel — see Security.
- **Auth:** Supabase Auth via `lib/auth.ts` (`requireAuth`, `requireAdmin`, `isAdmin`). Never roll custom auth.
- **AI:** Google Gemini, with an optional Grok path for web search. See Model Routing.
- **Streaming:** SSE
- **Validation:** Zod 3.24 on all API inputs and agent outputs
- **Payments:** Razorpay (`lib/razorpay.ts`)
- **Testing:** Vitest 4
- **Deployment:** Vercel

Migrations are plain SQL in `db/migrations/NNN_name.sql`, applied **manually** in the Supabase SQL editor. Nothing in the repo runs them. Current head: `047_idea_brief_and_updates.sql`.

---

## Model Routing (Never Change Without Instruction)

All model IDs live in `lib/gemini.ts`. Do not hardcode a model anywhere else.

| Helper | Model | Used by |
|---|---|---|
| `getFlashModel(maxOutputTokens?)` | `models/gemini-3-flash-preview` | Landing Page, Co-pilot, Investor Kit, idea intake, enhance, questions, email gen |
| `getFlashModelWithSearch()` | `models/gemini-3-flash-preview` + `googleSearch` | search-capable Flash |
| `getProModelWithThinking(budget)` | `models/gemini-3.1-pro-preview` | Shadow Board (10k budget) |
| `getProModelWithSearchAndThinking(budget)` | `models/gemini-3.1-pro-preview` + search | Lead Scout (8k budget) |

**Grok fallback:** when `shouldUseGrokForSearch()` is true, the search-capable helpers return a `GrokResponsesModel` (`XAI_MODEL`, default `grok-4`) with a Gemini model as `fallbackModel`. Any code consuming a `SearchCapableModel` must handle both shapes — use `isGrokResponsesModel`.

Shared helpers: `extractJSON`, `streamPrompt`, `withRetry` (1 retry, 3s delay), `withTimeout`, `withAbortableTimeout`.

`export const maxDuration` per route: 300 for the run route and crons, 120 for inspiration analyze, 60 for idea endpoints.

---

## Agent Rules

- Every venture-module agent exports `run<Name>(venture, onStream, onComplete, history?)` — `runPipelineAgent`, `runShadowBoard`, `runGeneralAgent`, `runInvestorKitAgent`, `runLeadScout`
- Every agent reads `venture.context` and `venture.globalIdea` before generating
- Every agent validates output with Zod before it reaches the DB
- Every agent wraps API calls in try/catch with retry
- Agents write to their `venture.context` key via `updateVentureContext` (atomic `merge_venture_context` RPC, with a read-modify-write fallback). **Co-pilot (`general`) writes nothing to context** — it is conversational only
- `globalIdea` is clipped to **6000 chars** in all four agents. The run route composes it as `global_idea` + structured brief + uploaded source documents, so that budget is shared. Do not lower it — at the old 1000 it silently truncated uploaded documents away

---

## File Ownership

| Path | Rule |
|---|---|
| `agents/*` | Only when explicitly building that agent |
| `lib/db.ts`, `lib/supabase/*` | Only during DB/auth work |
| `lib/queries.ts` | Only when adding query helpers. New domains get their own file in `lib/queries/` |
| `lib/schemas/*` | Zod schemas, one file per domain |
| `app/api/*` | Only when building API routes |
| `app/dashboard/*` | Only during UI wiring |
| `components/*` | Only during UI build or polish |
| `db/migrations/*` | Append only. Never edit an applied migration |
| `.claude/skills/*` | Only when updating skill instructions |
| `PRD.md` | Never |

---

## Design System (Never Override)

Tokens live in `app/globals.css` as HSL triples with derived variables. Use the variables, never raw hex.

```
Core:    --bg  --bg-deep  --sidebar  --text  --text-soft  --muted
Accent:  --accent  --accent-soft (10%)  --accent-glow (25%)
Border:  --border  --border-strong
Glass:   --glass-bg  --glass-bg-strong  --glass-border
Shadow:  --shadow-sm/md/lg  --shadow-input
Nav:     --nav-active
```

Light mode is a warm cream base (`hsl(32, 22%, 95%)`) with a burnt-orange accent (`hsl(28, 62%, 42%)`); dark mode is `hsl(24, 7%, 12%)` with a lighter accent. Both are defined in `app/globals.css` — read it rather than hardcoding.

Fonts: **DM Sans** (UI) and **JetBrains Mono** (stream output, counters, version chips), loaded via `next/font/google` in `app/layout.tsx`.

`.glass-card` and `.skeleton` are the established shared classes.

---

## Security Rules

- All dashboard routes protected by `requireAuth()`
- Never expose `GEMINI_API_KEY`, `XAI_API_KEY`, or any secret to the client
- All API inputs validated with Zod before processing
- No prompt injection via user-controlled text — sanitize via `lib/sanitize.ts` (`sanitize`, `sanitizeLabel`, `sanitizeForPrompt`) before any string reaches a model

### Security invariants — every new route/feature MUST follow these
- **Auth on every non-public route:** call `requireAuth()` (or `requireAdmin()`) before any DB read/write. Venture-scoped routes must ALSO verify access via `getVenture(id, session.userId)` / `getVentureAccess()`; project-scoped routes via `getProject(id, session.userId)`. Being logged in is not the same as owning the resource.
- **Deliberately public routes** (landing-page feedback/track/leads, tracking pixels, blog reads) must have strict input caps, generic error messages that never echo raw DB errors, and **IP-keyed rate limiting** via `enforceAnonRateLimit(clientIpKey(req), ...)`. A new public endpoint without a rate limit is a bug.
- **Authed expensive endpoints** (AI runs, bulk sends, polling) use `enforceRateLimit()` or `assertHourlyRateLimit()`. Never ship an unmetered AI/Gmail/expensive endpoint. Existing keys: `enhance` 30/hr, `idea-interview` 60/hr, `idea-update` 20/hr; module runs are metered by credits in `lib/billing-queries.ts`.
- **`import 'server-only'` on every secret-holding module.** ~28 modules in `lib/` carry it — `auth`, `db`, `queries`, `queries/*`, `billing-queries`, `gemini`, `razorpay`, `rate-limit`, `marketing-crypto`, `gmail-*`, `idea-brief`, `idea-intake`, `supabase/admin`, and more. Never remove it; add it to any new module touching a secret or the service-role client.
- **Cron/webhook endpoints:** timing-safe shared-secret compare; `x-vercel-cron` only trusted when `process.env.VERCEL` is set; Razorpay webhooks keep signature verification + amount validation + idempotency (`hasProcessedWebhookEvent`).
- **Service-role client (`createAdminClient`) is a scalpel:** webhooks, cron, and explicitly-public lookups that RLS would block. Never use it where the cookie-scoped `createDb()` works — RLS is a safety net, don't route around it.
- **RLS on every new table:** enable it plus the four owner policies (`auth.uid() = user_id`). Reference: `db/migrations/027_inspiration_analyses.sql`, `047_idea_brief_and_updates.sql`.
- **Secrets:** server env vars only. No `NEXT_PUBLIC_` prefix for anything sensitive. Never hardcode keys, never log secrets or tokens. OAuth tokens encrypted at rest via `lib/marketing-crypto.ts`.
- **Security headers/CSP** live in `next.config.ts` (CSP, `X-Frame-Options: DENY`, HSTS). Additions OK; never remove or loosen an existing directive without explicit instruction.

### Security no-regression
- Never delete or bypass an existing `requireAuth`/`requireAdmin`/`getVentureAccess`/rate-limit/signature-verification call to make a feature work. If a guard is in the way, the feature design is wrong — stop and say so.
- New rate limiting must **fail open** on infra errors (see `enforceRateLimit`) so a limiter outage never takes a feature down.
- Migrations backing security features stay additive + idempotent, and the code path must work even if the migration hasn't been applied yet.

---

## What Never to Do
- Never vibe auth
- Never vibe environment variables
- Never use purple gradients or Inter/Roboto fonts
- Never add a "recent conversations" section to the sidebar
- Never show modules outside of a venture context
- Never use comments in code

## Github commiting rules
 - Always make sure the user gets the most amount of commits
 - Make sure the commits are always to arhambegani2@gmail.com
 - make sure there are no co-authors in the commit
