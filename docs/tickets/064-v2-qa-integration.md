# [TICKET-064] v2 QA & Integration Pass

## Status
`pending`

## Dependencies
- Requires: #048-#063

## Description
Comprehensive QA pass across the entire v2 redesign. Verify all cross-page flows work end-to-end, all redirects resolve correctly, responsive layouts render properly at all breakpoints, accessibility standards are maintained, and no regressions exist from the migration. This is the final gate before shipping the v2 redesign.

## Acceptance Criteria
- [ ] **Navigation**: All sidebar links navigate correctly; active states match current URL; section labels render
- [ ] **Redirects**: All 5 old routes redirect to correct new locations; no infinite redirect loops
- [ ] **Today Hub**: All 4 summary cards render with real data; empty states for new accounts; alerts conditional
- [ ] **Understand Performance**: Table sorts/filters/paginates; timing sidebar sticky; format analysis below
- [ ] **Understand Audience**: Follower chart + demographics 2-col; collapsible sections animate
- [ ] **Insights**: Treemap renders proportionally; bar chart sorted; topic pills colored
- [ ] **Discover**: Topic suggestions, Grok trends, YouTube cards, quick actions all render
- [ ] **Scanner → Compose flow**: Scan draft → "Generate better version" → Composer with topic pre-filled
- [ ] **Post → Scanner flow**: Expand post → "Scan this post" → Scanner with text pre-filled
- [ ] **Discover → Compose flow**: Click any "Compose" button → Composer with topic pre-filled
- [ ] **Responsive**: Test at 375px, 768px, 1024px, 1440px — no overflow, no broken layouts
- [ ] **Accessibility**: Tab through all interactive elements; screen reader announces page titles; focus rings visible; reduced-motion respected
- [ ] **Performance**: No new layout shifts (CLS); sidebar doesn't cause hydration mismatches
- [ ] **Data integrity**: All metrics compute correctly (WES, engagement rate, cadence, topic clusters)

## Implementation Notes
- This is a testing/verification ticket, not a feature ticket
- Fix any bugs found during QA in this ticket
- If bugs are complex, create separate fix tickets and block this one

## Testing
- Full manual walkthrough of every page and flow
- Test with real Threads data (not just mock)
- Test with empty account (no posts)
- Test with large account (100+ posts)
- Browser DevTools responsive mode for breakpoint testing
- Lighthouse accessibility audit on each page
