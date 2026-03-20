# [TICKET-014] Post Performance Table

## Status
`pending`

## Dependencies
- Requires: #002 ✅, #013 ✅

## Description
Build the Posts tab content: a sortable, paginated table showing all of the user's posts with their engagement metrics. This is the primary feature of Spool — answering "what content performs best?"

## Acceptance Criteria
- [ ] Posts table renders at `/dashboard/posts`
- [ ] Table columns: Post preview (truncated text + media type icon), Published date, Views, Likes, Replies, Reposts, Quotes, Shares, Engagement rate
- [ ] Post preview: first ~80 chars of text with media type icon (Lucide: FileText, Image, Video, LayoutGrid for carousel)
- [ ] Engagement rate calculated as `(likes + replies + reposts + quotes + shares) / views` per CLAUDE.md decision #5
- [ ] Engagement rate displayed as percentage with 2 decimal places
- [ ] Default sort: by Published date, descending (newest first)
- [ ] Sortable by any metric column (click column header to toggle asc/desc)
- [ ] Pagination: 20 posts per page with page navigation
- [ ] Metrics shown are from the most recent `post_metrics` snapshot for each post
- [ ] Table uses DESIGN.md styling: 2px borders, Outfit headings, proper spacing
- [ ] Empty state if no posts (see #020)

## Design Reference
- **Layout**: § Layout > Container, Grid
- **Typography**: § Tokens > Typography (Outfit for headers, Plus Jakarta Sans for data)
- **Tokens**: § Tokens > Colors (`foreground` for text, `muted` for alternating rows)
- **Components**: § Components > Cards (table container styled as card)

## Visual Reference
A data table inside a Sticker Card container at `/dashboard/posts`. Column headers in Outfit 700 with sort indicators (chevron up/down). Rows alternate between white and muted backgrounds. Media type icons appear as small Lucide icons in colored circles next to truncated post text. Engagement rate column is highlighted with accent color for the top-performing posts. Pagination controls at the bottom use the secondary button style.

## Implementation Notes
- Key files: `app/dashboard/posts/page.tsx`, `components/post-table.tsx`
- Query: join `posts` with latest `post_metrics` per post (use `DISTINCT ON` or window function)
- Engagement rate is computed at query time, not stored
- Consider server-side sorting/pagination for performance with large post counts
- Per PRD: "Display a sortable, paginated table of posts"

## Testing
- Navigate to `/dashboard/posts` with a backfilled account
- Verify all columns display correct data
- Click column headers → verify sort toggles between asc/desc
- Verify engagement rate calculation matches formula
- Navigate between pages → verify pagination works
- Verify media type icons match post types
