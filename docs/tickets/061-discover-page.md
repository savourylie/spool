# [TICKET-061] Discover Page Assembly

## Status
`pending`

## Dependencies
- Requires: #049 ✅, #059 ✅, #060

## Description
Build the Discover page at `/dashboard/create` as the landing page for the Create section. This page assembles topic suggestions, Grok trending, YouTube inspiration, and quick-action entry points (Quick Scan + Quick Compose) into a cohesive "What Next" view. The page surfaces content opportunities from multiple sources and provides quick paths to the full Scanner and Composer.

## Acceptance Criteria
- [ ] `/dashboard/create` renders the Discover page
- [ ] Page title: "Discover" with subtitle "Find inspiration and create your next post."
- [ ] Top row (2-column): `TopicSuggestions` (standalone card, extracted from Composer) + `GrokTrending`
- [ ] Middle section (full width): `YouTubeInspiration` with 3-card grid
- [ ] Bottom row (2-column): `QuickScan` + `QuickCompose`
- [ ] `QuickScan`: textarea with placeholder + quality gauge + "Open full scanner →" link to `/dashboard/create/scanner`
- [ ] `QuickCompose`: topic input + "Generate" button + "Open full composer →" link to `/dashboard/create/compose`
- [ ] `TopicSuggestions` extracted as standalone card (currently embedded in Composer right panel) — shows near/medium/far topics with "Compose" buttons
- [ ] All "Compose" buttons pre-fill the topic via `?topic=` query param
- [ ] Server-side data fetching for topic suggestions (reuse existing `topicSuggestions()` from `lib/topic-suggestions.ts`)
- [ ] `GrokTrending` and `YouTubeInspiration` fetch client-side on mount

## Design Reference
- **Mockup**: Pencil file — Screen 6 "Create - Discover"

## Implementation Notes
- Key files: `src/app/dashboard/create/page.tsx` (new), `src/components/dashboard/quick-scan.tsx`, `src/components/dashboard/quick-compose.tsx`
- `TopicSuggestions` needs to be extracted from `composer.tsx` into a standalone card that works both in the Composer and on the Discover page
- `QuickScan` is a stripped-down version of `QualityScanner` — just textarea + heuristic score gauge, no LLM analysis
- `QuickCompose` is just a topic input + style selector + generate button — submitting navigates to full Composer

## Testing
- `npm run dev` → `/dashboard/create`
- All sections render: topic suggestions, Grok trends, YouTube videos, quick actions
- "Compose" buttons navigate with `?topic=` param
- "Open full scanner/composer" links work
- Responsive layout: single column on mobile
