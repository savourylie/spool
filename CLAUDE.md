# CLAUDE.md

## Stack

- **Prefer `npm` over `pnpm`**
- **Frontend Framework**: Next.js 16 (App Router)
- **UI Components**: shadcn/ui
- **Icons**: Phosphor (`@phosphor-icons/react`)
- **Animation**: Framer Motion, Anime.js
- **Data Fetching**: TanStack Query (React Query v5)
- **Database**: Supabase

## Dev server

- `npm run dev` — HTTP at `http://localhost:3000`
- `npm run dev:https` — HTTPS at `https://localhost:3000` (uses `next dev --experimental-https`; auto-generates a self-signed cert into `./certificates/` via `mkcert`, prompts for sudo on first run to install the local CA). Use when an OAuth provider or feature requires HTTPS locally; ensure redirect URIs and any `NEXT_PUBLIC_*` URL env vars use `https://` variants.

## Technical Decisions (PRD v0)

Resolved ambiguities from `docs/PRD.md` and `docs/threads-api.md`:

1. **Backfill progress** — Use Supabase Realtime (subscribe to a `backfill_jobs` table) to push progress updates to the client.
2. **Token security** — Encrypt access tokens at the app layer (AES-256-GCM) before storing in the `users` table.
3. **Pre-April 2024 posts** — Skip; only backfill posts from April 13, 2024 onward (API launch date).
4. **Repost facades** — Exclude entirely (don't store or display).
5. **Engagement rate formula** — Include shares: `(likes + replies + reposts + quotes + shares) / views`.
6. **`topic_tag` column** — Keep in schema (low cost, useful for future features).
7. **Token refresh** — API extends token by 90 days on refresh; the 50-day refresh schedule in the PRD is fine (conservative buffer).
8. **Demographics** — Requires 3 separate API calls (country, city, gender) due to single-dimension filtering limitation in the Threads API.
