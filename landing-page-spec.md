# Forze IDE — Landing Page Content Spec

> A complete brief for the marketing site: positioning, the full feature inventory,
> section-by-section page structure, ready-to-edit copy, design direction, and the
> assets you'll need to produce. Hand this to a designer/developer (or build it
> yourself) and you have everything required to ship the page.

---

## 0. The one-liner

**Product name:** Forze IDE
**Tagline (official, from the build):** *The Sovereign OS for Startup Founders.*
**Domain:** forze.in
**Category:** Desktop developer tool / founder operating system

**What it actually is:** A cross-platform desktop app (Tauri v2 — Rust + React) that
fuses a real code editor with everything a founder does *around* the code — AI coding
agents, deployments, task boards, analytics, build-in-public publishing, and community —
into one offline-first, bring-your-own-key workspace.

**The wedge / why it's different:** Other IDEs stop at the editor. Forze is the place a
solo founder or tiny team **codes, ships, tracks, and grows the company** without ever
leaving the window. It's local-first and sovereign — your keys, your files, your data
stay on your machine.

---

## 1. Audience & positioning

### Who it's for
- **Solo founders / indie hackers** building and shipping their own product.
- **Small startup teams** (2–10) who don't want a stack of 8 SaaS tabs.
- **"Vibe coders"** who drive AI agents (Claude Code, Codex, etc.) and want them orchestrated, not scattered across terminals.
- **Build-in-public creators** who ship and post in the same motion.

### The pain we speak to
- "My workflow is 12 browser tabs and 4 terminals."
- "I pay for an IDE, a deploy tool, a kanban tool, an analytics tool, a social scheduler…"
- "My AI agents don't share context — I re-explain the project to each one."
- "I want my data and API keys on *my* machine, not someone's cloud."

### Positioning statement
> For founders who code, Forze is the desktop OS that replaces your IDE *and* the
> half-dozen tools bolted around it — so you can build, ship, and grow from a single
> sovereign, local-first window.

### Competitive framing (use lightly on the page, more in SEO/comparison pages)
- vs **VS Code / Cursor**: those are editors with AI bolted on. Forze is an editor *inside a founder OS* — deployments, analytics, kanban, community are first-class.
- vs **Linear / Notion / Vercel dashboard**: those are single-purpose SaaS. Forze brings the founder-critical slices of each into the place you already write code, local-first.
- vs **a pile of terminals running CLI agents**: Forze gives those agents a shared context bus, a control room, and scheduling.

---

## 2. Brand & design direction

Pull this straight from the app so the site and product feel like one thing.

- **Mood:** "Builder OS." Matte black, high-contrast, focused, a little sci-fi/control-room.
- **Base:** near-black background (matte, not pure #000), elevated surfaces in dark gray.
- **Accent:** electric teal-cyan **`#00d4ff`** (the current product accent). One accent, used sparingly for CTAs, highlights, active states. (Earlier builds used indigo — teal-cyan is current.)
- **Light mode exists** ("Daylight") — offer a light/dark toggle on the site to mirror the product.
- **Typography:** clean geometric/grotesk sans for headings; a monospace face for code, terminal, and "spec" details (reinforces the developer-tool credibility).
- **Texture:** subtle glassmorphism on floating elements (mirrors the floating Assistant + title bar), thin 1px borders, soft glows on the accent only.
- **Imagery:** real product screenshots > illustrations. The UI is the hero. Show the dark workspace with the cyan accent.
- **Motion:** restrained. A looping product demo, subtle reveal-on-scroll, an animated terminal typing an agent prompt. No bouncy nonsense — it's a serious tool.

---

## 3. Full feature inventory

Everything below is real and shippable in the product. Group them on the page as shown
in Section 4. Each feature has a headline + a one-liner you can drop straight into copy.

### A. The editor & workbench (the "it's a real IDE" proof)
| Feature | One-liner |
|---|---|
| **Monaco-based code editor** | A real editor — syntax highlighting, auto-indent, multi-tab, the keystrokes you already know. |
| **File Explorer** | Full file tree with create/rename/delete; open any folder like VS Code's "Open Folder." |
| **Project-wide Search** | Fast search across the workspace with jump-to-line reveal. |
| **Quick Open** | Jump to any file in a keystroke. |
| **Format Document** | Prettier built in (Shift+Alt+F) — no extension hunting. |
| **Integrated terminal** | Real PTY terminals (xterm) inside the workspace. |
| **Custom title bar + command center** | Borderless, native-feeling window with a menu bar and command center. |
| **Workspaces** | Open-folder workspace switching; everything (tasks, boards, stations) re-scopes to the project. |

### B. Source control & safety
| Feature | One-liner |
|---|---|
| **VS Code-style Git** | Change gutter against the committed baseline, a clickable Source Control panel, stage/commit/diff. |
| **Commit Guard** | Optional **auto-commit** every N saved changes — never lose work. |
| **Security review gate** | Pre-commit secret scanner blocks commits that would leak API keys/secrets on added lines. |
| **Security Auditor** | A dedicated panel that scans your code for exposed secrets and risky patterns. |

### C. AI: agents, assistant & orchestration (the headline category)
| Feature | One-liner |
|---|---|
| **The Forze Assistant** | A floating AI copilot that doesn't just chat — it *drives the IDE*: opens views, runs features, takes actions for you. |
| **Bring-your-own-key + keyless default** | Gemini works out of the box (keyless). Plug in your own Claude or OpenAI key — your keys, your control. |
| **Agent Manager (Mission Control)** | Give it a goal; an Architect agent breaks it into tasks and runs a *team* of worker agents in parallel. |
| **Vibe Stations** | A grid of live CLI coding-agent terminals — Claude Code, Codex, Antigravity, OpenCode — running side by side. |
| **Shared Context Bus** | All your agents share one project context over a local MCP bus — explain the project once, not five times. |
| **Scheduled prompts** | "Run the test suite on Claude Code #1 at 9pm" — Forze opens the station and types it at the time. |
| **Vibe Canvas** | A visual, AI-assisted builder that generates code you can drop straight into the editor. |

### D. Ship it: deployments
| Feature | One-liner |
|---|---|
| **Full Vercel client** | Deploy, redeploy, cancel, promote to production, and stream build logs — without leaving Forze. |
| **Live deploy status** | Auto-polling deployment list so you always see the current state. |
| **One credential** | Just paste a Vercel token (and optional Team ID). |

### E. Run the company: founder tools
| Feature | One-liner |
|---|---|
| **Kanban board** | A colorful drag-and-drop task board, per-workspace, that the AI mission planner writes into and syncs live. |
| **Dashboard** | A founder cockpit built from *real* signals — git commits, streaks, workspace metrics, tasks, community reputation. |
| **Analytics** | Builder analytics derived from your actual activity, not vanity dummy data. |
| **Team** | A team roster with voice rooms for the people building with you. |
| **Community** | A local-first builder feed — profiles, posts, comments, likes, and "Demo Day" launches with voting. |
| **Build in Public** | Schedule and publish updates (LinkedIn OAuth) so shipping and posting happen in one move. |

### F. Platform & trust (the "why it's safe to install" proof)
| Feature | One-liner |
|---|---|
| **Cross-platform** | Native desktop builds for macOS, Windows, and Linux (Tauri v2). |
| **Offline-first** | A local SQLite cache means it works without a connection; your data lives on your device. |
| **Local-first & sovereign** | Files, keys, and project data stay on your machine — that's the whole point. |
| **Signed builds + auto-update** | Code-signed cross-platform bundles with a built-in updater (forze.in). |
| **Light & dark themes** | "Daylight" light mode and the default matte-black "Builder OS" dark. |
| **Lightweight** | Tauri (Rust core) instead of a heavy Electron stack — fast boot, small footprint. |

---

## 4. Landing page structure (section by section)

A single long-scroll page. Order optimized for a developer audience: hook → proof it's
real → the unique AI angle → the breadth → trust → CTA.

### Section 1 — Hero
- **Eyebrow:** `Desktop · macOS / Windows / Linux`
- **H1:** The Sovereign OS for Startup Founders.
- **Subhead:** Forze is a desktop IDE that doesn't stop at the editor — code, run AI agents, deploy, track, and build in public from one local-first window.
- **Primary CTA:** `Download for free` (or `Download for [auto-detected OS]`)
- **Secondary CTA:** `Watch the 90-sec demo`
- **Hero visual:** large product screenshot or a looping screen-capture of the dark workspace — editor + floating Assistant + cyan accents. This is the most important asset on the page.
- **Trust strip under the fold:** "Local-first · Bring your own key · Open a folder and go."

### Section 2 — The problem (short, sharp)
Three lines or a 3-up:
- "Your IDE. Plus a deploy dashboard. Plus a task tool. Plus an analytics tool. Plus a scheduler. Plus four terminals running AI agents that don't talk to each other."
- **Headline:** One window. Not twelve tabs.
- Transition into the product.

### Section 3 — "It's a real IDE" (kill the skepticism early)
Developers will assume an all-in-one tool has a toy editor. Disprove it immediately.
- Screenshot of the editor with Monaco highlighting, Explorer, Source Control gutter, terminal.
- Bullets: Monaco editor · file tree + search + quick open · real Git with change gutter · integrated terminals · Prettier formatting · open any folder.
- Micro-headline: **A serious editor at the core. Everything else is the upgrade.**

### Section 4 — The AI control room (the star feature block)
This is the differentiator — give it the most space. A larger feature section, possibly with a small interactive/animated element (an animated terminal typing an agent prompt).
- **Headline:** Don't manage agents. Command them.
- **Sub-features (3–4 cards):**
  - **Agent Manager** — one goal in, a team of agents out, working in parallel.
  - **Vibe Stations** — Claude Code, Codex, Antigravity & OpenCode, live, side by side.
  - **Shared Context Bus** — every agent knows the project. Explain it once.
  - **The Assistant** — a copilot that operates the IDE, not just talks about it.
- Callout: **Keyless Gemini built in. Your own Claude/OpenAI key when you want it.**

### Section 5 — Ship & run the company (the breadth block)
A feature grid (the "and so much more" that justifies "OS"). Use 6 tiles with icons:
- 🚀 **Deployments** — full Vercel control + live logs.
- 🗂️ **Kanban** — drag-drop board the AI writes into.
- 📊 **Dashboard & Analytics** — real metrics from your real work.
- 🔨 **Build in Public** — schedule & post updates as you ship.
- 💬 **Community** — a builder feed with Demo Day launches.
- 👥 **Team** — roster + voice rooms.
- 🛡️ **Security & Commit Guard** — secret-scan gate before every commit.

### Section 6 — Sovereignty / trust
The emotional close for a developer: ownership and privacy.
- **Headline:** Your machine. Your keys. Your data.
- Three pillars: **Local-first** (SQLite, works offline) · **Bring your own key** (no middleman on your AI calls) · **Lightweight & signed** (Tauri/Rust, code-signed, auto-updating).
- Subtext: "Forze runs on your desktop. Your code and credentials never have to leave it."

### Section 7 — How it works (3 steps)
1. **Download & open a folder** — point Forze at any project.
2. **Add your keys (optional)** — or start instantly with the keyless default.
3. **Build, ship, grow** — code, run agents, deploy, and post — without switching apps.

### Section 8 — Social proof / build-in-public
Forze is itself a build-in-public product — lean into that.
- Founder/team note, or a "follow the build" embed (X/LinkedIn).
- Placeholder for testimonials, GitHub stars, or a Discord/community member count once you have them.
- A roadmap / changelog teaser ("shipping weekly").

### Section 9 — Pricing (or "Free while in beta")
- If pre-monetization: a single **"Free during beta"** card + an email capture for launch pricing.
- When you price: keep it simple (Free / Pro / Team). Founder-tool pricing should feel obviously cheaper than the stack it replaces — that's a strong value line ("replaces $X/mo of tools").

### Section 10 — Final CTA
- **Headline:** Stop tab-switching. Start shipping.
- Big `Download Forze — Free` button + OS download links (macOS `.dmg`, Windows `.msi/.exe`, Linux `.AppImage/.deb`).
- Secondary: "Star us on GitHub" / "Join the community."

### Footer
- Nav: Features · Download · Docs · Community · Changelog · GitHub · X/LinkedIn
- Legal: Privacy, Terms.
- "Made for founders, by founders. forze.in"

---

## 5. Copy bank (drop-in headlines)

Use these as-is or remix:

- *The Sovereign OS for Startup Founders.*
- *One window. Not twelve tabs.*
- *Code it. Ship it. Post it. Without leaving the app.*
- *A real IDE at the core. A whole company OS around it.*
- *Don't manage your AI agents. Command them.*
- *Your machine. Your keys. Your data.*
- *Explain your project once. Every agent already knows.*
- *The editor is just the beginning.*
- *Built local-first, so you own everything.*
- *Replaces your IDE — and the six tools bolted around it.*

---

## 6. SEO / meta

- **Title tag:** `Forze IDE — The Sovereign OS for Startup Founders`
- **Meta description:** `Forze is a local-first desktop IDE for founders: code, run AI agents, deploy to Vercel, track analytics, manage tasks, and build in public — all in one window. macOS, Windows & Linux.`
- **Primary keywords:** founder IDE, AI coding agents desktop, all-in-one developer tool, local-first IDE, Claude Code orchestration, indie hacker tools, vibe coding.
- **OG/Twitter image:** the dark workspace hero screenshot with the tagline overlaid.
- Consider **comparison/alternative pages** later (Forze vs Cursor, Forze for indie hackers, etc.) for SEO — see the `competitor-alternatives` and `programmatic-seo` marketing skills.

---

## 7. Assets you need to produce

**Critical (page can't ship without these):**
1. **Hero screenshot/loop** — dark workspace, editor + floating Assistant + cyan accent.
2. **Editor close-up** — Monaco highlighting, Source Control gutter, terminal (proves "real IDE").
3. **Agent control-room shot** — Agent Manager and/or Vibe Stations with multiple agents live.
4. **A 60–90s demo video** — open folder → ask the Assistant to do something → an agent works → deploy. The single highest-converting asset.
5. **OS download builds** — signed `.dmg`, `.msi`/`.exe`, Linux bundle, wired to the forze.in download/update endpoint.

**Nice to have:**
6. Feature-tile icons (match the in-app Lucide icon set for consistency).
7. Light-mode screenshots (for the light/dark site toggle).
8. Logo lockups (wordmark + icon) in light/dark.
9. OG/social share image.

---

## 8. Build notes (if you build the site in this stack)

- This repo already ships to **Vercel** and the desktop updater points at **forze.in** — host the marketing site on the same domain and serve the download artifacts/updater from there (the `web/` Next.js app, "Forge", is the natural home).
- Reuse the product's color tokens (matte black, `#00d4ff` accent) so site and app match exactly.
- Keep the page fast and mostly static — it's a download page; the product does the heavy lifting. The `frontend-design` and `vercel:nextjs` skills can scaffold a high-quality implementation when you're ready to build.

---

### TL;DR — what must be on the page
1. Hero with the tagline + download CTA + a real screenshot.
2. Proof it's a real IDE (editor/git/terminal).
3. The AI control room (Agent Manager, Vibe Stations, Context Bus, Assistant) — the differentiator.
4. The breadth grid (Deployments, Kanban, Dashboard/Analytics, Build in Public, Community, Team, Security).
5. Sovereignty/trust (local-first, BYOK, signed, cross-platform).
6. How-it-works in 3 steps + a final download CTA.
