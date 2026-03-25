# [TICKET-047] v1 QA & Integration Pass

## Status
`blocked`

## Dependencies
- Requires: #024 ✅, #025 ✅, #026 ✅, #028 ✅, #030 ✅, #032 ✅, #034 ✅, #036 ✅, #040, #043, #044, #045, #046

## Description
Final quality assurance and integration pass for all v1 features. Verify cross-feature interactions, banner stacking order, chart library compliance, responsive behavior, keyboard navigation, screen reader accessibility, reduced-motion handling, and streaming functionality. Ensure no regressions on v0 features.

## Acceptance Criteria
- [ ] **Banner stacking order** correct per UX_DESIGN.md §3.2: token expiry (top) → backfill → viral recovery → reselection (within Posts tab)
- [ ] **Charts** all use shadcn `ChartContainer`/`ChartTooltip`/`ChartTooltipContent` wrappers — no bare Recharts imports
- [ ] **Responsive** all new sections stack correctly on mobile: cards full-width, composer panels stack vertically, touch targets ≥ 48px
- [ ] **Keyboard navigation** works for: cadence scatter chart, format analysis chart, reselection alert dismiss, viral recovery dismiss, scanner text input, composer topic input, draft card actions, topic suggestion selection
- [ ] **ARIA attributes** present on all new interactive elements: role, aria-label, aria-expanded, aria-current as appropriate
- [ ] **Reduced motion** (`prefers-reduced-motion`): all new animations degrade gracefully — no bounce, no wiggle, fall back to instant state changes
- [ ] **4-state machine** all new data-driven sections correctly implement loading → success / error / empty states
- [ ] **Scanner streaming** works end-to-end: type text → heuristic results appear → LLM results stream in → gauge updates → issues list populates
- [ ] **Composer streaming** works end-to-end: enter topic → drafts stream → cursor animation → quality scores appear → copy-to-clipboard works
- [ ] **No v0 regressions**: post table sorting/filtering, heatmap, follower chart, demographics, backfill progress, OAuth flow all still work
- [ ] **Empty states** show correct copy for all new sections when no data exists
- [ ] **Token expiry** banner still renders correctly above all new content

## Implementation Notes
- This is a cross-cutting verification ticket — primarily manual testing with targeted fixes
- Walk through each dashboard tab and verify all new features:
  - Posts: reselection alert, format analysis card, velocity indicators, comment quality in detail
  - Timing: cadence optimizer section
  - Audience: semantic focus, audience fit sections
  - Scanner: full scanner flow
  - Compose: full composer flow with topic suggestions
- Check banner rendering in dashboard layout with various combinations (viral + backfill, token expiry + viral, etc.)
- Run `grep -r "from 'recharts'" src/` to verify no bare Recharts imports
- Test with browser devtools: mobile viewport (375px), reduced-motion simulation
- Screen reader testing: use VoiceOver (macOS) or browser a11y inspector
- Fix any issues found during the QA pass

## Testing
- Run `npm run dev` and systematically test every new feature on every tab
- Test mobile viewport (375px, 768px)
- Test with `prefers-reduced-motion: reduce`
- Test keyboard-only navigation through all new interactive elements
- Run browser accessibility inspector on each page
- Verify all v0 features still work (post table, heatmap, follower chart, demographics, backfill, auth)
