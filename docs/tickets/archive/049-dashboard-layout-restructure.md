# [TICKET-049] Dashboard Layout Restructure

## Status
`done`

## Dependencies
- Requires: #048 ✅

## Description
Restructure `src/app/dashboard/layout.tsx` from the current header + horizontal tabs + centered container layout to a sidebar + content shell layout. The `DashboardHeader` and `DashboardTabs` are replaced by the new `DashboardSidebar`. The content container widens from `max-w-6xl` to `max-w-7xl` to compensate for sidebar width. Banners (token expiry, backfill) remain in the main content area. `ViralRecoveryCard` moves out of the layout (will be placed in Today hub in #052).

## Acceptance Criteria
- [x] `dashboard/layout.tsx` uses a horizontal flex layout: `<DashboardSidebar>` + `<main>` content area
- [x] `DashboardHeader` component removed from layout (absorbed into sidebar)
- [x] `DashboardTabs` component removed from layout (replaced by sidebar)
- [x] Content area uses `max-w-7xl` (up from `max-w-6xl`)
- [x] `TokenExpiryBanner` and `DashboardBackfillBanner` remain at top of content area
- [x] `ViralRecoveryCard` removed from layout (will be relocated to Today hub in #052)
- [x] All existing dashboard pages still render correctly within the new shell
- [x] Layout passes `min-h-screen` with proper flex sizing

## Visual Reference
The dashboard now shows a 240px sidebar on the left with the main content area filling the remaining width. Banners stack at the top of the content area. The old header bar and horizontal tab navigation are gone.

## Implementation Notes
- Key files: `src/app/dashboard/layout.tsx` (major rewrite)
- `DashboardHeader` and `DashboardTabs` files can be kept but are no longer imported in layout
- Data fetching in layout.tsx (user info, backfill job, viral recovery) should be preserved — viral recovery data still fetched but not rendered here (passed to Today hub later)
- The `children` prop renders inside the main content area

## Testing
- `npm run dev` — navigate to any `/dashboard/*` route
- Sidebar visible on left, content on right
- Token expiry and backfill banners still appear when applicable
- No visual regressions on existing pages (posts, timing, audience, scanner, compose)
