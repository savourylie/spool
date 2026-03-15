# CLAUDE.md

## Technical Decisions (PRD v0)

Resolved ambiguities from `docs/PRDv0.md` and `docs/threads-api.md`:

1. **Backfill progress** — Use Supabase Realtime (subscribe to a `backfill_jobs` table) to push progress updates to the client.
2. **Token security** — Encrypt access tokens at the app layer (AES-256-GCM) before storing in the `users` table.
3. **Pre-April 2024 posts** — Skip; only backfill posts from April 13, 2024 onward (API launch date).
4. **Repost facades** — Exclude entirely (don't store or display).
5. **Engagement rate formula** — Include shares: `(likes + replies + reposts + quotes + shares) / views`.
6. **`topic_tag` column** — Keep in schema (low cost, useful for future features).
7. **Token refresh** — API extends token by 90 days on refresh; the 50-day refresh schedule in the PRD is fine (conservative buffer).
8. **Demographics** — Requires 3 separate API calls (country, city, gender) due to single-dimension filtering limitation in the Threads API.
