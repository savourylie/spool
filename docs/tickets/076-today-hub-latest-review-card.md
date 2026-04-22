# [TICKET-076] Today Hub "Latest Review" Card

## Status
`blocked`

## Dependencies
- Requires: #074

## Description
Add a new card to Today Hub that surfaces the most recent prediction-vs-actual review: the post, the band verdict, the actual vs predicted deltas, and one key learning from the narrative. Completes the review loop — every time the user opens Today Hub, the hero reminder is "here's what your last post taught us." Includes a graceful empty state for users with no reviews yet.

## Acceptance Criteria
- [ ] New component `src/components/dashboard/latest-review-card.tsx` renders the most recent `post_predictions` row where `review_state = 'reviewed'`.
- [ ] Card shows: post excerpt (2 lines max, truncated), band verdict chip matching the palette from #075, one-line key learning pulled from the narrative (first sentence), and "See full review →" link to `/dashboard/understand/reviews`.
- [ ] Card integrated into `src/app/dashboard/page.tsx` in the primary card grid, positioned after `BestPostCard` and before `WhatToPostCard`.
- [ ] Empty state (no reviewed rows): card displays "Your first review lands here after your next published post."
- [ ] Loading state (skeleton) while server component fetches.
- [ ] `<ConfidenceBadge />` shown on the predicted-range detail if the user expands the card.

## Design Reference
- **Components**: reuses Today Hub `StickerCard` chrome; shadcn `Badge` for the band verdict; existing skeleton pattern from other Today Hub cards.
- **Layout**: card sits in the 2-col grid; full-width on mobile.
- **Colors**: band verdict colors match #075.

## Visual Reference
Today Hub's primary grid now shows a third card titled "Latest review" between `BestPostCard` and `WhatToPostCard`. The card shows a green `Baseline` chip in the top-right, a 2-line post excerpt in bold, a small horizontal bar comparing predicted vs actual engagement rate with a delta arrow, and a muted one-line learning — e.g., "Strong reply velocity in the first 3 hours drove this above the predicted band." Bottom-right has a quiet "See full review →" link. On an account with no reviews, the card shows a single paragraph empty state and no chart.

## Implementation Notes
- Server component fetches the single row; no client state needed.
- Excerpt truncation reuses the Today Hub helper for consistent behavior.
- Link to reviews page uses the route from #075; dead-link gracefully until that lands (the ticket order enforces #074 → #076 → then #075 can ship in any order).
- Actually: since #075 depends on this loop working, the dead-link window is short. Still handle the 404 by prefetching on link hover.
- Keep card payload ≤ one DB query — no cross-joining just for this card.

## Testing
- Today Hub with ≥1 reviewed row → card renders correctly with excerpt, chip, delta, learning, link.
- Zero reviews → empty state, no errors.
- Click "See full review" → routes to `/dashboard/understand/reviews` (404 OK until #075).
- Mobile viewport → card stacks full-width; no overflow.
- Skeleton shows during the server component's first render.
