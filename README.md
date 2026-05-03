# Forze

**An Autonomous Venture Orchestrator.** A coordinated swarm of specialized AI agents that turns a single prompt into a production-ready, market-validated venture in minutes — not months.

Forze is not a chatbot. It is not a wrapper. It is *your startup workforce*.

---

## What it does

A non-technical founder types one idea. An Architect Agent decomposes it into work, then dispatches a team of specialists. Each agent shares context with the others. The output is a coherent venture package — research, brand, landing page, feasibility report, and live URL.

| Module | Agent | Output |
|---|---|---|
| **Full Launch** | Architect (orchestrator) | Runs Research + Branding + Landing Page + Feasibility in parallel and stitches the results into one venture |
| **Research** | Genesis Engine | TAM/SAM/SOM, pain-point catalogue, competitor gaps, SWOT, risk matrix, 10 ranked concepts |
| **Branding** | Identity Architect | Brand bible — names, archetype, voice, palette, typography, logo concept, UI kit |
| **Marketing** | Content Factory | 30-day GTM plan, 90 social captions, SEO blog outlines, 7-part launch email sequence |
| **Landing Page** | Production Pipeline | Sitemap, copy, full Next.js component, deployable URL, lead capture |
| **Feasibility** | Deep Validation | Financial model, unit economics, risk scoring, go/no-go verdict |

Marketing always runs as its own module — it is intentionally excluded from Full Launch.

---

## Architecture

```
Prompt  →  Architect Agent  →  [ Genesis | Identity | Pipeline | Validation ]
                                          ↓
                              Shared Venture Object (Postgres)
                                          ↓
                                  SSE stream to UI
```

- **Single source of truth.** Every agent reads from and writes to a typed `venture.context` object. No agent invents state.
- **Parallel by default.** Full Launch fans out four agents concurrently and merges their outputs.
- **Streaming first.** Every agent run is a Server-Sent Events stream — tokens land in the UI as they're generated.
- **Validated I/O.** Zod schemas guard every API boundary and every agent JSON output. Bad output never reaches the database.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| UI | Tailwind + CSS variables, Framer Motion, Recharts |
| Database | Postgres via Supabase SSR |
| Auth | Supabase Auth (server-side sessions) |
| AI | Google Gemini (`@google/generative-ai`) |
| Streaming | Server-Sent Events |
| Validation | Zod |
| Deploy | Vercel |

### Model routing

| Module | Model | Notes |
|---|---|---|
| Full Launch (Architect) | `gemini-2.5-pro` | Extended thinking (10k), Agent Teams |
| Research | `gemini-2.5-flash` | `web_search` tool enabled |
| Branding | `gemini-2.5-flash` | Structured JSON + Zod validation |
| Marketing | `gemini-2.5-flash` | Brand-context injection |
| Landing Page | `gemini-2.5-flash` | Code generation + deploy hooks |
| Feasibility | `gemini-2.5-flash` | Extended thinking (8k) |

Prompt caching is enabled on every system prompt.

---

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project (URL + anon + service-role keys)
- A Google Gemini API key

### Install

```bash
git clone https://github.com/Arham-Begani/Forge.git
cd Forge
npm install
```

### Configure

Create `.env.local` in the repo root:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
```

Run the database migrations in `db/migrations/` against your Supabase project (in order).

### Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # eslint
```

---

## Project layout

```
agents/         Agent implementations — one file per specialist
app/            Next.js App Router (routes, API, dashboard)
  api/          Server routes (venture CRUD, agent runs, SSE streams)
  dashboard/    Authenticated workspace
components/    React components (UI primitives + module workspaces)
db/migrations/  SQL migrations
lib/           DB client, queries, auth, streaming, schemas
public/        Static assets
```

Authoritative documents:

- `PRD.md` — product vision, user, modules, success criteria
- `ARCHITECTURE.md` — file ownership, model routing, data flow
- `VENTURE_OBJECT.md` — the canonical venture schema (treat as read-only)
- `PROGRESS.md` — running build log

---

## Working on Forze

A few rules the codebase enforces:

- **Surgical edits only.** Never rewrite a whole file when a targeted change will do.
- **One agent at a time.** Don't build two agents in a single session — finish and test one.
- **Business logic lives in `/agents`.** API routes are thin transports.
- **No `localStorage` / `sessionStorage`.** Persistent state belongs in Postgres.
- **Never mutate the venture schema.** It is the contract every agent depends on.
- **Marketing is never inside Full Launch.** It is a standalone module by design.

The full ruleset lives in `.claude/CLAUDE.md`.

---

## Security

- Every dashboard route is gated by `requireAuth()` middleware.
- `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only — never shipped to the client.
- All API inputs are Zod-validated before any agent runs.
- Rate limit: 10 agent runs per user per hour.
- Agent timeout: 60 seconds per run.

---

## Status

Forze is in active development. Modules ship behind feature flags as they stabilize. See `PROGRESS.md` for the current build state.

---

## License

Proprietary. All rights reserved.
