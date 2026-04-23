# [TICKET-072] Today Hub Freshness Filter + Audit Surface

## Status
`done`

## Dependencies
- Requires: #071 ✅

## Description
Pipe Today Hub's "What to post" candidates through the freshness gate so only Green and reframed-Yellow suggestions surface. Add a lightweight health surface — a small "Freshness log health" card — that visualizes recent gate verdicts to help the user see drift patterns. The health card ships as a stub here and fills in once the `/dashboard/understand/reviews` page lands in #075; until then it shows a preview of last-7-days verdict distribution.

## Acceptance Criteria
- [x] `src/components/dashboard/what-to-post-card.tsx` runs each candidate through `checkTopicFreshness`; only candidates with `verdict === "green"` or (`verdict === "yellow"` + a reframed suggestion) render.
- [x] Each surviving candidate shows a small inline freshness chip (green dot or amber dot with tooltip).
- [x] A new component `src/components/dashboard/freshness-log-card.tsx` renders a compact donut or stacked bar of verdict counts over the last 7 days (reads directly from `freshness_checks`).
- [x] The freshness-log card is embedded on Today Hub as a secondary card below the "What to post" card. It links to `/dashboard/understand/reviews` (placeholder route until #075 ships).
- [x] Reframed-yellow logic: when a candidate is yellow because of external saturation but the user has not posted on the topic in 30+ days, surface a "Reframed angle" suggestion using the existing Composer helper — do not fully draft, just suggest a sharper angle.
- [x] Today Hub gracefully handles the case where every candidate was filtered out — show an empty state "Nothing fresh surfaced — try a custom topic" with a direct link to Composer.

## Design Reference
- **Components**: existing `StickerCard` / card chrome on Today Hub; shadcn `Tooltip` for verdict hints; compact chart via shadcn chart components (project convention per CLAUDE memory).
- **Layout**: new card below existing "What to post" card; reuses Today Hub 2-col grid.

## Visual Reference
Today Hub's "What to post" card now shows 3 candidates, each with a tiny green dot on the left. Hovering a dot reveals "Fresh — low external saturation, no recent self-overlap." A fourth candidate that would have been red is gone. Directly below, a new "Freshness log" card shows a small horizontal bar: 14 green, 4 yellow, 2 red across the last 7 days, with a muted "See review log →" link sending the user to the Reviews page (placeholder until #075).

## Implementation Notes
- Do not call `checkTopicFreshness` per render — cache per request on the server component; or use a single batch call if the lib supports it.
- Health card must render gracefully when `freshness_checks` is empty (first-run) — show "No checks yet" rather than a blank donut.
- Reframed-yellow helper is a light LLM call — use `llm-resolver.ts` and keep the prompt under 500 tokens.
- Keep Today Hub loading budget intact — this card should not add more than ~300ms to first contentful paint.

## Testing
- Today Hub with 20 recent freshness checks → verdict distribution card renders with correct counts.
- Today Hub with empty `freshness_checks` → empty state shows, no chart error.
- Seed a user where every candidate fails the gate → Today Hub shows the "Nothing fresh surfaced" empty state.
- Hover a candidate's freshness dot → tooltip explains the verdict.
- Click "See review log" → routes to `/dashboard/understand/reviews` (404 OK until #075 lands).
