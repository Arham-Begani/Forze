# Forze Module Tightening + Editable Investor Kit

## Summary

Improve existing Forze modules so they feel more decisive, consistent, and founder-useful without adding new modules. The implementation centers on two product shifts:

- Existing modules move from "long AI output" to "clear recommendation + weak-point detection + editable artifact"
- `Investor Kit` becomes a first-class founder-owned document with hand editing, while AI stays as an assistive generator instead of the only author

This v1 should cover `research`, `branding`, `landing`, `marketing`, `feasibility`, `shadow-board`, `cohorts`, and `investor-kit`, with the investor kit editor as the highest-priority shipped surface.

## Key Changes

### 1. Shared output quality upgrade across existing modules

Add a consistent "decision layer" to module prompts and rendering so each module returns not just content, but a sharper recommendation artifact.

- `research`: require `bestCustomerSegment`, `bestWedge`, `bestChannels`, `biggestTrap`, and `recommendedNextStep`
- `branding`: require `buyerFitRationale`, `nameScores`, `conversionRisks`, and `recommendedBrandDirection`
- `landing`: require `positioningAngles`, `headlineWeaknesses`, `ctaWeaknesses`, `sectionToPainPointMap`, and `recommendedPageDirection`
- `marketing`: require `priorityChannels`, `channelWhyNow`, `channelWhyNotNow`, `goalPerAsset`, and `recommendedFirstMotion`
- `feasibility`: require `realBlockers`, `manageableRisks`, `mostDangerousAssumption`, `evidenceNeededToFlipVerdict`, and `recommendedGoForwardMotion`
- `shadow-board`: require each persona to cite exact module evidence, give one concrete fix, and end with `fixThisThisWeek`
- `cohort-comparator`: require `winnerBecause`, `loserStrengthsToMerge`, and scoring on `clarity`, `distributionEase`, `monetizationSpeed`, and `founderAdvantage`

Implementation approach:

- Extend each Zod schema in the agent files to include these "decision layer" fields
- Update system prompts so these fields are mandatory and must cite venture context rather than generic advice
- Update `components/ui/ResultCard.tsx` to surface these decision fields near the top instead of burying them below long reports
- Keep existing long-form output fields for backwards compatibility; add new fields as optional-with-defaults for old records

### 2. Cross-module alignment checks inside existing runs

Use existing venture context to reduce contradictions between modules without adding a new module.

- `branding` reads `research` and must explicitly align voice/naming to target customer and wedge
- `landing` reads `research + branding` and must reject vague messaging that does not map to known pain points
- `marketing` reads `research + branding + landing` and must prioritize one or two channels instead of broad spray
- `investor-kit` reads `research + landing + feasibility` and must flag weak claims rather than polishing them away

Add lightweight contradiction detection in prompts:

- If target customer, pricing posture, or promise differs from prior modules, the agent must return `alignmentWarnings`
- `ResultCard` shows these warnings as a visible "Needs Alignment" block when present
- No hard blocking in v1; warnings are advisory so users are not forced into a workflow

### 3. Editable Investor Kit as founder-owned document

Turn the investor kit from AI-generated output into a structured editable artifact stored in `investor_kits`.

Canonical source of truth:

- The editable `investor_kits.kit_data` record becomes the authoritative published artifact
- `venture.context.investorKit` remains a generation cache / module result, but owner edits save to the DB record first
- When the editable kit exists, public investor pages read from `investor_kits.kit_data` only

Editor shape:

- Add a dashboard editor surface for the existing investor kit with structured sections:
  - `executiveSummary`
  - `pitchDeckOutline[]`
  - `onePageMemo`
  - `askDetails.suggestedRaise`
  - `askDetails.useOfFunds[]`
  - `askDetails.keyMilestones[]`
  - `dataRoomSections[]`
- Use dedicated inputs, textareas, and repeatable rows for slides and list items
- Add `dirty`, `saving`, and `lastSavedAt` UI states
- Support add, remove, reorder for deck slides and list sections
- Keep markdown rendering for previewable rich-text fields, but editing is plain structured form, not raw JSON

Required API/interface changes:

- Extend `GET /api/ventures/[id]/investor-kit` to return:
  - `kit`
  - `source` = `generated` | `manual` | `hybrid`
  - `hasManualEdits`
  - `lastEditedAt`
- Add `PATCH /api/ventures/[id]/investor-kit` to update manual fields on the existing shared DB kit
- Add a shared sanitizer/validator for the structured payload before save
- Add DB fields to `investor_kits`:
  - `has_manual_edits boolean default false`
  - `last_edited_at timestamptz null`
  - optional `manual_fields jsonb default '{}'` only if field-level provenance is needed during AI merge; otherwise skip for v1

Save semantics:

- `PATCH` writes to `investor_kits.kit_data`
- `PATCH` sets `has_manual_edits = true` and `last_edited_at = now()`
- `PATCH` does not overwrite the historical conversation result
- Public page at `app/investor/[code]/page.tsx` immediately reflects saved manual edits

### 4. AI/manual coexistence policy for Investor Kit

Preserve manual edits by default when AI runs again.

Run behavior:

- If no editable shared kit exists yet, `POST` generation creates one from AI output as today
- If an editable shared kit exists and `has_manual_edits = false`, regenerate in place
- If an editable shared kit exists and `has_manual_edits = true`, `POST` generation should:
  - generate a fresh AI draft
  - merge only untouched fields by default
  - keep manually edited fields unchanged
  - return `preservedManualFields` and `updatedAIFields` metadata for the UI
- Do not silently overwrite manual sections in v1

Merge policy:

- If `manual_fields` is implemented, preserve only marked fields
- If `manual_fields` is not implemented, preserve full top-level sections once edited:
  - edited summary protects summary
  - edited memo protects memo
  - edited deck protects entire deck array
  - edited ask protects ask object
  - edited data-room protects the data-room array

UI behavior:

- Show "AI updated other sections; your manual edits were kept" after regeneration
- Add a future-facing but not yet implemented hook for explicit "overwrite with AI" and "compare drafts"; do not build comparison UI in v1

## Public APIs and Types

Additions and adjustments:

- `InvestorKit` query type gains `has_manual_edits` and `last_edited_at`
- `InvestorKitOutput` stays structurally compatible, but editor/save code should validate the same shape
- `app/api/ventures/[id]/investor-kit/route.ts`
  - `GET` returns editable metadata
  - `PATCH` accepts partial structured updates
- `lib/queries.ts`
  - add `updateInvestorKit(...)`
  - add optional `markInvestorKitManualFields(...)` only if provenance is stored separately
- `app/investor/[code]/page.tsx` remains read-only for external viewers; no public editing

## Test Plan

Validate both quality upgrades and editor behavior.

- Agent schema tests: each upgraded module accepts old records and validates new decision fields
- Prompt/output regression tests: investor kit, landing, and feasibility return required decision-layer fields on happy path
- Investor kit API tests:
  - `GET` returns editable metadata
  - `PATCH` updates only intended sections
  - invalid payload is rejected cleanly
  - public investor page reflects saved edits
- Merge behavior tests:
  - manual summary preserved during AI rerun
  - untouched ask/details updated from AI rerun
  - edited slide deck is not overwritten
- UI tests/manual checks:
  - add/remove/reorder deck slides
  - autosave or explicit save keeps data stable on refresh
  - markdown preview still renders memo correctly
  - alignment warnings render without breaking old result cards

## Assumptions and Defaults

- This is a phased implementation; `Investor Kit editor + decision-layer upgrades + alignment warnings` are the v1 shipping scope
- No new standalone module is introduced; all improvements live inside current modules and existing pages
- The editable shared DB record is the canonical investor kit artifact
- Structured form editing is the only editing UI in v1; no raw JSON editor and no rich-text WYSIWYG
- Manual edits are protected by default on AI reruns
- Alignment checks are advisory, not blocking
- Existing historical conversations and old venture context payloads must continue rendering without migration failures
