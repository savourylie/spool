# UX Design: Spool

> Redesigned from: docs/UX_DESIGN.md (previous version)
> Audit report: docs/reports/UX_DESIGN_REPORT.md
> Sources: docs/PRD.md, docs/FEATURES.md, codebase inspection
> Date: 2026-03-26

---

## Part I: UX Foundations

### 1. User Intent & Mental Model

**Primary user intent:** "See what's working, understand the algorithm, and know what to post next."

**Intended mental model (from spec):**
The original spec positioned Spool as a v0 analytics dashboard (observe and understand) with v1 AI intelligence features (create) coming later. Two tab groups — Analyze and Create — reflected this evolution, with Scanner and Compose showing "Coming Soon" placeholders.

**Implemented mental model (from code):**
The codebase presents a complete content intelligence platform from day one. All five tabs are fully functional. Users encounter analytics, algorithmic scoring (WES, velocity, cadence), content quality analysis, and AI-powered draft generation in a single session. The "Analyze | Create" tab grouping exists but is no longer a phased roadmap — it's a workflow split.

**Mental model drift:**

| Aspect | Spec Intent | Code Reality | Drift | Verdict |
|--------|-------------|--------------|-------|---------|
| Product scope | v0 analytics dashboard, v1 AI intelligence | Full intelligence platform, all phases live | Product is 3x the originally-specced scope | Beneficial — the full product is live and functional |
| Tab groups | Analyze (live) vs Create (coming soon) | Analyze (live) vs Create (live) | "Soon" badges removed, both groups active | Beneficial — no misleading placeholders |
| Algorithmic concepts | Introduced gradually per phase | WES, velocity, cadence, format analysis all visible at once | Multiple algorithmic concepts on first visit | Neutral → Harmful — needs progressive introduction |
| Onboarding flow | Landing → dashboard with banner | Landing → /loading (full-screen) → dashboard | Dedicated first-run experience | Beneficial — more focused |
| Feature discovery | Analytics-first, AI later | All features visible in navigation from day one | No graduated complexity | Harmful — can overwhelm new users |

**Likely misconceptions (updated):**
- "WES is just another metric" → Correction: WES reflects how the algorithm weights engagement types differently. Shares (10x) and replies (8x) matter far more than likes (1x). The UX should make this weighting visible on first encounter.
- "Scanner and Composer are separate tools" → Correction: They're parts of a creation workflow. The Scanner evaluates content quality; the Composer generates quality-optimized drafts. Users should flow naturally between them.
- "The Audience tab is about demographics" → Correction: It now also measures content-audience alignment and topic focus. Users seeing demographics alone miss the strategic insights below the fold.

**Redesign decisions:**
- **Keep:** Analyze | Create tab grouping — it accurately frames the product's dual purpose
- **Keep:** Dedicated `/loading` page for first-run — superior to banner-only approach
- **Change:** Add mental model bridge in the navigation. Subtitle under tab groups: the Analyze group helps users *understand* their data; the Create group helps them *act on it*
- **Change:** WES column needs inline education — first-encounter info icon that explains algorithm weighting
- **Change:** Cross-tab flows from Scanner ↔ Composer and Post detail → Scanner to reinforce the "analyze → improve" mental model
- **Change:** Progressive disclosure on the Audience tab to prevent information overload

**Mental model diagram (redesigned):**

```
                    SPOOL
    "Understand your data. Improve your content."
                      |
        +-------------+-------------+
        |                           |
    UNDERSTAND                    CREATE
   (Analyze tabs)             (Create tabs)
        |                           |
   +----+----+              +-------+-------+
   |    |    |              |               |
 Posts Timing Audience   Scanner        Composer
   |    |    |              |               |
   |    |    |              +-------+-------+
   |    |    |                      |
   |    |    |             "Analyze → Improve"
   |    |    |              cross-flow links
   +----+----+--------------+------+
                |
         Shared concepts:
         WES, engagement rate,
         posting cadence, audience fit
```

---

### 2. Information Architecture

**IA Comparison:**

| Concept | In Spec? | In Code? | Spec Group | Code Location | Delta | Action |
|---------|----------|----------|------------|---------------|-------|--------|
| Post performance table | Yes | Yes | Posts tab | `/dashboard/posts` | None | Keep |
| Post filters + sort | Yes | Yes | Posts tab | PostFilters component | None | Keep |
| Post detail (sparkline) | Yes | Yes | Posts tab | PostRowDetail | Enhanced with comments | Keep |
| WES column | Yes | Yes | Posts tab | PostTable | Present but unexplained | Modify — add education |
| Format analysis | Yes (v1) | Yes | Posts tab | FormatAnalysis below table | New section in Posts tab | Keep |
| Reselection alerts | Yes (v1) | Yes | Posts tab | ReselectionAlert above table | New section in Posts tab | Keep |
| Velocity indicator | Yes (v1) | Yes | Posts tab | VelocityIndicator in PostTable | Inline badge per row | Keep |
| Comment quality | Yes (v1) | Yes | Posts tab | CommentQuality in PostRowDetail | Nested in detail panel | Keep |
| Timing heatmap | Yes | Yes | Timing tab | TimingHeatmap | None | Keep |
| Cadence optimizer | Yes (v1) | Yes | Timing tab | CadenceOptimizer below heatmap | New section in Timing tab | Keep |
| Follower growth chart | Yes | Yes | Audience tab | FollowerChart | None | Keep |
| Demographics | Yes | Yes | Audience tab | DemographicsCharts | None | Keep |
| Semantic focus | Yes (v1) | Yes | Audience tab | SemanticFocus | New section, high scroll | Modify — progressive disclosure |
| Audience fit | Yes (v1) | Yes | Audience tab | AudienceFit | New section, very high scroll | Modify — progressive disclosure |
| Quality scanner | Yes (v1) | Yes | Scanner tab | QualityScanner | Fully live (was coming soon) | Keep — update spec |
| AI composer | Yes (v1) | Yes | Compose tab | Composer | Fully live (was coming soon) | Modify — guided entry flow |
| Topic suggestions | Yes (v1) | Yes | Compose tab | TopicSuggestions | In right panel | Keep |
| Engagement prediction | Yes (v1) | Yes | Scanner + Compose | PredictionWidget | Shared component | Keep |
| Full-screen loading | No | Yes | First-run | `/loading` page | New route | Keep (positive) |
| Saved drafts browsing | No | No | N/A | N/A | Noted in FEATURES.md as missing | Add — future consideration |

**New concept inventory (redesigned):**

| Concept | Group | Classification | Source | Rationale |
|---------|-------|----------------|--------|-----------|
| Post performance table | Posts | Primary | Spec | Core feature, first thing users see |
| Post filters & sort | Posts | Primary | Spec | Essential for navigating posts |
| Post detail panel | Posts | Secondary | Spec | On-demand per row |
| WES column | Posts | Primary | Code | Needs inline education |
| Velocity badges | Posts | Secondary | Code | Visual enhancement per row |
| Format analysis | Posts | Secondary | Code | Below-fold insight card |
| Reselection alerts | Posts | Secondary | Code | Contextual notification |
| Comment quality | Posts | Hidden (in detail) | Code | Nested in expanded row |
| Timing heatmap | Timing | Primary | Spec | Core feature of tab |
| Cadence optimizer | Timing | Secondary | Code | Below-fold analysis |
| Follower growth | Audience | Primary | Spec | Lead section |
| Demographics | Audience | Primary | Spec | Core audience data |
| Semantic focus | Audience | Secondary | Code | Collapsible insight section |
| Audience fit | Audience | Secondary | Code | Collapsible insight section |
| Quality scanner input | Scanner | Primary | Code | Main interaction area |
| Quality gauge | Scanner | Primary | Code | Immediate feedback |
| Issues + rewrites | Scanner | Secondary | Code | Appears after analysis |
| Engagement prediction | Scanner/Compose | Secondary | Code | Supporting data |
| Topic + style input | Compose | Primary | Code | Entry point for generation |
| Draft cards | Compose | Primary | Code | Main output |
| Timing recommendations | Compose | Secondary | Code | Right panel supporting data |
| Topic suggestions | Compose | Secondary | Code | Right panel ideas |

**Grouped structure (redesigned):**

#### Posts — Performance Intelligence
- Post table with WES: Primary
- Filters + sort: Primary
- Post detail (sparkline + comments): Secondary (on expand)
- Reselection alerts: Secondary (conditional)
- Format analysis: Secondary (below table)
- Rationale: Table-first design, insights revealed on demand
- Delta from previous: Added WES education, no structural change needed

#### Timing — Schedule Optimization
- Heatmap: Primary
- Cadence optimizer: Secondary (below heatmap)
- Rationale: Two related sections, manageable density
- Delta from previous: No change needed — two sections is appropriate

#### Audience — Growth & Alignment
- Follower growth chart: Primary
- Demographics: Primary
- Semantic focus: Secondary (collapsible)
- Audience fit: Secondary (collapsible)
- Rationale: **Changed** — secondary sections now collapsible to manage 4-section density
- Delta from previous: Added progressive disclosure for semantic focus and audience fit

#### Scanner — Content Quality Check
- Text input + post selector: Primary
- Quality gauge: Primary
- Issues list: Secondary (appears after analysis)
- Rewrites: Secondary (appears after analysis)
- Engagement prediction: Secondary (below results)
- Rationale: Vertical flow from input → score → detail
- Delta from previous: Updated from "coming soon" to fully specced

#### Compose — AI Draft Generation
- Topic + style selection: Primary
- Draft cards: Primary
- Quality gauge + prediction + timing: Secondary (right panel, appears after generation)
- Topic suggestions: Secondary (right panel)
- Rationale: **Changed** — right panel content deferred until drafts exist to reduce initial cognitive load
- Delta from previous: Guided entry flow, right panel deferred

**IA hierarchy diagram (redesigned):**

```
Spool
+-- / (Landing)
|   +-- Hero + features + "Get Started" CTA
|
+-- /loading (First-run backfill progress)
|   +-- Animated progress → redirect to /dashboard
|
+-- /dashboard
    +-- [SHELL] Header (logo, username, sign-out)
    +-- [SHELL] Banners (token expiry > backfill > viral recovery)
    +-- [SHELL] Tab navigation
    |
    +-- /dashboard/posts (ANALYZE group)
    |   +-- [Primary] Post Performance table with WES
    |   |   +-- [Primary] Filters (media type, date range)
    |   |   +-- [Secondary] Active filter chips
    |   |   +-- [Conditional] Reselection alert banner
    |   |   +-- [On expand] Post detail (text, sparkline, comments)
    |   |   +-- [Primary] Pagination
    |   +-- [Secondary] Format Analysis card
    |
    +-- /dashboard/timing (ANALYZE group)
    |   +-- [Primary] Timing Heatmap card
    |   |   +-- Timezone selector
    |   |   +-- Edge case banners
    |   +-- [Secondary] Cadence Optimizer card
    |
    +-- /dashboard/audience (ANALYZE group)
    |   +-- [Primary] Follower Growth card
    |   +-- [Primary] Demographics cards (country, city, gender)
    |   +-- [Collapsible] Semantic Focus card
    |   +-- [Collapsible] Audience Fit card
    |
    +-- /dashboard/scanner (CREATE group)
    |   +-- [Primary] Text input + post selector
    |   +-- [Primary] Quality Gauge
    |   +-- [On analysis] Issues list
    |   +-- [On analysis] Suggested rewrites
    |   +-- [On analysis] Engagement prediction
    |   +-- [Cross-flow] "Generate better version" → /dashboard/compose
    |
    +-- /dashboard/compose (CREATE group)
        +-- [Left] Topic input + style selection
        +-- [Center] Draft cards (streaming)
        +-- [Right, after generation] Quality + prediction + timing + topics
```

---

### 3. Affordances & Action Clarity

**Affordance gap analysis:**

| Element | Spec Action | Implemented Action | Match? | Issue | Resolution |
|---------|------------|-------------------|--------|-------|------------|
| Sort column headers | Click to sort, caret indicators | Link-based sort with CaretDown/CaretUp | Full | — | Keep |
| Post rows | Click/Enter/Space to expand | role="button" with keyboard support | Full | — | Keep |
| Media type filters | Toggle on/off, prevent last deselect | Button toggles with last-type protection | Full | — | Keep |
| Date range inputs | Change triggers navigation | HTML5 date inputs with immediate nav | Full | — | Keep |
| Filter chips | X to remove, "Clear all" | Chip buttons with clear action | Full | — | Keep |
| Heatmap cells | Hover/focus for tooltip | Custom tooltip with viewport clamping | Full | — | Keep |
| Follower spike dots | Click to open linked post | onClick only, no keyboard | Partial | No keyboard support | Add tabIndex + onKeyDown |
| Backfill banner retry | Click to retry failed import | Button with loading state | Full | — | Keep |
| Token expiry reconnect | Click to re-authenticate | Link to OAuth endpoint | Full | — | Keep |
| Viral recovery dismiss | Click X to dismiss for 7 days | localStorage with TTL | Full | — | Keep |
| Scanner text input | Type to analyze | Textarea with 500ms debounce | Full | — | Keep |
| Scanner post selector | Click to analyze existing | Collapsible toggle button | Partial | Not immediately obvious | Improve discoverability |
| Scanner "Apply" rewrite | Click to replace text | Button per rewrite | Full | — | Keep |
| Composer topic input | Enter topic text | Textarea, disabled during generation | Full | — | Keep |
| Composer style presets | Click to select style | 5 toggle buttons | Full | — | Keep |
| Composer "Generate" | Click to start generation | Candy button, disabled states | Full | — | Keep |
| Composer "Stop" | Click to cancel generation | Button with abort controller | Full | — | Keep |
| Draft copy | Click to copy text | Clipboard API with 2s feedback | Full | — | Keep |
| Draft edit | Click to toggle inline editing | Textarea swap with character count | Full | — | Keep |
| Draft regenerate | Click to regen single draft | Button per card | Full | — | Keep |
| Topic suggestion click | Click to populate topic | Button per suggestion | Full | — | Keep |
| WES column | Hover for tooltip | title attribute tooltip | Partial | Brief tooltip, no education | Add info icon with fuller explanation |
| Scanner → Composer | N/A | Not implemented | Missing | No cross-flow | Add "Generate better version" action |
| Post detail → Scanner | N/A | Not implemented | Missing | No cross-flow | Add "Scan this post" action |
| Composer timing → Timing tab | N/A | Not linked | Missing | No cross-flow | Add "See full analysis" link |

**Redesigned affordance inventory:**

| Element | Action | Type | Visual/Interaction Signal |
|---------|--------|------|--------------------------|
| Sort headers | Sort table by column | Clickable | Bold caret icon, hover text color change |
| Post rows | Expand detail panel | Clickable | role="button", cursor-pointer, hover bg |
| Media type buttons | Toggle filter | Clickable | Color change (active: filled candy; inactive: outline) |
| Date inputs | Set date filter | Editable | Standard date picker, immediate navigation |
| Filter chips | Remove filter | Clickable | X icon, hover bg change |
| Clear all | Remove all filters | Clickable | Ghost button |
| Heatmap cells | View detail | Read-only (hover/focus) | Color intensity + fixed tooltip |
| Follower spike dots | View linked post | Clickable | Prominent dot (r=6), cursor-pointer, keyboard accessible |
| Reselection dismiss | Dismiss alert | Clickable | X icon button |
| Scanner textarea | Input draft text | Editable | Placeholder text, character count |
| Scanner post selector | Select existing post | Clickable | Toggle button with clear label + collapsible list |
| Scanner "Generate better" | Cross-flow to Composer | Clickable | Button below results, links to /dashboard/compose |
| Post detail "Scan this" | Cross-flow to Scanner | Clickable | Link in expanded detail, opens Scanner with post |
| Composer "See full timing" | Cross-flow to Timing | Clickable | Link in timing recommendations card |
| Quality gauge | View score | Read-only | Animated arc, color-coded |
| Issues list | View problems | Read-only | Severity-colored badges |
| Rewrite "Apply" | Replace draft text | Final | Button per suggestion |
| Composer generate | Start AI generation | Final | Candy button, becomes "Stop" during gen |
| Draft cards | Select draft | Clickable | Border/shadow change on selection |
| Draft copy | Copy to clipboard | Final | Button with 2s "Copied!" feedback |
| Draft edit | Toggle editing | Clickable | Button toggles textarea mode |
| Draft regenerate | Regenerate one draft | Final | Button with loading state |
| WES info icon | Learn about WES | Clickable | Info circle icon, opens popover with weighting explanation |
| Audience collapsible | Expand/collapse section | Clickable | Chevron icon, animated expand/collapse |

**Affordance rules (redesigned):**
- If a user sees a table header with a caret, they can click to sort
- If a user sees a post row, they can click to expand details
- If a user sees colored toggle buttons, they can filter by type
- If a user sees an X icon, they can dismiss or remove
- If a user sees a "→" link, it leads to a related feature on another tab
- If a user sees a gauge or chart, they can hover/focus for detail
- If a user sees a chevron next to a section header, they can collapse/expand it

**Ambiguous affordances to resolve:**
- **Scanner "Analyze existing post" button:** Rename to "Or scan an existing post" and move directly below textarea as inline prompt when textarea is empty
- **Composer "Surprise me" button:** Only visible in idle state — change to always visible as secondary action near topic input: "Need inspiration? Generate ideas for me"
- **WES column asterisk:** Top performer gets `*` prefix but meaning is not obvious — add sr-only label "(top performer)" and a brief tooltip

---

### 4. Cognitive Load & Decision Minimization

**Friction point comparison:**

| Friction Point | In Spec? | Addressed in Code? | Current State | Redesign Action |
|---------------|----------|-------------------|---------------|-----------------|
| First-run wait time | Yes | Yes + improved | Full-screen /loading page with animated progress and personality messages | Keep — superior to spec's banner approach |
| Table overwhelm (many columns) | Yes | Yes | 10 columns with abbreviations, tabular-nums for alignment | Keep — well-handled |
| Media type selection | Yes | Yes | Toggle buttons with last-type protection | Keep |
| Date range friction | Yes | Yes | Immediate navigation, no submit button | Keep |
| Empty states during import | Yes | Yes | isImporting-aware copy variants across all components | Keep |
| Timing heatmap low data | Yes | Yes | Banner: "Post more to improve accuracy" | Keep |
| Sub-100 follower gate | Yes | Yes | Demographics replaced with growth prompt | Keep |

**New friction points (from implementation):**

| Moment | Location | Type | Simplification |
|--------|----------|------|----------------|
| First visit to Audience tab | Audience page | Overwhelm — 4 sections, long scroll | Add collapsible sections with summary headers for semantic focus and audience fit |
| First visit to Composer | Compose page | Choice overload — topic + style + 3 panels visible | Defer right panel until drafts exist; consider step-by-step first-use |
| Understanding WES | Posts table | Uncertainty — unfamiliar metric | Add info icon with brief popover explaining algorithm weights |
| Scanner mode choice | Scanner page | Choice — type new vs analyze existing | Remove choice: single empty state prompt "Type a new draft or select an existing post below" |
| After generating drafts | Composer center panel | Uncertainty — what to do with drafts | Add clear next-step guidance: "Copy your favorite draft, or edit it first" |
| Discovering cross-flows | Scanner results, post detail | Missing affordance — no link between analysis and creation | Add contextual "Generate better version" and "Scan this post" actions |

**Defaults (redesigned):**
- Sort: `published_at` descending — most recent posts first (unchanged, correct default)
- Media types: All selected — no filter applied (unchanged)
- Date range: None — show all posts (unchanged)
- Timezone: Browser-detected via `useSyncExternalStore` (unchanged for heatmap; **fix Composer to match**)
- Composer style: None pre-selected — user must choose (unchanged, intentional friction)
- Audience collapsibles: Semantic Focus and Audience Fit **collapsed by default** — Summary metrics visible in headers
- Composer right panel: **Hidden until first draft generated** — reduces initial cognitive load

**Progressive disclosure plan (redesigned):**
- **Show first (always visible):**
  - Posts: Table + filters + pagination
  - Timing: Heatmap with timezone selector
  - Audience: Follower chart + demographics
  - Scanner: Text input area + empty state prompt
  - Composer: Topic input + style buttons + generate CTA
- **Show on demand (user action required):**
  - Posts: Expanded row detail (click), format analysis (scroll)
  - Timing: Cadence optimizer (scroll)
  - Audience: Semantic focus + audience fit (click chevron to expand)
  - Scanner: Gauge + issues + rewrites + prediction (appears on analysis)
  - Composer: Right panel (appears after generation), draft cards (appear on generation)
- **Show on context (conditional):**
  - Reselection alerts (when detected)
  - Velocity badges (on recent posts)
  - Viral recovery card (when viral post detected)
  - Token expiry banner (when expiring/expired)
  - Backfill banner (when import in progress)

**Decision count per flow (redesigned):**

| Flow | Spec Target | Code Reality | Redesign Target | How |
|------|-------------|--------------|-----------------|-----|
| First run (landing → dashboard) | 1 (click "Get Started") | 1 (same) | 1 | Keep — OAuth handles everything |
| View best posts | 0 (auto-sorted by date) | 0 | 0 | Keep — default sort shows recent, user can change |
| Analyze a draft | 1 (paste text) | 2 (type text + wait) | 1 | Merge "type new" and "select existing" into unified input with inline prompt |
| Generate drafts | 2 (topic + generate) | 3 (topic + style + generate) | 3 | Keep style as intentional choice — it differentiates drafts meaningfully |
| Explore audience insights | 0 (scroll) | 4 sections visible, scroll | 2 primary + 2 on-demand | Collapse secondary sections |

---

### 5. State Design & Feedback

**State coverage matrix:**

| Screen/Element | State | In Spec? | In Code? | Quality | Redesign Action |
|---------------|-------|----------|----------|---------|-----------------|
| Post table | Empty | Yes | Yes | Good — isImporting-aware copy | Keep |
| Post table | Loading | Yes | Yes | Good — skeleton rows | Keep |
| Post table | Success | Yes | Yes | Good — full table with all features | Keep |
| Post table | Error | Yes | Yes | Good — ErrorState with retry | Keep |
| Post detail sparkline | Loading | Yes | Yes | Adequate — "Loading metrics..." text | Keep |
| Post detail sparkline | Error | Yes | Yes | Good — destructive color message | Keep |
| Post detail sparkline | Insufficient | Yes | Yes | Good — "Not enough data points" | Keep |
| Comment quality | Loading | No | Yes | Good — purpose-built skeleton | Keep |
| Comment quality | Error | No | Yes | Good — retry button | Keep |
| Comment quality | Empty | No | Yes | Good — "No replies yet" | Keep |
| Timing heatmap | Empty | Yes | Yes | Good — Clock icon empty state | Keep |
| Timing heatmap | Low data | Yes | Yes | Good — warning banner | Keep |
| Timing heatmap | Same-slot | Yes | Yes | Good — recommendation banner | Keep |
| Cadence optimizer | Empty | No | Yes | Good — Timer icon empty state | Keep |
| Follower chart | Empty | Yes | Yes | Good — TrendUp icon empty state | Keep |
| Demographics | Sub-100 gate | Yes | Yes | Good — growth prompt | Keep |
| Demographics | Empty per chart | Yes | Yes | Good — per-section empty states | Keep |
| Semantic focus | Empty | No | Yes | Good — Crosshair icon | Keep |
| Semantic focus | Low score | No | Yes | Good — warning banner | Keep |
| Audience fit | Empty | No | Yes | Good — UsersFour icon | Keep |
| Scanner input | Empty | No | Yes | Good — MagnifyingGlass empty state | Modify — add inline prompt |
| Scanner analysis | Loading | No | Yes | Good — LLM streaming indicator | Keep |
| Scanner analysis | Error | No | Yes | Good — error message display | Keep |
| Prediction widget | Insufficient | No | Yes | Good — shows required post count | Keep |
| Composer | Idle | No | Yes | Good — empty center panel | Modify — clearer guidance |
| Composer | Generating | No | Yes | Good — streaming cursor, stop button | Keep |
| Composer | Complete | No | Yes | Good — drafts visible, right panel populated | Keep |
| Composer | Error | No | Yes | Good — error message + retry | Keep |
| Draft cards | Streaming | No | Yes | Good — blinking cursor | Keep |
| Draft cards | Editing | No | Yes | Good — textarea swap, char count | Keep |
| Backfill banner | Pending | Yes | Yes | Good — spinner + "Preparing" | Keep |
| Backfill banner | Running | Yes | Yes | Good — progress + stage + time | Keep |
| Backfill banner | Complete | Yes | Yes | Good — auto-hide after delay | Keep |
| Backfill banner | Failed | Yes | Yes | Good — error + retry button | Keep |
| Backfill banner | Stale | Yes | Yes | Good — amber sub-banner + resume | Keep |
| Token expiry | Expiring | Yes | Yes | Good — amber banner + reconnect | Keep |
| Token expiry | Expired | Yes | Yes | Good — red banner + reconnect | Keep |
| Viral recovery | Active | No | Yes | Good — countdown + playbook | Keep |
| Viral recovery | Dismissed | No | Yes | Good — localStorage 7-day TTL | Keep |
| Loading page | Progress | No | Yes | Good — animated stages | Keep |
| Loading page | Failed | No | Yes | Good — error + retry | Keep |
| Loading page | Complete | No | Yes | Good — "All done!" + redirect | Keep |
| Composer best times | UTC default | Yes (browser TZ) | No (uses UTC) | **Poor** — wrong timezone | **Fix** — use browser timezone |

#### Composer (Redesigned State Detail)

| State | User Sees | User Understands | User Can Do |
|-------|-----------|------------------|-------------|
| Idle | Topic input, style buttons, "Generate" disabled, empty center | "I need to enter a topic and pick a style first" | Type topic, select style, click "Surprise me" |
| Generating | Streaming cursor in draft cards, "Stop" button, disabled inputs | "My drafts are being created" | Watch progress, click "Stop" to cancel |
| Complete | 2-3 draft cards, right panel appears with gauge + prediction + timing | "Here are my options — I can compare, edit, or copy" | Select draft, copy, edit, regenerate, view quality/prediction |
| Partial (stopped) | 1+ drafts visible, some incomplete | "I stopped early but can use what's done" | Work with completed drafts, regenerate, generate new |
| Error | Error message in center panel | "Something went wrong" | Retry generation, change topic/style |

#### Audience Collapsible Sections (New)

| State | User Sees | User Understands | User Can Do |
|-------|-----------|------------------|-------------|
| Collapsed (default) | Section header with score summary + chevron | "There's more data here if I want it" | Click to expand |
| Expanded | Full chart + analysis | "Here's the detailed analysis" | Read, interact with chart, click to collapse |

**Feedback mechanisms (redesigned):**
- **Backfill progress:** Real-time updates via Supabase Realtime, relative timestamps every 5s
- **Scanner debounce:** 500ms delay prevents analysis on every keystroke
- **Composer streaming:** Token-by-token text with cursor animation
- **Copy confirmation:** "Copied!" text for 2 seconds
- **Generation auto-quality:** Each draft auto-scores on completion
- **Stale detection:** Amber warning when backfill job hasn't updated
- **Collapsible sections:** Smooth expand/collapse animation with bounce easing

**State transition diagram (redesigned — Composer):**

```
[Idle] ──topic+style──→ [Ready to Generate]
  ↑                            |
  | reset                     generate
  |                            ↓
  |                     [Generating]
  |                      |       |
  |                   complete  stop/error
  |                      |       |
  |                      ↓       ↓
  |                  [Complete] [Partial/Error]
  |                      |       |
  |                  edit/copy/  retry/
  |                  regenerate  regenerate
  |                      |       |
  +──────────────────────+───────+
```

---

### 6. Flow Integrity Check

**Flow breakage report:**

| Risk | Where | Spec Intent | Code Reality | Impact | Mitigation |
|------|-------|-------------|-------------|--------|------------|
| Scanner dead-end after analysis | Scanner results | N/A (wasn't specced) | User sees score + issues but no "next step" to fix via AI | User must manually navigate to Composer | Add "Generate better version" button below scanner results that opens Composer with context |
| Post detail dead-end | Expanded row | Only "View on Threads" action | No path to scan, analyze, or improve the post | Missed opportunity for engagement loop | Add "Scan this post" link in detail panel |
| Composer timing isolation | Compose right panel | Shows 3 best times | No link to full Timing tab analysis | Users curious about timing patterns must navigate manually | Add "See full analysis →" link |
| Composer UTC timezone | Compose best-times | Browser timezone | Uses UTC ("Tue 3 AM" when user is in PST) | Wrong time recommendations | Pass browser timezone or use useSyncExternalStore |
| Audience section discovery | Audience tab scroll | All sections visible | Semantic focus and audience fit require significant scrolling | May never be discovered by users | Collapse by default with summary in header |
| After-copy dead end | Composer draft copy | "Copy to clipboard" | No guidance after copy | User copies text but gets no "what now?" cue | Add subtle "Paste this into Threads to publish" hint after copy |

**Visibility decisions (redesigned):**
- **Must be visible:** Post table, filters, heatmap, follower chart, demographics, scanner input, composer topic/style — these are the primary actions on each tab
- **Can be implied:** Format analysis (below-fold scroll), cadence optimizer (below-fold scroll), WES weighting (info icon on demand), audience secondary sections (collapsed)

**Cross-flow dependencies (redesigned):**
- **Posts → Scanner:** "Scan this post" in expanded detail → opens Scanner with post text pre-filled — Currently: Not implemented
- **Scanner → Composer:** "Generate better version" after analysis → opens Composer with topic seeded from analyzed text — Currently: Not implemented
- **Composer → Timing:** "See full analysis" in timing recommendations → navigates to Timing tab — Currently: Not linked
- **Composer → Scanner:** Auto-quality analysis on draft completion → gauge updates in right panel — Currently: Works
- **Landing → Loading → Dashboard:** OAuth → `/loading` progress → redirect to `/dashboard` — Currently: Works

**Dead ends found in implementation:**
- **Scanner results:** After seeing score/issues/rewrites, no forward action → Add "Generate better version" CTA
- **Post detail panel:** Only "View on Threads" outbound → Add "Scan this post" link
- **Composer after copy:** "Copied!" feedback but no next step → Add "Paste into Threads" hint
- **Composer after complete:** Drafts visible but no "start fresh" guidance → Add "New topic" button that resets state
- **Topic suggestions:** Load on mount, no refresh → Add "Refresh suggestions" action

**UX constraints for visual phase:**
- **Tab count is fixed at 5:** Any new features must live within existing tabs, not create new ones
- **Mobile-first touch targets:** All interactive elements minimum 48px
- **Reduced-motion support:** All animations must degrade gracefully
- **URL state for Posts tab:** Filter/sort/pagination encoded in search params for deep-linking
- **StickerCard consistency:** All content sections use StickerCard wrapper with floating icon
- **Banner hierarchy:** Token expiry > Backfill > Viral recovery — order is non-negotiable
- **Max-width 6xl:** All dashboard content constrained to max-w-6xl
- **Analyze | Create grouping:** Tab separator must be preserved

---

## Part II: Visual Specifications

### 7. Sitemap & Navigation Structure

```
/                                    Landing Page
|
+-- /api/auth/threads                OAuth redirect (external)
+-- /api/auth/callback               OAuth callback → redirect
+-- /api/auth/sign-out               POST sign-out → redirect
|
+-- /loading                         First-Run Backfill Progress
|   (redirects to /dashboard on complete)
|
+-- /dashboard                       Redirect → /dashboard/posts
    |
    +-- SHELL (shared layout)
    |   +-- DashboardHeader (sticky, full-width)
    |   |   +-- Logo: "Spool"
    |   |   +-- @username
    |   |   +-- Sign out (form POST)
    |   |
    |   +-- Banner Stack (inside max-w-6xl)
    |   |   +-- [1] Token Expiry Banner (if expiring/expired)
    |   |   +-- [2] Backfill Status Banner (if job exists)
    |   |   +-- [3] Viral Recovery Card (if viral detected)
    |   |
    |   +-- DashboardTabs (border-b-2)
    |       +-- ANALYZE: Posts | Timing | Audience
    |       +-- [separator]
    |       +-- CREATE: Scanner | Compose
    |
    +-- /dashboard/posts
    |   +-- Post Performance (StickerCard)
    |   |   +-- PostFilters (type toggles + date range)
    |   |   +-- Active filter chips (conditional)
    |   |   +-- ReselectionAlert (conditional)
    |   |   +-- PostTable (sortable, expandable rows)
    |   |   |   +-- PostRowDetail (on expand)
    |   |   |       +-- Full text + sparkline + comment quality
    |   |   |       +-- "View on Threads" + "Scan this post" links
    |   |   +-- Pagination
    |   +-- FormatAnalysis (StickerCard)
    |
    +-- /dashboard/timing
    |   +-- TimingHeatmap (StickerCard)
    |   |   +-- Timezone selector
    |   |   +-- Edge case banners
    |   |   +-- 7x24 grid + legend
    |   +-- CadenceOptimizer (StickerCard)
    |
    +-- /dashboard/audience
    |   +-- FollowerChart (StickerCard)
    |   +-- DemographicsCharts (StickerCard x3)
    |   |   +-- Sub-100 follower gate
    |   +-- SemanticFocus (StickerCard, collapsible)
    |   +-- AudienceFit (StickerCard, collapsible)
    |
    +-- /dashboard/scanner
    |   +-- Content Scanner (StickerCard)
    |       +-- Text input + inline post selector prompt
    |       +-- QualityGauge (after analysis)
    |       +-- QualityIssuesList (after analysis)
    |       +-- QualityRewrites (after analysis)
    |       +-- PredictionWidget (after analysis)
    |       +-- "Generate better version →" link (after analysis)
    |
    +-- /dashboard/compose
        +-- AI Composer (StickerCard)
            +-- Left: Topic textarea + "Surprise me" + style presets
            +-- Center: Draft cards (streaming) + empty guidance
            +-- Right (after generation): Gauge + prediction + timing + topics
```

### 8. User Flows

#### 8.1 First-Run Onboarding

```
[Landing Page (/)]
    |
    | session cookie exists?
    |--- Yes --→ [Redirect to /dashboard]
    |
    | No
    ↓
[Hero + Features + "Get Started" CTA]
    |
    | Click "Get Started"
    ↓
[/api/auth/threads → Threads OAuth (external)]
    |
    | User authorizes
    ↓
[/api/auth/callback]
    | Store encrypted tokens
    | Create backfill job (status: pending)
    | Set session cookie (60-day, httpOnly, sameSite=lax)
    |
    ↓ Redirect
[/loading — Full-Screen Progress]
    |
    | ┌────────────────────────────────────────┐
    | │ [SpinnerGap icon]                      │
    | │ "Analyzing your posts"                 │
    | │ ████████░░░░░░ 55%                     │
    | │ "Analyzing your best posts..."         │
    | │ ┌──────────────────────────┐           │
    | │ │ Fetching post insights   │           │
    | │ │ Last update 30s ago.     │           │
    | │ └──────────────────────────┘           │
    | └────────────────────────────────────────┘
    |
    | Backfill complete
    ↓
[/dashboard/posts — Full Dashboard]
```

#### 8.2 Returning User

```
[Landing Page (/)]
    |
    | session cookie exists?
    |--- Yes --→ [/dashboard → /dashboard/posts]
    |
    ↓ No
[Show landing page]
```

#### 8.3 Content Quality Analysis (Scanner)

```
[Scanner Tab]
    |
    | Empty state: "Type a new draft or select an existing post below"
    |
    +--→ [Type in textarea]          [Select existing post]
    |           |                            |
    |      500ms debounce              Populate textarea
    |           |                            |
    |           +----------+-----------------+
    |                      |
    |                      ↓
    |              [Analysis Running]
    |              Heuristic (instant) + LLM (streaming)
    |                      |
    |                      ↓
    |              [Results Displayed]
    |              Gauge + issues + rewrites + prediction
    |                      |
    |         +------------+------------+
    |         |            |            |
    |    [Apply rewrite]  [Read issues] [Generate better →]
    |         |                         |
    |    Update text,                   Navigate to
    |    re-analyze                     /dashboard/compose
    |                                   with topic context
    ↓
```

#### 8.4 AI Draft Generation (Composer)

```
[Composer Tab]
    |
    | ┌────────┬──────────────┬─────────┐
    | │  LEFT  │   CENTER     │ RIGHT   │
    | │        │              │ (hidden │
    | │ Topic  │  Empty:      │  until  │
    | │ input  │ "Enter topic │ drafts  │
    | │        │  and style"  │  exist) │
    | │ Style  │              │         │
    | │ presets│              │         │
    | └────────┴──────────────┴─────────┘
    |
    | Enter topic + select style
    ↓
[Click "Generate Drafts"]
    |
    | Streaming begins
    ↓
[Draft 1 streaming → Draft 2 → Draft 3]
    |
    | Each draft auto-scored on completion
    ↓
[Drafts Complete — Right panel appears]
    |
    | ┌────────┬──────────────┬──────────────┐
    | │  LEFT  │   CENTER     │    RIGHT     │
    | │        │              │              │
    | │ Topic  │ [Draft 1] ← │ Quality      │
    | │ (kept) │ [Draft 2]   │ gauge        │
    | │        │ [Draft 3]   │              │
    | │ Style  │              │ Predicted    │
    | │ (kept) │  Actions:    │ engagement   │
    | │        │  Copy/Edit/  │              │
    | │        │  Regenerate  │ Best times   │
    | │        │              │              │
    | │        │              │ Topic        │
    | │        │              │ suggestions  │
    | └────────┴──────────────┴──────────────┘
    |
    +--→ [Copy draft] → "Copied! Paste into Threads."
    |
    +--→ [Edit draft] → Inline textarea → [Done]
    |
    +--→ [Regenerate] → Re-stream single draft
    |
    +--→ [Select topic suggestion] → Set topic → Generate new drafts
```

#### 8.5 Post Exploration

```
[Posts Tab]
    |
    | Default: sorted by date (desc), all types
    ↓
[Post Performance Table]
    |
    +--→ [Click column header] → Sort table, reset to page 1
    |
    +--→ [Toggle media type] → Filter table, reset to page 1
    |
    +--→ [Set date range] → Filter table, reset to page 1
    |
    +--→ [Click post row] → Expand detail panel
    |         |
    |         +--→ [Sparkline loads via API]
    |         +--→ [Comment quality loads via API]
    |         +--→ [View on Threads] → External tab
    |         +--→ [Scan this post →] → Navigate to Scanner
    |
    +--→ [Scroll below table] → Format Analysis card
    |
    +--→ [Pagination] → Navigate pages
```

#### 8.6 Audience Exploration (Redesigned)

```
[Audience Tab]
    |
    ↓
[Follower Growth Chart]
    | Area chart with spike detection
    | Click spike → opens linked post
    ↓
[Demographics Charts]
    | Country bars | City bars | Gender donut
    | (gated behind 100+ followers)
    ↓
[Semantic Focus — COLLAPSED by default]
    | Header: "Semantic Focus" + score badge (e.g., "72 — Focused") + chevron ▸
    |
    +--→ [Click to expand]
    |       Score display + topic clusters + trend chart + warnings
    |       [Click chevron to collapse]
    ↓
[Audience Fit — COLLAPSED by default]
    | Header: "Audience Fit" + score badge (e.g., "58 — Moderate") + chevron ▸
    |
    +--→ [Click to expand]
            Alignment score + engagement comparison + demographic timeline
            + recommendations + [Click chevron to collapse]
```

### 9. Screen Wireframes

#### 9.1 Landing Page

```
+-----------------------------------------------------------+
|                                                           |
| (decorative circles, hidden on mobile)                    |
|                                                           |
|  +---[max-w-6xl]-----------------------------------+     |
|  |                                                   |     |
|  |  +--[Left Col]---+  +--[Right Col]---+           |     |
|  |  |               |  |                |           |     |
|  |  | (accent blob) |  | [SVG illust.]  |           |     |
|  |  |  # Spool      |  | Dashboard      |           |     |
|  |  |               |  | mockup with    |           |     |
|  |  | Algorithm-    |  | chart bars     |           |     |
|  |  | aware         |  |                |           |     |
|  |  | analytics...  |  +----------------+           |     |
|  |  |               |  (hidden on mobile)           |     |
|  |  | [Get Started →]                               |     |
|  |  +---------------+                               |     |
|  |                                                   |     |
|  +---------------------------------------------------+     |
|                                                           |
|  +---[max-w-5xl]-----------------------------------+     |
|  |  ## Analytics that understand the algorithm       |     |
|  |  Track what works, learn why, create more.        |     |
|  |                                                   |     |
|  |  +----------+  +----------+  +----------+         |     |
|  |  | ChartBar |  | Clock    |  | Users    |         |     |
|  |  | Weighted |  | Timing & |  | Audience |         |     |
|  |  | Perform. |  | Cadence  |  | Fit      |         |     |
|  |  +----------+  +----------+  +----------+         |     |
|  |                                                   |     |
|  |  +-----------------+  +-----------------+         |     |
|  |  | Lightning       |  | PencilLine      |         |     |
|  |  | Content Scanner |  | AI Composer     |         |     |
|  |  +-----------------+  +-----------------+         |     |
|  |                                                   |     |
|  +---------------------------------------------------+     |
+-----------------------------------------------------------+
```

#### 9.2 Loading Page (First-Run Backfill)

```
+-----------------------------------------------------------+
|                                                           |
| (decorative shapes, hidden on mobile)                     |
|                                                           |
|              +--[max-w-md]--+                             |
|              |              |                             |
|              | (O) spinner  |                             |
|              |              |                             |
|              | # Analyzing  |                             |
|              |   your posts |                             |
|              |              |                             |
|              | ████████░░ 55%                             |
|              |              |                             |
|              | "Analyzing   |                             |
|              |  your best   |                             |
|              |  posts..."   |                             |
|              |              |                             |
|              | +----------+ |                             |
|              | | Stage:   | |                             |
|              | | Fetching | |                             |
|              | | insights | |                             |
|              | | 30s ago  | |                             |
|              | +----------+ |                             |
|              |              |                             |
|              +--------------+                             |
|                                                           |
+-----------------------------------------------------------+
```

#### 9.3 Dashboard Shell

```
+-----------------------------------------------------------+
| DashboardHeader (sticky, full-width)                      |
| +--[max-w-6xl]-----------------------------------------+  |
| |  Spool           @username          [Sign out]       |  |
| +------------------------------------------------------+  |
| border-b-2 border-border                                  |
+-----------------------------------------------------------+
| +--[max-w-6xl]-----------------------------------------+  |
| |                                                       |  |
| |  [Token Expiry Banner — if expiring/expired]          |  |
| |  [Backfill Status Banner — if job active]             |  |
| |  [Viral Recovery Card — if viral detected]            |  |
| |                                                       |  |
| |  Posts | Timing | Audience ┃ Scanner | Compose        |  |
| |  ──────────────────────────────────────────────       |  |
| |  border-b-2, mb-8                                     |  |
| |                                                       |  |
| |  {tab content}                                        |  |
| |                                                       |  |
| +------------------------------------------------------+  |
+-----------------------------------------------------------+
```

#### 9.4 Posts Tab

```
+-----------------------------------------------------------+
| +--Post Performance (StickerCard)----------------------+   |
| | (icon)                                               |   |
| | ## Post Performance                                  |   |
| | Sort by any metric to find your best content.        |   |
| |                                                      |   |
| | [Text] [Image] [Video] [Carousel]   FROM [____]     |   |
| |                                      TO   [____]     |   |
| |                                                      |   |
| | (active filter chips, if any)         [Clear all]    |   |
| |                                                      |   |
| | [Reselection Alert — if detected posts]              |   |
| |                                                      |   |
| | Showing 1-25 of 142 posts           Page 1 of 6     |   |
| | +--------------------------------------------------+ |   |
| | | Post       | Date  | Views | ... | Eng | WES (i)| |   |
| | |------------|-------|-------|-----|-----|--------| |   |
| | | [T] First  | Mar 2 | 1.2K  | ... | 4.2%| *2.31 | |   |
| | |  ↓ expanded detail panel                         | |   |
| | |  Full post text...                               | |   |
| | |  [sparkline chart: views + eng rate]             | |   |
| | |  [comment quality: ■■■ short ■■ med ■ long]     | |   |
| | |  [View on Threads ↗] [Scan this post →]          | |   |
| | |                                                  | |   |
| | | [I] Second | Mar 1 | 800   | ... | 3.1%|  1.87 | |   |
| | | [V] Third  | Feb 28| 2.1K  | ... | 5.0%|  2.05 | |   |
| | +--------------------------------------------------+ |   |
| |                                                      |   |
| | [< 1 [2] 3 4 5 >] Pagination                        |   |
| +------------------------------------------------------+   |
|                                                           |
| +--Format Analysis (StickerCard)----------------------+   |
| | (icon)                                               |   |
| | ## Format Analysis                                   |   |
| | [bar chart: avg views + WES per media type]          |   |
| | [text length bars: short/med/long engagement]        |   |
| | "Your IMAGE posts get 35% more engagement..."        |   |
| +------------------------------------------------------+   |
```

#### 9.5 Timing Tab

```
+-----------------------------------------------------------+
| +--Best Time to Post (StickerCard)--------------------+   |
| | (icon)                                               |   |
| | ## Best Time to Post              [Timezone: ▾ PST]  |   |
| | Best times: Tue 9 AM, Thu 7 PM, Sat 10 AM           |   |
| |                                                      |   |
| | [low data banner — if < 20 posts]                    |   |
| | [same slot banner — if all posts at same time]       |   |
| |                                                      |   |
| |      12a 1a 2a ... 11a 12p 1p ... 11p               |   |
| | Mon  [  ][  ][  ] ... [██][██] ... [  ]              |   |
| | Tue  [  ][  ][  ] ... [██][██] ... [  ]              |   |
| | ...                                                  |   |
| | Sun  [  ][  ][  ] ... [  ][  ] ... [  ]              |   |
| |                                                      |   |
| |                          Lower ░░▒▒▓▓██ Higher       |   |
| +------------------------------------------------------+   |
|                                                           |
| +--Cadence Optimizer (StickerCard)--------------------+   |
| | (icon)                                               |   |
| | ## Posting Cadence                                   |   |
| |                                                      |   |
| | Avg posts/day: 1.3  |  Avg gap: 22h  |  Longest: 4d |   |
| |                                                      |   |
| | [scatter chart: hours since prev post vs views]      |   |
| | ◆ = outlier (beyond 95th percentile)                 |   |
| |                                                      |   |
| | [recommendation banner — if suboptimal cadence]      |   |
| | [collision list — dates with 2+ posts]               |   |
| +------------------------------------------------------+   |
```

#### 9.6 Audience Tab (Redesigned)

```
+-----------------------------------------------------------+
| +--Follower Growth (StickerCard)----------------------+   |
| | (icon)                                               |   |
| | ## Follower Growth                                   |   |
| |                                                      |   |
| | [area chart: 300px, gradient fill, spike dots]       |   |
| | (click spike dot → opens linked post in new tab)     |   |
| +------------------------------------------------------+   |
|                                                           |
| +--Demographics (StickerCard x3)----------------------+   |
| | [OR: sub-100 follower gate if < 100 followers]       |   |
| |                                                      |   |
| | +--Countries--+  +--Cities----+                      |   |
| | | (bar chart) |  | (bar chart)|                      |   |
| | | Top 10      |  | Top 10     |                      |   |
| | +-------------+  +------------+                      |   |
| |                                                      |   |
| |         +--Gender Breakdown--+                       |   |
| |         | (donut chart)      |                       |   |
| |         | Legend beside      |                       |   |
| |         +--------------------+                       |   |
| +------------------------------------------------------+   |
|                                                           |
| +--Semantic Focus (StickerCard, COLLAPSIBLE)---------+   |
| | (icon)                                               |   |
| | ## Semantic Focus    [72 — Focused]         [▸]      |   |
| |   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     |   |
| | (collapsed by default — click ▸ to expand)           |   |
| |                                                      |   |
| | EXPANDED:                                            |   |
| | Score: 72 (Focused)                                  |   |
| | Topics: [Marketing] [Growth] [Content]               |   |
| | [30-day trend line chart]                            |   |
| | [warning banner if score < threshold]                |   |
| +------------------------------------------------------+   |
|                                                           |
| +--Audience Fit (StickerCard, COLLAPSIBLE)------------+   |
| | (icon)                                               |   |
| | ## Audience Fit      [58 — Moderate]        [▸]      |   |
| |   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     |   |
| | (collapsed by default — click ▸ to expand)           |   |
| |                                                      |   |
| | EXPANDED:                                            |   |
| | Score: 58 (Moderate)                                 |   |
| | Earlier eng: 3.2%  |  Recent eng: 4.1%              |   |
| | "Demographics shifted toward..."                     |   |
| | [timeline chart: demographic trends]                 |   |
| | [recommendation cards — if score < 70]               |   |
| +------------------------------------------------------+   |
```

#### 9.7 Scanner Tab

```
+-----------------------------------------------------------+
| +--Content Scanner (StickerCard)----------------------+   |
| | (icon)                                               |   |
| | ## Content Scanner                                   |   |
| | Check posts for algorithm-demoted patterns.          |   |
| |                                                      |   |
| | +--------------------------------------------------+ |   |
| | | [textarea]                                       | |   |
| | | Type a new draft to analyze...                   | |   |
| | |                                                  | |   |
| | |                                                  | |   |
| | |                                    0/500 chars   | |   |
| | +--------------------------------------------------+ |   |
| |                                                      |   |
| | Or select an existing post:                          |   |
| | +--------------------------------------------------+ |   |
| | | [▸ "My latest post about..."    Mar 25, 2026]    | |   |
| | | [  "Thread on growth hacks..."  Mar 22, 2026]    | |   |
| | | [  "Hot take: algorithms..."    Mar 20, 2026]    | |   |
| | +--------------------------------------------------+ |   |
| |                                                      |   |
| | ── AFTER ANALYSIS: ──────────────────────────────    |   |
| |                                                      |   |
| |        ╭─────╮                                       |   |
| |       ╱  78   ╲    "Great"                           |   |
| |      ╱─────────╲   Quality Gauge                     |   |
| |                                                      |   |
| | Issues Found:                                        |   |
| | [HIGH] Engagement bait detected — "Comment if..."    |   |
| |   Suggestion: Rephrase as a genuine question.        |   |
| | [LOW] Post is short (< 50 chars)                     |   |
| |   Suggestion: Add context to increase shareability.  |   |
| |                                                      |   |
| | Suggested Rewrites:                                  |   |
| | ┌──────────────────────────────────────┐             |   |
| | │ "Instead of asking for comments..."  │  [Apply]    |   |
| | └──────────────────────────────────────┘             |   |
| |                                                      |   |
| | Predicted Views: |──[===|===]──| 800 - 1,200 - 1.8K |   |
| |   Based on 45 similar posts. Confidence: High        |   |
| |                                                      |   |
| | [Generate a better version →]                        |   |
| +------------------------------------------------------+   |
```

#### 9.8 Compose Tab (Redesigned)

```
+-----------------------------------------------------------+
| +--AI Composer (StickerCard)-------------------------+    |
| | (icon)                                              |    |
| | ## AI Composer                                      |    |
| | Draft algorithm-optimized posts from your data.     |    |
| |                                                     |    |
| | +----------+----------------------------+---------+ |    |
| | | LEFT     | CENTER                     | RIGHT   | |    |
| | |          |                            | (hidden | |    |
| | | Topic:   | Enter a topic and choose   | until   | |    |
| | | [______] | a style to generate        | drafts  | |    |
| | | [______] | your first drafts.         | exist)  | |    |
| | | [______] |                            |         | |    |
| | |          |                            |         | |    |
| | | Need     |                            |         | |    |
| | | ideas?   |                            |         | |    |
| | | [Generate|                            |         | |    |
| | |  ideas]  |                            |         | |    |
| | |          |                            |         | |    |
| | | Style:   |                            |         | |    |
| | |[Prof]    |                            |         | |    |
| | |[Casual]  |                            |         | |    |
| | |[Provoc]  |                            |         | |    |
| | |[Educ]    |                            |         | |    |
| | |[Humor]   |                            |         | |    |
| | |          |                            |         | |    |
| | |[Generate]|                            |         | |    |
| | +----------+----------------------------+---------+ |    |
| +-----------------------------------------------------+    |
|                                                           |
| AFTER GENERATION:                                         |
| +-----------------------------------------------------+    |
| | +----------+----------------------------+---------+ |    |
| | | LEFT     | CENTER                     | RIGHT   | |    |
| | |          |                            |         | |    |
| | | Topic:   | +--Draft 1 (selected)---+ | Quality | |    |
| | | [kept]   | | Voice of the Reader   | | ╭──╮    | |    |
| | |          | | "Your take on..."     | | │72│    | |    |
| | | Style:   | | Score: 78  [Copy]     | | ╰──╯    | |    |
| | | [kept]   | | [Edit] [Regenerate]   | |         | |    |
| | |          | +------------------------+ | Predict | |    |
| | | [New     | +--Draft 2--------------+ | |==|==| | |    |
| | |  topic]  | | Time-Saving Compile.  | |         | |    |
| | |          | | "5 things I learned.."| | Best    | |    |
| | |          | | Score: 65             | | times:  | |    |
| | |          | +------------------------+ | Tue 9AM | |    |
| | |          | +--Draft 3--------------+ | Thu 7PM | |    |
| | |          | | Counterintuitive Data | | Sat 10AM| |    |
| | |          | | "Most creators..."    | | [Full →]| |    |
| | |          | | Score: 81             | |         | |    |
| | |          | +------------------------+ | Topics: | |    |
| | |          |                            | ● Near  | |    |
| | |          | "Copy your favorite draft, | ● Med   | |    |
| | |          |  or edit it first."        | ● Far   | |    |
| | +----------+----------------------------+---------+ |    |
| +-----------------------------------------------------+    |
```

### 10. Annotated Wireframes

#### 10.1 Posts Tab — Key Interactions

```
+--Post Performance (StickerCard)-----------------------------+
|                                                              |
| 1→ [Text] [Image] [Video] [Carousel]   FROM [____]          |
|    Toggle filters. Cannot deselect    2→ Date inputs trigger |
|    the last remaining type.              immediate nav.      |
|                                                              |
| 3→ [media:Image ✕] [from:Mar 1 ✕] [Clear all]              |
|    Active filter chips. Each removable.                      |
|                                                              |
| 4→ Showing 1-25 of 142 posts              Page 1 of 6       |
|    Counter always visible.                 Hidden on mobile. |
|                                                              |
| +-----------------------------------------------------------+
| | Post       | Date↓ | Views | ... | Eng%  | WES 5→(i)     |
| |------------|-------|-------|-----|-------|----------------|
| | [T] First  | Mar 2 | 1.2K  | ... | 4.2% | *2.31 🟢      |
| |                                                            |
| 6→ ↓ EXPANDED (grid-template-rows: 0fr → 1fr, 300ms bounce)|
| |  Full post text (whitespace-pre-wrap)                      |
| |                                                            |
| |  [sparkline: Views ─── Eng Rate - - -]                    |
| |  7→ role="img", aria-label with snapshot summary           |
| |                                                            |
| |  [Comment Quality: ■■■ short ■■ medium ■ long]            |
| |  Discussion Score: 65                                      |
| |                                                            |
| |  8→ [View on Threads ↗]  9→ [Scan this post →]            |
| |     External link           Cross-flow to Scanner tab      |
| |                                                            |
| +-----------------------------------------------------------+
```

**Annotations:**
1. Media type toggles — `candy` variant when active, `outline` when inactive. Last type cannot be deselected.
2. Date inputs — `min="2024-04-13"` (API launch date). Changes navigate immediately, reset page to 1.
3. Filter chips — Appear when any filter is active. `min-h-12` on mobile for 48px touch target.
4. Counter — "Showing X-Y of Z" left-aligned. "Page M of N" right-aligned, `hidden sm:block` on mobile.
5. WES info icon — **NEW.** Click opens popover: "Weighted Engagement Score — the algorithm weights shares (10x), replies (8x), quotes (5x), reposts (3x), and likes (1x) differently." First encounter: auto-open tooltip once.
6. Row expansion — `grid-template-rows: 0fr → 1fr` with `--ease-bounce`. Only one row expanded at a time. Lazy mount on first expand.
7. Sparkline accessibility — `role="img"` with `aria-label` including snapshot count and latest values.
8. View on Threads — Opens in new tab. `target="_blank" rel="noopener noreferrer"`.
9. Scan this post — **NEW cross-flow.** Navigates to `/dashboard/scanner` with post text pre-filled in the textarea.

**Error states:**
- Page-level fetch failure → `ErrorState` with "Try again" → `router.refresh()`
- Sparkline fetch failure → Inline destructive-color error text
- Insufficient sparkline data (< 2 snapshots) → "Not enough data points"

**Loading states:**
- Page-level → Skeleton rows in table
- Sparkline → "Loading metrics..." centered text
- Comment quality → Purpose-built skeleton with pulsing divs

**Edge cases:**
- No posts + importing → "Importing your posts" / "This table will fill in automatically..."
- No posts + not importing → Algorithm insight copy with relevant empty state
- Filters match nothing → "No posts match your filters" + "Clear filters" button

#### 10.2 Audience Tab — Collapsible Sections (Redesigned)

```
+--Semantic Focus (StickerCard, COLLAPSIBLE)-------------------+
|                                                               |
| 1→ (Crosshair icon in quaternary circle)                      |
|                                                               |
| ## Semantic Focus   2→ [72 — Focused]    3→ [▸ Expand]        |
|    Section title       Score badge in        Chevron button   |
|                        collapsed header      toggles section  |
|                                                               |
| ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  |
|                                                               |
| 4→ EXPANDED CONTENT (animated, grid-template-rows transition):|
|                                                               |
|  Score: 72                                                    |
|  5→ [Focused] badge: bg-quaternary/20, text-quaternary        |
|                                                               |
|  Topics: [Marketing] [Growth] [Content Strategy]              |
|  6→ Topic clusters shown as bordered badges                   |
|                                                               |
|  [30-day trend line chart]                                    |
|  7→ Line chart, domain [0,100], dynamic color per level       |
|                                                               |
|  8→ [Warning banner if score < threshold]                     |
|     "Your content has become less focused..."                 |
|                                                               |
+---------------------------------------------------------------+
```

**Annotations:**
1. Section icon — Same StickerCardIcon pattern, positioned absolutely.
2. Score badge in header — **NEW.** Score summary visible even when collapsed. Color-coded: quaternary (Focused ≥70), tertiary (Mixed 40-69), destructive (Scattered <40).
3. Chevron expand/collapse — **NEW.** `▸` rotates to `▾` when expanded. `aria-expanded={boolean}`. Keyboard accessible: Enter/Space.
4. Expand animation — `grid-template-rows: 0fr → 1fr` with 300ms bounce easing (matches row expand pattern).
5. Score level badge — Color and label match the header badge.
6. Topic clusters — Capitalized badges with border and muted background.
7. Trend chart — `role="img"` with `aria-label` describing score and trend direction.
8. Warning banner — Only shown when score drops below threshold. Destructive styling.

**Design rationale:**
- Collapsing reduces Audience tab from 4 always-visible sections to 2 primary + 2 on-demand
- Score badges in collapsed headers give users enough information to decide whether to explore
- Preserves all existing content — no features removed, just deferred

#### 10.3 Composer — Guided Entry (Redesigned)

```
INITIAL STATE (no drafts yet):

+--AI Composer (StickerCard)-----------------------------------+
|                                                               |
| +-------+----------------------------------+                  |
| | LEFT  | CENTER                           |                  |
| |       |                                  |                  |
| | 1→    | 3→ (Empty state)                 |                  |
| | Topic:| "Enter a topic and choose a      |                  |
| | [____]| style to generate your first     |                  |
| | [____]| drafts."                         |                  |
| |       |                                  |                  |
| | 2→    |                                  |                  |
| | Need  | [icon illustration]              |                  |
| | ideas?|                                  |                  |
| | [Gen] |                                  |                  |
| |       |                                  |                  |
| | Style:|                                  |                  |
| | [Prof]|                                  |                  |
| | [Cas] |                                  |                  |
| | [Prov]|                                  |                  |
| | [Edu] |                                  |                  |
| | [Hum] |                                  |                  |
| |       |                                  |                  |
| | [GEN] |                                  |  4→ RIGHT panel  |
| +-------+----------------------------------+     HIDDEN       |
|                                                               |
+---------------------------------------------------------------+

AFTER GENERATION:

+---------------------------------------------------------------+
| +-------+--------------------------+----------+               |
| | LEFT  | CENTER                   | RIGHT    |               |
| |       |                          |          |               |
| | Topic | [Draft 1] ← selected    | 5→ Gauge |               |
| | [kept]| [Draft 2]               | ╭──╮     |               |
| |       | [Draft 3]               | │72│     |               |
| | Style |                          | ╰──╯     |               |
| | [kept]| 6→ "Copy your favorite, |          |               |
| |       |  or edit it first."      | 7→ Pred  |               |
| | [New  |                          | |==|==|  |               |
| |  topic|                          |          |               |
| |  ]    |                          | 8→ Times |               |
| |       |                          | Tue 9 AM |               |
| |       |                          | Thu 7 PM |               |
| |       |                          | [Full →] |               |
| |       |                          |          |               |
| |       |                          | 9→ Topics|               |
| |       |                          | ● Near   |               |
| |       |                          | ○ Medium |               |
| +-------+--------------------------+----------+               |
+---------------------------------------------------------------+
```

**Annotations:**
1. Topic textarea — 4 rows, 500 char limit with counter. Disabled during generation.
2. "Generate ideas for me" — **CHANGED.** Always visible as secondary action below topic input (was hidden after first generation). Label: "Need inspiration? Generate ideas for me."
3. Center empty state — **NEW guidance text.** Tells user what to do. Replaced generic empty component.
4. Right panel hidden — **REDESIGNED.** Not rendered until drafts exist. Reduces initial cognitive load from 3 panels to 2.
5. Quality gauge — Appears after generation. Shows active draft's score.
6. Next-step guidance — **NEW.** After generation completes, center panel shows "Copy your favorite draft, or edit it first."
7. Prediction widget — Engagement range for active draft.
8. Timing recommendations — Top 3 best times. **FIXED:** Must use browser timezone, not UTC. **NEW:** "See full analysis →" link to `/dashboard/timing`.
9. Topic suggestions — Semantic distance indicators (Near/Medium/Far). **NEW:** "Refresh suggestions" action.

**Responsive behavior:**
- Mobile: Panels stack vertically: Left → Center → Right
- Desktop: 3-column grid with fixed left (200px) and right (240px) columns

---

## Appendix: Companion Files

| Document | Covers |
|----------|--------|
| `DESIGN.md` | Visual tokens, colors, typography, shadows, component styles, decorative elements |
| `PRD.md` | Product requirements, data model, success metrics, API details |
| `SEO_FEATURES.md` | Algorithm-aware feature roadmap (Phase 1/2/3), formulas, build order |
| `FEATURES.md` | Structured feature catalog with 36 features across 7 areas |
| `reports/UX_DESIGN_REPORT.md` | Audit report comparing spec to implementation |
| `UX_DESIGN.md` (this file) | Interaction flows, component states, page behaviors, responsive rules, accessibility |

---

## Changelog from Previous UX_DESIGN.md

| Section | Change | Rationale |
|---------|--------|-----------|
| Scanner tab | Updated from "Coming Soon" placeholder to full spec | Implementation is live — spec must match |
| Compose tab | Updated from "Coming Soon" placeholder to full spec | Implementation is live — spec must match |
| Audience tab | Added collapsible pattern for Semantic Focus and Audience Fit | Audit finding CL-1: 4 sections cause cognitive overload |
| Composer entry | Right panel deferred until drafts exist | Audit finding CL-2: 3-panel layout overwhelms first-time users |
| Post detail | Added "Scan this post" cross-flow link | Audit finding FI-3: dead end after viewing post detail |
| Scanner results | Added "Generate better version" cross-flow link | Audit finding FI-1: no path from analysis to improvement |
| Composer timing | Added "See full analysis" link to Timing tab | Audit finding FI-2: timing recommendations isolated |
| WES column | Added info icon with algorithm explanation | Audit finding MM-3: WES unexplained |
| Loading page | Added to spec — full-screen backfill progress | Positive divergence: dedicated first-run UX, better than banner |
| Composer timezone | Noted browser timezone requirement | Audit finding SD-1: UTC default produces wrong times |
| Composer "Surprise me" | Always visible, not hidden after generation | Audit finding AF-3: discoverable only before first generation |
| All v1 features | Removed "v1" and "[v1 Phase N]" labels | All features are now live — phase labels are misleading |
| Tab badges | Removed "Soon" badge references | Scanner and Compose are live — badges removed in code |
