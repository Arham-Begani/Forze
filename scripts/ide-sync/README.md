# Auto-sync: `/ide` landing page ⇆ Forze_IDE features

The `/ide` marketing page (`components/ide-landing/*`) is kept in sync with the actual
product feature docs in the [`Forze_IDE`](https://github.com/Arham-Begani/Forze_IDE)
repo, automatically, via a PR.

## How it flows

```
push to Forze_IDE (features.md / README.md / ide_plan.md)
        │   .github/workflows/notify-landing.yml
        ▼
repository_dispatch  ──►  Forze repo
        │   .github/workflows/sync-ide-landing.yml
        ▼
pull latest docs ─► Claude Code edits components/ide-landing/* ─► open PR
        ▼
you review + merge
```

Nothing auto-merges. Every change lands as a reviewable PR on the `ide-sync/auto` branch.

## One-time setup (required secrets)

The plumbing is committed, but it does nothing until two secrets exist.

### 1. In **this** repo (`Arham-Begani/Forze`)

| Secret | Value |
|---|---|
| `ANTHROPIC_API_KEY` | An Anthropic API key. Used by Claude Code in CI to rewrite the page content. |

Add it: repo → Settings → Secrets and variables → Actions → New repository secret.

### 2. In the **`Forze_IDE`** repo

| Secret | Value |
|---|---|
| `LANDING_DISPATCH_TOKEN` | A GitHub PAT that can POST a `repository_dispatch` to `Arham-Begani/Forze`. Classic PAT with the `repo` scope, or a fine-grained PAT scoped to the `Forze` repo with **Contents: read** + the ability to dispatch events. |

Add it: `Forze_IDE` → Settings → Secrets and variables → Actions → New repository secret.

## Triggering it manually

- **From this repo:** Actions → *Sync IDE landing page* → Run workflow. (Pulls current
  `Forze_IDE` docs and opens a sync PR without needing a push.)
- **From `Forze_IDE`:** Actions → *Notify landing page* → Run workflow.

## Files

- `.github/workflows/sync-ide-landing.yml` — the consumer (this repo).
- `scripts/ide-sync/prompt.md` — the instructions Claude follows in CI.
- `Forze_IDE/.github/workflows/notify-landing.yml` — the trigger (other repo).
