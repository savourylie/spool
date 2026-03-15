# [TICKET-015] Post Table Filters & Sorting

## Status
`blocked`

## Dependencies
- Requires: #014

## Description
Add filtering controls to the post performance table: media type multi-select filter and date range picker. These allow users to slice their post data to find patterns in specific content types or time periods.

## Acceptance Criteria
- [ ] Media type filter: multi-select for Text, Image, Video, Carousel
- [ ] All types selected by default; deselecting filters the table in real-time
- [ ] Date range picker: start date and end date inputs
- [ ] Date range defaults to "All time" (no constraint)
- [ ] Filters persist across pagination (page resets to 1 when filter changes)
- [ ] Active filters shown as removable chips/badges
- [ ] "Clear all filters" button resets to defaults
- [ ] Filters work in combination (e.g., "Image posts from last 30 days")
- [ ] Filter UI uses DESIGN.md Input and Button component styles
- [ ] URL query params encode filter state (shareable/bookmarkable)
- [ ] When no posts match active filters, display empty state: "No posts match your filters. Try adjusting your criteria." with clear filters button

## Design Reference
- **Components**: § Components > Inputs (date picker styling)
- **Components**: § Components > Buttons > Secondary (filter chips, clear button)
- **Tokens**: § Tokens > Radius > `radius-sm` (badges/chips), `radius-md` (inputs)

## Visual Reference
Above the post table, a filter bar shows a multi-select dropdown for media types (with checkboxes for Text, Image, Video, Carousel) and two date inputs (From / To) with the DESIGN.md input styling. Active filters display as small pill-shaped badges with an "×" to remove. A "Clear all" secondary button appears when any filter is active.

## Implementation Notes
- Key files: `components/post-filters.tsx`, update `app/dashboard/posts/page.tsx`
- Per PRD: "Filter by media type (multi-select) and date range picker"
- Consider using `nuqs` or `useSearchParams` for URL-based filter state
- Media type filter: checkbox group or multi-select dropdown
- Date range: use native date inputs styled per DESIGN.md, or a shadcn/ui date picker

## Testing
- Select only "Image" media type → verify table shows only image posts
- Set date range to last 7 days → verify only recent posts shown
- Combine filters → verify both apply
- Clear filters → verify table returns to full view
- Change filter → verify pagination resets to page 1
- Refresh page → verify filters persist via URL params
