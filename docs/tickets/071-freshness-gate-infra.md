# [TICKET-071] Freshness Gate Infrastructure

## Status
`blocked`

## Dependencies
- Requires: #065 ✅, #067

## Description
Build the pre-draft gate that stops the Composer from generating on dead topics or topics the user just covered. Combines an external freshness signal (reuses existing `/api/grok` from #059) with a self-repetition check (semantic cluster match against the user's recent posts in the last 7/14/30 days). Emits a Green / Yellow / Red verdict and writes every check to an audit log. Wire the gate into the Composer pre-draft flow as a banner with a "proceed anyway" escape hatch.

## Acceptance Criteria
- [ ] Supabase migration creates `freshness_checks` table with: `run_id uuid`, `user_id uuid`, `topic text`, `verdict text check (verdict in ('green','yellow','red'))`, `external_signal jsonb`, `self_repetition_risk jsonb`, `sources jsonb`, `created_at timestamptz default now()`.
- [ ] `src/lib/freshness-gate.ts` exports `checkTopicFreshness(topic: string, userId: string): Promise<FreshnessResult>` returning `{ verdict, externalSignal, selfRepetitionRisk, sources, runId }`.
- [ ] External-signal path calls the existing `/api/grok` internal route (or its library) and classifies saturation into `green`/`yellow`/`red` per the S14 rule from `src/lib/prompts/algorithm.md`.
- [ ] Self-repetition path: semantic cluster match against the user's posts from last 7 / 14 / 30 days using `src/lib/topic-model.ts` clusters; risk is `high` if the topic hits a cluster with ≥2 posts in 7 days, `medium` for 14 days, `low` for 30 days, `none` otherwise.
- [ ] Every call writes a row to `freshness_checks` with full verdict, signals, and sources.
- [ ] Composer flow: the `/api/compose` endpoint runs the gate before the LLM draft; response includes a `freshness` payload; Composer UI shows a banner with the verdict, source citations, and a "Compose anyway" button.

## Implementation Notes
- `run_id` lets a single UI interaction group multiple checks (e.g., if the user types 3 topics); use it as a foreign key from any future review surfaces.
- Reuse `topic-model.ts` for cluster membership; do not reimplement clustering.
- `sources` jsonb should contain an array of `{type: "external"|"self", label: string, url?: string, postId?: string}` entries — drives the UI "Why?" disclosure.
- Gate is advisory, never blocking — the user can always proceed; the point is to surface the signal.
- Rate limit: at most 10 checks per user per hour to cap Grok cost.
- Server-only: never call this from a client component.

## Testing
- Apply migration → table exists with correct constraints.
- Call `checkTopicFreshness("AI agents productivity")` → returns a verdict and writes a row.
- Seed the user with 3 posts in last 7 days tagged to the same cluster → `self_repetition_risk.severity === "high"`.
- Call from Composer UI → banner renders with verdict, sources collapse/expand, "Compose anyway" proceeds.
- Trigger 11 calls in an hour → 11th returns rate-limit response.
