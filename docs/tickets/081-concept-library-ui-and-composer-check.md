# [TICKET-081] Concept Library UI + Composer Pre-Draft Check

## Status
`pending`

## Dependencies
- Requires: #080 ✅

## Description
Ship `/dashboard/understand/concepts` — a searchable table of every concept and analogy the user has already used, with reuse risk per concept. Add a pre-draft check in the Composer that surfaces "you've used analogy X before; consider Y" when the chosen topic hits ledger concepts. Completes the editorial superpower: answers "have I explained this before?" and prevents unconscious repetition.

## Acceptance Criteria
- [ ] New route `/dashboard/understand/concepts/page.tsx` renders the library at max-width.
- [ ] New component `src/components/dashboard/concept-library-table.tsx` renders columns: Concept, First-seen post, Times explained, Analogies used, Reuse risk (chip), Last used, Related cluster.
- [ ] Search input at top filters by concept or analogy substring.
- [ ] Sort toggles: reuse-risk descending, last-used descending, times-explained descending.
- [ ] Reuse-risk chip colors: green / yellow / red from #080's `computeReuseRisk`.
- [ ] Click a concept row → inline drawer expands showing all posts where it appeared (linked to post detail).
- [ ] Composer pre-draft check: when the user picks a topic, `src/lib/composer-prompt.ts` or a new helper queries the ledger for concepts/analogies likely to come up; surfaces the top 3 matches as an advisory panel above the generated drafts.
- [ ] Advisory panel shows: "You've explained `topic concept` 4 times in the last 90 days" + "Analogies used: rainforest ecosystem (5x), factory assembly line (2x)" + "Consider a fresh angle."
- [ ] Sidebar link added for `/dashboard/understand/concepts` under Understand section.
- [ ] Empty state (no ledger rows) → "Build your concept library" CTA that calls `/api/concept-library/rebuild`.

## Design Reference
- **Components**: shadcn `Table`, `Badge`, `Input`, `Drawer` or `Collapsible`.
- **Layout**: max-width Understand container; advisory panel in Composer uses existing `Card` chrome.
- **Colors**: reuse-risk palette aligns with freshness verdict palette (green/yellow/red) for consistency.

## Visual Reference
At `/dashboard/understand/concepts`, a page titled "Concept Library" shows a search input and a sortable table with ~100 rows — each row has a concept name in bold, the first-seen post link, a small count, a comma-separated analogy list, a colored reuse-risk chip, a last-used date, and a related cluster tag. Clicking a row drops down an inline drawer listing every post where the concept appeared, each linkable. Over in the Composer (Create > Compose), right above the generated drafts, a muted advisory card reads: "Heads up — you've explained 'cognitive load' 4 times in the last 90 days. Analogies used: 'rainforest ecosystem' (5x), 'assembly line' (2x). Consider a fresh angle." This panel is dismissible but non-blocking.

## Implementation Notes
- The Composer check is a read-only query — no LLM call. Just match topic keywords against `concept_ledger.concept` and surface the hits.
- Keyword match first; if no direct hit, do a small embedding-based lookup reusing `topic-model.ts` clusters — but only if the cheap match finds nothing.
- Advisory panel must be dismissible to avoid annoying users who are intentionally doubling down on a concept.
- Table pagination: 50 rows per page; concept lists can be long.
- Drawer content fetches posts lazily when expanded.

## Testing
- Concepts page renders with real ledger data → search narrows results, sort orders work.
- Expand a row → inline drawer loads posts.
- Compose on a topic the user has covered before → advisory panel appears.
- Dismiss the panel → stays dismissed for the session.
- Empty ledger → empty state CTA runs the rebuild and refreshes the table.
- Sidebar link routes correctly.
