# Forze Agent Document Style Guide

Use this guide whenever you write a long-form document that may be exported to PDF. The goal is clean structure, predictable rendering, and executive readability.

## Core Rules

1. Write in professional Markdown only.
2. Use short paragraphs: 2-4 sentences each.
3. Prefer clear sectioning over dense prose.
4. Keep headings descriptive and specific to the venture.
5. Do not use HTML.
6. Do not use code fences unless the output explicitly requires code.
7. Do not use nested bullet lists deeper than one level.
8. Do not create fake citations like "[1]" unless the source is named inline.
9. Do not dump raw JSON inside the document body.
10. When a fact has a source, include it inline in plain English.

## Required Document Shape

Every long-form document should follow this pattern:

1. `# Title`
2. A 2-4 sentence executive summary
3. `## Key Takeaways`
4. 3-5 bullet points with the most important conclusions
5. Main body sections using `##` headings
6. Optional sub-sections using `###` headings
7. Final `## Recommended Next Steps` section with 3-5 numbered actions

## Heading Rules

- Use exactly one `#` heading for the document title.
- Use `##` for major sections.
- Use `###` only for sub-sections inside a major section.
- Do not skip heading levels.
- Keep headings under 8 words where possible.

## Paragraph Rules

- Keep paragraphs focused on one idea.
- Avoid walls of text longer than 120 words.
- Start sections with the conclusion, then the supporting detail.
- Use plain language over jargon when both are possible.

## Lists

- Use `-` for unordered lists.
- Use `1.` style numbering for ordered lists.
- Keep each list item to one idea.
- If a list item needs detail, add one short sentence after the key point instead of creating deep nesting.

## Tables

Use Markdown tables only for compact comparisons, projections, or scorecards.

- Keep tables to 3-6 columns.
- Keep cell text short.
- Add one sentence before the table explaining what it shows.
- Add one sentence after the table explaining the implication.

Example:

| Metric | Value | Why It Matters |
| --- | --- | --- |
| CAC | $45 | Supports efficient paid growth |
| LTV | $540 | Leaves room for reinvestment |

## Callouts And Labels

You may use simple label lines when they improve scanning:

- `Verdict: GO`
- `Primary Risk: Regulatory approval lag`
- `Best Channel: LinkedIn outbound`

Keep labels short and place the explanation after the colon.

## Source Handling

- Name the source directly in the sentence.
- Good: `Grand View Research estimates the market at $4.2B in 2025.`
- Good: `Multiple Reddit threads in r/smallbusiness highlighted onboarding delays as a recurring pain point.`
- Bad: `Source: market research`
- Bad: bare URLs in the middle of paragraphs

## Section Patterns By Document Type

### Research Or Feasibility Docs

Recommended sections:

- `## Market Snapshot`
- `## Customer Pain Points`
- `## Competitive Landscape`
- `## Economics` or `## Financial Model`
- `## Risks`
- `## Recommendation`

### Brand Or Marketing Docs

Recommended sections:

- `## Positioning`
- `## Audience`
- `## Messaging Framework`
- `## Voice And Tone`
- `## Channel Strategy`
- `## Execution Plan`

### Investor Docs

Recommended sections:

- `## Thesis`
- `## Opportunity`
- `## Traction Or Validation`
- `## Economics`
- `## Risks`
- `## The Ask`

## PDF Friendliness

To help the PDF renderer:

- Put each heading on its own line.
- Leave a blank line before and after tables.
- Keep bullet markers consistent.
- Avoid excessively long single-line text.
- Use simple Markdown emphasis sparingly.
- Do not rely on color, indentation, or layout tricks to convey meaning.

## Final Quality Bar

Before finishing, check:

- Would a founder understand the argument by skimming headings alone?
- Would an investor or operator be able to quote the 3 main takeaways quickly?
- Would this still look clean if exported to a plain PDF renderer?
