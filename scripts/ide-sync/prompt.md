# IDE landing-page sync — CI instructions

You are running headless inside CI for the **Forze** marketing repo. Your one job:
reconcile the `/ide` marketing landing page with the **current** Forze IDE product
feature docs, then stop.

## Inputs

The latest product docs were just pulled from the `Forze_IDE` repo into:

- `$IDE_DOCS_DIR/features.md` — the complete feature list (source of truth)
- `$IDE_DOCS_DIR/README.md` — product overview / positioning
- `$IDE_DOCS_DIR/ide_plan.md` — build plan / roadmap context

(`$IDE_DOCS_DIR` is provided in the environment.)

## What to edit

Only files under `components/ide-landing/`. These render the page content:

- `IdeHero.tsx` — headline, subhead, trust strip
- `IdeProblem.tsx` — the "one window, not twelve tabs" problem framing
- `IdeShowcase.tsx` — the "it's a real IDE" + AI control-room showcase copy
- `IdeCapabilities.tsx` — the **full feature inventory** (the `CATEGORIES` array). This
  is the most important one to keep in sync with `features.md`.
- `IdeHowItWorks.tsx` — the 3-step flow
- `IdePlatforms.tsx` — platform / sovereignty / trust block
- `IdeFaq.tsx` — FAQ entries

## Rules

1. **Content only.** Do not change layout, structure, component props, styling,
   class names, animation logic, or the design tokens/accent colors. Update the
   text/data: feature names, one-liner descriptions, category groupings, counts,
   FAQ answers, copy.
2. **Source of truth is the docs.** Add/rename/remove features so the page matches
   `features.md`. Do **not** invent features that aren't in the docs.
3. Keep the existing voice — terse, confident, builder-OS tone. Match the style of
   the surrounding copy.
4. Preserve any hardcoded counts/numbers in copy by updating them to the new totals
   if the feature list changed (e.g. "40+ features").
5. Touch **nothing** outside `components/ide-landing/`. Do not edit configs, the
   workflow, this prompt, or `scripts/`.
6. If the docs and the page already agree, make **no edits** — it's fine to do nothing.

When done, stop. The workflow opens a PR from whatever you changed; a human reviews it.
