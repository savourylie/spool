# [TICKET-066] Data Confidence Util + ConfidenceBadge

## Status
`done`

## Dependencies
- Requires: None

## Description
Build the cross-cutting "data confidence tier" presentation layer. Adds a utility that classifies a sample size into one of five tiers (Directional / Weak / Usable / Strong / Deep) and a reusable `<ConfidenceBadge />` primitive that renders next to any metric or section header. Retrofit the badge across Understand Performance, Understand Audience, Insights, and Today Hub so that new accounts don't see the same confident percentages as accounts with 300 posts. This is a credibility fix that unblocks every AK integration feature.

## Acceptance Criteria
- [x] `src/lib/data-confidence.ts` exports `getConfidenceTier(sampleSize: number): { tier: Tier; label: string; suggestedCopy: string }` where `Tier` is one of `"directional" | "weak" | "usable" | "strong" | "deep"`.
- [x] Tier thresholds match `src/lib/prompts/data-confidence.md`: Directional <5, Weak 5–9, Usable 10–19, Strong 20–49, Deep 50+.
- [x] `src/components/ui/confidence-badge.tsx` renders a small pill with tier label + sample count (e.g., "Strong · 47 posts"). Tooltip on hover explains what the tier means.
- [x] Badge color scale: Directional=neutral, Weak=amber, Usable=blue, Strong=green, Deep=emerald. Uses existing shadcn theme tokens, no ad-hoc hex.
- [x] Retrofitted into: Understand Performance page header, Understand Audience page header, Insights page (each topic cluster cell), Today Hub `BestPostCard` and `PulseCard`.
- [x] Below Directional (<5 posts), callers can opt into a "description-only" mode where numeric values hide and a prose description shows instead — documented in a short JSDoc on `getConfidenceTier`.

## Design Reference
- **Tokens**: shadcn Badge component as base; color families via existing Tailwind theme.
- **Components**: `<ConfidenceBadge />` primitive; composes into page headers and card headers.

## Visual Reference
A small pill sits immediately to the right of each section title — e.g., "Performance by hook type" followed by a green pill reading "Strong · 47 posts". Hovering the pill shows a tooltip: "Strong confidence — based on 20–49 comparable posts." On an account with 3 posts, the same pill shows "Directional · 3 posts" in a neutral gray, and any adjacent numeric claims render as a prose description instead of percentages.

## Implementation Notes
- Keep the util pure and dependency-free (no React imports) so it can be reused server-side in other tickets.
- The badge should accept `tier` + `sample` + `compact?` props; `compact` hides the sample count for tight spaces.
- Retrofit scope: prefer one-line `<ConfidenceBadge ... />` additions; avoid rewriting surrounding copy unless a tier change makes a metric misleading.
- `src/components/dashboard/best-post-card.tsx`, `pulse-card.tsx`, `today-hub/*` and the Understand/Insights page.tsx files are the primary insertion points.

## Testing
- Unit test `getConfidenceTier`: boundary cases (0, 4, 5, 9, 10, 19, 20, 49, 50, 999).
- Visual: `npm run dev` → each target page shows the badge in the header; switch users or truncate posts locally to verify tier transitions.
- Verify below-Directional mode: pages render prose descriptions instead of percentages when `<ConfidenceBadge tier="directional" />`.
