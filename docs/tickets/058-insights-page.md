# [TICKET-058] Insights Page Assembly

## Status
`pending`

## Dependencies
- Requires: #049 ✅, #057

## Description
Build the Insights page at `/dashboard/insights` that assembles the Topic Model components and relocated analytical components into a cohesive "So What" view. The page shows the topic cluster treemap at the top, topic performance and content focus (relocated `SemanticFocus`) in a 2-column grid below, and audience-topic fit at the bottom. This is the primary home for understanding content patterns.

## Acceptance Criteria
- [ ] `/dashboard/insights` renders the full Insights page
- [ ] Top section: `TopicModelViz` treemap spanning full width
- [ ] Middle section: 2-column grid — `TopicPerformance` (left) + `SemanticFocus` (right, relocated from Audience tab)
- [ ] Bottom section: `AudienceTopicFit` spanning full width
- [ ] Page title: "Topics & Patterns" with subtitle
- [ ] Server-side data fetching: `get_posts_with_metrics` (all posts) + posts with `topic_tag` + demographics for audience-topic fit
- [ ] `buildTopicModel()` called server-side with fetched data, results passed to client components
- [ ] Loading state with skeletons while data fetches
- [ ] Empty state for accounts with <5 posts

## Design Reference
- **Mockup**: Pencil file — Screen 5 "Insights - Topics & Patterns"

## Implementation Notes
- Key file: `src/app/dashboard/insights/page.tsx` (new)
- `SemanticFocus` component is shared between this page and the Audience page (#055) — import from existing location
- Data fetching combines posts + metrics + demographics in parallel
- The `buildTopicModel()` function runs server-side (it's a pure function)

## Testing
- `npm run dev` → `/dashboard/insights`
- Treemap renders with topic clusters
- Performance bars show correct relative sizes
- SemanticFocus displays focus score and topic pills
- Page loads without errors for accounts with varying post counts
