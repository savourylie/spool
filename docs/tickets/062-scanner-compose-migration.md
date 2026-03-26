# [TICKET-062] Scanner & Compose Migration + Cross-flows

## Status
`pending`

## Dependencies
- Requires: #049 ✅

## Description
Migrate the Scanner and Composer pages to their new routes under `/dashboard/create/` and add cross-flow CTAs that connect the creation workflow. Scanner gets a "Generate a better version" button that opens the Composer with the analyzed topic. Composer accepts a `?topic=` query parameter to pre-populate the topic field from external navigation (Discover page, Scanner, post detail rows).

## Acceptance Criteria
- [ ] `/dashboard/create/scanner` renders the full `QualityScanner` (migrated from `/dashboard/scanner`)
- [ ] `/dashboard/create/compose` renders the full `Composer` (migrated from `/dashboard/compose`)
- [ ] Scanner: after analysis completes, show "Generate a better version →" button that navigates to `/dashboard/create/compose?topic={summary}`
- [ ] Composer: reads `?topic=` from URL search params and pre-populates the topic textarea on mount
- [ ] Pre-populated topic is editable (not locked)
- [ ] Post detail expanded rows: add "Scan this post →" CTA that navigates to `/dashboard/create/scanner` with post text pre-filled
- [ ] Old routes `/dashboard/scanner` and `/dashboard/compose` redirect to new locations (from #050)
- [ ] All existing Scanner and Composer functionality preserved (streaming, quality analysis, draft generation, etc.)
- [ ] Composer timezone fix: use browser timezone instead of UTC for `computeBestTimes()` (addresses SD-1 from UX audit)

## Implementation Notes
- Key files: `src/app/dashboard/create/scanner/page.tsx` (new, copies from old scanner), `src/app/dashboard/create/compose/page.tsx` (new, copies from old compose)
- Scanner cross-flow: extract a 1-sentence summary from the analyzed text to use as the compose topic
- Composer `?topic=`: use `useSearchParams()` in the client component to read and set initial topic
- Post detail CTA: modify `PostRowDetail` component to add a "Scan this post" link
- Timezone fix: change `computeBestTimes(heatmapPosts, "UTC")` to `computeBestTimes(heatmapPosts, browserTimezone)` using `Intl.DateTimeFormat().resolvedOptions().timeZone`

## Testing
- Scanner → Compose flow: scan a draft, click "Generate better version", verify topic pre-filled in Composer
- Direct URL: `/dashboard/create/compose?topic=AI+productivity` — topic field pre-populated
- Post detail → Scanner: expand a post row, click "Scan this post", verify scanner loads with post text
- All existing scanner/composer tests still pass
- Timezone: verify best posting times show in user's local timezone
