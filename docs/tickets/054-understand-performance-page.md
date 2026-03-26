# [TICKET-054] Understand Performance Page

## Status
`pending`

## Dependencies
- Requires: #049 ✅, #053

## Description
Build the Understand Performance page at `/dashboard/understand` with a 2-column layout: the post performance table (with filters, reselection alert, pagination) on the left, and a sticky timing sidebar (compact heatmap, best 3 times, compact cadence) on the right. Format analysis renders full-width below the 2-column section. This migrates content from the old `/dashboard/posts` and `/dashboard/timing` routes into a unified view.

## Acceptance Criteria
- [ ] `/dashboard/understand` renders the 2-column performance page
- [ ] Left column (flexible width): `PostFilters` + `ReselectionAlert` + `PostTable` + `Pagination`
- [ ] Right column (300px fixed): compact `TimingHeatmap` + best-3-times list + compact `CadenceOptimizer`
- [ ] Right column is `sticky top-4` so it stays visible while scrolling the table
- [ ] `FormatAnalysis` renders full-width below the 2-column grid
- [ ] Layout: `xl:grid-cols-[1fr_300px]`, single column on smaller screens
- [ ] All existing PostTable functionality preserved: sorting, filtering, URL-driven state, expandable rows, velocity indicators, comment quality
- [ ] "Scan this post" CTA added to expanded post detail rows, linking to `/dashboard/create/scanner`
- [ ] Server-side data fetching mirrors existing `/dashboard/posts/page.tsx` + `/dashboard/timing/page.tsx` queries combined

## Design Reference
- **Mockup**: Pencil file — Screen 3 "Understand - Performance"
- **Layout**: `xl:grid-cols-[1fr_300px]` with sticky right column

## Implementation Notes
- Key file: `src/app/dashboard/understand/page.tsx` (new)
- Merge data fetching from `posts/page.tsx` and `timing/page.tsx` into one `Promise.all`
- Existing components (`PostTable`, `PostFilters`, `Pagination`, `PostRowDetail`, `FormatAnalysis`, `ReselectionAlert`) move as-is — no internal changes
- URL search params for filters/sort/pagination continue to work
- The old `/dashboard/posts` route already redirects here (from #050)

## Testing
- `npm run dev` → `/dashboard/understand`
- Table sorts, filters, paginates correctly
- Timing sidebar visible on desktop, hidden on mobile
- Sticky behavior works on scroll
- Format analysis shows below the grid
- "Scan this post" CTA navigates to scanner
