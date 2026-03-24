# [TICKET-008] Backfill Progress UI

## Status
`done`

## Dependencies
- Requires: #003 ✅, #007 ✅

## Description
Build the loading screen shown after OAuth connect while the backfill pipeline runs. Displays a real-time progress bar using Supabase Realtime subscriptions on the `backfill_jobs` table, with playful messaging and auto-redirect to the dashboard on completion.

## Acceptance Criteria
- [x] Loading page at `/loading` or `/backfill` displays while backfill runs
- [x] Real-time progress bar: subscribes to `backfill_jobs` row via Supabase Realtime
- [x] Progress percentage: `(processed_posts / total_posts) × 100`
- [x] Animated messaging: "Analyzing your posts..." or similar playful text
- [x] Progress bar uses DESIGN.md accent color with hard shadow styling
- [x] On `status = 'complete'`: auto-redirect to `/dashboard`
- [x] On `status = 'failed'`: show error state with "Try again" button that re-triggers backfill
- [x] If user navigates to `/loading` with no active backfill job, redirect to dashboard or landing

## Design Reference
- **Components**: § Components > Buttons (for "Try again" CTA)
- **Motion**: § Motion & Animation (bounce entrance for progress elements)
- **Visual Signatures**: § Visual Signatures (decorative shapes around loading state)

## Visual Reference
A centered loading screen on the warm cream background. A progress bar with accent color fill and hard shadow border. Above it, playful text like "Analyzing your posts..." with a subtle bounce animation. Decorative shapes (circles, squiggles) float in the background. The progress percentage updates in real-time as posts are processed. On completion, the screen transitions to the dashboard.

## Implementation Notes
- Key files: `app/loading/page.tsx` or `app/backfill/page.tsx`, `components/backfill-progress.tsx`
- Subscribe to Supabase Realtime: `supabase.channel('backfill').on('postgres_changes', { event: 'UPDATE', table: 'backfill_jobs', filter: 'user_id=eq.{userId}' }, callback)`
- Per CLAUDE.md decision #1: Supabase Realtime is the chosen mechanism for backfill progress
- Per PRD: median time-to-value target is < 60 seconds, so the backfill should be fast
- Clean up Realtime subscription on unmount

## Testing
- Connect a test account and verify the loading screen appears
- Verify progress bar updates in real-time as posts are processed
- Verify auto-redirect to dashboard on completion
- Simulate a failed backfill and verify error state with retry button
- Test navigation: going to `/loading` without an active job redirects appropriately
