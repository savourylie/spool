# Posts CSV Export — Design

**Date:** 2026-06-12
**Status:** Approved

## Purpose

Let a user export all of their Threads posts with metadata (date, full text, views, likes, replies, reposts, quotes, shares, engagement rate) as a single CSV file, suitable for uploading to an AI assistant (ChatGPT, Claude, etc.) for further analysis.

## Decisions

- **Format:** CSV (RFC 4180). Most universal for AI file upload, code interpreters, and spreadsheets.
- **Data scope:** One row per post with its **latest** metrics snapshot only (no metric history).
- **Post scope:** All of the user's posts, always. No filters in v1.
- **Architecture:** Server API route returns the file directly (no client-side generation, no background jobs).

## Architecture

### API route: `GET /api/export/posts`

New file: `src/app/api/export/posts/route.ts`

1. Authenticate via existing `getSession(request)` (`src/lib/session.ts`). No session → `401` JSON error.
2. Fetch posts + latest metrics via a new RPC (below) using `createAdminClient()` from `src/lib/supabase/server.ts`.
3. Serialize rows to CSV with a small hand-rolled RFC 4180 escaper (no new dependency). Fields containing commas, double quotes, or newlines are quoted; embedded quotes doubled.
4. Respond with:
   - `Content-Type: text/csv; charset=utf-8`
   - `Content-Disposition: attachment; filename="spool-posts-export-<YYYY-MM-DD>.csv"`

### Database: new RPC via migration

New migration adding `export_posts_with_latest_metrics(p_user_id uuid)`:

- Joins `posts` to each post's most recent `post_metrics` row using `DISTINCT ON (post_id) ... ORDER BY post_id, fetched_at DESC`.
- `LEFT JOIN` so posts with no metrics snapshot are still returned (metric columns NULL).
- Returns all posts for the user ordered by `published_at DESC`.
- Columns: `threads_media_id, media_type, text_full, text_preview, permalink, topic_tag, published_at, views, likes, replies, reposts, quotes, shares, fetched_at`.

### CSV schema

One row per post, columns in order:

| Column | Source / rule |
|---|---|
| `published_at` | `posts.published_at`, ISO 8601 |
| `media_type` | `posts.media_type` |
| `text` | `posts.text_full`, falling back to `text_preview` when `text_full` is NULL (rows predating the `text_full` migration) |
| `permalink` | `posts.permalink` |
| `topic_tag` | `posts.topic_tag` (may be empty) |
| `views`, `likes`, `replies`, `reposts`, `quotes`, `shares` | latest snapshot; empty if no snapshot exists |
| `engagement_rate` | `(likes + replies + reposts + quotes + shares) / views` (project formula); **empty** if no snapshot or `views = 0` (never `NaN`/`Infinity`) |
| `metrics_fetched_at` | snapshot `fetched_at`, ISO 8601; tells the consumer how fresh the numbers are |
| `threads_media_id` | stable external identifier; internal UUIDs are excluded |

### UI

"Export CSV" button in the Posts page header (`src/app/dashboard/posts/page.tsx`, inside `ScreenHead`), using the existing button styling and the Phosphor `DownloadSimple` icon. Implemented as a plain anchor to `/api/export/posts` with the `download` attribute — the browser handles the download; no loading state or client fetch logic.

## Error handling

- No session → `401` JSON error (consistent with existing API routes).
- User has no posts → `200` with a valid CSV containing only the header row.
- Post has no metrics snapshot → row included with metric columns and `engagement_rate` empty.
- `views = 0` → `engagement_rate` empty.
- Database error → `500` JSON error, logged server-side.

## Testing

- **Unit tests** for the CSV serializer: escaping of commas, double quotes, newlines, emoji; empty-metrics rows; engagement-rate edge cases (no snapshot, zero views).
- **Manual verification** (no seed data in this project; run against a real Threads account):
  1. Log in, open the Posts page, click "Export CSV".
  2. Confirm the file downloads with the expected filename and opens cleanly.
  3. Confirm row count matches the Posts page total; spot-check one post's metrics against the dashboard.
  4. Smoke test: upload the CSV to an AI chat and ask a question about the data.

## Out of scope (v1)

- Metric history export (time-series per post).
- Filtered exports (date range, media type).
- JSON/Markdown formats.
- Background/async export jobs.
