# [TICKET-040] Content Quality Scanner UI

## Status
`blocked`

## Dependencies
- Requires: #038 ✅, #039

## Description
Replace the Scanner tab's "Coming Soon" stub with the full Content Quality Scanner interface. Provides a text input area for draft or existing post text, real-time analysis via both heuristic (instant, client-side) and LLM (streamed, server-side) layers, a quality score gauge, and a list of flagged issues with suggested rewrites.

## Acceptance Criteria
- [ ] Scanner page at `/dashboard/scanner` shows a text input area instead of the "Coming Soon" empty state
- [ ] Typing triggers analysis after 500ms debounce: heuristic results appear instantly, LLM results stream in after
- [ ] Quality score gauge (semicircular, 0-100) renders below the text input with color zones: 0-40 red, 40-70 yellow, 70-100 green
- [ ] Gauge updates in real-time: initially shows heuristic score, refines when LLM analysis completes
- [ ] Flagged issues list shows each issue with severity badge (high: red, medium: yellow, low: blue), description, and suggested fix
- [ ] LLM-generated rewrites appear with an "Apply" button that replaces the text in the input area
- [ ] "Analyze existing post" button opens a post selector (using existing post data), populating the input and running analysis
- [ ] Empty state when text input is empty: "Type or paste a draft post to analyze"
- [ ] Loading state during LLM analysis: spinner indicator next to the gauge
- [ ] Character count shown below text input (for awareness of post length impact)

## Design Reference
- **Components**: § Components > Cards ("Sticker Card") for the main scanner card, § Components > Inputs for the text area
- **Colors**: § Tokens > Colors — `destructive` for 0-40 score, `tertiary` for 40-70, `quaternary` for 70-100
- **Shadows**: § Shadows — hard shadow on focused input

## Visual Reference
At `/dashboard/scanner`: a full-width StickerCard containing a large text area at the top. Below, a semicircular gauge shows the quality score (e.g., "78") with a green arc. Below the gauge, a scrollable list of issues — each with a colored severity badge (e.g., red "HIGH"), description text, and a blue "Apply fix" button for rewrites. At the top-right of the card, an "Analyze existing post" link. Character count "142 / 500" below the text area.

## Implementation Notes
- Rewrite `src/app/dashboard/scanner/page.tsx` — server component that fetches user's posts list (for "Analyze existing post" selector) and passes to client component
- Create `src/components/dashboard/quality-scanner.tsx` — client component managing:
  - Text state with controlled input
  - Debounced analysis trigger (500ms after last keystroke)
  - Heuristic analysis via `analyzeHeuristics()` from `quality-heuristics.ts` (runs synchronously on client)
  - LLM analysis via `fetch('/api/scanner', { method: 'POST', body: ... })` with SSE stream parsing
  - Score merging: combine heuristic + LLM issues, compute final score
  - "Apply" button replaces input text with suggested rewrite
- Quality gauge: SVG semicircle with stroke-dasharray for the arc, colored segments
- Post selector for "Analyze existing post": simple dropdown/modal listing recent posts (text_preview + date), on select → populate text area
- Update `src/lib/dashboard-empty-state-copy.ts` — update scanner copy to remove "Coming soon" language (or remove the function entirely since the empty state is now "Type or paste a draft post")
- Per UX_DESIGN.md §9.2-9.5 for full interaction specification

## Testing
- Run `npm run dev` and navigate to `/dashboard/scanner`
- Type text: heuristic analysis runs instantly, gauge updates
- Type engagement bait: issues appear with red severity badges
- Wait for LLM analysis: gauge refines, additional issues/rewrites appear
- Click "Apply" on a rewrite: text area updates
- Click "Analyze existing post": post selector opens, selecting a post populates the input
- Empty text area: placeholder message shown
- Mobile: full-width layout, gauge and issues stack vertically
