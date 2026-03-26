# [TICKET-045] Landing Page & Tabs Update

## Status
`done`

## Dependencies
- Requires: #040 ✅, #043 ✅

## Description
Update the landing page and dashboard tabs to reflect shipped Scanner and Composer features. Remove "Coming Soon" badges from the Scanner and Compose tabs, update landing page feature cards to present these features as active rather than aspirational, and clean up any remaining "coming soon" language in empty state copy.

## Acceptance Criteria
- [x] Scanner and Compose tabs in DashboardTabs no longer show "Soon" badges
- [x] Landing page feature cards for Content Scanner and AI Composer updated with active descriptions (not "Coming soon")
- [x] Any remaining "Coming soon" text in `dashboard-empty-state-copy.ts` for scanner/composer is removed or updated
- [x] Tab icons for Scanner and Compose remain consistent (MagnifyingGlass, PencilLine)
- [x] No visual regressions on the landing page or dashboard tabs

## Design Reference
- **Layout**: § Layout > Section Patterns > Features — landing page feature card grid
- **Components**: § Components > Cards ("Sticker Card") for feature cards

## Visual Reference
On the landing page: feature cards for Scanner and Composer show active descriptions like "Analyze your posts for algorithm anti-patterns" and "Generate algorithm-optimized drafts from your performance data" instead of "Coming soon" text. In the dashboard, the Scanner and Compose tabs appear as regular tabs without amber "Soon" badges.

## Implementation Notes
- Modify `src/components/dashboard/dashboard-tabs.tsx`:
  - Remove `badge: "Soon"` from the Scanner and Compose tab entries in the `tabs` array
- Modify `src/app/page.tsx`:
  - Update feature card text for Scanner and Composer sections
  - Consider adding a "New" badge (temporary) to highlight newly shipped features
- Modify `src/lib/dashboard-empty-state-copy.ts`:
  - Update or remove `getScannerEmptyStateCopy()` and `getComposerEmptyStateCopy()` if they still contain "Coming soon" references (tickets #040 and #043 may have already handled this)

## Testing
- Run `npm run dev` and check:
  - Landing page (`/`): feature cards show updated descriptions
  - Dashboard tabs: Scanner and Compose tabs have no "Soon" badges
  - Scanner page (`/dashboard/scanner`): full scanner UI loads (not empty state)
  - Compose page (`/dashboard/compose`): full composer UI loads (not empty state)
