# [TICKET-082] v3 QA & Integration Pass

## Status
`blocked`

## Dependencies
- Requires: #065 ✅, #066 ✅, #067 ✅, #068 ✅, #069 ✅, #070 ✅, #071 ✅, #072, #073, #074, #075, #076, #077, #078, #079, #080, #081

## Description
Comprehensive manual QA across the v3 consultant-layer rollout. Verify cross-feature flows end-to-end, confidence badges cover every analytics view, prompt-cache hit rate hits the Phase-1 target, and no regressions exist in v2 surfaces. This is the final gate before declaring v3 shipped.

## Acceptance Criteria
- [ ] **Knowledge foundation**: `src/lib/prompts/` contains all expected files; Scanner + Composer load them; Anthropic request inspection confirms `cache_control` on the knowledge prefix.
- [ ] **Prompt cache hit rate**: after 10 warm-up calls per user, inspected headers show `cache_read_input_tokens > 0.8 × cache_creation_input_tokens` for both Scanner and Composer.
- [ ] **Confidence badges**: present on Understand Performance header, Understand Audience header, Insights page, Today Hub `PulseCard`, `BestPostCard`, `LatestReviewCard`. Tier math matches sample sizes.
- [ ] **Brand voice end-to-end**: refresh extracts profile → `/dashboard/understand/voice` panel renders 11 dimensions with excerpts → Composer output visibly matches dimensions → Scanner emits drift signal on off-voice input.
- [ ] **Freshness gate end-to-end**: Composer pre-draft shows verdict banner → "Compose anyway" bypasses → `freshness_checks` log has the row → Today Hub filter hides red candidates → Reviews page Freshness health section matches.
- [ ] **Prediction → review loop**: Composer saves → `post_predictions` row with `post_id=null` → user "marks as published" or next backfill runs fuzzy match → sweep runs → `reviewed_at` + `narrative` populated → Today Hub "Latest review" card + Reviews page timeline both reflect.
- [ ] **Scanner 4-axis**: `SCANNER_V2_ENABLED=true` → 4 cards render progressively → rule pills link to tooltips → neighbor-post citations visible → "Get rewrite suggestions" routes to Composer with text pre-filled.
- [ ] **AI-tone markers**: at least 3 markers fire on a canonical AI-sounding test paragraph; hover highlights the right spans; remediation actions visible.
- [ ] **Concept library**: `/dashboard/understand/concepts` renders full table → search and sort work → Composer advisory panel fires on a repeated topic.
- [ ] **v2 regressions**: existing Today Hub cards, Understand pages, Insights, Discover, Scanner (with flag off), Composer still work at all breakpoints.
- [ ] **Responsive**: all new pages tested at 375/768/1024/1440 — no overflow, no broken layouts.
- [ ] **Accessibility**: new interactive elements have focus states; screen reader announces page titles; reduced-motion respected.
- [ ] **Data integrity**: cross-feature numbers agree — `freshness_checks` count in Today Hub matches Reviews page; brand voice `source_post_count` matches fetched corpus.

## Implementation Notes
- This is a testing/verification ticket, not a feature ticket.
- File any bugs found as blocker or fix in this ticket — mirror the pattern from #047 and #064.
- Measure prompt-cache hit rate via server logs added in #067.
- Test matrix includes: empty account (no posts), mid-size (20 posts), large (100+ posts), and one account with BYOK OpenAI (cache markers skipped gracefully).

## Testing
- Full manual walkthrough of every new page and cross-feature flow per the acceptance criteria above.
- Test with real Threads data, not mocks.
- Browser DevTools responsive mode at all breakpoints.
- Lighthouse accessibility audit on each new page (`voice`, `concepts`, `reviews`).
- Inspect Anthropic request payloads via dev proxy to confirm `cache_control` placement.
- Run `/api/reviews/sweep` manually and confirm narrative output reads naturally.
