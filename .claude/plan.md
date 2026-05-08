# Forze Dashboard Restructure + Instagram Fix + Mobile Polish

## Context

Six interrelated user-requested changes:

1. **Sidebar IA** — Regroup from 4 flat groups into 3 top-level sections: BUILD (with sub-labels launch/agents/tools), OUTREACH, CRM DASHBOARD.
2. **CRM Dashboard** — New per-venture page aggregating social signals (Instagram, LinkedIn stub, Gmail, Reddit/Telegram coming-soon).
3. **Gmail connection card** — Surface Gmail OAuth in the Social panel (currently buried inside campaign creation).
4. **Instagram comment error** — Replace the plain `<FlashMessage>` error at MonitorCard line 727 with a keyword-matched, actionable reconnect CTA using `auth_type=rerequest`.
5. **"Master Dossier" → "Overview"** — Two-line rename in `app/dashboard/layout.tsx`.
6. **Mobile polish** — Hero blobs overflow on small viewports; OutputTabs financial table has no scroll wrapper. (Dashboard shell auto-close, ComparisonTable card-stack, AgentGrid single-col, and Navbar hamburger are **already implemented** — confirmed in code.)

---

## What's Already Done (Don't Redo)

| Draft Task | Status | Evidence |
|---|---|---|
| Dashboard overlay click-to-close | ✅ Done | `layout.tsx:364` — `onClick={() => setMobileOpen(false)}` |
| Dashboard auto-close on route change | ✅ Done | `layout.tsx:295` — `useEffect(() => setMobileOpen(false), [pathname])` |
| ComparisonTable mobile | ✅ Done | `ComparisonTable.tsx:99-105` — `isMobile` guard renders card-stack at < 768px |
| AgentGrid single-col | ✅ Done | `AgentGrid.tsx:399` — `@media (max-width: 640px) { grid-template-columns: 1fr }` |
| Navbar hamburger | ✅ Done | `Navbar.tsx:12,244` — `mobileOpen` state + hamburger render |

---

## Dependency Order

```
                   ┌─────────────────────────────────────────────┐
                   │           layout.tsx changes                 │
                   │  1. Rename Overview  2. Sidebar groups       │
                   │  3. Add crm module + routing                 │
                   └──────────────────────┬──────────────────────┘
                                          │ enables crm route
                   ┌──────────────────────▼──────────────────────┐
                   │  crm/page.tsx  +  CrmDashboard.tsx           │
                   │  (scaffold → pills → tabs)                   │
                   └───────────┬──────────────┬───────────────────┘
                               │              │
              ┌────────────────▼──┐   ┌───────▼────────────────┐
              │  inbox/route.ts   │   │  leads/route.ts         │
              │  (IG comments +   │   │  (dedup by username/    │
              │   Gmail stubs)    │   │   email)                │
              └───────────────────┘   └────────────────────────┘

  ConnectedChannelsPanel.tsx (independent)
  ├── Task A: Gmail card (new state + POST /api/integrations/gmail)
  └── Task B: Instagram reconnect CTA
        ├── lib/marketing-oauth.ts — add auth_type=rerequest when forceReauth
        ├── app/api/integrations/[provider]/connect/route.ts — pass forceReauth
        └── MonitorCard props — add onReconnect callback

  Landing mobile (independent, smallest risk)
  ├── Hero.tsx — shrink blobs + skip parallax on pointer:coarse
  └── OutputTabs.tsx — overflow-x:auto wrapper on financial table
```

---

## Task 1 — Rename "Master Dossier" → "Overview"

**File:** `app/dashboard/layout.tsx`

- Line 770: change comment `{/* Master Dossier */}` → `{/* Overview */}`
- Line 785: change `<span ...>Master Dossier</span>` → `<span ...>Overview</span>`

---

## Task 2 — Sidebar group restructure + add CRM module

**File:** `app/dashboard/layout.tsx`

### 2a. Add `crm` to MODULES (after `campaigns`, line 52)
```ts
{ id: 'crm', label: 'CRM', icon: '◐', accent: '#5A8C5A' },
```

### 2b. Replace MODULE_GROUPS (lines 55-60) with nested structure
```ts
const MODULE_GROUPS = [
  { group: 'BUILD',         label: 'launch',  ids: ['full-launch'] },
  { group: 'BUILD',         label: 'agents',  ids: ['research', 'branding', 'marketing', 'landing', 'feasibility'] },
  { group: 'BUILD',         label: 'tools',   ids: ['general', 'shadow-board'] },
  { group: 'OUTREACH',      label: null,      ids: ['campaigns'] },
  { group: 'CRM DASHBOARD', label: null,      ids: ['crm'] },
] as const
```

### 2c. Update `moduleHref` (line 302 area)
```ts
if (moduleId === 'crm') return `/dashboard/venture/${ventureId}/crm`
```

### 2d. Update `isModuleActive` (line 307 area)
```ts
if (moduleId === 'crm') return pathname.startsWith(`/dashboard/venture/${ventureId}/crm`)
```

### 2e. Update rendering loop (lines 789-854)

Track `lastGroup` as the loop iterates. When the group changes:
- If it's not the first group, emit a divider `<div style={{ height: 1, ... }} />`
- Emit the top-level label at font-size 9, weight 700, uppercase, muted.
- If the sub-label (`group.label`) is non-null, emit it below in italic, font-size 9, lighter opacity, before the module buttons.

The inner module-button JSX stays unchanged.

TypeScript: the `group` field is a discriminated union via `as const` — use `module.group` and `module.label` (nullable). Declare `let lastGroup: string | null = null` above the `.map()` call; since `as const` forbids `.reduce()` building derived state inline, track it via a local mutable variable.

---

## Task 3 — CRM route + page

### 3a. New server page — `app/dashboard/venture/[id]/crm/page.tsx`
```ts
import { requireAuth } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { redirect } from 'next/navigation'
import { CrmDashboard } from '@/components/venture/CrmDashboard'

export default async function CrmPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireAuth()
  const { id } = await params
  const venture = await getVenture(id, userId)
  if (!venture) redirect('/dashboard')
  return <CrmDashboard ventureId={id} ventureName={venture.name} />
}
```

### 3b. Client component — `components/venture/CrmDashboard.tsx`

**Shape:**
```
┌─────────────────────────────────────────────┐
│  Header: venture name / "CRM Dashboard"     │
├─────────────────────────────────────────────┤
│  Connection pills (5): IG / LI / Gmail /    │
│  Reddit (coming soon) / Telegram (coming)   │
├─────────────────────────────────────────────┤
│  [Inbox] [Leads] [Pipeline]  tabs           │
├─────────────────────────────────────────────┤
│  Tab content (see below)                    │
└─────────────────────────────────────────────┘
```

**Connection pills:** `GET /api/integrations` (existing) for IG/LI + `GET /api/integrations/gmail` for Gmail. Reddit/Telegram render as grey pills with "Coming soon" — clicking shows a toast via `useToast()`.

**Inbox tab:** `GET /api/ventures/[id]/crm/inbox` → renders list of `CrmInboxItem`s (Instagram comments + Gmail stub rows). Empty state when empty.

**Leads tab:** `GET /api/ventures/[id]/crm/leads` → table rows: Identity / Source / Count / Last touch. Empty state when empty.

**Pipeline tab:** `GET /api/ventures/[id]/campaigns` (existing endpoint) → count rows by status and render chips (Sent/Opened/Replied/Booked). No new API needed. Clicking "View all campaigns" routes to `/dashboard/venture/${ventureId}/campaigns`.

Style: reuse CSS variable tokens from CLAUDE.md (`--glass-bg`, `--border`, `--text`, `--text-soft`, `--muted`, `--accent`). No new CSS files.

---

## Task 4 — CRM API routes

### 4a. `app/api/ventures/[id]/crm/inbox/route.ts`

```
GET /api/ventures/[id]/crm/inbox
```

1. `requireAuth()` → verify venture ownership via `getVenture(id, userId)`.
2. Query `marketing_assets` where `venture_id = id AND provider = 'instagram' AND status = 'published'`. For each, pluck `payload.insights.comments` array.
3. Flatten into `CrmInboxItem[]`:
   ```ts
   type CrmInboxItem = {
     id: string; source: 'instagram'; username: string | null
     text: string; timestamp: string | null; permalink: string | null
   }
   ```
4. For Gmail: return empty array (no `email_replies` table confirmed in codebase — add a comment noting the TODO).
5. Return `{ items: CrmInboxItem[] }`.

### 4b. `app/api/ventures/[id]/crm/leads/route.ts`

```
GET /api/ventures/[id]/crm/leads
```

1. Calls the inbox route logic (import the aggregation helper, don't HTTP-chain).
2. Deduplicate by `username` (case-insensitive), count occurrences, take latest timestamp.
3. Return `{ leads: CrmLead[] }`.

---

## Task 5 — Gmail card in Social panel

**File:** `components/marketing/ConnectedChannelsPanel.tsx`

The existing `PROVIDERS.map()` loop renders 3 cards (YouTube, Instagram, LinkedIn). Append a 4th card outside the loop, using the `GmailUI` type and popup OAuth pattern from `CreateCampaignFlow.tsx:86-165`.

### Changes:
1. **Import/type**: Copy `GmailUI` type inline (5 fields, see `CreateCampaignFlow.tsx:86-92`). Do NOT import from CreateCampaignFlow — it's a local type there.

2. **State** (inside `ConnectedChannelsPanel`):
   ```ts
   const [gmail, setGmail] = useState<GmailUI | null>(null)
   const [gmailBusy, setGmailBusy] = useState(false)
   ```

3. **On mount**: add a `useEffect` that fetches `GET /api/integrations/gmail` and sets `gmail` state (same null-safe normalization as line 120-128 of CreateCampaignFlow).

4. **Connect handler**: `async function handleConnectGmail()` — POST `/api/integrations/gmail`, open popup, poll every 1.5s until closed, then re-fetch status. Mirror `handleConnectGmail` in CreateCampaignFlow:137-165.

5. **Disconnect handler**: POST `/api/integrations/gmail` with `{ action: 'disconnect' }` body — confirm this is the right endpoint by checking `app/api/integrations/gmail/route.ts` for the disconnect path.

6. **Card JSX**: Place after the `.map()` block inside the grid. Reuse the same card shape/styles as the other provider cards. Show: status pill, connected email (if any), Connect/Reconnect/Disconnect button per `gmail.state`.

---

## Task 6 — Instagram reconnect CTA

### 6a. `lib/marketing-oauth.ts` — add `forceReauth` to URL builder

`buildProviderAuthorizationUrl` currently takes `{ redirectUri, state }`. Add optional `{ forceReauth?: boolean }`:

```ts
if (provider === 'instagram' && options.forceReauth) {
  params.set('auth_type', 'rerequest')
}
```
Place before the `return` at line 156.

### 6b. `app/api/integrations/[provider]/connect/route.ts` — pass forceReauth

```ts
const bodySchema = z.object({
  returnTo: z.string().optional(),
  forceReauth: z.boolean().optional(),
})
// ...
const authUrl = buildProviderAuthorizationUrl(provider, { redirectUri, state, forceReauth: payload.data.forceReauth })
```

### 6c. `components/marketing/ConnectedChannelsPanel.tsx` — reconnect wiring

**Step 1: Add `handleReconnect` in the parent** (alongside `handleConnect`, `handleDisconnect`):
```ts
async function handleReconnectInstagram() {
  setBusyProvider('instagram')
  setError(null)
  try {
    await fetch('/api/integrations/instagram/disconnect', { method: 'POST' })
    const res = await fetch('/api/integrations/instagram/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnTo: window.location.pathname, forceReauth: true }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to reconnect')
    window.location.href = data.authUrl
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Reconnect failed')
    setBusyProvider(null)
  }
}
```

**Step 2: Add `onReconnect` prop to MonitorCard**:
```ts
function MonitorCard({
  asset, onUpdated, onRemoved, onReconnect,
}: {
  asset: MarketingAsset; onUpdated: ...; onRemoved: ...; onReconnect?: () => void
})
```

**Step 3: Pass it at call site** (line ~1494):
```tsx
<MonitorCard asset={a} onUpdated={...} onRemoved={...} onReconnect={handleReconnectInstagram} />
```

**Step 4: Replace line 726-728** (plain FlashMessage) with keyword-matched CTA:

```tsx
{insights?.commentsFetchError && (() => {
  const err = insights.commentsFetchError
  const isPersonal  = /PERSONAL/i.test(err)
  const isScope     = /instagram_business_manage_comments/i.test(err) && !isPersonal
  const isDevMode   = /Development Mode/i.test(err)
  const heading = isPersonal
    ? 'Instagram account is Personal'
    : isScope ? 'Comment permission missing'
    : isDevMode ? 'App in Development Mode'
    : 'Instagram comments unavailable'
  const detail = isPersonal
    ? 'Switch your Instagram to a Business or Creator account in the Instagram app, then reconnect.'
    : isScope ? 'Reconnect Instagram to grant the comment-read permission.'
    : isDevMode ? 'Add the connected account as a tester in your Meta app dashboard.'
    : err
  const showReconnect = isPersonal || isScope
  return (
    <div style={{ background: '#dc262612', border: '1px solid #dc262630', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>{heading}</div>
      <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>{detail}</div>
      {showReconnect && onReconnect && (
        <button onClick={onReconnect} style={{ marginTop: 8, fontSize: 11, ... }}>
          Reconnect Instagram →
        </button>
      )}
    </div>
  )
})()}
```

The error strings from `lib/instagram-insights.ts:224-241` use exact strings: `"PERSONAL"`, `"instagram_business_manage_comments"`, `"Development Mode"` — regex-match is safe.

---

## Task 7 — Landing mobile fixes (only what's actually broken)

### 7a. `components/landing/Hero.tsx` — blob overflow + parallax on touch

The section already has `overflow: 'hidden'` (line 101). The blobs are 600px/700px positioned at `right: '-5%'` / `left: '-8%'` — the negative offsets let them bleed out on narrow viewports.

**Fix 1:** Add `isMobile` state (same `window.innerWidth < 768` pattern as in ComparisonTable). When mobile, clamp blob styles inline:
```tsx
width: isMobile ? 280 : 600,
height: isMobile ? 280 : 600,
right: isMobile ? '-20%' : '-5%',
// and second blob:
width: isMobile ? 320 : 700,
height: isMobile ? 320 : 700,
left: isMobile ? '-15%' : '-8%',
```

**Fix 2:** Disable parallax transform on touch devices. In the `mousemove` useEffect (line 80-88), add a guard:
```ts
if (window.matchMedia('(pointer: coarse)').matches) return () => {}
```

### 7b. `components/landing/OutputTabs.tsx` — financial table overflow

Line 193: the parent `<div style={{ border: ..., overflow: 'hidden' }}>` clips the grid rather than scrolling it. Wrap the rows container in:
```tsx
<div style={{ overflowX: 'auto' }}>
  {/* existing rows */}
</div>
```
No style change to the rows themselves.

---

## Implementation Order (one commit each)

1. Rename Overview (1-line text + 1-line comment)
2. Sidebar group restructure + `crm` in MODULES + routing
3. CRM page scaffold (`crm/page.tsx` + empty `CrmDashboard.tsx` stub)
4. CRM connection pills + tab shell in `CrmDashboard.tsx`
5. CRM inbox API route (`app/api/ventures/[id]/crm/inbox/route.ts`)
6. CRM inbox tab wired to API
7. CRM leads API route + leads tab
8. CRM pipeline tab (reads existing campaigns endpoint)
9. Gmail card state + on-mount fetch in `ConnectedChannelsPanel`
10. Gmail card JSX + connect/disconnect handlers
11. Instagram `forceReauth` in `lib/marketing-oauth.ts` + connect route
12. `handleReconnectInstagram` + `onReconnect` prop to MonitorCard
13. Instagram reconnect CTA block (replaces plain FlashMessage)
14. Hero mobile blob sizing + parallax guard
15. OutputTabs financial table scroll wrapper

---

## Critical Files

| File | Change |
|---|---|
| `app/dashboard/layout.tsx` | Overview rename, sidebar groups, crm module, routing |
| `components/marketing/ConnectedChannelsPanel.tsx` | Gmail card, Instagram reconnect CTA, `onReconnect` prop |
| `lib/marketing-oauth.ts` | `forceReauth` → `auth_type=rerequest` |
| `app/api/integrations/[provider]/connect/route.ts` | Accept + forward `forceReauth` |
| `app/dashboard/venture/[id]/crm/page.tsx` *(new)* | CRM page |
| `components/venture/CrmDashboard.tsx` *(new)* | CRM client component |
| `app/api/ventures/[id]/crm/inbox/route.ts` *(new)* | Inbox aggregation |
| `app/api/ventures/[id]/crm/leads/route.ts` *(new)* | Lead dedup |
| `components/landing/Hero.tsx` | Blob sizing + parallax guard |
| `components/landing/OutputTabs.tsx` | Scroll wrapper on financial table |

## Patterns to Reuse

- `requireAuth()` — `lib/auth.ts`
- `getVenture(id, userId)` — `lib/queries.ts:257`
- Gmail popup OAuth — `components/venture/CreateCampaignFlow.tsx:137-165`
- `GmailUI` type — `CreateCampaignFlow.tsx:86-92` (copy inline, don't import)
- Existing module button JSX — `layout.tsx:809-849` (unchanged in rendering)
- Instagram error keyword strings — `lib/instagram-insights.ts:224-241`

---

## Verification

1. **Sidebar:** `npm run dev` → open venture → confirm: Overview at top, then BUILD with italic sub-labels (launch/agents/tools), divider, OUTREACH, divider, CRM DASHBOARD. Click CRM → routes to `/dashboard/venture/{id}/crm`.
2. **CRM page:** Loads without error. Connection pills show live IG/Gmail status. Reddit/Telegram pills are grey with "Coming soon" and toast on click. Inbox tab shows IG comments if any published posts exist.
3. **Gmail card:** Open Marketing → Social tab. Confirm 4th "Gmail" card. Click Connect → popup opens → grant → popup closes → card shows connected email.
4. **Instagram reconnect:** Force the error: edit `social_connections.scopes` in DB to remove `instagram_business_manage_comments`, run validate on a published post with `commentsCount > 0`. Confirm the new CTA shows "Comment permission missing" with a "Reconnect Instagram →" button. Click it → disconnect + redirect to Meta with `auth_type=rerequest` in URL.
5. **Mobile:** Chrome DevTools at 375px. Hero has no horizontal scroll; blobs fit. OutputTabs financial table scrolls inside its container.
6. **Build:** `npm run build` — zero TypeScript errors.