# Spool — PRD v0

**Personal brand analytics for Threads.**

Connect your Threads account. See what's working, when to post, and who's listening.

---

## Problem

Threads offers no native analytics beyond basic per-post counts. Creators and personal brand builders have no way to:

- Compare post performance across content types
- Understand which time slots drive the most engagement
- Visualize their audience demographics and follower growth

They're left guessing. Spool turns their posting history into actionable insights.

## Target User

Individual creators and personal brand marketers on Threads with 100+ followers who post regularly (3+ times/week) and want to grow intentionally.

## Success Metrics

| Metric | Target (3 months post-launch) |
| --- | --- |
| Connected accounts | 500 |
| Weekly active users | 40% of connected accounts |
| Median time-to-value (connect → first insight viewed) | < 60 seconds |

---

## MVP Features

### 1. Post Performance Ranking

**Goal:** Instantly answer "what content of mine performs best?"

**Functionality:**
- On connect, backfill all available posts and their per-post insights from the Threads API
- Display a sortable, paginated table of posts with columns:
  - Post preview (truncated text + media type icon)
  - Published date
  - Views
  - Likes
  - Replies
  - Reposts
  - Quotes
  - Shares
  - Engagement rate (likes + replies + reposts + quotes) / views
- Filter by:
  - Media type: Text, Image, Video, Carousel (multi-select)
  - Date range picker
- Sort by any metric column (ascending / descending)
- Click a row to expand full post text and a mini engagement-over-time sparkline (from `post_metrics` snapshots)

**API endpoints used:**
- `GET /{threads-user-id}/threads` — list user's posts
- `GET /{threads-media-id}/insights` — per-post metrics (views, likes, replies, reposts, quotes, shares)

### 2. Best Time to Post

**Goal:** Answer "when should I post to maximize engagement?"

**Functionality:**
- Derived entirely from post `published_at` timestamps + their engagement metrics (no extra API calls)
- Heatmap (7 rows × 24 columns) showing average engagement rate per day-of-week × hour-of-day slot
- Color scale from low (cool) to high (warm)
- Hover tooltip: number of posts in that slot, average engagement rate, average views
- Minimum data threshold: if a time slot has < 2 posts, show as "insufficient data" (gray)
- Summary text: "Your best posting times are **Tuesday 9–11 AM** and **Thursday 7–9 PM**" (top 3 slots)
- User's timezone auto-detected from browser, with manual override

**Edge cases:**
- < 20 total posts: show the heatmap but display a banner — "Post more to improve accuracy. Based on N posts so far."
- All posts at the same time: surface this as a recommendation — "You always post at X. Try varying your schedule."

### 3. Audience Snapshot

**Goal:** Answer "who is my audience?"

**Functionality:**
- **Follower count trend** — line chart showing daily follower count over time
  - Populated by polling `followers_count` daily and storing in `daily_stats`
  - On first connect, only the current count is available; the chart grows over time
  - Annotate notable spikes with the post published closest to that date
- **Geography** — horizontal bar chart of top 10 countries and top 10 cities
  - Source: `follower_demographics` with dimension `country` and `city`
- **Gender** — donut chart showing gender split
  - Source: `follower_demographics` with dimension `gender`
- If user has < 100 followers: show a placeholder state — "Audience insights unlock at 100 followers. You're at N."

**API endpoints used:**
- `GET /{threads-user-id}/threads_insights` — `followers_count`, `follower_demographics`

---

## Explicitly Out of Scope (v0)

- Competitor / peer tracking
- AI-powered content recommendations
- Reply and conversation depth analysis
- Multi-account support
- Hashtag / topic classification
- Webhook-driven real-time updates (polling is sufficient)
- Mobile app (web-only)

---

## User Flow

```
Landing Page
  │
  ▼
"Connect Threads" button → Threads OAuth 2.0 consent screen
  │
  ▼
Callback → store tokens → kick off backfill job
  │
  ▼
Loading screen: "Analyzing your posts..." (progress bar, ~30s)
  │
  ▼
Dashboard (3 tabs)
  ├── [Posts]      Sortable performance table
  ├── [Timing]    Day/hour engagement heatmap
  └── [Audience]  Follower trend + demographics
```

---

## Technical Architecture

### Stack

| Layer | Technology | Rationale |
| --- | --- | --- |
| Framework | Next.js (App Router) | SSR for OAuth callback, React for dashboards |
| UI Components | shadcn/ui | Consistent, accessible component library |
| Charts | shadcn/ui charts (built on Recharts) | Heatmap, line chart, bar chart, donut chart, sparklines |
| Database | Supabase (local) | Postgres with row-level security, real-time subscriptions, free local dev |
| Auth | Threads OAuth 2.0 → tokens stored in Supabase | Single OAuth provider |
| Scheduling | Vercel Cron (prod) / pg_cron (local) | Poll metrics every 6 hours, refresh tokens before expiry |
| Hosting | Vercel | Zero-config Next.js deployment |

### Data Model

```sql
-- Authenticated Threads users
create table users (
  id            uuid primary key default gen_random_uuid(),
  threads_user_id text unique not null,
  username      text,
  access_token  text not null,
  token_expires_at timestamptz not null,
  created_at    timestamptz default now()
);

-- Posts pulled from the Threads API
create table posts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade,
  threads_media_id text unique not null,
  media_type      text not null,          -- TEXT, IMAGE, VIDEO, CAROUSEL
  text_preview    text,                   -- first 280 chars
  permalink       text,
  topic_tag       text,
  published_at    timestamptz not null,
  created_at      timestamptz default now()
);

-- Append-only metric snapshots (tracks engagement growth over time)
create table post_metrics (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references posts(id) on delete cascade,
  views       int default 0,
  likes       int default 0,
  replies     int default 0,
  reposts     int default 0,
  quotes      int default 0,
  shares      int default 0,
  fetched_at  timestamptz default now()
);

-- Daily user-level stats (polled once per day)
create table daily_stats (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade,
  date            date not null,
  followers_count int,
  views           int,
  unique (user_id, date)
);

-- Follower demographics (refreshed periodically)
create table demographics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  dimension   text not null,              -- country, city, gender
  key         text not null,              -- e.g. "US", "Female"
  value       numeric not null,           -- count or percentage
  fetched_at  timestamptz default now()
);
```

### Ingestion Pipeline

```
On OAuth connect (immediate):
  1. Store user + tokens
  2. Fetch all posts via paginated GET /{user-id}/threads
  3. For each post, fetch GET /{media-id}/insights
  4. Store posts + initial post_metrics snapshot
  5. Fetch user insights (followers_count, demographics)
  6. Store daily_stats + demographics
  7. Mark backfill complete → redirect to dashboard

Scheduled (every 6 hours):
  1. For each user with valid token:
     a. Fetch new posts (since last fetch)
     b. Fetch updated metrics for recent posts (last 7 days)
     c. Store new post_metrics snapshots

Scheduled (daily):
  1. For each user with valid token:
     a. Fetch followers_count → insert daily_stats
     b. Refresh demographics

Scheduled (every 50 days):
  1. Refresh long-lived tokens before 60-day expiry
```

### API Rate Limit Awareness

| Operation | Limit | Our usage |
| --- | --- | --- |
| Publishing | 250/24h | N/A (read-only app) |
| Keyword search | 2,200/24h | N/A (not in MVP) |
| General API calls | Standard Graph API limits | Backfill is bursty; schedule polls to stay well under |

The backfill fetches posts + insights in sequence. For a user with 500 posts, that's ~501 API calls (1 paginated list + 500 insight fetches). This is well within standard rate limits when spread over the backfill window.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Meta app review delays | Can't onboard users beyond test group | Submit for review early; design the app to work for 25 testers first |
| Users with few posts (< 20) | Timing heatmap is noisy / misleading | Show data-quality warnings; recommend minimum post count |
| Token expiry / silent failure | Stale data, broken dashboard | Auto-refresh tokens; alert user via email/banner if re-auth needed |
| Threads API changes or deprecation | Feature breakage | Abstract API calls behind a service layer; monitor Meta changelog |
| Insight data lag (metrics grow over days) | Numbers feel "wrong" to users | Show "last updated" timestamp; explain in UI that metrics are periodic snapshots |

---

## Open Questions

1. **Monetization model?** Free tier with limits (e.g., 90-day history) + paid for full history and daily email digests?
2. **Do we want a "post composer" later?** The publishing API exists — could tie insights directly to a "post at your best time" workflow.
3. **Onboarding for < 100 follower users?** The audience tab is empty for them. Should we still allow signup or gate it?
4. **Data retention policy?** How long do we keep metric snapshots? Indefinitely (storage cost) or rolling window?
