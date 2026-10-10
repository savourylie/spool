# UX Design Audit Report

**Project:** Spool
**Date:** 2026-03-26
**Sources:** docs/PRD.md, docs/FEATURES.md, docs/UX_DESIGN.md, codebase
**Framework:** Next.js 16 (App Router)

---

## Executive Summary

**Spec-to-Implementation Alignment:** Moderate

The UX_DESIGN.md spec describes a v0 analytics dashboard with three "Analyze" tabs (Posts, Timing, Audience) and two "Create" tabs (Scanner, Compose) marked as "Coming Soon." The implementation has dramatically surpassed this scope: all five tabs are fully functional with complete v1 Phase 1, Phase 2, and Phase 3 features live. The Scanner delivers real-time heuristic + LLM analysis with suggested rewrites, engagement prediction, and existing-post scanning. The Composer provides streaming multi-draft generation with style presets, quality scoring, topic suggestions, and timing recommendations.

The core v0 spec is faithfully implemented — the post table, timing heatmap, audience demographics, filter/sort/pagination, backfill progress, and token expiry flows all closely match the spec. Where the code diverges, it almost always improves on the spec: a dedicated full-screen loading page replaces the spec's banner-only first-run approach, v1 features like WES, format analysis, cadence optimization, velocity indicators, reselection alerts, viral recovery, comment quality, semantic focus, and audience fit are all present and well-integrated.

The primary concern is not missing features but **complexity management**. With 36 features now live across 5 tabs, the cognitive load — particularly on the Audience tab (4 sections) and Composer (3-panel layout with 7+ interactive zones) — warrants a redesign focused on progressive disclosure and flow clarity rather than feature addition.

### Finding Counts

| Severity | Count |
|----------|-------|
| Critical (UX-breaking) | 0 |
| Major (significant gaps) | 5 |
| Minor (small discrepancies) | 6 |
| Positive (implementation improvements) | 8 |
| **Total** | **19** |

---

## Implementation Inventory

### Route Map

| # | Route | File | Type | In Spec? | Notes |
|---|-------|------|------|----------|-------|
| 1 | `/` | `src/app/page.tsx` | Page | Yes | Landing page with session redirect |
| 2 | `/loading` | `src/app/loading/page.tsx` | Page | **No** | Full-screen backfill progress (positive divergence) |
| 3 | `/dashboard` | `src/app/dashboard/page.tsx` | Page | Yes | Redirects to `/dashboard/posts` |
| 4 | `/dashboard/posts` | `src/app/dashboard/posts/page.tsx` | Page | Yes | Post table + format analysis + reselection alert |
| 5 | `/dashboard/timing` | `src/app/dashboard/timing/page.tsx` | Page | Yes | Heatmap + cadence optimizer |
| 6 | `/dashboard/audience` | `src/app/dashboard/audience/page.tsx` | Page | Yes | Follower chart + demographics + semantic focus + audience fit |
| 7 | `/dashboard/scanner` | `src/app/dashboard/scanner/page.tsx` | Page | Partial | Spec says "coming soon" — code is fully functional |
| 8 | `/dashboard/compose` | `src/app/dashboard/compose/page.tsx` | Page | Partial | Spec says "coming soon" — code is fully functional |
| 9 | `/dev` | `src/app/dev/page.tsx` | Page | No | Developer debug (non-user-facing) |
| 10 | `/dev/backfills` | `src/app/dev/backfills/page.tsx` | Page | No | Developer debug (non-user-facing) |
| 11 | — | `src/app/layout.tsx` | Layout | Yes | Root layout with fonts |
| 12 | — | `src/app/dashboard/layout.tsx` | Layout | Yes | Dashboard shell with header, tabs, banners |

### Navigation Structure (Implemented)

```
/                              Landing page
+-- /loading                   Full-screen backfill progress (NEW)
+-- /dashboard                 Redirect → /dashboard/posts
    +-- /dashboard/posts       Post Performance (Analyze group)
    +-- /dashboard/timing      Timing & Cadence (Analyze group)
    +-- /dashboard/audience    Audience Insights (Analyze group)
    +-- /dashboard/scanner     Content Scanner (Create group) — FULLY LIVE
    +-- /dashboard/compose     AI Composer (Create group) — FULLY LIVE
+-- /dev                       Developer tools (non-user-facing)
    +-- /dev/backfills
```

### Component Inventory

| Component | File | Used By | Purpose | In Spec? |
|-----------|------|---------|---------|----------|
| DashboardHeader | dashboard-header.tsx | Dashboard layout | Logo + username + sign-out | Yes |
| DashboardTabs | dashboard-tabs.tsx | Dashboard layout | 5-tab navigation with groups | Partial (badges removed) |
| DashboardBackfillBanner | backfill-status-banner.tsx | Dashboard layout | Real-time import progress | Yes |
| TokenExpiryBanner | token-expiry-banner.tsx | Dashboard layout | Token expiry warning | Yes |
| ViralRecoveryCard | viral-recovery-card.tsx | Dashboard layout | Viral post guidance + countdown | Yes (v1) |
| PostTable | post-table.tsx | Posts page | Sortable post performance table | Yes |
| PostRowDetail | post-row-detail.tsx | PostTable | Expanded row with sparkline + comments | Yes |
| PostFilters | post-filters.tsx | Posts page | Media type + date range filters | Yes |
| Pagination | pagination.tsx | PostTable | Page navigation | Yes |
| FormatAnalysis | format-analysis.tsx | Posts page | Media type + text length analysis | Yes (v1 P1) |
| ReselectionAlert | reselection-alert.tsx | Posts page | Renewed engagement alerts | Yes (v1 P1) |
| VelocityIndicator | velocity-indicator.tsx | PostTable | Launch velocity badge | Yes (v1 P2) |
| CommentQuality | comment-quality.tsx | PostRowDetail | Reply breakdown + quality score | Yes (v1 P2) |
| TimingHeatmap | timing-heatmap.tsx | Timing page | 7x24 engagement heatmap | Yes |
| CadenceOptimizer | cadence-optimizer.tsx | Timing page | Post spacing analysis + scatter chart | Yes (v1 P1) |
| FollowerChart | follower-chart.tsx | Audience page | Follower growth area chart + spikes | Yes |
| DemographicsCharts | demographics-charts.tsx | Audience page | Country/city/gender charts | Yes |
| SemanticFocus | semantic-focus.tsx | Audience page | Topic concentration score + trend | Yes (v1 P2) |
| AudienceFit | audience-fit.tsx | Audience page | Content-audience alignment score | Yes (v1 P2) |
| QualityScanner | quality-scanner.tsx | Scanner page | Draft analysis orchestrator | Yes (v1 P3) |
| QualityGauge | quality-gauge.tsx | Scanner, Composer | Semicircular score visualization | Yes (v1 P3) |
| QualityIssuesList | quality-issues-list.tsx | QualityScanner | Severity-tagged issue cards | Yes (v1 P3) |
| QualityRewrites | quality-rewrites.tsx | QualityScanner | LLM rewrite suggestions with apply | Yes (v1 P3) |
| PredictionWidget | prediction-widget.tsx | Scanner, Composer | Engagement range prediction | Yes (v1 P3) |
| Composer | composer.tsx | Compose page | Multi-draft generation engine | Yes (v1 P3) |
| DraftCard | draft-card.tsx | Composer | Individual draft with edit/copy/regen | Yes (v1 P3) |
| TopicSuggestions | topic-suggestions.tsx | Composer | AI-recommended topics | Yes (v1 P3) |
| BackfillProgress | backfill-progress.tsx | Loading page | Full-screen import progress | **No** (positive) |
| StickerCard | card.tsx | Everywhere | Styled card container with floating icon | Yes |
| EmptyState | empty-state.tsx | Many components | No-data placeholder with CTA | Yes |
| ErrorState | error-state.tsx | Page-level errors | Error display with retry | Yes |
| ProgressBar | progress-bar.tsx | Banners, loading page | Determinate/indeterminate progress | Yes |
| Button | button.tsx | Everywhere | Button with variant system | Yes |
| ChartContainer | chart.tsx | Charts | Recharts wrapper with theming | Yes |

---

## Gap Analysis by UX Dimension

### 1. User Intent & Mental Model

**Spec intent:** Users are Threads creators who want to understand "what's working." The v0 mental model is a simple analytics dashboard — connect, see data, learn patterns. v1 features (scanner, composer) are positioned as future additions.

**Implementation reality:** The code presents a full-stack content intelligence platform. Users see analytics, algorithmic insights, AI-powered content analysis, and draft generation all at once from day one. The "Analyze → Create" tab grouping attempts to manage this complexity but five active tabs with 36 features is a different product from the three-tab analytics dashboard the spec describes.

| ID | Finding | Severity | Spec Says | Code Does | Impact |
|----|---------|----------|-----------|-----------|--------|
| MM-1 | Spec describes Scanner/Composer as "Coming Soon" placeholder states | Major | §9.1 and §10.1 specify EmptyState with "coming soon" copy | Full implementations with LLM-powered features, no "Soon" badges | Spec is significantly outdated — any design work based on current spec would miss half the product |
| MM-2 | "Analyze vs Create" mental model works but is untested at full feature density | Minor | §2.3 defines two tab groups with a visual separator | Code implements the separator and grouping faithfully | Users must understand both paradigms; the grouping helps but may need reinforcement |
| MM-3 | WES (Weighted Engagement Score) is introduced without onboarding | Minor | §6.4 mentions tooltip "algorithm-weighted metric" | PostTable shows WES column with tooltip, top performer with asterisk | Users may not understand what WES means or why it matters without context |

### 2. Information Architecture

**Spec intent:** Five routes under `/dashboard/*`, with Scanner and Compose as placeholders. Posts tab is the primary landing. URL params encode filter/sort/pagination state.

**Implementation reality:** All five routes are active and content-rich. The Audience tab has grown from 2 sections (follower chart + demographics) to 4 sections (+ semantic focus + audience fit). The Posts tab has 3 areas (filters+table, reselection alert, format analysis). URL-driven state management is faithfully implemented for the Posts tab.

| ID | Finding | Severity | Spec Says | Code Does | Impact |
|----|---------|----------|-----------|-----------|--------|
| IA-1 | Audience tab has 4 full sections — heaviest tab in the app | Major | §8 specifies follower chart + demographics (2 sections) | 4 sections: follower chart, demographics, semantic focus, audience fit | Long scroll, potential for users to miss lower sections |
| IA-2 | `/loading` route exists outside spec's sitemap | Minor (Positive) | §2.1 has no `/loading` route; §4 says dashboard loads with banner | Dedicated full-screen loading page for first-run, banner for subsequent | Better first-run experience — focused, distraction-free |
| IA-3 | Scanner page no longer wrapped in "coming soon" state | Minor (Positive) | §9.1 wraps scanner in EmptyState | Full QualityScanner with text input, gauge, issues, rewrites, prediction | Feature is live and functional |

### 3. Affordances & Action Clarity

**Spec intent:** Interactive elements should be self-documenting — sortable columns show carets, expandable rows have role="button", filters toggle visually, charts have tooltips.

**Implementation reality:** Code closely follows spec affordance patterns. Sortable columns have proper caret indicators, rows expand/collapse with keyboard support, media type toggles prevent deselecting the last type, date inputs trigger immediate navigation. The Composer introduces new affordances (style presets, stop generation, inline edit, copy/regenerate) that aren't in the spec but are self-consistent.

| ID | Finding | Severity | Spec Says | Code Does | Impact |
|----|---------|----------|-----------|-----------|--------|
| AF-1 | Follower spike dots lack keyboard accessibility | Minor | §3.6 notes "Pointer only — consider adding" keyboard support | Spike dots use `onClick` only, no keyboard handler, no tabIndex | Screen reader / keyboard users cannot access spike-linked posts |
| AF-2 | Scanner "Analyze existing post" toggle is not immediately obvious | Minor | §9.5 describes button/link to open post selector | Button toggles collapsible post list below textarea | Users may not discover they can scan existing posts |
| AF-3 | Composer "Generate ideas for me" only appears in idle state | Minor | §10.3 describes "Generate ideas for me" option | Button hidden during/after generation; labeled "Surprise me — generate a trending topic" | Discoverable only before first generation |

### 4. Cognitive Load & Decision Minimization

**Spec intent:** Progressive disclosure — show data first, details on demand. Filters and sorting reduce noise. Empty states guide users. Backfill progress is passive (banner, not blocking).

**Implementation reality:** The core progressive disclosure pattern works: table rows expand for detail, charts show tooltips on hover, filters chip away complexity. However, three areas have accumulated cognitive weight beyond the spec's design: Audience tab (4 sections), Composer (3-panel layout with 7+ interactive zones), and Scanner (gauge + issues + rewrites + prediction on one screen).

| ID | Finding | Severity | Spec Says | Code Does | Impact |
|----|---------|----------|-----------|-----------|--------|
| CL-1 | Audience tab requires significant scrolling to see all insights | Major | §8 spec had 2 sections in a manageable viewport | 4 sections: follower growth (300px chart), demographics (2-col grid + donut), semantic focus (score + trend chart), audience fit (score + timeline chart + recommendations) | Users may not scroll far enough to discover semantic focus and audience fit |
| CL-2 | Composer 3-panel layout presents many decisions simultaneously | Major | §10.2 describes 3-panel layout but as future state | Left: topic + style (6 buttons). Center: up to 3 draft cards. Right: gauge + prediction + timing + topic suggestions | First-time users face topic input, style choice, and multiple output panels at once |
| CL-3 | Scanner combines 4 output sections in a single vertical scroll | Minor | §9.2-9.5 describe analysis sections | Gauge → issues → rewrites → prediction stacked vertically | Manageable due to empty state (shows only when content analyzed), but long scroll when populated |

### 5. State Design & Feedback

**Spec intent:** Four-state machine (Loading → Success, Error, Empty) for every data-driven section. Backfill banner with real-time progress. Token expiry with two tiers.

**Implementation reality:** State machine pattern is consistently implemented across all components. Loading uses skeleton patterns, errors show retry buttons, empty states have contextual copy with `isImporting` variants. The backfill banner implements all specified states (pending, running, complete, failed, stale) with real-time Supabase updates. The Composer adds streaming states not in the original spec but handles them well (typing cursor, stop button, sequential draft generation).

| ID | Finding | Severity | Spec Says | Code Does | Impact |
|----|---------|----------|-----------|-----------|--------|
| SD-1 | Compose page computes best posting times using UTC, not user timezone | Major | §7.2 says auto-detect from browser via `useSyncExternalStore` | `computeBestTimes(heatmapPosts, "UTC")` on server-side | Timing recommendations may be wrong for non-UTC users |
| SD-2 | Streaming states in Composer well-handled but not spec'd | Minor (Positive) | §10.3 describes streaming UX conceptually | Reducer with 14+ action types, abort controller, sequential draft streaming, cursor animation | Implementation exceeds spec detail with robust state management |
| SD-3 | CommentQuality has loading/error/success/empty states | Minor (Positive) | §6.8 describes comment quality conceptually | Skeleton loader, retry button on error, stacked bar + quality score on success | Well-implemented state machine for a nested feature |

### 6. Flow Integrity

**Spec intent:** Landing → OAuth → Backfill → Dashboard flow. Tab navigation is primary. Expandable rows for detail. Deep-linkable URLs.

**Implementation reality:** The core onboarding flow works well with an enhancement: OAuth callback likely redirects to `/loading` (full-screen progress) instead of directly to dashboard with banner. This provides a more focused first-run experience. Tab navigation is clean with proper active state indication. Deep-linking via URL params works for the Posts tab. However, cross-tab flows are limited — there's no path from Scanner (analyzing content) to Composer (generating better content), or from Composer timing recommendations to the Timing tab for deeper analysis.

| ID | Finding | Severity | Spec Says | Code Does | Impact |
|----|---------|----------|-----------|-----------|--------|
| FI-1 | No Scanner → Composer cross-flow | Minor | No cross-flow specified | Scanner and Composer are independent tabs | User who scans a poor-quality post has no "generate a better version" path |
| FI-2 | Composer timing recommendations don't link to Timing tab | Minor | §10.6 describes timing card in right panel | Shows top 3 best times but no link to explore further in Timing tab | Users who want deeper timing analysis must navigate manually |
| FI-3 | Post detail "View on Threads" is the only outbound action | Minor | §6.3 specifies external link | ArrowSquareOut icon, opens in new tab | No "scan this post" or "generate similar" actions from post detail |

---

## Positive Divergences

Implementation improvements over spec that should be preserved:

| # | What | Where | Why It's Better |
|---|------|-------|-----------------|
| 1 | Dedicated full-screen loading page with animated progress | `/loading` + `BackfillProgress` | Focused first-run UX with personality ("Unraveling your threads..."), Framer Motion animations, reduced-motion support — far better than a banner-only approach for new users |
| 2 | All v1 Phase 1-3 features live | Posts, Timing, Audience, Scanner, Compose tabs | Product is significantly more valuable than v0 spec describes |
| 3 | "Soon" badges removed from Scanner/Compose tabs | `dashboard-tabs.tsx` | Features are live — no misleading "coming soon" messaging |
| 4 | Robust streaming UX in Composer | `composer.tsx` | useReducer with 14+ actions, abort controller, sequential draft streaming, auto-quality analysis on completion |
| 5 | Hydration-safe patterns throughout | Viral recovery, backfill banner, timing heatmap | `useSyncExternalStore` and `suppressHydrationWarning` prevent SSR/client mismatches |
| 6 | Consistent skeleton loading across all components | All dashboard components | Every component has a purpose-built skeleton, not generic spinners |
| 7 | URL-driven filter state with proper pagination reset | `post-filters.tsx` | Deep-linkable, browser back/forward works, filter changes reset to page 1 |
| 8 | Cadence optimizer scatter chart with outlier clamping | `cadence-optimizer.tsx` | 95th-percentile axis clamping with diamond markers for outliers — prevents a few extreme values from compressing the useful range |

---

## PRD & Feature Compliance

| Feature | Category | In Spec? | In Code? | Gap |
|---------|----------|----------|----------|-----|
| Sign In with Threads | Auth | Yes | Yes | None |
| Sign Out | Auth | Yes | Yes | None |
| Automatic Token Refresh | Auth | Yes | Yes (cron) | None |
| Historical Data Import | Auth | Yes | Yes | None — enhanced with `/loading` page |
| Resume/Retry Failed Imports | Auth | Yes | Yes | None |
| Post Performance Table | Posts | Yes | Yes | None |
| Sort Posts by Any Metric | Posts | Yes | Yes | None |
| Filter by Media Type | Posts | Yes | Yes | None |
| Filter by Date Range | Posts | Yes | Yes | None |
| Expand Post Details | Posts | Yes | Yes | None — enhanced with comment quality |
| Comment Quality Analysis | Posts | Yes (v1 P2) | Yes | Spec says "conceptually"; fully built |
| Velocity Indicators | Posts | Yes (v1 P2) | Yes | Spec says "conceptually"; fully built |
| Format Analysis | Posts | Yes (v1 P1) | Yes | Spec says "conceptually"; fully built |
| Reselection Alerts | Posts | Yes (v1 P1) | Yes | Spec says "conceptually"; fully built |
| Best Time Heatmap | Timing | Yes | Yes | None |
| Change Heatmap Timezone | Timing | Yes | Yes | None |
| Cadence Optimizer | Timing | Yes (v1 P1) | Yes | Spec says "conceptually"; fully built |
| Follower Growth Chart | Audience | Yes | Yes | None |
| Audience Demographics | Audience | Yes | Yes | None |
| Semantic Focus Score | Audience | Yes (v1 P2) | Yes | Spec says "conceptually"; fully built |
| Audience Fit Score | Audience | Yes (v1 P2) | Yes | Spec says "conceptually"; fully built |
| Quality Scanner | Scanner | Yes (v1 P3) | Yes | Spec says "coming soon" placeholder; fully built |
| Quality Issues | Scanner | Yes (v1 P3) | Yes | Spec says "coming soon"; fully built |
| AI Rewrites | Scanner | Yes (v1 P3) | Yes | Spec says "coming soon"; fully built |
| Shareability Score | Scanner | Yes (v1 P3) | Partial | Integrated into LLM analysis, not standalone widget |
| Engagement Prediction | Scanner | Yes (v1 P3) | Yes | Spec says "coming soon"; fully built |
| Scan Existing Posts | Scanner | Yes (v1 P3) | Yes | Post selector in scanner UI |
| Generate AI Drafts | Composer | Yes (v1 P3) | Yes | Spec says "coming soon"; fully built |
| Topic Inspiration | Composer | Yes (v1 P3) | Yes | "Surprise me" button |
| Edit/Copy/Regenerate | Composer | Yes (v1 P3) | Yes | DraftCard with all three actions |
| Topic Suggestions | Composer | Yes (v1 P3) | Yes | Right panel with semantic distance |
| Best Time Recommendations | Composer | Yes (v1 P3) | Partial | Shows times but uses UTC default instead of user timezone |
| Viral Recovery Guidance | Alerts | Yes (v1 P1) | Yes | Card with countdown, playbook, dismiss |
| Token Expiry Warning | Alerts | Yes | Yes | None |
| Data Import Status Banner | Alerts | Yes | Yes | None — plus dedicated `/loading` page |
| Saved Drafts Browsing | Composer | No | No | FEATURES.md notes drafts saved to DB but no browsing UI |

---

## Prioritized Recommendations

### Critical -- Must Address in Redesign

(None — no UX-breaking issues found.)

### Major -- Should Address in Redesign

1. **[MM-1] Update spec to reflect current product state**
   - Finding: UX_DESIGN.md describes Scanner and Composer as "Coming Soon" but both are fully functional
   - Recommendation: Redesign spec must treat all five tabs as live features and address full feature density

2. **[CL-1] Progressive disclosure for Audience tab**
   - Finding: 4 full sections (follower chart, demographics, semantic focus, audience fit) create cognitive overload
   - Recommendation: Consider collapsible sections, tabbed sub-navigation within the Audience tab, or a "Summary → Deep Dive" pattern where secondary insights (semantic focus, audience fit) are revealed on demand

3. **[CL-2] Guided entry point for Composer**
   - Finding: 3-panel layout with topic input, 5 style presets, draft cards, quality gauge, prediction, timing, and topic suggestions is dense
   - Recommendation: Consider a stepped flow (topic → style → generate) or a "quick start" mode that hides the right panel until drafts exist

4. **[SD-1] Fix Composer best-times timezone**
   - Finding: `computeBestTimes(heatmapPosts, "UTC")` — should use browser timezone
   - Recommendation: Pass browser timezone from client component or use same `useSyncExternalStore` pattern as TimingHeatmap

5. **[IA-1] Audience tab section density**
   - Finding: 4 sections with charts require significant scrolling; lower sections may go undiscovered
   - Recommendation: Anchor nav, collapsible cards, or summary cards at top that link to detail sections

### Minor -- Consider in Redesign

1. **[AF-1] Add keyboard support to follower spike dots**
   - Finding: Spike dots use pointer-only interaction
   - Recommendation: Add `tabIndex={0}` and `onKeyDown` handler for Enter/Space

2. **[AF-2] Improve Scanner "Analyze existing post" discoverability**
   - Finding: Toggle button for post selector may be overlooked
   - Recommendation: Consider an inline prompt when textarea is empty: "Type a new draft or select an existing post"

3. **[FI-1] Add Scanner → Composer cross-flow**
   - Finding: No path from analyzing a poor-quality post to generating a better version
   - Recommendation: Add "Generate better version" action from Scanner that opens Composer with topic pre-filled

4. **[FI-2] Link Composer timing to Timing tab**
   - Finding: Timing recommendations in Composer right panel are static, no link to full analysis
   - Recommendation: Add "See full analysis →" link to `/dashboard/timing`

5. **[MM-3] Add WES explainer or onboarding tooltip**
   - Finding: WES column appears without explanation beyond a brief tooltip
   - Recommendation: First-time tooltip or info icon that explains the algorithm weighting

6. **[FI-3] Add cross-actions from Post detail row**
   - Finding: Only "View on Threads" action available from expanded post detail
   - Recommendation: Add "Scan this post" action linking to Scanner with post pre-selected

### Preserve -- Keep As-Is

1. **Full-screen loading page (`/loading`)**
   - Rationale: Provides a focused, delightful first-run experience with animated progress, stage labels, and personality. The dual approach (dedicated page for first-run, banner for returning users) is better than spec's banner-only design.

2. **URL-driven filter state**
   - Rationale: Deep-linkable, browser history compatible, pagination reset on filter change. Implementation matches spec intent perfectly.

3. **Consistent 4-state machine pattern**
   - Rationale: Every component implements Loading/Error/Empty/Success with contextual copy, `isImporting` variants, and proper accessibility attributes.

4. **Cadence optimizer outlier handling**
   - Rationale: 95th-percentile clamping with diamond markers prevents axis compression while preserving outlier visibility.

5. **Hydration-safe patterns**
   - Rationale: `useSyncExternalStore` for browser-dependent values (timezone, localStorage) and `suppressHydrationWarning` prevent SSR mismatches throughout.

6. **Streaming UX in Composer**
   - Rationale: Well-engineered state management with useReducer, abort controller, sequential streaming, and cursor animation. Robust error handling including LLM unavailability (503) detection.

7. **Tab group separation (Analyze | Create)**
   - Rationale: Visual separator between analytics tabs and AI creation tabs helps frame the dual-purpose product.

8. **Accessibility implementation**
   - Rationale: ARIA roles on tables, grids, charts; keyboard navigation for expandable rows, sortable columns, filters, pagination; screen reader alternatives for all charts; reduced-motion support; focus-visible rings.
