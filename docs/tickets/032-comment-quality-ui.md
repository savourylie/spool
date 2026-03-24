# [TICKET-032] Comment Quality UI

## Status
`pending`

## Dependencies
- Requires: #031 ✅

## Description
Add a comment quality breakdown to the expandable post row detail, displayed below the sparkline chart. Shows the distribution of reply quality (short/medium/long) and a Discussion Quality Score for each post, helping users understand which posts generate meaningful discussion.

## Acceptance Criteria
- [ ] `CommentQuality` component renders in the post detail expansion below the sparkline chart
- [ ] Horizontal stacked bar shows reply distribution: short (<5 words, muted), medium (5-20 words, tertiary), long (20+ words, quaternary)
- [ ] Discussion Quality Score displays as a bold number (0-100) with a label
- [ ] Summary text: "X meaningful comments (5+ words) out of Y total replies"
- [ ] Loading state while reply data is being fetched
- [ ] Empty state when no replies exist: "No replies yet"
- [ ] Reply data is fetched via API route when the post detail is expanded (lazy-loaded, like the sparkline metrics)

## Design Reference
- **Colors**: § Tokens > Colors — `muted` for short replies, `tertiary` for medium, `quaternary` for long
- **Components**: § Components > Cards — inline section within post detail area

## Visual Reference
In the expanded post row detail on `/dashboard/posts`, below the sparkline chart: a "Comment Quality" subheading, a horizontal stacked bar (gray/amber/green segments proportional to short/medium/long reply counts), the Discussion Quality Score as a bold number, and a text summary of meaningful comment count.

## Implementation Notes
- Create `src/components/dashboard/comment-quality.tsx` — client component that fetches reply data and renders the breakdown
- Modify `src/components/dashboard/post-row-detail.tsx` to render `<CommentQuality postId={post.id} />` below the sparkline section
- Create or extend API route `src/app/api/posts/[postId]/replies/route.ts` — GET endpoint returning reply classification for a post (queries `post_replies` table, runs `classifyReplies()` and `computeDiscussionQualityScore()`)
- Lazy-loaded: only fetches when the row is expanded (follows the sparkline pattern with `useEffect` + fetch)
- Stacked bar: simple div-based bar chart (CSS widths as percentages) — no need for Recharts for this simple visualization
- Per UX_DESIGN.md §6.8: reply breakdown in PostRowDetail, below sparkline

## Testing
- Run `npm run dev` and navigate to `/dashboard/posts`
- Expand a post row that has replies: comment quality section appears below sparkline
- Verify stacked bar proportions match actual reply counts
- Expand a post with no replies: "No replies yet" message
- Expand a post while replies are loading: loading indicator shown
