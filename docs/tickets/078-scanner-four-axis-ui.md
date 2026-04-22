# [TICKET-078] Scanner Four-Axis UI

## Status
`blocked`

## Dependencies
- Requires: #077

## Description
Refactor the Scanner page UI from a flat issue list to four collapsible diagnostic cards, one per axis. Each card shows the axis summary, its findings with rule references, and neighbor-post citations inline. Replace the old automatic rewrites with an explicit "Get rewrite suggestions" CTA that routes to the Composer with the analyzed text pre-filled. This preserves the user journey while aligning with the AK discipline.

## Acceptance Criteria
- [ ] `src/components/dashboard/quality-scanner.tsx` refactored to render four cards: Style Matching, Psychology Triggers, Algorithm Alignment, AI-Tone Detection.
- [ ] Each card is collapsible (default expanded) and shows axis summary at top + findings list; severity chips (`info`/`flag`/`warn`) colored via tier palette from #066.
- [ ] Algorithm-axis findings that carry `rule: "R3"` etc. render the rule code as a small pill linking to an in-app tooltip with the 1-line rule summary (sourced from `algorithm.md`).
- [ ] Neighbor-post citations render as a small inline strip at the bottom of the Style card: "Similar posts: " + 3 post thumbnails linking to the post detail.
- [ ] "Get rewrite suggestions" button replaces the old inline-rewrites section; clicking routes to `/dashboard/create/compose?from=scanner&text=<encoded>`.
- [ ] Streaming: cards render progressively as each axis completes — axis-specific skeletons show while data streams.
- [ ] Feature flag aware: when `SCANNER_V2_ENABLED` is false, render the legacy flat issue list unchanged.
- [ ] Loading, empty, and error states per card.

## Design Reference
- **Components**: shadcn `Card`, `Collapsible`, `Badge`, `Tooltip`; existing card styles from dashboard.
- **Layout**: cards stack vertically on all breakpoints; max-width container.
- **Colors**: severity palette shared with `<ConfidenceBadge />` tiers (warn=amber, flag=blue, info=neutral).

## Visual Reference
Scanner page now shows four large cards down the page. The top card "Style Matching" has a 1-line summary ("Close match to your voice — 87% overlap with top-quartile posts"), then 2–3 findings each with a severity chip and inline evidence quote. At the bottom of this card, a thin strip reads "Similar posts:" followed by 3 small post thumbnails. The next card "Psychology Triggers" shows findings like "Hook type: Information Gap" and "Missing retellability — no single memorable sentence." The "Algorithm Alignment" card shows a pill reading `R3` next to a finding "First-sentence CTA risks engagement-bait demotion" with a tooltip showing the full rule. The "AI-Tone" card is present but largely empty until #079 lands. Below all four cards, a single primary CTA "Get rewrite suggestions →" links to Composer.

## Implementation Notes
- Server-to-client streaming: the existing SSE pattern from `quality-llm.ts` streams card-by-card events; client parses and updates state incrementally.
- Rule tooltip content: read a short summary from `src/lib/prompts/algorithm.md` at build time (via prompt loader from #067) — one-line summaries per rule stored in a generated JSON.
- The rewrite CTA must pass the full analyzed text to Composer — reuse the cross-page flow established in #062.
- Feature-flag branch goes at the top of the component to avoid double-renders.

## Testing
- Scanner with v2 flag → 4 cards render; each streams progressively; severity chips colored correctly.
- Click a rule pill → tooltip shows the rule summary.
- Click a neighbor-post citation → navigates to post detail.
- Click "Get rewrite suggestions" → Composer opens with text pre-filled.
- Flag off → legacy UI unchanged (regression).
- Mobile viewport → cards stack cleanly; collapsibles behave.
