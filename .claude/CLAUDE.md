# Forze — Claude Code Rules

## What Forze Is
An Autonomous Venture Orchestrator. A coordinated swarm of AI agents that transforms a raw business concept into a production-ready, market-validated venture in minutes. Not a chatbot. Not a wrapper. A Your Startup Workforce.

Read PRD.md for the full product vision before starting any task.

---

## Non-Negotiable Rules

### Before every task
- Read PRD.md for product context
- Read VENTURE_OBJECT.md before touching any agent logic
- Read ARCHITECTURE.md before creating or modifying any files
- Check PROGRESS.md to understand current state

### While building
- Surgical edits only — never rewrite entire files
- One file per prompt — never touch files outside the explicit task scope
- Never change the venture object schema without explicit instruction
- Never accept or offer a full file rewrite — always prefer targeted edits
- Never build two agents in a single session — finish and test one at a time
- Never hardcode business logic inside API routes — it belongs in /agents
- Never use localStorage or sessionStorage — use Antigravity DB

### After every task
- Update PROGRESS.md with what was built, what broke, what's next

---

## Robustness & No-Regression (Non-Negotiable)

The #1 rule: **shipping a change to one feature must never break another.** Every edit is made as if the whole app is in production with live users. Follow these:

### Isolate failures — one feature down must never take the app down
- Every feature surface (module page, panel, tab, flow) must **fail independently**. A failed fetch, a null field, or a thrown agent error shows an error/empty state for *that* feature — it never blanks the page or unmounts siblings.
- There is a route error boundary at `app/dashboard/error.tsx`. Do not delete it. Add finer-grained boundaries around risky new feature surfaces rather than letting errors bubble.
- **Guard every external result:** wrap every `fetch().json()` in `.catch(() => fallback)`; treat every API/agent response as possibly `null`/malformed (`data?.field ?? default`); Zod-validate agent output before use. Never assume a response has the shape you expect.
- Never let a component throw during render on missing data — render a fallback.

### Additive over destructive — never break existing consumers
- Do **not** rename or remove a shared type field, API response key, `venture.context` key, or DB column without updating **every** consumer in the *same* change. Prefer **adding** new fields over changing existing ones.
- Migrations are **additive and idempotent** (`ADD COLUMN IF NOT EXISTS`, guarded `ALTER TYPE`, `INSERT ... WHERE NOT EXISTS`). Never assume a migration was applied to the live DB — keep a runtime fallback (see `getVentureAccess`'s owner fallback as the reference pattern).
- Old ventures' legacy context keys must stay readable forever. Backward compatibility is mandatory.

### High-blast-radius files — change only with explicit reason, then re-verify everything
- `lib/auth.ts`, `lib/supabase/*`, `lib/queries.ts`, `lib/billing*.ts`, `proxy.ts`, `app/dashboard/layout.tsx` run on nearly every request/page. A subtle change here breaks *all* features at once. Touch them only when the task truly requires it, keep the change minimal, and re-verify a full build + an unrelated feature afterward.
- Keep expensive/blocking work (DB writes, extra auth round-trips) off the hot path of these shared chokepoints.

### Verify before "done" — every task
- `npx tsc --noEmit` **and** `npm run build` must both exit 0. No exceptions.
- Then exercise the exact flow you changed **and** smoke-test one unrelated feature to confirm no regression. State what you verified in PROGRESS.md.
- If you can't runtime-test a risky change (auth/session/data-shape), say so and prefer the smallest, most reversible version.

---

## Stack (Never Deviate)
- Framework: Next.js 15 with App Router
- Language: TypeScript (strict mode)
- Styling: Tailwind utilities + CSS variables for all design tokens
- Database: Antigravity DB (Postgres) — never use SQLite or external DB
- Auth: Antigravity built-in auth — never roll custom auth
- AI: Google Gemini API only
- Streaming: Server-Sent Events (SSE)
- Validation: Zod on all API inputs and agent outputs
- Deployment: Antigravity / Vercel

---

## Model Routing (Never Change Without Instruction)

| Module | Model | Special Features |
|--------|-------|-----------------|
| Full Launch Architect | gemini-2.5-pro | Agent Teams + extended thinking (10k) |
| Research | gemini-2.5-flash | web_search tool enabled |
| Branding | gemini-2.5-flash | Structured JSON + Zod validation |
| Marketing | gemini-2.5-flash | Brand context injection |
| Landing Page | gemini-2.5-flash | Code generation + deploy hooks |
| Feasibility | gemini-2.5-flash | Extended thinking (8k tokens) |
| Cleanup/formatting | gemini-2.5-flash | Mechanical tasks only |

All agents: prompt caching enabled on system prompts.

---

## Agent Rules

- Every agent exports a single function: run[AgentName](venture, onStream, onComplete)
- Every agent reads from venture.context before generating output
- Every agent writes structured JSON output to the correct venture.context key
- Every agent validates its output with Zod before writing to DB
- Every agent wraps all API calls in try/catch with retry logic
- Marketing (Content Factory) is NEVER included in Full Launch
- Full Launch agent order: Genesis → Identity → Pipeline + Feasibility (parallel)

---

## File Ownership Rules

| File/Folder | Who Modifies It |
|-------------|----------------|
| src/agents/* | Only when explicitly building that agent |
| lib/db.ts | Only during DB setup phase |
| lib/queries.ts | Only when adding new query helpers |
| app/api/* | Only when building API routes |
| app/(dashboard)/* | Only during UI wiring phase |
| components/* | Only during UI build or polish phases |
| .claude/skills/* | Only when updating agent skill instructions |
| VENTURE_OBJECT.md | Never — only with explicit instruction |
| PRD.md | Never — product requirements are locked |

---

## Design System (Never Override)

The UI is defined by ForzeUI.jsx — treat it as read-only source of truth.

```
Light mode:  bg #faf9f6 | sidebar #f4f2ed | border #e8e4dc | accent #c07a3a
Dark mode:   bg #111110 | sidebar #0d0d0c | border #272523 | accent #d4924a
Fonts:       DM Sans (UI) + JetBrains Mono (stream output)
```

Module accents:
```
Full Launch:      #C4975A
Research:         #5A8C6E
Branding:         #5A6E8C
Marketing:        #8C5A7A
Landing Page:     #8C7A5A
Feasibility:      #7A5A8C
```

---

## Security Rules
- All dashboard routes protected by requireAuth() middleware
- Never expose GEMINI_API_KEY to the client
- All API inputs validated with Zod before processing
- Rate limit: 10 agent runs per user per hour
- Agent timeout: 60 seconds max per run
- No prompt injection via user-controlled venture names

---

## What Never to Do
- Never vibe auth
- Never vibe environment variables
- Never use purple gradients or Inter/Roboto fonts
- Never add a "recent conversations" section to the sidebar
- Never show modules outside of a venture context
- Never include Marketing in Full Launch
- Never trust unvalidated agent JSON output
- Never deploy without running npm run build first

## Github commiting rules
 - Always make sure the user gets the most amount of commits
 - Make sure the commits are always to arhambegani2@gmail.com
 - make sure there are no co-authors in the commit