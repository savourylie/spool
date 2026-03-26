# [TICKET-055] Understand Audience Page

## Status
`pending`

## Dependencies
- Requires: #049 ✅

## Description
Build the Understand Audience page at `/dashboard/understand/audience`. This relocates `FollowerChart` and `DemographicsCharts` from the old `/dashboard/audience` route into a 2-column top section, with `SemanticFocus` and `AudienceFit` remaining as collapsible sections below (they will also appear on the Insights page — shared components). The collapsible sections show a summary metric in the header when collapsed.

## Acceptance Criteria
- [ ] `/dashboard/understand/audience` renders the audience page
- [ ] Top section: 2-column grid with `FollowerChart` (left) + `DemographicsCharts` (right)
- [ ] Below: `SemanticFocus` in a collapsible card (collapsed by default, summary score visible in header)
- [ ] Below: `AudienceFit` in a collapsible card (collapsed by default, summary score visible in header)
- [ ] Collapsible animation using Framer Motion `AnimatePresence` + height animation
- [ ] Collapse/expand triggered by clicking the card header (keyboard accessible)
- [ ] Server-side data fetching mirrors existing `/dashboard/audience/page.tsx`
- [ ] All existing component functionality preserved

## Implementation Notes
- Key file: `src/app/dashboard/understand/audience/page.tsx` (new)
- Data fetching: copy from existing `audience/page.tsx` (7 parallel queries)
- Collapsible wrapper: create a `CollapsibleCard` utility component or use inline state
- `SemanticFocus` and `AudienceFit` may also be rendered on the Insights page (#058) — keep them as shared components

## Testing
- `npm run dev` → `/dashboard/understand/audience`
- Follower chart and demographics render in 2-column layout
- Collapsible sections expand/collapse with animation
- Collapsed state shows summary score in header
- All data loads correctly from existing queries
