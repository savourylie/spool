# [TICKET-044] Topic Suggestions

## Status
`done`

## Dependencies
- Requires: #042 ✅, #033 ✅

## Description
Build the Topic Suggestion Engine — analyzes the user's top-performing posts to extract core topics, then uses the LLM to generate semantically adjacent topic suggestions scored by audience relevance and semantic distance. Integrates into the Composer's right panel as a "Suggested Topics" card.

## Acceptance Criteria
- [x] `generateTopicSuggestions()` analyzes top-performing posts, extracts core topics (reusing `topic-classification.ts`), and calls the LLM to suggest adjacent topics
- [x] Each suggestion includes: topic name, relevance score (0-100), and semantic distance indicator (near/medium/far)
- [x] `TopicSuggestions` component renders as a card in the Composer's right panel showing 5-8 suggestions
- [x] Clicking a suggestion populates the Composer's topic input and triggers draft generation
- [x] Suggestions refresh when the user's post data changes significantly
- [x] Empty state when insufficient posts for topic extraction (< 5 posts with topic_tag)

## Design Reference
- **Components**: § Components > Cards ("Sticker Card")
- **Colors**: § Tokens > Colors — `quaternary` for near distance, `tertiary` for medium, `muted-foreground` for far

## Visual Reference
In the Composer's right panel (below the prediction widget): a card titled "Suggested Topics". Each suggestion is a clickable row with the topic name, a small relevance score bar (e.g., 85%), and a colored dot indicating semantic distance (green = near your focus, yellow = moderate stretch, gray = new territory). Clicking a row highlights it and populates the topic input.

## Implementation Notes
- Create `src/lib/topic-suggestions.ts`:
  - `generateTopicSuggestions(userPosts, topicClusters)` — core function
  - Extracts core topics using `extractTopics()` from `topic-classification.ts` (#033)
  - Constructs LLM prompt asking for adjacent topic suggestions with scoring rationale
  - LLM response parsed into typed `TopicSuggestion[]`
  - Types: `TopicSuggestion { name, relevanceScore, semanticDistance, rationale }`
  - `semanticDistance`: `"near" | "medium" | "far"` based on LLM assessment
- Create `src/components/dashboard/topic-suggestions.tsx`:
  - Client component accepting user's posts and rendering suggestions
  - Fetches suggestions on mount (or receives from parent)
  - Each row is clickable with hover state (accent/5 background)
  - Click callback: `onSelectTopic(topicName)` — parent (composer) handles populating input
- Modify `src/components/dashboard/composer.tsx`:
  - Import and render `<TopicSuggestions>` in the right panel below `<PredictionWidget>`
  - Wire `onSelectTopic` to populate the topic input and optionally auto-trigger generation
- Per UX_DESIGN.md §10.6: click to populate topic selector, scored suggestions

## Testing
- Run `npm run dev` and navigate to `/dashboard/compose`
- Topic suggestions card renders in the right panel with 5-8 items
- Click a suggestion: topic input populates with the selected topic
- With few posts: empty state or reduced suggestions
- Relevance scores and distance indicators render correctly
- Mobile: suggestions card stacks below drafts section
