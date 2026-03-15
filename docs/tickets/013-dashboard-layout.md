# [TICKET-013] Dashboard Layout & Tab Navigation

## Status
`blocked`

## Dependencies
- Requires: #003, #004

## Description
Build the authenticated dashboard layout with tab navigation between the three MVP views: Posts, Timing, and Audience. This is a shared layout that wraps all dashboard pages and handles auth state.

## Acceptance Criteria
- [ ] Dashboard layout at `/dashboard` with shared header and tab navigation
- [ ] Three tabs: "Posts" (`/dashboard/posts`), "Timing" (`/dashboard/timing`), "Audience" (`/dashboard/audience`)
- [ ] Active tab indicated with accent color underline or highlight
- [ ] Tab navigation uses Next.js App Router nested layouts
- [ ] Header shows user's Threads username (from `users` table)
- [ ] Header includes a "Disconnect" or "Sign out" option
- [ ] Auth guard: unauthenticated users redirected to `/` (landing page)
- [ ] Layout uses `max-w-6xl` centered container per DESIGN.md
- [ ] Default route `/dashboard` redirects to `/dashboard/posts`
- [ ] Tab transitions feel snappy (no full page reload)

## Design Reference
- **Layout**: § Layout > Container (`max-w-6xl`, centered)
- **Tokens**: § Tokens > Colors (accent for active tab)
- **Typography**: § Tokens > Typography (Outfit for tab labels)
- **Components**: § Components > Buttons (tab styling)

## Visual Reference
The dashboard header spans the full width with the Spool logo/wordmark on the left and the user's Threads username on the right. Below the header, three tabs ("Posts", "Timing", "Audience") are displayed horizontally. The active tab has an accent-colored bottom border. The warm cream background continues. Content area below tabs renders the active tab's page component within the `max-w-6xl` container.

## Implementation Notes
- Key files: `app/dashboard/layout.tsx`, `app/dashboard/page.tsx` (redirect to posts)
- Use Next.js parallel routes or simple nested layout with `usePathname()` for active tab detection
- Auth check: verify user session via Supabase auth or cookie — redirect if missing
- Fetch username from `users` table via server component or API call
- Consider prefetching tab content for instant navigation

## Testing
- Navigate to `/dashboard` while authenticated → verify redirect to `/dashboard/posts`
- Click each tab → verify URL changes and content area updates without full reload
- Verify active tab has accent-colored indicator
- Verify header shows correct Threads username
- Navigate to `/dashboard` while unauthenticated → verify redirect to `/`
