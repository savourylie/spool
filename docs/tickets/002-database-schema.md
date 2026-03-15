# [TICKET-002] Database Schema & Supabase Config

## Status
`blocked`

## Dependencies
- Requires: #001

## Description
Set up Supabase local development, create the database schema (users, posts, post_metrics, daily_stats, demographics, backfill_jobs), configure Row Level Security policies, and enable Supabase Realtime on the backfill_jobs table for progress tracking.

## Acceptance Criteria
- [ ] Supabase CLI initialized (`supabase init`)
- [ ] Local Supabase instance starts with `supabase start`
- [ ] Migration file creates `users` table with encrypted `access_token` column (text), `threads_user_id` (unique), `username`, `token_expires_at`, `created_at`
- [ ] Migration file creates `posts` table with `user_id` FK, `threads_media_id` (unique), `media_type`, `text_preview`, `permalink`, `topic_tag`, `published_at`
- [ ] Migration file creates `post_metrics` table (append-only) with `post_id` FK, `views`, `likes`, `replies`, `reposts`, `quotes`, `shares`, `fetched_at`
- [ ] Migration file creates `daily_stats` table with `user_id` FK, `date`, `followers_count`, `views`, unique constraint on `(user_id, date)`
- [ ] Migration file creates `demographics` table with `user_id` FK, `dimension`, `key`, `value`, `fetched_at`
- [ ] Migration file creates `backfill_jobs` table with `user_id` FK, `status` (pending/running/complete/failed), `total_posts`, `processed_posts`, `started_at`, `completed_at`
- [ ] RLS enabled on all tables; policies restrict access to the authenticated user's own data
- [ ] Supabase Realtime enabled on `backfill_jobs` table
- [ ] Indexes created on: `posts(user_id, published_at)`, `post_metrics(post_id, fetched_at)`, `daily_stats(user_id, date)`
- [ ] Environment variables configured: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Implementation Notes
- Key files: `supabase/config.toml`, `supabase/migrations/001_initial_schema.sql`
- The `access_token` column stores the AES-256-GCM encrypted ciphertext — encryption/decryption happens at the app layer (see #005)
- Per CLAUDE.md: only backfill posts from April 13, 2024 onward; exclude repost facades
- Per CLAUDE.md: backfill progress uses Supabase Realtime on `backfill_jobs` table
- `topic_tag` kept in schema per CLAUDE.md decision #6
- Create a `.env.local.example` with placeholder Supabase vars

## Testing
- Run `supabase start` and verify all tables exist via Supabase Studio (localhost:54323)
- Insert test data into each table and verify constraints (unique, FK, not null)
- Verify RLS blocks cross-user data access
- Verify Realtime subscription on `backfill_jobs` fires on UPDATE
