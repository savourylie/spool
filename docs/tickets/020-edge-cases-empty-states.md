# [TICKET-020] Edge Case & Empty States

## Status
`blocked`

## Dependencies
- Requires: #014, #017, #018, #019

## Description
Handle all empty states, edge cases, and data-quality warnings across the dashboard. Every view should gracefully handle missing, insufficient, or unusual data patterns rather than showing blank screens or broken layouts.

## Acceptance Criteria
- [ ] **Posts tab — no posts**: friendly empty state with illustration/icon and "No posts yet. Connect your Threads account to get started." message
- [ ] **Backfill failed**: error state on loading screen with retry button
- [ ] **Token expired**: banner across dashboard "Your Threads connection has expired. Reconnect to continue getting updates." with CTA
- [ ] **API errors**: graceful error states (not raw error dumps) with retry options where applicable
- [ ] All empty states use DESIGN.md styling: playful illustrations/icons, Outfit headings, warm tone

## Design Reference
- **Components**: § Components > Cards (empty state containers)
- **Components**: § Components > Buttons (CTAs in empty states)
- **Tokens**: § Tokens > Colors (`muted-foreground` for empty state text)
- **Iconography**: § Iconography (Lucide icons in colored circles for empty states)

## Visual Reference
Empty states feature a centered Lucide icon inside a large colored circle (using secondary/tertiary/quaternary), a heading in Outfit 700, a descriptive message in Plus Jakarta Sans 400 muted-foreground, and an optional CTA button. The overall feel is friendly and encouraging, not clinical.

## Implementation Notes
- Key files: various components across `app/dashboard/` and `components/`
- Per PRD edge cases: specific copy defined for < 20 posts, same-time posting, < 100 followers
- Create a reusable `EmptyState` component that accepts icon, title, description, and optional CTA
- Token expiry detection: check `users.token_expires_at` on dashboard load
- Consider a `useTokenStatus()` hook that returns `valid | expiring | expired`

## Testing
- Delete all posts for test user → verify posts tab empty state
- Apply impossible filter combination → verify "no matching" state
- Set test user to < 20 posts → verify timing banner
- Set test user to < 100 followers → verify demographics placeholder
- Set `token_expires_at` to past date → verify expired token banner
- Verify all empty states have proper styling and CTAs
