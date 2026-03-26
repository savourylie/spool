# [TICKET-050] Route Structure & Redirects

## Status
`pending`

## Dependencies
- Requires: #049 ✅

## Description
Set up the new route file structure under `/dashboard/*` and add redirects from old routes to new ones. The new structure organizes pages into `/understand`, `/insights`, and `/create` sections. Old routes (`/dashboard/posts`, `/dashboard/timing`, `/dashboard/audience`, `/dashboard/scanner`, `/dashboard/compose`) redirect to their new locations to preserve bookmarks and shared links.

## Acceptance Criteria
- [ ] New route directories created: `dashboard/understand/`, `dashboard/understand/audience/`, `dashboard/insights/`, `dashboard/create/`, `dashboard/create/scanner/`, `dashboard/create/compose/`
- [ ] Each new route has a placeholder `page.tsx` that renders a basic title (e.g., "Performance", "Insights")
- [ ] `/dashboard` no longer redirects to `/dashboard/posts` — it renders the Today hub placeholder
- [ ] `/dashboard/posts` redirects to `/dashboard/understand`
- [ ] `/dashboard/timing` redirects to `/dashboard/understand`
- [ ] `/dashboard/audience` redirects to `/dashboard/understand/audience`
- [ ] `/dashboard/scanner` redirects to `/dashboard/create/scanner`
- [ ] `/dashboard/compose` redirects to `/dashboard/create/compose`
- [ ] All redirects use `next/navigation` `redirect()` (server-side, 307)

## Implementation Notes
- Key files: Create new `page.tsx` files in each new route directory; modify old route `page.tsx` files to `redirect()`
- Placeholder pages should be simple server components with a title — real content comes in later tickets
- The existing `dashboard/page.tsx` currently does `redirect("/dashboard/posts")` — change it to render the Today hub placeholder
- Old route files (`posts/page.tsx`, `timing/page.tsx`, etc.) become one-line redirect files until content is migrated

## Testing
- `npm run dev` — navigate to each old route, verify redirect
- Navigate to each new route, verify placeholder renders
- Browser back/forward works with redirects
- Sidebar active state matches new URLs
