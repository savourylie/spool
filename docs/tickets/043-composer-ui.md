# [TICKET-043] AI Content Composer UI

## Status
`blocked`

## Dependencies
- Requires: #040 ✅, #041 ✅, #042

## Description
Replace the Compose tab's "Coming Soon" stub with the full AI Content Composer interface. A three-panel layout where users provide a topic, receive AI-generated draft variations streamed in real-time, and see quality scores and engagement predictions for each draft. The composer integrates the Quality Scanner and Prediction Widget, creating the capstone Phase 3 feature.

## Acceptance Criteria
- [ ] Compose page at `/dashboard/compose` shows a three-panel layout instead of the "Coming Soon" empty state
- [ ] **Left panel**: Topic input (text field or "Generate ideas for me" button) and optional style selector
- [ ] **Center panel**: Streaming draft cards (2-3 variations) appear as text generates token-by-token
- [ ] **Right panel**: Quality score from scanner, predicted engagement widget, timing recommendation (best posting time from heatmap data)
- [ ] Each draft card shows: generated text, share-trigger category label, inline quality score badge, "Copy to clipboard" button, "Regenerate" button, inline edit mode toggle
- [ ] "Copy to clipboard" copies the draft text (primary CTA — v1 is copy-paste only, no direct publishing)
- [ ] "Stop generating" button cancels mid-stream
- [ ] Each completed draft auto-runs through heuristic quality analysis
- [ ] Drafts appear in sequence (first starts immediately, subsequent drafts after previous completes)
- [ ] Responsive: panels stack vertically on mobile (topic → drafts → scoring)

## Design Reference
- **Components**: § Components > Cards ("Sticker Card") for draft cards, § Components > Buttons for primary CTAs
- **Layout**: § Layout — three-column on desktop, single-column on mobile
- **Colors**: § Tokens > Colors — `accent` for primary actions, `secondary`/`tertiary`/`quaternary` for share-trigger category labels

## Visual Reference
At `/dashboard/compose`: Left panel (narrow) with a text input "What do you want to post about?" and a "Generate" candy button. Center panel (wide) with 2-3 StickerCards, each containing streaming text with a typing cursor, a category badge (e.g., "Counterintuitive Insight"), quality score pill, "Copy" and "Regenerate" buttons. Right panel (narrow) with a stacked quality gauge, prediction range bar, and "Best time to post: Tue 9 AM" recommendation.

## Implementation Notes
- Rewrite `src/app/dashboard/compose/page.tsx` — server component that fetches user context (top posts, demographics, heatmap best times, last post time) and passes to client component
- Create `src/components/dashboard/composer.tsx` — main client component managing:
  - Topic/style input state
  - SSE stream connection to `/api/compose`
  - Stream parsing: split incoming text into individual drafts based on event structure
  - Generation state machine: idle → generating → complete
  - "Stop generating": abort the fetch/stream
- Create `src/components/dashboard/draft-card.tsx` — individual draft card component:
  - Streaming text display with cursor animation (blinking `|` at end during streaming)
  - Share-trigger category label as a colored badge
  - Quality score: run `analyzeHeuristics()` on the draft text after completion
  - "Copy to clipboard": `navigator.clipboard.writeText()` with success feedback
  - "Regenerate": re-trigger composition for this slot
  - Inline edit: toggle `contentEditable` or switch to textarea, re-analyze on change
- Integrate `PredictionWidget` from `prediction-widget.tsx` in right panel
- Timing recommendation: reuse heatmap best-times logic (top 3 slots from existing data)
- Update `src/lib/dashboard-empty-state-copy.ts` — update composer copy to remove "Coming soon"
- Per UX_DESIGN.md §10.2-10.4 for full interaction specification

## Testing
- Run `npm run dev` and navigate to `/dashboard/compose`
- Enter a topic and click Generate: drafts stream in with typing cursor effect
- Click "Copy to clipboard": text copied, visual feedback shown
- Click "Stop generating" mid-stream: generation halts
- Click "Regenerate" on a draft: that draft re-generates
- Right panel shows quality score and prediction that update per draft
- Mobile: panels stack vertically, all functionality accessible
- Without LLM API key: appropriate error state
