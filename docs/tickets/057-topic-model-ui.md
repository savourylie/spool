# [TICKET-057] Topic Model UI Components

## Status
`pending`

## Dependencies
- Requires: #056

## Description
Build the UI components for the Topic Model feature: `TopicModelViz` (treemap/bubble chart showing topic clusters), `TopicPerformance` (horizontal bar chart comparing topics by engagement), and `AudienceTopicFit` (matrix showing which demographics engage with which topics). These components receive pre-computed data from `buildTopicModel()` and render interactive visualizations.

## Acceptance Criteria
- [ ] `TopicModelViz` renders a Recharts `Treemap` with topic clusters — size = post count, color = brand palette per topic
- [ ] Each treemap cell shows topic name + "N posts · X% eng" label
- [ ] Clicking a topic cluster shows a detail panel (slide-over or expandable) with: posts in that cluster, avg metrics, trend
- [ ] `TopicPerformance` renders horizontal bar chart with one bar per topic, sorted by avg engagement
- [ ] Each bar labeled with topic name + "X% avg eng" — bar color matches topic's assigned color
- [ ] `AudienceTopicFit` renders a summary card showing which demographics engage most with each topic (text-based, not full matrix — simplified for v1)
- [ ] All components have loading skeletons and empty states
- [ ] All components use existing chart theming (`ChartContainer` wrapper, brand colors)

## Design Reference
- **Mockup**: Pencil file — Screen 5 "Insights - Topics & Patterns"
- **Treemap**: Large colored blocks with topic labels, nested layout
- **Bars**: Horizontal progress bars with brand colors

## Implementation Notes
- Key files: Create `src/components/dashboard/topic-model-viz.tsx`, `topic-performance.tsx`, `audience-topic-fit.tsx`
- Recharts `Treemap` component for the topic visualization
- Bar chart can use simple styled `<div>` bars or Recharts `BarChart`
- Topic detail panel: use a collapsible section or Framer Motion slide-over
- Colors assigned by `buildTopicModel()` from #056

## Testing
- Render each component with mock TopicModelData
- Verify treemap sizes proportional to post count
- Verify bar chart sorted by engagement
- Click topic in treemap — detail panel appears
- Empty state when no topics available
