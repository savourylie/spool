# [TICKET-069] Brand Voice UI Panel

## Status
`pending`

## Dependencies
- Requires: #066 ✅, #068 ✅

## Description
Ship the user-facing Brand Voice page at `/dashboard/understand/voice`. Displays the 11-dimension profile as an accordion with 2–3 real post excerpts per dimension, a confidence badge, and a "Refresh voice" button that invokes `/api/brand-voice/refresh`. This is the surface where the user answers "does this look like me?" and is the visible proof that the Composer's output (once wired in #070) is actually on-voice.

## Acceptance Criteria
- [ ] New route `/dashboard/understand/voice/page.tsx` fetches the user's profile via server component and renders the panel.
- [ ] New component `src/components/dashboard/brand-voice-panel.tsx` renders an accordion with one section per dimension. Each section shows: the pattern summary, 2–3 blockquoted excerpts, and a link to the source post.
- [ ] Page header shows `<ConfidenceBadge />` reflecting `source_post_count` from the profile row.
- [ ] When `confidence_tier === "directional"` (under 10 posts), a banner above the accordion reads "This profile is directional — we need 10+ posts to drive composition. The Composer won't use this profile yet." and the button label becomes "Refresh (directional)".
- [ ] "Refresh voice" button calls `POST /api/brand-voice/refresh` with optimistic UI; shows streaming progress or a spinner; disables while in-flight.
- [ ] Empty state (no profile yet): renders a hero-style card with "Extract your brand voice" CTA that runs the refresh endpoint.
- [ ] Sidebar link added for `/dashboard/understand/voice` under Understand section.

## Design Reference
- **Components**: shadcn `Accordion`, `Badge`, `Button`, `Card`.
- **Layout**: max-width container matching existing Understand pages.
- **Colors**: tier-colored banner; neutral body with excerpt blockquotes styled as quiet secondary.

## Visual Reference
Landing at `/dashboard/understand/voice` shows a page titled "Your Brand Voice" with a green `Strong · 47 posts` pill in the header. Below that, an accordion with 11 collapsed rows — "Sentence Structure", "Tone Switching", "Emotional Expression", etc. Expanding a row reveals a one-sentence pattern description (e.g., "Short sentences under 10 words, ~45% of your posts") followed by 2–3 gray-bordered blockquotes with the real post text and a muted "View post →" link. A "Refresh voice" button sits top-right. On a 3-post account, an amber banner sits above the accordion explaining that the profile is directional and the Composer won't use it yet.

## Implementation Notes
- Use TanStack Query for the refresh flow to get caching + loading states for free.
- The accordion should be multi-open (several dimensions expanded at once) so users can compare.
- Server component fetches profile; client component handles the refresh button — split at the panel boundary.
- Reuse the existing Understand page layout/chrome; don't build a new shell.

## Testing
- Navigate to `/dashboard/understand/voice` with a populated profile → accordion renders 11 sections with excerpts.
- Click "Refresh voice" → loading state → new profile data replaces the UI.
- Seed a user with 3 posts → directional banner shows, button disabled message matches.
- No-profile state → empty-state CTA runs the extraction end-to-end.
- Sidebar shows new link; click routes correctly.
