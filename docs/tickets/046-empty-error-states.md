# [TICKET-046] Phase 2 Empty & Error States

## Status
`blocked`

## Dependencies
- Requires: #030 ✅, #032 ✅, #034 ✅, #036

## Description
Add comprehensive empty states, error states, and loading skeletons for all Phase 2 UI components. Ensures every new data-driven section implements the 4-state machine (loading → success / error / empty) and correctly handles the `isImporting` flag for backfill-in-progress copy variants.

## Acceptance Criteria
- [ ] Velocity Indicator (#030): graceful absence when no velocity data exists (no badge, no error)
- [ ] Comment Quality (#032): loading skeleton while fetching replies, "No replies yet" empty state, error state on fetch failure
- [ ] Semantic Focus (#034): loading skeleton, "Not enough posts for topic analysis" empty state (< 10 posts with text_full), error state
- [ ] Audience Fit (#036): loading skeleton, "Not enough demographic history" empty state (< 2 snapshots), error state
- [ ] All empty states show `isImporting` variant when backfill is in progress ("Importing your posts" copy)
- [ ] All loading states use pulse-animated `bg-muted` skeleton bars within StickerCard (matches existing pattern)
- [ ] Empty state copy added to `dashboard-empty-state-copy.ts` for each new section
- [ ] Screen reader attributes (`role="status"`, `aria-label`) on all loading skeletons

## Design Reference
- **Components**: § Components > Cards — skeleton within StickerCard pattern

## Visual Reference
Each Phase 2 section shows a skeleton loading state (gray pulsing bars in the shape of the content) while data loads. When no data is available, a centered EmptyState with a colored icon, descriptive title, and helpful description. When data fetch fails, an ErrorState with a "Try again" button.

## Implementation Notes
- Add empty state copy functions to `src/lib/dashboard-empty-state-copy.ts`:
  - `getVelocityEmptyStateCopy(isImporting)` — not needed (velocity indicator simply doesn't render)
  - `getCommentQualityEmptyStateCopy(isImporting)` — title: "No replies yet" / "Importing replies..."
  - `getSemanticFocusEmptyStateCopy(isImporting)` — title: "Not enough posts for topic analysis" / "Analyzing your topics..."
  - `getAudienceFitEmptyStateCopy(isImporting)` — title: "Not enough demographic history" / "Building your audience profile..."
- Each copy function follows the existing pattern: returns `{ title: string; description: string }`
- Loading skeletons: add skeleton variants to each Phase 2 component (div elements with `animate-pulse bg-muted rounded` classes)
- Error states: use the existing `ErrorState` component with tab-specific descriptions
- Follow UX_DESIGN.md §3.1 (Component State Machine) for all states

## Testing
- Run `npm run dev` and verify each Phase 2 section:
  - With data: content renders normally
  - With no data: empty state with appropriate copy
  - During backfill: importing variant copy
  - On fetch error: error state with retry button
  - While loading: skeleton animation visible
