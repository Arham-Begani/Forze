# Forze — Architecture

## Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 15 (App Router) | API routes + SSE streaming + deployment |
| Language | TypeScript | Strict mode enabled |
| Styling | Tailwind + CSS variables | Design tokens as CSS vars, Tailwind for utilities only |
| Database | Antigravity DB (Postgres) | Built-in, no external setup |
| Auth | Antigravity Auth | Built-in session management |
| AI | Google Gemini API | All 6 agent modules |
| Streaming | Server-Sent Events (SSE) | Real-time agent output to frontend |
| Validation | Zod | All API inputs + agent JSON outputs |
| Deployment | Antigravity / Vercel | One-click from Antigravity IDE |
| IDE | Antigravity + Claude Code | Build and iterate |
| Skills | Claude Skills (SKILL.md) | Agent instructions as portable skill files |

---

## Model Routing

| Module | Model | Features |
|--------|-------|----------|
| Full Launch (Architect) | gemini-3-pro-preview | Agent Teams + HIGH level thinking |
| Co-pilot (Genesis) | gemini-3-pro-preview | Deep context synthesis + HIGH level thinking |
| Research | gemini-3-flash-preview | web_search tool enabled |
| Branding | gemini-3-flash-preview | Structured JSON output + Zod validation |
| Marketing | gemini-3-flash-preview | Brand context injection + structured output |
| Landing Page | gemini-3-flash-preview | Code generation + Antigravity deploy hooks |
| Feasibility | gemini-3-pro-preview | HIGH level thinking (risk/financial analysis) |
| Shadow Board | gemini-3-pro-preview | Multi-persona simulation + HIGH level thinking |
| Formatting/cleanup | gemini-3-flash-preview | Mechanical tasks only |

All models use prompt caching on system prompts.

---

## Project Structure

```
Forze/
  .claude/
    CLAUDE.md                        ← Claude Code global rules
    settings.json                    ← Agent Teams enabled, model config
    skills/
      architect-agent/SKILL.md
      genesis-engine/
        SKILL.md
        references/schema.md
      identity-architect/
        SKILL.md
        references/schema.md
      content-factory/
        SKILL.md
        references/schema.md
      production-pipeline/
        SKILL.md
        references/schema.md
      deep-validation/
        SKILL.md
        references/schema.md
      shadow-board/
        SKILL.md
        references/schema.md

  src/
    agents/
      genesis.ts                     ← Research agent
      identity.ts                    ← Branding agent
      content.ts                     ← Marketing agent
      pipeline.ts                    ← Landing page agent
      feasibility.ts                 ← Feasibility agent
      shadow.ts                      ← Shadow Board agent
      orchestrator.ts                ← Full Launch orchestrator

    lib/
      db.ts                          ← Antigravity DB client
      queries.ts                     ← Typed DB query helpers
      auth.ts                        ← getSession(), requireAuth()
      streaming.ts                   ← SSE helpers

    components/
      ui/
        ModulePicker.tsx             ← Pill selector inside input
        MessageStream.tsx            ← Stream output display
        ResultCard.tsx               ← Completion result card
        AgentStatusRow.tsx           ← Full Launch agent rows

  app/
    (auth)/
      signin/page.tsx
      signup/page.tsx
    (dashboard)/
      layout.tsx                     ← Sidebar + venture tree
      page.tsx                       ← Home / venture overview
      venture/[id]/[module]/
        page.tsx                     ← Module workspace

    api/
      ventures/
        route.ts                     ← GET list, POST create
        [id]/
          route.ts                   ← GET, PATCH, DELETE
          run/route.ts               ← POST trigger agent run
          stream/
            [conversationId]/
              route.ts               ← GET SSE stream

  db/
    migrations/
      001_initial.sql

  public/
  PRD.md
  ARCHITECTURE.md
  VENTURE_OBJECT.md
  PROGRESS.md
```

---

## Database Schema

```sql
-- Users (managed by Antigravity Auth)
users (
  id          UUID PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  plan        TEXT DEFAULT 'free',
  created_at  TIMESTAMPTZ DEFAULT NOW()
)

-- Ventures
ventures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  context     JSONB DEFAULT '{}',   -- accumulated agent outputs
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
)

-- Conversations (one per module run)
conversations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id     UUID REFERENCES ventures(id) ON DELETE CASCADE,
  module_id      TEXT NOT NULL,      -- research | branding | marketing | landing | feasibility | shadow-board | full-launch
  prompt         TEXT NOT NULL,
  status         TEXT DEFAULT 'running',  -- running | complete | failed
  stream_output  JSONB DEFAULT '[]', -- array of output lines
  result         JSONB DEFAULT '{}', -- structured final output
  created_at     TIMESTAMPTZ DEFAULT NOW()
)
```

---

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | /api/ventures | List all ventures for user |
| POST | /api/ventures | Create new venture |
| GET | /api/ventures/[id] | Get venture + conversations |
| PATCH | /api/ventures/[id] | Update venture name |
| DELETE | /api/ventures/[id] | Delete venture |
| POST | /api/ventures/[id]/run | Trigger module agent run |
| GET | /api/ventures/[id]/stream/[convId] | SSE stream of agent output |

---

## Agent Context Flow

```
User Prompt
    ↓
POST /api/ventures/[id]/run { moduleId, prompt }
    ↓
Create conversation record (status: running)
    ↓
Load venture.context from DB
    ↓
Route to correct agent:
    research    → runGenesisAgent(venture, onStream, onComplete)
    branding    → runIdentityAgent(venture, onStream, onComplete)
    marketing   → runContentAgent(venture, onStream, onComplete)
    landing     → runPipelineAgent(venture, onStream, onComplete)
    feasibility → runFeasibilityAgent(venture, onStream, onComplete)
    shadow-board → runShadowBoard(venture, onStream, onComplete)
    full-launch → runFullLaunch(venture, onStream, onComplete)
    ↓
onStream(line) → write to DB stream_output + emit SSE event
    ↓
onComplete(result) → write to DB result + update venture.context
    ↓
SSE sends { type: 'complete', result }
    ↓
Frontend renders ResultCard
```

---

## SSE Event Shape

```typescript
// Stream line
{ type: 'line', content: string, index: number }

// Status update (full-launch only)
{ type: 'agent-status', agentId: string, status: 'running' | 'complete' | 'failed' }

// Completion
{ type: 'complete', result: Record<string, unknown> }

// Error
{ type: 'error', message: string }
```

---

## Design Tokens

```css
/* Light mode */
--bg:          #faf9f6;
--sidebar:     #f4f2ed;
--card:        #ffffff;
--border:      #e8e4dc;
--text:        #1c1917;
--text-soft:   #44403c;
--muted:       #a8a29e;
--nav-active:  #edeae3;
--accent:      #c07a3a;
--accent-soft: rgba(192, 122, 58, 0.1);
--input-bg:    #ffffff;
--stream-bg:   #f8f6f1;
--stream-text: #78716c;

/* Dark mode */
--bg:          #111110;
--sidebar:     #0d0d0c;
--card:        #1a1917;
--border:      #272523;
--text:        #e8e4dc;
--text-soft:   #a8a29e;
--muted:       #57534e;
--nav-active:  #1f1e1b;
--accent:      #d4924a;
--accent-soft: rgba(212, 146, 74, 0.1);
--input-bg:    #161513;
--stream-bg:   #0f0e0c;
--stream-text: #57534e;

/* Module accents */
--full-launch: #C4975A;
--research:    #5A8C6E;
--branding:    #5A6E8C;
--marketing:   #8C5A7A;
--landing:     #8C7A5A;
--feasibility: #7A5A8C;
```

---

## Full Launch Agent Order

```
Architect Agent (Opus 4.6 — Team Lead)
    ↓ spawns simultaneously
    ├── Genesis Engine → writes venture.context.research
    │       ↓ broadcasts findings
    ├── Identity Architect (waits for Genesis) → writes venture.context.branding
    │       ↓ both complete
    ├── Production Pipeline (parallel) → writes venture.context.landing
    └── Deep Validation (parallel) → writes venture.context.feasibility
    
NOTE: Content Factory (Marketing) is NEVER spawned in Full Launch.
```

---

## Environment Variables

```bash
# Required
GEMINI_API_KEY=
ANTIGRAVITY_PROJECT_ID=
NEXT_PUBLIC_APP_URL=

# Optional
AGENT_TIMEOUT_MS=60000         # 60s max per agent
RATE_LIMIT_RUNS_PER_HOUR=10    # per user
LOG_AGENT_ERRORS=true
```