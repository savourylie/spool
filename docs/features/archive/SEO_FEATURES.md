# SEO Features — Algorithm-Aware Intelligence Roadmap

> Synthesized from Meta patent analysis and Threads algorithm research in `docs/seo/`.
> Each feature references the specific algorithm mechanic it exploits or defends against.

---

## Data Inventory

### Already Collected (no new ingestion)

| Data | Source | Notes |
|------|--------|-------|
| Post text previews (280 char) | `posts.text_preview` | Truncated on ingestion |
| Media type | `posts.media_type` | TEXT / IMAGE / VIDEO / CAROUSEL |
| Publish timestamp | `posts.published_at` | UTC |
| Metric snapshots (every 6h) | `post_metrics` | views, likes, replies, reposts, quotes, shares |
| Daily follower count | `daily_stats` | One row per user per day |
| Demographics | `demographics` | country, city, gender (latest only) |
| `topic_tag` column | `posts.topic_tag` | Exists in schema, currently unpopulated |

### Available from Threads API but Not Yet Collected

| Data | Endpoint | Scope Required |
|------|----------|---------------|
| Full post text | `GET /{media-id}?fields=text` | `threads_basic` |
| Reply threads | `GET /{media-id}/replies` | `threads_read_replies` |
| Keyword search | `GET /keyword_search` | `threads_keyword_search` |

### Not Available from Any API

- DM / private share counts (`shares` metric is the closest proxy)
- Internal algorithm scores, semantic vectors, trust scores
- Other users' metrics (no competitor data)

---

## Phase 1 — Algorithmic Scoring

> Uses only data Spool already collects. No schema changes, no new API calls, no external services.

### 1.1 Weighted Engagement Score (WES)

**Algorithm insight:** Signal weights — shares = 3-5× likes, meaningful comments = 30× likes, simple likes = baseline (Mosseri 2025, FB Papers MSI scoring). The current flat engagement rate `(likes + replies + reposts + quotes + shares) / views` treats all interactions equally, misrepresenting how the algorithm ranks content.

**What it does:** Add an algorithm-weighted engagement score alongside the existing engagement rate. Sortable column in the post table.

**Scoring formula:**

```
WES = (likes × 1) + (replies × 8) + (reposts × 3) + (quotes × 5) + (shares × 10)
Normalized WES = WES / views × 100
```

Rationale: `shares` proxies DM sends (highest value per Mosseri). `quotes` require creating new content. `replies` weight is 8 (not 30) because we can't distinguish meaningful 5+ word comments from short ones without reply data (addressed in Phase 2).

**Implementation:**
- Compute client-side from existing `PostRow` data — no SQL change for Phase 1
- Add WES as a sortable column in `post-table.tsx` with a toggle to switch between flat rate and WES
- Color-code using the existing top-performer accent highlight

**Files:**
- New: `src/lib/weighted-engagement.ts` (pure scoring function + tests)
- Modify: `src/components/dashboard/post-table.tsx` (add WES column + toggle)

---

### 1.2 Posting Cadence Optimizer

**Algorithm insight:** Diversity enforcement (US9336553B2, US11170006B2) — same-source density control means 3 posts/day ≈ each gets ⅓ visibility. Best practice: max 1 post/day, never post while previous post is in freshness window.

**What it does:** Analyze posting history to show cadence patterns, how spacing correlates with reach, and specific recommendations.

**UI (new section below timing heatmap in Timing tab):**
- **Cadence stats bar:** Average posts/day (last 30d), average gap between posts (hours), longest/shortest gap
- **Cadence vs. reach scatter:** X = hours since previous post, Y = views. Directly shows diversity filtering effect.
- **Recommendation banner:** If average gap < 18h, warn: "Posts spaced 18-24+ hours apart get [X]% more views on average based on your data."
- **Same-day collisions:** List dates with 2+ posts, show reach differential

**Implementation:**
- Derive from `posts.published_at` + latest `post_metrics` — same data source as the heatmap
- Sort posts by `published_at`, compute gaps, bucket by duration, average views per bucket
- Follow `timing-heatmap.tsx` chart-in-StickerCard pattern

**Files:**
- New: `src/components/dashboard/cadence-optimizer.tsx`, `src/lib/cadence-analysis.ts`
- Modify: `src/app/dashboard/timing/page.tsx` (render below heatmap)

---

### 1.3 Optimal Post Format Analysis

**Algorithm insight:** Content clustering (US10558714B2) — the algorithm classifies content by type and builds per-account performance expectations. Different audiences respond to different formats.

**What it does:** Break down engagement by media type and post length, showing which formats work best for this user's audience.

**UI (new section in Posts tab or standalone card):**
- **Media type breakdown:** Grouped bar chart — avg views, avg WES, post count per media type. Highlight best-performing type.
- **Text length analysis:** Bucket TEXT/IMAGE posts by char count (0-50 short, 50-150 medium, 150-280 long), show engagement per bucket.
- **Recommendation:** "Your IMAGE posts get [X]% more engagement than TEXT posts. Long-form posts (150+ chars) outperform short ones by [Y]%."

**Implementation:**
- `posts.media_type` already stored. `text_preview` length proxies full text length (capped at 280, sufficient for bucketing).
- Compute client-side from existing post list or new RPC `get_format_analysis`
- Follow `demographics-charts.tsx` bar chart pattern

**Files:**
- New: `src/components/dashboard/format-analysis.tsx`, `src/lib/format-analysis.ts`
- Modify: `src/app/dashboard/posts/page.tsx` (render below or beside post table)

---

### 1.4 Content Reselection Alerts

**Algorithm insight:** Content reselection (US10635732B2) — posts can re-enter distribution if they receive new high-quality engagement. Users need to know when this happens so they can engage with new comments to maintain momentum.

**What it does:** Detect posts older than 7 days showing significant engagement spikes, surface as alerts with a link to Threads.

**Detection logic:** Compare two most recent `post_metrics` snapshots per post. If a post older than 7 days shows >20% increase in views or >50% increase in total engagement between snapshots → flag as "re-selected."

**UI:** Dismissible alert banner above post table (follows `backfill-status-banner.tsx` pattern). Shows: "Old post gaining traction: '[preview]' gained [X] new views in the last 6 hours. Engage with new comments to keep momentum." Links to Threads permalink.

**Implementation:**
- Query two most recent `post_metrics` rows per post where `published_at` > 7 days ago, compute delta, filter by threshold
- Cache per page load — no real-time needed

**Files:**
- New: `src/components/dashboard/reselection-alert.tsx`, `src/lib/reselection-detection.ts`
- Modify: `src/app/dashboard/posts/page.tsx` (render alert above PostTable)

---

### 1.5 Post-Viral Recovery Mode

**Algorithm insight:** Post-viral dynamics — diversity enforcement throttles subsequent posts, viral audience influx creates follower-content mismatch, and semantic similarity detection penalizes follow-up posts on the same topic. Recovery requires: 24-48h pause, aggressive comment management, semantic variation.

**What it does:** Detect viral posts and proactively show a recovery playbook to avoid the post-viral slump.

**Detection logic:** A post is "viral" when views > 5× user's median post views AND daily_stats shows >100 new followers within 48h. Recovery mode active for 7 days after detection.

**UI:** Full-width alert card at dashboard top (above tabs), styled with amber/warning color. Contains:
- "Your post '[preview]' went viral. Here's how to protect your reach:"
- Wait 24-48h before posting again (countdown timer)
- Next post should target your usual audience, not the new followers
- Actively reply to quality comments on the viral post
- Avoid posting similar content (algorithm detects semantic similarity)
- Dismissible via localStorage

**Implementation:**
- Detection runs on dashboard load: compare latest metrics against user's median, check `daily_stats` for follower spike
- Follow `backfill-status-banner.tsx` persistent alert pattern

**Files:**
- New: `src/components/dashboard/viral-recovery-card.tsx`, `src/lib/viral-detection.ts`
- Modify: `src/app/dashboard/layout.tsx` (render above DashboardTabs)

---

## Phase 2 — Enhanced Data Collection

> Requires new Threads API scopes, schema migrations, and extended scheduled jobs.

### 2.1 First-3-Hour Engagement Velocity

**Algorithm insight:** First 3 hours — engagement quality in this window determines if a post gets second-round distribution. The EV system (US9378529B2) disproportionately weights early signals.

**What it does:** Track engagement velocity during the critical first 3 hours, showing whether posts typically "launch" or "stall."

**New data:** More frequent metric snapshots for recent posts — fetch at 30min, 1h, 2h, 3h after publish instead of every 6h.

**Schema changes:**
```sql
CREATE INDEX idx_post_metrics_recent
  ON post_metrics (post_id, fetched_at DESC)
  WHERE fetched_at > now() - interval '3 days';
```

**Implementation:**
- New cron job `spool-velocity-check` runs every 30 min, fetches metrics for posts published in last 3h
- Velocity = (engagement at 3h) / (engagement at 30min), compared to user's historical 3h average
- UI: velocity sparkline on post rows + "Launch Score" indicator (green/yellow/red)

**Files:**
- New: `src/app/api/cron/velocity/route.ts`, `src/lib/velocity-check.ts`, `src/components/dashboard/velocity-indicator.tsx`

---

### 2.2 Comment Quality Monitor

**Algorithm insight:** Meaningful comments (5+ words) = 30× likes in MSI scoring. The system evaluates engagement chains — comments that spawn further discussion. Low-quality comments (emoji, "+1") contribute negligible signal (US10574610B1, US9152675B2).

**What it does:** Fetch reply threads and analyze comment quality, showing which posts generate meaningful discussion.

**Schema changes:**
```sql
CREATE TABLE post_replies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  threads_reply_id text UNIQUE NOT NULL,
  text         text,
  word_count   int,
  replied_at   timestamptz,
  fetched_at   timestamptz DEFAULT now()
);
CREATE INDEX idx_post_replies_post ON post_replies (post_id);
```

**Implementation:**
- Extend 6h metrics refresh to also fetch replies for recent posts (requires `threads_read_replies` scope)
- Classify replies: short (<5 words), medium (5-20), long (20+)
- Discussion Quality Score per post: weighted average of reply lengths
- UI: reply breakdown in PostRowDetail + summary: "Your posts average [X] meaningful comments (5+ words)."

**Files:**
- New: `src/lib/reply-analysis.ts`, `src/components/dashboard/comment-quality.tsx`, migration for `post_replies`
- Modify: `src/lib/metrics-refresh.ts` (extend to fetch replies)

---

### 2.3 Semantic Focus Score

**Algorithm insight:** Content clustering (US10558714B2) — consistent posting in one topic builds classification confidence. Crossing semantic neighborhoods without a bridge strategy causes penalty (US10740825B1). Trust graph (2025+): creator credibility and consistency matter more than content alone.

**What it does:** Analyze post content to measure topical consistency, showing whether the account has a clear semantic identity or is scattered.

**New data:** Full post text (currently truncated to 280 chars). Modify backfill and metrics refresh to store full text.

**Schema changes:**
- Add `text_full text` column to `posts` (keep `text_preview` for display)
- Populate `topic_tag` via auto-classification

**Implementation (no LLM — keyword-based for Phase 2):**
- TF-IDF keyword extraction on post text to identify top topic clusters
- Focus Score (0-100): % of recent posts within top 2-3 topics
- Rolling 30-day trend line
- Warning when score drops: "Your content has become less focused. The algorithm may be re-classifying your account."

**Files:**
- New: `src/lib/topic-classification.ts`, `src/components/dashboard/semantic-focus.tsx`, migration for `text_full`
- Modify: `src/lib/backfill.ts`, `src/lib/metrics-refresh.ts` (store full text)

---

### 2.4 Audience Fit Analysis

**Algorithm insight:** High followers + topic mismatch = reach suppression (US9582786B2, the "follower paradox"). System recommends based on follower interests; if followers don't match content, initial engagement rate drops.

**What it does:** Cross-reference content topics with audience demographics and engagement patterns. Detect whether viral-acquired followers create audience-content mismatch.

**Schema changes:**
- Demographics history table (currently upserts only latest):
```sql
CREATE TABLE demographics_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dimension    text NOT NULL,
  key          text NOT NULL,
  value        numeric NOT NULL,
  fetched_at   timestamptz DEFAULT now()
);
```

**Implementation:**
- Archive demographic snapshots (not just latest) to track shifts over time
- Audience Alignment Score: compare pre-viral vs post-viral engagement rates
- Show demographic shift timeline
- UI: section in Audience tab with alignment score and recommendations

**Files:**
- New: `src/lib/audience-fit.ts`, `src/components/dashboard/audience-fit.tsx`, migration for `demographics_history`
- Modify: `src/lib/daily-stats.ts` (insert into history instead of upsert-only)

---

## Phase 3 — AI-Powered Features

> Requires LLM API integration (Claude or similar). Crown jewel features.

**Shared infrastructure:**
- LLM API key stored in Supabase Vault, env var `LLM_API_KEY`
- New: `src/lib/llm-client.ts` — LLM API abstraction with streaming support

### 3.1 Content Quality Scanner (Anti-Pattern Detector)

**Algorithm insight:** Low-quality triggers — clickbait openings, keyword stuffing, generic fluff (US9959412B2). ML-detected anti-patterns: vote bait, react bait, share bait, tag bait, comment bait — causes account-level demotion. Semantic similarity detection flags reposted content (US10635732B2, US10599774B1).

**What it does:** Analyze draft or existing post text for algorithm-demoted patterns. Quality Score gauge + fix suggestions.

**Two layers:**
1. **Heuristic (client-side, no API):** Regex for clickbait openers ("You won't believe..."), engagement bait ("Like if you agree"), excessive hashtags (>5), ALL CAPS, emoji density, too-short posts (<20 chars)
2. **LLM (server-side):** Tone analysis (AI-generated feel?), topic coherence, semantic similarity to recent posts, shareability assessment against the 4 private-share triggers

**UI:** New route `/dashboard/scanner` — text input, real-time analysis (debounced), quality score gauge (0-100), flagged issues with severity + suggested rewrites. Also: "Analyze existing post" to retroactively score history.

**Files:**
- New: `src/app/dashboard/scanner/page.tsx`, `src/components/dashboard/quality-scanner.tsx`, `src/lib/quality-heuristics.ts`, `src/lib/quality-llm.ts`, `src/app/api/scanner/route.ts`

---

### 3.2 Engagement Prediction

**Algorithm insight:** EV system (US9378529B2) — the algorithm predicts expected content value. Understanding predicted reach before posting lets users iterate on drafts.

**What it does:** Predict expected engagement range based on historical data + post characteristics.

**Model inputs (from user's own data):** media type, post length, posting time (day/hour), topic similarity to past high-performers, time since last post (cadence effect), current follower count.

**Implementation:**
- Statistical model from user's historical averages: "Posts like this (IMAGE, Tuesday 9am, 150 chars) have historically gotten [X-Y] views."
- Show as 25th-75th percentile range
- LLM refinement: semantic quality analysis to adjust prediction
- UI: prediction widget in scanner/composer

**Files:**
- New: `src/lib/engagement-prediction.ts`, `src/components/dashboard/prediction-widget.tsx`

---

### 3.3 AI Content Composer

**Algorithm insight:** All insights synthesized — the composer encodes every best practice into content creation. Targets the 4 content types that trigger private shares: (1) articulating what readers think but can't express, (2) systematic time-saving compilations, (3) counterintuitive data-backed conclusions, (4) shareable conversation frameworks.

**What it does:** LLM-powered post drafting using the user's performance history, audience data, and algorithm rules.

**Workflow:**
1. User provides topic idea or selects "generate ideas for me"
2. System sends LLM context: top-performing posts + metrics, audience demographics, topic cluster / semantic identity, current cadence (last post time, recommended wait), recent topics (ensure semantic variation)
3. LLM generates 2-3 draft variations, each targeting a different share-trigger category
4. Each draft auto-runs through Quality Scanner
5. User edits, refines, requests rewrites
6. Optional: schedule for optimal posting time (from heatmap data)

**UI:** New dashboard tab "Compose" — left panel (topic + style selector), center (editable drafts), right (quality score + predicted engagement + timing recommendation).

**Schema changes:**
```sql
CREATE TABLE drafts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic                 text,
  content               text NOT NULL,
  quality_score         numeric,
  predicted_engagement  jsonb,
  created_at            timestamptz DEFAULT now()
);
```

**Implementation:**
- Streaming response via SSE for real-time draft generation
- No direct Threads posting in v1 — generates text for copy-paste
- Future: publish via Threads Publishing API

**Files:**
- New: `src/app/dashboard/compose/page.tsx`, `src/components/dashboard/composer.tsx`, `src/components/dashboard/draft-card.tsx`, `src/lib/composer-prompt.ts`, `src/app/api/compose/route.ts`, migration for `drafts`
- Modify: `src/components/dashboard/dashboard-tabs.tsx` (add Compose tab)

---

### 3.4 Topic Suggestion Engine

**Algorithm insight:** Semantic neighborhoods — expanding into adjacent topics requires a bridge strategy (natural extension, not hard pivot). Trust graph rewards niche consistency but allows calculated expansion.

**What it does:** Suggest new topics adjacent to the user's semantic identity, scored by audience relevance and semantic distance.

**Implementation:**
- Analyze top-performing posts to extract core topics
- LLM generates related suggestions that are semantically adjacent
- Score by: relevance to existing audience, trending potential, distance from current focus
- UI: "Suggested Topics" card in Compose tab

**Files:**
- New: `src/lib/topic-suggestions.ts`, `src/components/dashboard/topic-suggestions.tsx`
- Depends on Composer (3.3) infrastructure

---

## Phasing Summary

| Phase | Features | New Infra | Estimate |
|-------|----------|-----------|----------|
| 1 | WES, Cadence, Format, Reselection, Viral Recovery | None | 10-16 days |
| 2 | Velocity, Comments, Semantic Focus, Audience Fit | New API scopes, schema migrations, cron jobs | 16-24 days |
| 3 | Quality Scanner, Prediction, Composer, Topics | LLM API, streaming, new tables | 21-30 days |

**Build order within each phase:**
- Phase 1: WES first (smallest, highest visibility) → Cadence + Format in parallel → Reselection + Viral Recovery
- Phase 2: Velocity first (extends existing cron) → Comments → Semantic Focus → Audience Fit
- Phase 3: Quality Scanner first (establishes LLM infra) → Prediction → Composer (capstone) → Topics (extension of Composer)

---

## Algorithm-to-Feature Mapping

| Algorithm Insight | Patent / Source | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| Signal weights (shares > comments > likes) | Mosseri 2025, FB Papers | 1.1 WES | 2.2 Comments | 3.3 Composer |
| Diversity filtering (posting cadence) | US9336553B2, US11170006B2 | 1.2 Cadence | | 3.3 Composer |
| Content clustering (topic consistency) | US10558714B2 | 1.3 Format | 2.3 Semantic Focus | 3.4 Topics |
| Content reselection | US10635732B2 | 1.4 Reselection | | |
| Post-viral dynamics | Multiple | 1.5 Viral Recovery | 2.4 Audience Fit | |
| First 3-hour window | US9378529B2 (EV system) | | 2.1 Velocity | 3.2 Prediction |
| Comment quality / engagement chains | US10574610B1, US9152675B2 | | 2.2 Comments | 3.1 Scanner |
| Semantic neighborhoods | US10740825B1 | | 2.3 Focus | 3.4 Topics |
| Clickbait / anti-pattern detection | US9959412B2 | | | 3.1 Scanner |
| Audience-content mismatch | US9582786B2 | | 2.4 Audience Fit | 3.3 Composer |
| Semantic similarity (no repost) | US10599774B1 | | 2.3 Focus | 3.1 Scanner |
| 4 share-trigger content types | Mosseri interview | | | 3.3 Composer |
| Social graph authority (KOL boost) | US9582786B2 | | 2.2 Comments | |
| External link evaluation | EP2977948A1, US10268763B2 | | | 3.1 Scanner |
| New account honeymoon period | US20140172877A1, US9959412B2 | | 2.3 Focus | |
