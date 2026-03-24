# UX_DESIGN.md — Interaction & Behavior Specification

> **Purpose**: Single source of truth for how Spool **behaves** — user flows, interaction patterns, component states, and page-level UX. Complements `DESIGN.md` (how it looks) and `PRD.md` (what it does). Reference `SEO_FEATURES.md` for algorithm insights behind each feature.

---

## 1. Companion Files

| Document | Covers |
|----------|--------|
| `DESIGN.md` | Visual tokens, colors, typography, shadows, component styles, decorative elements |
| `PRD.md` | Product requirements, data model, success metrics, API details |
| `SEO_FEATURES.md` | Algorithm-aware feature roadmap (Phase 1/2/3), formulas, build order |
| `UX_DESIGN.md` (this file) | Interaction flows, component states, page behaviors, responsive rules, accessibility |

---

## 2. Information Architecture

### 2.1 Site Map

```
/                           Landing page (redirects to /dashboard if session exists)
/api/auth/threads           OAuth redirect to Threads consent screen
/api/auth/callback          OAuth callback → store tokens → start backfill → redirect
/api/auth/sign-out          POST → clear session → redirect to /
/dashboard                  Redirect to /dashboard/posts
/dashboard/posts            Post performance table + filters
/dashboard/timing           Timing heatmap + cadence
/dashboard/audience         Follower growth + demographics
/dashboard/scanner          Content quality scanner (v0: coming soon)
/dashboard/compose          AI composer (v0: coming soon)
/api/posts/[id]/metrics     GET → metric snapshot history for sparkline
/api/cron/refresh           Scheduled metrics refresh (6h)
/api/cron/daily             Scheduled daily stats + demographics
/api/cron/token-refresh     Scheduled token refresh (50 days)
```

### 2.2 URL Structure & State Encoding

The Posts tab encodes all filter/sort/pagination state in search params:

| Param | Type | Example | Notes |
|-------|------|---------|-------|
| `sort` | enum | `views`, `engagement_rate` | Valid columns only; defaults to `published_at` |
| `order` | `asc` \| `desc` | `desc` | Defaults to `desc` |
| `page` | int | `2` | 1-indexed; defaults to 1 |
| `types` | CSV | `TEXT,IMAGE` | Omitted when all types selected |
| `from` | date | `2024-06-01` | ISO date, min `2024-04-13` |
| `to` | date | `2024-12-31` | ISO date |

**Convention**: All future tab features that need client state should use URL search params. This enables deep-linking, browser back/forward, and shareable URLs. Filter changes always reset `page` to 1.

### 2.3 Navigation Model

**Tab bar** is the primary navigation, split into two groups:

| Group | Tabs | Divider |
|-------|------|---------|
| **Analyze** | Posts, Timing, Audience | Vertical 1px `bg-border` separator after Audience |
| **Create** | Scanner (Soon), Compose (Soon) | — |

**Tab behavior:**
- Active tab: `aria-current="page"`, filled Phosphor icon weight, primary-colored bottom border
- Inactive tab: regular icon weight, transparent bottom border, muted text
- Mobile (`< sm`): icon-only, labels hidden; "Soon" badges hidden
- Desktop: icon + label + optional badge
- Overflow: `overflow-x-auto` for horizontal scrolling on narrow viewports
- Focus: `focus-visible:ring-3 ring-ring` with rounded corners

---

## 3. Global UX Patterns

### 3.1 Component State Machine

Every data-driven section implements four states:

```
┌──────────┐     fetch      ┌──────────┐
│ Loading  │ ─────────────→ │ Success  │
│ skeleton │                │ content  │
└──────────┘                └──────────┘
      │                          ↑
      │ fetch error              │ retry
      ▼                          │
┌──────────┐     retry     ┌──────────┐
│  Error   │ ←─────────── │ fetch    │
│  state   │ ─────────────→│ again    │
└──────────┘               └──────────┘
      │
      │ data empty
      ▼
┌──────────┐
│  Empty   │
│  state   │
└──────────┘
```

| State | Component | Behavior |
|-------|-----------|----------|
| **Loading** | Skeleton in `StickerCard` | Pulse-animated `bg-muted` bars, `role="status"`, `aria-label="Loading dashboard content"` |
| **Error** | `ErrorState` | WarningCircle icon in destructive circle, title + description, "Try again" button calls `router.refresh()` or custom handler |
| **Empty** | `EmptyState` | Colored icon circle + title + description + optional CTA. Copy varies by `isImporting` flag |
| **Success** | Content | Normal component rendering |

**Empty state copy variants:**
- When backfill is in progress (`isImporting: true`): "Importing your posts" / "This table will fill in automatically..."
- When no data exists: Feature-specific copy with algorithm insights (e.g., "shares and meaningful comments carry far more weight than likes")
- When filters match nothing: "No posts match your filters" with "Clear filters" button

### 3.2 Banner & Alert Hierarchy

Banners stack vertically in the dashboard layout. Order from top to bottom:

| Priority | Banner | Condition | Style | Persistence |
|----------|--------|-----------|-------|-------------|
| 1 (top) | **Token expiry** | Token expires within 7 days or already expired | `border-destructive` (expired) or `border-tertiary` (expiring) | Until user reconnects |
| 2 | **Backfill status** | Import pending, running, complete, or failed | `border-primary` (importing), `border-secondary` (complete), `border-destructive` (failed) | Auto-hides 5s after completion |
| 3 | **[v1] Viral recovery** | Viral post detected with follower spike | `border-tertiary` (amber) | Dismissible via localStorage, 7 days |
| 4 | **[v1] Reselection alert** | Old post showing engagement spike | Within Posts tab, above table | Dismissible per session |

**Backfill banner states:**

| Status | Icon | Content | Action |
|--------|------|---------|--------|
| `pending` | SpinnerGap (spinning) | "Preparing your import" + progress bar | — |
| `running` | SpinnerGap (spinning) | "Importing your posts" + progress count + stage label + relative time | — |
| `complete` | CheckCircle | "Import complete" | Auto-hides after `BACKFILL_SUCCESS_HIDE_DELAY_MS` |
| `failed` | WarningCircle | Error message + last stage + relative time | "Retry import" button |
| Stale (nested) | — | Amber sub-banner within running state | "Resume import" button |

**Token expiry banner:**

| Status | Border/BG | Message | CTA |
|--------|-----------|---------|-----|
| `expiring` | `tertiary/30` + `tertiary/10` | "Your Threads connection expires soon" | "Reconnect" → `/api/auth/threads` |
| `expired` | `destructive/30` + `destructive/10` | "Your Threads connection has expired" | "Reconnect" → `/api/auth/threads` |

### 3.3 Data Freshness Indicators

- **Backfill banner**: Shows relative time ("Last update 30 seconds ago") using `Intl.RelativeTimeFormat`, refreshed via 5-second interval
- **Stale detection**: If backfill heartbeat exceeds 30s (pending) or 90s (running), shows amber sub-banner with "Resume import" action
- **Charts**: Use the most recent `fetched_at` from underlying metric snapshots
- **Future convention**: All data sections should surface "last updated" timestamps from their data source

### 3.4 Animation Behaviors

All animations reference the bounce easing from `DESIGN.md`: `cubic-bezier(0.34, 1.56, 0.64, 1)` via `var(--ease-bounce)`.

| Animation | Implementation | Duration | Reduced Motion |
|-----------|---------------|----------|----------------|
| Row expand/collapse | `grid-template-rows: 0fr → 1fr` transition | 300ms, bounce easing | Instant (0ms) |
| Tab transitions | Color and border-bottom transition | 300ms, bounce easing | Color only, no bounce |
| Card hover | `rotate(-1deg) scale(1.02)` | 300ms, bounce easing | Disabled |
| Button hover | `translate(-2px, -2px)` + shadow shift | 300ms, bounce easing | Color change only |
| Backfill spinner | `animate-spin` on SpinnerGap icon | Continuous | Static icon |
| Skeleton pulse | `animate-pulse` on placeholder bars | Continuous | Reduced opacity fade |
| Pagination hover | Background fill with bounce | 300ms, bounce easing | Instant color change |

**Rule**: All animations must check `prefers-reduced-motion` and degrade gracefully — remove transforms, disable continuous animations, fall back to instant state changes or simple opacity fades.

### 3.5 Responsive Behavior Rules

| Element | Desktop (`≥ md`) | Mobile (`< md` / `< sm`) |
|---------|-----------------|--------------------------|
| Tab labels | Icon + text | Icon only (`< sm`) |
| Tab badges ("Soon") | Visible | Hidden (`< sm`) |
| Post table | Full width, all columns | Horizontal scroll (`overflow-x-auto`) |
| Filter media buttons | Inline row | Wrap to multiple rows |
| Date range inputs | `h-9`, `w-40`, inline | `h-12`, `w-full`, full-width |
| Filter chips | Inline | `min-h-12` for 48px touch target |
| Demographics grid | 2-column | Single column |
| Pagination buttons | `size-10` (40px) | `size-12` (48px) |
| Landing decorations | Visible | Hidden |
| Hero layout | Side-by-side (text + SVG) | Stacked, centered text |

**Touch targets**: All interactive elements have minimum 48×48px tap targets on mobile, achieved through `h-12` / `min-h-12` / `size-12` sizing.

### 3.6 Accessibility Interaction Patterns

**Keyboard navigation:**

| Element | Keys | Behavior |
|---------|------|----------|
| Tab bar | Tab / Shift+Tab | Navigate between tabs |
| Table rows | Tab to focus, Enter / Space | Toggle expand/collapse |
| Heatmap cells | Tab (data cells only) | Focus cell, show tooltip |
| Pagination | Tab / Enter | Navigate between page links |
| Sort headers | Tab / Enter | Navigate via link |
| Filter buttons | Tab / Enter / Space | Toggle media type |
| Date inputs | Tab / native date picker | Standard input behavior |
| Filter chips | Tab / Enter / Space | Remove filter |
| Follower spike dots | Pointer only | Open linked post (no keyboard equivalent — consider adding) |

**ARIA patterns:**

| Component | Attributes |
|-----------|-----------|
| Tab bar links | `aria-current="page"` on active tab |
| Table rows | `role="button"`, `tabIndex={0}`, `aria-expanded={boolean}` |
| Sort headers | `aria-sort="ascending"` or `"descending"` when active |
| Heatmap grid | `role="grid"`, `aria-label="Posting time heatmap..."` |
| Heatmap cells | `role="gridcell"`, `aria-label` with day/time/data summary, `tabIndex={0}` for data cells, `-1` for empty |
| Charts | `role="img"`, `aria-label` summarizing the data (e.g., "Follower growth: 1,200 to 3,400 followers over 90 days") |
| Follower spikes | `sr-only` paragraph listing all spikes with dates and gains |
| Pagination | `aria-label="Pagination"`, `aria-current="page"` on current, `aria-disabled` + `tabIndex={-1}` on boundaries |
| Loading skeleton | `role="status"`, `aria-label="Loading dashboard content"` |
| Decorative icons | `aria-hidden="true"` on icon circles and SVG decorations |
| Empty state icons | `aria-hidden="true"` |

**Focus rings**: `focus-visible:ring-3 ring-ring` (3px accent-colored ring). Table rows use `focus-visible:ring-inset` to prevent overflow clipping.

---

## 4. Onboarding Flow

```
Landing Page (/):
  │ Session cookie exists? → redirect to /dashboard
  │
  ▼ No session
  Show hero + features + "Get Started" CTA
  │
  ▼ Click "Get Started"
  /api/auth/threads → Threads OAuth consent screen (external)
  │
  ▼ User authorizes
  /api/auth/callback
  │ Store tokens (AES-256-GCM encrypted)
  │ Create backfill job (status: pending)
  │ Set session cookie (60-day, httpOnly, sameSite=lax)
  │
  ▼ Redirect to /dashboard
  Dashboard loads with backfill banner showing progress
  │ Pages display whatever data is already available
  │ Empty states show "importing" copy variant
  │ Backfill progress updates via Supabase Realtime subscription
  │
  ▼ Backfill completes
  Banner shows "Import complete" with CheckCircle
  Auto-hides after delay
  Router refreshes to show full data
```

**Landing page UX:**
- Hero: left-aligned text + right SVG illustration (desktop), centered stacked (mobile)
- Decorative shapes (gradient circles, dot-grid, dashed border) hidden on mobile
- Feature cards: 3-column grid (analytics) + 2-column grid (intelligence) on desktop, single column on mobile
- No authentication UI beyond the "Get Started" CTA — Threads OAuth handles everything

**First-run experience:**
- Dashboard renders immediately with backfill banner at top
- Each tab shows available data; empty states display contextual "importing" messages
- Backfill progress updates in real-time without page reload (Supabase Realtime → `useBackfillJob` hook)
- On complete: banner auto-hides, router refreshes to populate all sections

---

## 5. Dashboard Shell

**Layout structure:**

```
<div min-h-screen bg-background>
  ┌─────────────────────────────────────────────────┐
  │ DashboardHeader (sticky)                        │
  │ ┌─────────────────────────────────────────────┐ │
  │ │ "Spool" logo    @username    [Sign out]     │ │
  │ └─────────────────────────────────────────────┘ │
  │ border-b-2 border-border                        │
  ├─────────────────────────────────────────────────┤
  │ <div max-w-6xl mx-auto px-6>                    │
  │                                                 │
  │   [Token expiry banner]     ← if token expiring │
  │   [Backfill status banner]  ← if job exists     │
  │   [Viral recovery card]    ← v1 Phase 1         │
  │                                                 │
  │   ┌─ DashboardTabs ──────────────────────────┐  │
  │   │ Posts │ Timing │ Audience ┃ Scanner │ Compose│
  │   └──────────────────────────────────────────┘  │
  │   border-b-2 border-border, mb-8                │
  │                                                 │
  │   {children}  ← tab page content                │
  │                                                 │
  └─────────────────────────────────────────────────┘
</div>
```

**Header behavior:**
- Full-width with `border-b-2`
- Content constrained to `max-w-6xl`
- Sign out is a `<form>` with POST to `/api/auth/sign-out` (no JS required)

---

## 6. Posts Tab

### 6.1 Post Performance Table

**Columns:**

| Column | Key | Sortable | Alignment | Format |
|--------|-----|----------|-----------|--------|
| Post | `text_preview` | No | Left | Truncated text + media type icon in colored circle |
| Date | `published_at` | Yes | Right | `MMM D, YYYY` (e.g., "Jan 15, 2024") |
| Views | `views` | Yes | Right | Abbreviated: `1.2K`, `3.5M` |
| Likes | `likes` | Yes | Right | Abbreviated |
| Replies | `replies` | Yes | Right | Abbreviated |
| Reposts | `reposts` | Yes | Right | Abbreviated |
| Quotes | `quotes` | Yes | Right | Abbreviated |
| Shares | `shares` | Yes | Right | Abbreviated |
| Eng. Rate | `engagement_rate` | Yes | Right | `X.XX%` (2 decimal places) |
| WES | `wes` | No | Right | `X.XX` (2 decimals), bold; top performer gets `*` prefix + accent color |

**Media type icons** (colored circle + filled Phosphor icon):

| Type | Icon | Color |
|------|------|-------|
| TEXT | TextT | `bg-accent` (violet) |
| IMAGE | Image | `bg-secondary` (pink) |
| VIDEO | VideoCamera | `bg-tertiary` (amber) |
| CAROUSEL | SquaresFour | `bg-quaternary` (emerald) |

**Table behaviors:**
- Zebra striping: odd rows `bg-muted`, even rows `bg-white`
- Hover: `bg-accent/5` on non-expanded rows
- Expanded row: `bg-accent/5` persistent
- Counter above table: "Showing X-Y of Z posts" (left), "Page M of N" (right, desktop only)
- All numeric cells use `tabular-nums` for alignment

**Number formatting:**

```
>= 1,000,000 → X.XM (e.g., 1.2M)
>= 1,000     → X.XK (e.g., 3.5K)
< 1,000      → raw number
```

### 6.2 Filters & Sorting

**Media type toggles:**
- Four buttons: Text, Image, Video, Carousel
- Active: `candy` variant with type-specific background color, filled icon, white text
- Inactive: `outline` variant, regular icon weight
- Cannot deselect the last remaining type
- When all types selected: `types` param omitted from URL (treated as "no filter")

**Date range:**
- Two `type="date"` inputs with `min="2024-04-13"` (Threads API launch date)
- Labels: uppercase, bold, small, `tracking-wide`
- Responsive: `h-12 w-full` on mobile, `h-9 w-40` on desktop
- Changes trigger immediate navigation (no submit button)

**Active filter chips:**
- Appear in a second row below filters when any filter is active
- Each chip shows the filter value with an `X` button to remove
- Date chips formatted as `MMM D, YYYY`
- "Clear all" ghost button at the end
- Chips have `min-h-12` on mobile for 48px touch targets

**Sort behavior:**
- Click a sortable column header to sort by that column
- First click: descending. Second click on same column: ascending. Third: back to descending.
- Sort changes reset `page` to 1
- Active column shows bold `CaretDown` or `CaretUp`; inactive columns show faded `CaretUp`

### 6.3 Expandable Row Detail

**Interaction:**
- Click or press Enter/Space on a row to expand
- Only one row expanded at a time (expanding a new row collapses the previous)
- Expand/collapse uses `grid-template-rows: 0fr ↔ 1fr` with 300ms bounce easing
- Lazy mount: detail component not rendered until first expansion (prevents unnecessary API calls)

**Detail content:**
- Full post text (whitespace preserved via `whitespace-pre-wrap`)
- Sparkline chart (100px tall, full width): Views (solid line, `chart-1`) + Engagement Rate (dashed line, `chart-5`)
  - Lazy-loaded via `GET /api/posts/{id}/metrics`
  - Loading: centered "Loading metrics..." text
  - Error: centered error message in destructive color
  - Insufficient data (< 2 snapshots): "Not enough data points for a sparkline"
  - Chart legend below: solid line for Views, dashed for Eng. Rate
- "View on Threads" link with ArrowSquareOut icon (opens in new tab)

### 6.4 WES Column

- Computed client-side using `computeNormalizedWES()` from existing PostRow metrics
- Formula: `(likes×1 + replies×8 + reposts×3 + quotes×5 + shares×10) / views × 100`
- Not sortable in v0 (computed client-side, not available in SQL sort)
- Top performer on current page: `*` prefix + `text-accent` color + `sr-only` "(top performer)" label
- Tooltip on hover: "Weighted Engagement Score — algorithm-weighted metric"

### 6.5 [v1 Phase 1] Reselection Alert Banner

**When:** A post older than 7 days shows >20% increase in views or >50% increase in engagement between the two most recent metric snapshots.

**Where:** Above the post table, within the Posts tab (not in the global banner stack).

**UX:**
- Dismissible alert banner following `backfill-status-banner.tsx` pattern
- Shows: post preview text, metrics delta, and Threads permalink
- CTA: "Engage with new comments to keep momentum" + link to post on Threads
- Dismisses per session

### 6.6 [v1 Phase 1] Format Analysis Section

**Where:** Below the post table in the Posts tab.

**Content:**
- Grouped bar chart: avg views + avg WES per media type (TEXT, IMAGE, VIDEO, CAROUSEL)
- Text length analysis: bucket posts by character count (0-50, 50-150, 150-280), show engagement per bucket
- Recommendation text: "Your IMAGE posts get X% more engagement than TEXT posts"
- Follows `StickerCard` pattern with icon

### 6.7 [v1 Phase 2] Velocity Indicator

**What:** Launch Score badge on each post row — green/yellow/red indicator showing first-3-hour engagement velocity relative to user's historical average.

**Where:** Inline with each post row, next to the WES column or as a separate small indicator.

### 6.8 [v1 Phase 2] Comment Quality in Detail Row

**What:** Reply breakdown within the expandable row detail — count of short (<5 words), medium (5-20), long (20+) replies, plus Discussion Quality Score.

**Where:** New section in `PostRowDetail`, below the sparkline chart.

---

## 7. Timing Tab

### 7.1 Heatmap

**Grid:** 7 rows (Mon–Sun) × 24 columns (12a–11p), with day labels on the left and hour labels above.

**Cell behavior:**

| Cell State | Appearance | Interaction |
|------------|-----------|-------------|
| Has data (≥ 2 posts) | Colored background (interpolated muted → accent), engagement % text | Hover/focus shows tooltip, `tabIndex={0}`, `cursor-pointer` |
| Insufficient data (< 2 posts) | Dashed border, no fill | No interaction, `tabIndex={-1}` |

**Color interpolation:**
- Range: `hsl(210, 40%, 96%)` (muted) → `hsl(263, 90%, 66%)` (accent)
- Normalized 0-1 based on min/max engagement rates across all qualifying cells
- Text color: `foreground` when `t ≤ 0.5`, white when `t > 0.5`

**Tooltip:**
- Fixed position, centered above hovered cell
- Clamped to viewport edges (min 120px from edge)
- Shows: day name, formatted time, post count, avg engagement %, avg views
- Triggers on both hover (mouse) and focus (keyboard)
- Hides on mouse leave and blur

**Summary text** below the card title:
- With data: "Best times: Tue 9 AM, Thu 7 PM, Sat 10 AM" (top 3 slots with ≥ 2 posts, sorted by avg engagement)
- Without data: "Not enough data to determine best posting times yet."

**Legend:** Gradient bar at bottom-right: "Lower" — [gradient] — "Higher"

### 7.2 Timezone Selector

- `<select>` element in the card header, right-aligned next to the title
- Auto-detected from browser via `useSyncExternalStore` (falls back to UTC on server)
- Options grouped by continent (`<optgroup>`) using `Intl.supportedValuesOf("timeZone")`
- Changing timezone recalculates the entire grid without a server round-trip

### 7.3 Edge Case Banners

| Condition | Style | Message |
|-----------|-------|---------|
| < 20 total posts | `border-tertiary bg-tertiary/10` | "Post more to improve accuracy. Based on **N** posts so far." |
| All posts in same slot | `border-secondary bg-secondary/10` | "You always post at **Day Time**. Try varying your schedule to discover better times." |

Both appear above the heatmap grid, below the card header.

### 7.4 [v1 Phase 1] Cadence Optimizer Section

**Where:** New `StickerCard` below the heatmap on the Timing tab.

**Content:**
- **Stats bar:** Average posts/day (30d), average gap (hours), longest/shortest gap
- **Scatter chart:** X = hours since previous post, Y = views. Shows diversity filtering effect.
- **Recommendation banner:** If average gap < 18h: "Posts spaced 18-24+ hours apart get X% more views on average based on your data."
- **Same-day collision list:** Dates with 2+ posts, showing reach differential

**Data source:** Derived from `posts.published_at` + latest `post_metrics` — same data already fetched for heatmap.

---

## 8. Audience Tab

### 8.1 Follower Growth Chart

- `StickerCard` with floating `StickerCardIcon` (TrendUp, quaternary)
- Area chart: 300px tall, gradient fill from `chart-1` at 20% opacity to transparent
- X-axis: date labels (MMM D format), Y-axis: follower count with thousands separators

**Spike detection:**
- Spike = >5% follower gain from previous day
- Rendered as prominent dots (r=6, white stroke) on the chart line
- Dots are clickable — opens the nearest post (within 24h) in a new tab via `window.open`
- Cursor changes to pointer when a linked post exists

**Tooltip:**
- Standard: date + follower count
- On spike: adds green "+N followers" and linked post text preview (truncated)

**Empty state:**
- < 2 data points: `EmptyState` with importing/default copy
- Screen reader: `sr-only` paragraph lists all detected spikes

### 8.2 Demographics Charts

**Layout:** Two-column grid (country + city) + centered gender donut below, all in `StickerCard` wrappers.

**Bar charts (Country, City):**
- Horizontal bar chart, vertical layout
- Top 10 entries from latest `fetched_at` snapshot
- X-axis shows percentage, Y-axis shows location names
- Tooltip: "X.X% (N)"

**Gender donut:**
- Inner radius 50, outer 80, 2px foreground stroke
- Colors cycle: `secondary`, `tertiary`, `quaternary`, `chart-5`
- Legend beside chart (side-by-side on desktop, stacked on mobile)
- Centered in `max-w-lg` container

**Each chart** has its own `StickerCardIcon` with distinct color:
- Countries: GlobeHemisphereWest, primary
- Cities: MapPin, quaternary
- Gender: GenderIntersex, tertiary

### 8.3 Sub-100 Follower Gate

When `followersCount < 100`:
- Entire demographics section replaced with single `EmptyState`
- Title: "Audience insights unlock at 100 followers"
- Description: "You're at N — keep growing!"
- Icon: UsersThree, secondary color

### 8.4 [v1 Phase 2] Audience Fit Analysis

**Where:** New section in Audience tab.

**Content:**
- Audience Alignment Score: compare pre-viral vs post-viral engagement rates
- Demographic shift timeline using `demographics_history` table
- Recommendations when audience-content mismatch detected

### 8.5 [v1 Phase 2] Semantic Focus Score

**Where:** New section in Audience tab or potentially its own card.

**Content:**
- Focus Score (0-100): percentage of recent posts within top 2-3 topic clusters
- Rolling 30-day trend line
- Warning when score drops: "Your content has become less focused"
- Based on TF-IDF keyword extraction (no LLM)

---

## 9. Scanner Tab

### 9.1 Coming Soon State (v0)

`StickerCard` with `StickerCardIcon` (MagnifyingGlass, quaternary) and `EmptyState`:
- Title: "Content Quality Scanner"
- Description: "Analyze your posts for patterns the algorithm demotes — clickbait, engagement bait, and semantic duplicates. Coming soon."

### 9.2 [v1 Phase 3] Text Input & Real-Time Analysis

**Layout:** Full-width text area at top, analysis results below.

**Interaction:**
- User types or pastes draft post text
- Analysis runs on 500ms debounce after last keystroke
- Two analysis layers run in parallel:
  1. **Heuristic (client-side, instant):** Regex checks for clickbait openers, engagement bait, excessive hashtags (>5), ALL CAPS, emoji density, too-short posts (<20 chars)
  2. **LLM (server-side, streamed):** Tone analysis, topic coherence, semantic similarity to recent posts, shareability assessment

### 9.3 [v1 Phase 3] Quality Score Gauge

- Semicircular gauge (0-100) below the text input
- Color zones: 0-40 red (destructive), 40-70 yellow (tertiary), 70-100 green (quaternary)
- Score updates in real-time as heuristic results arrive; refines when LLM response completes

### 9.4 [v1 Phase 3] Flagged Issues & Suggested Rewrites

- Scrollable list below the gauge
- Each issue: severity badge (high/medium/low) + description + suggested fix
- LLM-generated rewrites appear inline with "Apply" button to replace text in the input

### 9.5 [v1 Phase 3] Analyze Existing Post Mode

- "Analyze existing post" button/link opens a post selector (modal or inline list from post table data)
- Selecting a post populates the text input and runs analysis
- Allows retroactive scoring of posting history

---

## 10. Compose Tab

### 10.1 Coming Soon State (v0)

`StickerCard` with `StickerCardIcon` (PencilLine, primary) and `EmptyState`:
- Title: "AI Content Composer"
- Description: "Draft algorithm-optimized posts based on your performance history, audience data, and what triggers shares. Coming soon."

### 10.2 [v1 Phase 3] Three-Panel Layout

```
┌────────────┬───────────────────────────┬─────────────────┐
│ Left Panel │ Center Panel              │ Right Panel     │
│            │                           │                 │
│ Topic      │ Editable draft cards      │ Quality score   │
│ selector   │ (2-3 variations)          │ Predicted       │
│            │                           │ engagement      │
│ Style      │ Streaming text generation │ Timing rec      │
│ options    │                           │                 │
│            │ Edit / regenerate buttons  │ Topic           │
│            │                           │ suggestions     │
└────────────┴───────────────────────────┴─────────────────┘
```

**Responsive:** On mobile, panels stack vertically: topic selector → drafts → scoring.

### 10.3 [v1 Phase 3] Streaming Draft Generation

**Interaction flow:**
1. User provides topic idea or selects "Generate ideas for me"
2. System sends context to LLM: top posts + metrics, demographics, topic clusters, cadence state
3. Text appears token-by-token via SSE streaming
4. 2-3 draft variations generated, each targeting a different share-trigger category
5. Each draft auto-runs through Quality Scanner on completion

**UX during generation:**
- Typing cursor animation at the end of streaming text
- "Stop generating" button to cancel mid-stream
- Drafts appear in sequence (first draft starts immediately, second after first completes)

### 10.4 [v1 Phase 3] Draft Cards with Scanner Integration

- Each draft in a `StickerCard` with inline quality score badge
- "Copy to clipboard" button (primary action — v1 is copy-paste only, no direct publishing)
- "Regenerate" button to re-draft with same parameters
- "Edit" mode: inline text editing within the card

### 10.5 [v1 Phase 3] Engagement Prediction Widget

- Shows predicted engagement range (25th-75th percentile) based on: media type, post length, posting time, topic similarity, cadence
- Displayed as a horizontal range bar with min/max labels
- Updates as draft text changes

### 10.6 [v1 Phase 3] Topic Suggestions Card

- "Suggested Topics" card in the right panel
- Each suggestion: topic name + relevance score + semantic distance indicator
- Click to populate the topic selector and trigger generation
- Based on analysis of top-performing posts + adjacent semantic neighborhoods

---

## 11. Data Visualization UX

### 11.1 Chart Interaction Patterns

All charts use shadcn's `ChartContainer` / `ChartTooltip` / `ChartTooltipContent` wrappers (built on Recharts). Direct Recharts imports are wrapped — never used bare.

| Chart Type | Component | Interaction |
|------------|-----------|-------------|
| Sparkline (post detail) | LineChart | Hover for tooltip, active dot (r=3) |
| Area chart (followers) | AreaChart | Hover for tooltip, spike dots clickable |
| Bar chart (demographics) | BarChart (horizontal) | Hover for tooltip |
| Donut chart (gender) | PieChart | Hover for tooltip |
| Heatmap (timing) | Custom grid | Hover/focus for fixed tooltip |

### 11.2 Tooltip Behavior

- **Chart tooltips**: Use `ChartTooltipContent` with custom formatters. Appear above/beside the hovered data point.
- **Heatmap tooltip**: Fixed-position `div`, centered above hovered cell, clamped to viewport bounds. Styled as a mini `StickerCard` (2px border, hard shadow, `radius-sm`).
- All tooltips include textual data — never rely on color alone.

### 11.3 Color Encoding Rules

| Data Type | Color Source |
|-----------|-------------|
| Media types | `accent` (TEXT), `secondary` (IMAGE), `tertiary` (VIDEO), `quaternary` (CAROUSEL) |
| Chart series | CSS variables `--chart-1` through `--chart-5` |
| Gender donut | `secondary`, `tertiary`, `quaternary`, `chart-5` |
| Heatmap | Interpolated `hsl(210,40%,96%)` → `hsl(263,90%,66%)` |
| Spikes/gains | Emerald-600 for positive follower gains |

### 11.4 Responsive Chart Sizing

- Charts use `w-full` inside `ChartContainer` — width is always 100% of parent
- Fixed heights: sparkline 100px, follower chart 300px, demographics charts 300px, gender donut 200×200px
- On narrow viewports: charts maintain height, compress horizontally (Recharts handles this via `ResponsiveContainer`)

### 11.5 Screen Reader Alternatives

| Chart | Accessible Alternative |
|-------|----------------------|
| Follower area chart | `role="img"`, `aria-label` with date range + start/end follower counts |
| Follower spikes | `sr-only` paragraph listing each spike date and follower gain |
| Demographics bar | `role="img"`, `aria-label` with top entry name and percentage |
| Gender donut | `role="img"`, `aria-label` with each gender and percentage |
| Post sparkline | `role="img"`, `aria-label` with snapshot count and latest views |
| Timing heatmap | `role="grid"` with `aria-label`, each cell has `role="gridcell"` with full text description |

---

## 12. Error & Recovery Flows

### 12.1 Network Errors

- **Page-level fetch failure** (Supabase RPC error): Renders `ErrorState` component in place of the tab content
  - Title: "Something went wrong"
  - Description: Tab-specific message (e.g., "We couldn't load your posts right now")
  - Action: "Try again" → `router.refresh()`
- **Client-side fetch failure** (sparkline metrics): Inline error text in destructive color within the expanded row
- **Error boundary** (`dashboard/error.tsx`): Catches unhandled errors, shows `StickerCard` with retry button calling `reset()`

### 12.2 Token Expiry & Re-auth

Two severity tiers, detected via `getTokenStatus()`:

| Tier | Trigger | Visual | Action |
|------|---------|--------|--------|
| **Expiring** | Token expires within 7 days | Amber border, WarningCircle icon | "Reconnect" link to `/api/auth/threads` |
| **Expired** | Token already expired | Red border, WarningCircle icon | "Reconnect" link to `/api/auth/threads` |

Banner renders at the top of the dashboard layout (above backfill banner). Only shown when `tokenStatus !== "valid"`.

### 12.3 Backfill Failure & Retry

| Scenario | Indicator | Recovery |
|----------|-----------|----------|
| Job failed | Red banner with error message, last stage, relative time | "Retry import" button → POST to start new backfill job |
| Job stale (pending >30s or running >90s) | Amber sub-banner within progress banner | "Resume import" button |
| Job complete | Green banner, auto-hides after delay | Router refresh loads new data |

**Retry behavior:**
- Button shows "Retrying..." / "Resuming..." disabled state during API call
- On success: new job starts, banner transitions to importing state
- On failure: error message updates

### 12.4 Rate Limit Handling

**Current (v0):** Threads API client logs rate limit headers at 80%+ usage. No user-facing indication.

**[v1 Phase 2]:** When velocity tracking adds more frequent API calls, consider:
- User-facing banner when rate limits are approaching
- Automatic backoff with estimated retry time
- Graceful degradation: show cached data with "last updated" timestamp
