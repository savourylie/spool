# [TICKET-056] Topic Model Library

## Status
`done`

## Dependencies
- Requires: None

## Description
Create `lib/topic-model.ts` that orchestrates topic extraction and metrics aggregation. This library takes all posts with their metrics and topic tags, groups them by topic cluster, and computes per-topic performance statistics (avg views, avg engagement, avg replies, follower impact). It builds on the existing `extractTopics()` and `classifyPostTopic()` from `lib/topic-classification.ts` and the existing `topic_tag` column in the `posts` table.

## Acceptance Criteria
- [x] `lib/topic-model.ts` created with exported function `buildTopicModel(posts: PostWithMetrics[]): TopicModelData`
- [x] `TopicModelData` type includes: `clusters: TopicCluster[]` with `name`, `postCount`, `avgEngagement`, `avgViews`, `avgReplies`, `avgWes`, `topPosts`, `color` (assigned from brand palette)
- [x] Clusters sorted by `postCount` descending (largest topic first)
- [x] `getTopicPerformanceComparison(clusters)` returns sorted bar-chart data for topic × metric comparison
- [x] `getAudienceTopicFit(clusters, demographics)` returns cross-reference of which demographics engage with which topics (when demographic data is available)
- [x] Handles edge cases: posts with no `topic_tag`, fewer than 3 posts per cluster (merged into "Other"), single-topic accounts
- [x] Pure functions, no side effects, no API calls — all computation is synchronous
- [x] Unit tests covering clustering, metric aggregation, and edge cases

## Implementation Notes
- Key file: Create `src/lib/topic-model.ts`
- Reuse `extractTopics()` from `src/lib/topic-classification.ts` for cluster names
- Color assignment: map clusters to brand palette in order (primary, secondary, tertiary, quaternary, muted-foreground for overflow)
- The `topic_tag` column is already populated by the existing classification pipeline

## Testing
- Unit tests: `npm test -- topic-model`
- Test with mock data: 30+ posts across 4 topics
- Test edge case: all posts same topic
- Test edge case: no topic tags populated
