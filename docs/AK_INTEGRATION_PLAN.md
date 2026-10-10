# AK-Threads-Booster Integration Plan

> A feature proposal mapping the `docs/seo/AK-Threads-booster/` skill repo onto the spool web app. The goal is to absorb what the skills know (algorithm red lines, brand voice analysis, consultant diagnostics, prediction feedback loops) into spool's live product surface — without duplicating anything we've already shipped.

See the companion analysis at `docs/seo/AK-Threads-booster/REPORT.md` for the full anatomy of the skill repo.

---

## 1. Why this plan

Spool's v2 dashboard (tickets 048–064) is live: Today Hub, Understand, Insights, Create (Scanner + Composer + Discover), BYOK LLM settings. The core analytics stack is mature. What we're weak on is the **"why did this work / why won't this work / what should I say next"** consultant layer — the reasoning a creator gets from a thoughtful editor.

The AK-Threads-Booster skills are exactly that consultant layer, built as a Claude Code plugin. Its eight sub-skills cover:

- Historical import and style extraction (`/setup`)
- Qualitative voice profiling (`/voice`)
- Topic recommendations with freshness gates (`/topics`)
- Voice-aligned drafting (`/draft`)
- Diagnostic review of finished drafts (`/analyze`)
- 24-hour performance prediction (`/predict`)
- Tracker refresh (`/refresh`)
- Post-publish review loop (`/review`)

The skills are backed by a **knowledge-as-data** architecture: `knowledge/algorithm.md` (R1–R12 red lines, S1–S14 suppression risks), `knowledge/psychology.md` (~859 lines of behavioral science reference), `knowledge/ai-detection.md` (sentence/structure/content AI-tone markers), `knowledge/data-confidence.md` (five-tier rubric). These files are loaded into the LLM's context at runtime — and that's the exact pattern we want to adopt for our server-side LLM calls.

---

## 2. Gap analysis

| Capability | Spool today | AK provides | Decision |
|---|---|---|---|
| Post ingestion, metrics, OAuth | ✅ `backfill-job.ts`, `threads-api.ts` | ✅ but CLI-based | **Keep spool's.** |
| Topic clustering | ✅ `topic-model.ts`, `topic-classification.ts` | Conceptually present via tags | **Keep spool's.** |
| Weighted engagement score (WES) | ✅ `weighted-engagement.ts` | Similar idea, less formal | **Keep spool's.** |
| Quality scanner (tone, issues, rewrites) | ✅ `quality-llm.ts`, `quality-heuristics.ts` | Implicit in `/analyze` | **Augment** with AK's structured rubric. |
| Composer (3 variations) | ✅ `composer-prompt.ts` | `/draft` (single, voice-driven) | **Augment** with brand voice driver. |
| Engagement prediction (p25/p50/p75) | ✅ `engagement-prediction.ts` | `/predict` ranges | **Augment** with prediction persistence + actual comparison. |
| Topic suggestions (near/mid/far) | ✅ `topic-suggestions.ts`, Grok trending | `/topics` with freshness gate | **Augment** with freshness gate + self-repetition risk. |
| AI-tone detection | ✅ partial (scanner) | `ai-detection.md` 10+5+5 markers | **Upgrade** using AK's marker taxonomy. |
| Algorithm red-line warnings | ⚠️ partial (issue categories only) | `algorithm.md` R1–R12 + S1–S14 | **Upgrade** with explicit rule catalog. |
| **Brand voice qualitative profile** | ❌ missing | `/voice` (11 dimensions, `brand_voice.md`) | **New feature.** |
| **Concept library / analogy tracker** | ❌ missing | `/setup` (`concept_library.md`) | **New feature.** |
| **Prediction vs actual review loop** | ❌ missing | `/review` | **New feature.** |
| **Data confidence tiers in UI** | ❌ missing | `knowledge/data-confidence.md` | **New cross-cutting.** |
| **Freshness audit log** | ❌ missing | `threads_freshness.log` | **New feature.** |
| **Consultant diagnostic narrative** | ⚠️ partial (issues array) | `/analyze` structured 4-axis output | **Upgrade.** |

**Summary:** 4 net-new features, 4 upgrades to existing features, 1 cross-cutting presentation change.

---

## 3. Proposed feature set

Organized by value tier and grouped by which AK skill(s) it adapts. Every feature is a product-surface feature — we're not shipping CLI skills; we're absorbing the logic into the Next.js app.

### Tier 1 — New features (highest value)

#### F1. Brand Voice Profile

**Source:** `/voice` skill; `examples/brand-voice-example.md` as the output shape.

**What it is:** A new page under `/dashboard/understand/voice` (or a card on the audience page) that auto-extracts and displays the user's qualitative voice profile across 11 dimensions (sentence structure, tone switching, emotional expression, knowledge presentation, fan vs critic reply tone, analogies, humor, self-reference, taboo phrases, paragraph rhythm, comment-reply characteristics). Each dimension cites 2–3 actual post excerpts.

**Why it matters:** The Composer today uses "top 10 posts by WES" as an implicit style prompt. That produces 3 variations that sometimes feel generic. A structured `brand_voice` profile becomes a **composition driver** for the Composer's system prompt and pushes output toward the user's real voice.

**Implementation sketch:**

- New lib: `src/lib/brand-voice.ts` with `analyzeBrandVoice(posts, comments, userId)`.
- LLM call using our existing `llm-resolver.ts`. Prompt template lives in `src/lib/prompts/brand-voice.md` — markdown, edited without code changes, following the AK knowledge-as-data pattern.
- Persist result as JSON in Supabase: new `brand_voice_profiles` table, one row per user, updated on demand. Columns: `user_id`, `profile` (jsonb), `source_post_count`, `confidence_tier`, `updated_at`.
- Realtime subscription: when the user clicks "Refresh voice" or posts N new items, we recompute and publish.
- UI: `src/components/dashboard/brand-voice-panel.tsx` — accordion of 11 dimensions with excerpts.
- **Composer integration:** `composer-prompt.ts` pulls the profile and injects it as the primary voice driver. Respects the AK discipline — used as composition driver in Composer, but **observation-only** in Scanner (flag drift, don't pull text toward the profile).

**Confidence tier gating:** under 10 posts → show "directional" banner and don't let it drive composition until we hit Usable (10+).

---

#### F2. Concept Library

**Source:** `/setup` skill (concept_library.md output); `templates/concept-library-template.md` for schema.

**What it is:** A searchable table of concepts the user has already explained, analogies they've used, and reuse risk per concept. Lives at `/dashboard/understand/concepts` or as a tab inside Insights. Columns: concept, first-seen post, times explained, analogies used, reuse risk (green/yellow/red), last used date, related cluster.

**Why it matters:**
- Prevents unconscious repetition ("you've used the 'rainforest ecosystem' analogy 5 times in 3 months").
- Feeds into Composer: when drafting about a topic, surface the analogies already burned so the user reaches for a fresh one.
- Editorial superpower: answers "have I explained this before?"

**Implementation sketch:**

- New lib: `src/lib/concept-library.ts` — builds the library by running a classifier-style LLM pass over posts, extracting concepts and analogies. Emits `{concept, analogy, post_id, timestamp}` rows.
- Table: `concept_ledger` with `user_id`, `concept`, `analogy`, `post_id`, `seen_at`. Upsert on re-run.
- Materialized view or computed lib function for the "reuse risk" aggregate per concept.
- UI: `src/components/dashboard/concept-library-table.tsx`.
- Composer integration: add a pre-draft check — if the chosen topic hits concepts in the library, highlight "you've used analogy X before; consider Y."

---

#### F3. Prediction → Actual review loop

**Source:** `/predict` + `/review` skills.

**What it is:** We already compute engagement prediction ranges (`engagement-prediction.ts`). Today they're ephemeral — shown in the Composer and Scanner but not persisted. This feature **persists the prediction at compose time** and, 24–72 hours after publish, presents a **prediction-vs-actual report**:

- Predicted range (Conservative / Baseline / Optimistic) — snapshotted at draft time.
- Actual result — pulled by the next `backfill-job.ts` sweep.
- Deviation analysis (narrative): "Actual beat Optimistic. Likely drivers: strong reply velocity in first 3 hours, topic cluster X on the rise. Reuse the hook structure."
- Signal validation: did the flagged upside drivers play out? Did the uncertainty factors materialize?
- Cumulative stats: "Your predictions land in the Baseline band 62% of the time. Conservative underestimates topic cluster Z consistently."

**Why it matters:** Closes the learning loop. Makes spool's prediction model falsifiable, which makes it trustworthy. Generates the narrative that the current dashboard is missing.

**Implementation sketch:**

- New table: `post_predictions` — `post_id`, `draft_text_hash`, `predicted_at`, `ranges` (jsonb), `driver_factors` (jsonb), `actual_windowed_metrics` (jsonb, nullable), `review_state` ('pending'|'reviewed'|'discarded'), `reviewed_at`.
- Compose/Scanner writes a prediction snapshot to this table at save time. (Spool doesn't publish posts directly, so we'd tie this to "mark as published" — a new one-click action in the Composer result view, or auto-link by text match when backfill sees a new post.)
- Cron or scheduled job (`src/app/api/reviews/sweep/route.ts`): for posts older than 24h with `review_state = pending`, run the review analysis and mark reviewed.
- New page: `/dashboard/understand/reviews` — timeline of predictions vs actuals.
- Today Hub card: "Latest review" — prediction vs actual on the most recently published post, with one key learning.

---

#### F4. Data confidence tiers (cross-cutting)

**Source:** `knowledge/data-confidence.md`.

**What it is:** A five-tier label (Directional / Weak / Usable / Strong / Deep) applied to every analytics view that depends on historical post count. Shown as a small pill next to section headers: "Performance by hook type · Strong (47 posts)".

**Why it matters:** Prevents the product from overstating precision on new accounts. Today, a user with 3 posts sees the same confident percentages as one with 300. This is a credibility fix.

**Implementation sketch:**

- New util: `src/lib/data-confidence.ts` — `getConfidenceTier(sampleSize)` returns tier + label + suggested copy.
- New primitive: `<ConfidenceBadge tier={...} sample={47} />`.
- Sprinkle through: topic insights, performance page, audience-topic fit, Today Hub cards.
- Gate behaviors: below Directional (<5 posts), some outputs switch to description-only (no predicted ranges, no trend arrows).

---

### Tier 2 — Upgrades to existing features

#### F5. Scanner → AK-style structured diagnostic

**Source:** `/analyze` skill.

**What it is:** Today the Scanner returns `{issues: [...], rewrites: [...], shareability, tone}`. Upgrade the output shape to a **four-axis diagnostic** matching `/analyze`:

1. **Style matching** vs user's style guide + top-quartile posts (with nearest-neighbor citations).
2. **Psychology triggers** — hook type, share motives, cognitive biases present/missing, retellability.
3. **Algorithm alignment** — explicit red-line matches (R1–R12) and suppression-risk matches (S1–S14) from a new `src/lib/prompts/algorithm.md` reference file.
4. **AI-tone detection** — upgraded from generic tone-vs-baseline to the 10+5+5 marker taxonomy from `ai-detection.md`.

**Why it matters:** Turns the scanner from "issues" into "diagnosis." Each finding carries structure (which axis, which rule, which neighbor post), which drives trust and makes suggestions actionable.

**Implementation sketch:**

- Replace `quality-llm.ts` prompt builder with one that loads `src/lib/prompts/analyze.md` + knowledge references.
- Extend `quality-scanner-shared.ts` types with the four-axis structure (keep old shape behind a flag during migration).
- Scanner UI: four collapsible cards instead of a flat issue list; each card shows rule matches + neighbor-post citations.
- Discipline from AK: **do not return full rewrites by default.** The Scanner becomes diagnostic; rewriting moves to the Composer (which already exists). This matches AK's `/analyze` vs `/draft` split.

---

#### F6. Algorithm knowledge module

**Source:** `knowledge/algorithm.md` (750 lines, R1–R12, S1–S14, first-3-hour strategy, 4×4 matrix).

**What it is:** A reference document at `src/lib/prompts/algorithm.md` loaded by the Scanner and Composer LLM prompts. Not a new page — it's infrastructure. The file itself mirrors AK's structure (red lines, signal zones, strategy) but rewritten for our voice and kept current by us.

**Why it matters:** Same payoff AK has — Meta changes, we edit one file, every LLM-powered feature picks it up. No code changes.

**Implementation sketch:**

- Create `src/lib/prompts/` directory. Add `algorithm.md`, `psychology.md`, `ai-detection.md` (all distilled from AK versions — we reference, not copy, with attribution).
- Update `quality-llm.ts` and `composer-prompt.ts` to inject these references.
- Add to prompt caching via the Claude API (these files are stable and large — perfect candidates for cache breakpoints).
- Optional surface: a `/dashboard/understand/playbook` page that renders these markdown files as a reference the user can read. Good for credibility; low engineering cost.

---

#### F7. Topic freshness gate + self-repetition risk

**Source:** `/topics` + `/draft` skills; `threads_freshness.log` pattern.

**What it is:** Before the Composer drafts on a topic, run a freshness check:

- **External freshness:** use existing Grok search integration to classify Green / Yellow / Red based on external saturation.
- **Self-repetition risk:** check the user's own tracker for recent similar topics (semantic cluster match in last 7/14/30 days).
- Log every check to a `freshness_checks` table with `run_id`, `topic`, `verdict`, `sources`, `created_at` — an audit trail.

**Why it matters:** We already have the pieces (Grok search, topic clusters) but they don't converge into a pre-draft gate. This prevents the Composer from generating on dead topics or topics the user just covered.

**Implementation sketch:**

- New lib: `src/lib/freshness-gate.ts` — `checkTopicFreshness(topic, userId)` returns `{verdict, externalSignal, selfRepetitionRisk, sources}`.
- Composer flow: run the gate before LLM draft, show verdict banner, allow user to proceed anyway (with warning) or pick a different topic.
- Today Hub "What to post" card: filter candidates through the gate; surface only Green + reframed Yellow.
- New table: `freshness_checks` (audit log).
- New page section: `/dashboard/understand/reviews` includes freshness-log health (degradation patterns, pattern drifts).

---

#### F8. AI-tone detection upgrade

**Source:** `knowledge/ai-detection.md`.

**What it is:** Upgrade the Scanner's current tone detection from "does this sound AI-generated (general)" to a structured marker scan:

- 10 sentence-level markers (fixed phrases, over-neat contrast, gold-sentence density, performative transitions, rhetorical question closures, overly complete reasoning, book-style connectors, too-neat lists, unnatural emotion words, philosophical endings).
- 5 structure-level markers (too-smooth arguments, over-complete endings, over-neat paragraph closures, perfect narrative arc, uniform information distribution).
- 5 content-level markers (floating numbers, one-directional evidence, abstract without concrete cases, overly neutral stance, knowledge display).

Output: matched markers with locations + the 6 de-AI-ification methods as recommended actions.

**Why it matters:** Our current detection gives a vibe; the AK version gives a checklist. Much more actionable.

**Implementation sketch:**

- Add to `src/lib/prompts/ai-detection.md`.
- Extend Scanner's axis-3 output type with `ai_markers: MarkerMatch[]`.
- UI: highlight-on-hover in the draft preview showing exactly which sentence triggered which marker.

---

### Tier 3 — Architectural absorbs

These aren't user-visible features; they're patterns from AK worth adopting in the codebase.

#### A1. Knowledge-as-data directory

Adopt `src/lib/prompts/` as the canonical location for large stable prompt fragments. Every skill-adjacent LLM call in spool should load from here. Editing `algorithm.md` updates Scanner + Composer + Topic suggestions in one edit. Benefits: prompt caching for free (stable prefixes), easier A/B, non-engineers can edit.

#### A2. Composition driver vs observer discipline

Codify in `brand-voice.ts`: the profile is a composition driver **only** in the Composer. Scanner, Prediction, Review all treat it as observation-only (flag drift, never pull text toward it). Document in `src/lib/prompts/brand-voice-usage.md`. Prevents feedback-loop homogenization.

#### A3. Audit logs as interskill communication

AK uses `threads_freshness.log` and `threads_refresh.log` as append-only logs that later skills read for health monitoring. We should have equivalents:
- `freshness_checks` (F7)
- `post_predictions` (F3)
- `backfill_events` — we likely have something already; formalize as a reviewable log
Use these both for feature logic and for a small admin/health page (already have `dev/backfills/page.tsx` as a start).

#### A4. Transactional updates with backups

AK's `/review` treats three-file updates as all-or-nothing with backups. In our Supabase world, the equivalent is transactional writes + audit trail. When F3 (review loop) updates multiple tables (post_predictions + brand voice hints + concept library), wrap in a transaction and record to a review event log for rollback.

#### A5. Data-confidence-first presentation

Pair with F4. Make it culturally hard to ship a new analytics view without wiring a `<ConfidenceBadge />` in. Lint rule or template convention.

---

## 4. What we deliberately skip

- **`/refresh` skill.** We have `backfill-job.ts` — no need to add a Chrome MCP fallback. API-first is fine.
- **`/setup` skill's Chrome/export paths.** We have OAuth. Skip.
- **Installing the skills as a Claude Code plugin inside spool's repo.** The skills are great for local authoring; the product should be native Next.js.
- **`concept_library.md` / `brand_voice.md` as files on disk.** We store in Supabase. Export to markdown is a stretch goal (user-requested "download my voice profile" feature).
- **Bilingual UI for now.** AK is zh/en; spool is en-first. Translate later.

---

## 5. Phased rollout

Each phase is one sprint-sized unit, with concrete tickets.

### Phase 1 — Foundation (unblocks everything else)

- **T-070** Create `src/lib/prompts/` with distilled `algorithm.md`, `psychology.md`, `ai-detection.md`, `data-confidence.md`. (A1, F6)
- **T-071** Ship `<ConfidenceBadge />` + `data-confidence.ts` util. Retrofit across Understand + Insights pages. (F4, A5)
- **T-072** Refactor `quality-llm.ts` and `composer-prompt.ts` to load from `src/lib/prompts/`. Enable Claude API prompt caching on the stable prefixes.

### Phase 2 — New signals

- **T-073** Brand Voice extraction: `brand-voice.ts` lib, Supabase table, refresh endpoint. (F1)
- **T-074** Brand Voice UI panel at `/dashboard/understand/voice`. (F1)
- **T-075** Wire Brand Voice into Composer as primary driver; into Scanner as observer. (F1, A2)
- **T-076** Freshness Gate: `freshness-gate.ts`, `freshness_checks` table, Composer pre-draft integration. (F7, A3)

### Phase 3 — The loop

- **T-077** `post_predictions` table + prediction snapshot on Composer save / "mark published". (F3)
- **T-078** Backfill-triggered review sweep + narrative generator. (F3)
- **T-079** `/dashboard/understand/reviews` page with prediction-vs-actual timeline + cumulative stats. (F3)
- **T-080** Today Hub "Latest review" card. (F3)

### Phase 4 — Diagnostic polish

- **T-081** Scanner four-axis refactor — structure output, UI cards, neighbor-post citations. (F5)
- **T-082** AI-tone marker taxonomy rollout with in-draft highlighting. (F8)
- **T-083** Concept Library lib + `concept_ledger` table. (F2)
- **T-084** Concept Library UI + Composer pre-draft analogy reuse check. (F2)

### Phase 5 — Stretch

- Playbook page (markdown knowledge rendered as reference).
- Export brand voice / concept library as downloadable markdown (for users who also use the Claude Code skills).
- AK skill installation docs for power users who want the CLI workflow alongside the app.

---

## 6. Open questions

1. **Publish tracking.** Spool doesn't publish to Threads directly (API limitation). How do we tie a Composer draft to the published post for F3's prediction-vs-actual loop? Options: (a) user clicks "mark as published," (b) match by text fuzzy-hash when the next backfill sweep finds a new post, (c) both. Default: (c).
2. **Prompt caching cost.** Large knowledge files inflate prompt size. Claude API caching amortizes this, but we should measure the break-even on cache hit rate per feature.
3. **Brand voice update cadence.** On-demand only, or auto-refresh every N posts? AK is on-demand. Suggest on-demand with a "needs refresh — you've added 12 posts since last analysis" nudge.
4. **Concept library recall.** The classifier-style extraction is expensive. Batch once, then incrementally update on new posts only.
5. **Scanner scope change risk.** F5 removes rewrites from Scanner output. Users may expect them. Either keep rewrites as an explicit sub-action ("Get rewrite suggestions" button) or migrate fully to "Scanner diagnoses, Composer rewrites."
6. **Attribution.** AK is MIT. We're adapting, not copying. Attribution block in `src/lib/prompts/README.md` linking to the source repo.

---

## 7. Success criteria

Per phase, how we know it landed:

- **Phase 1:** Every analytics section shows a confidence badge. Prompt cache hit rate >80% on Scanner and Composer calls.
- **Phase 2:** Composer output visibly more on-voice (measurable: Scanner's "style match" score jumps after Brand Voice injection). Users can answer "does this look like me?" yes/no from the Voice page.
- **Phase 3:** Every post published through spool has a persisted prediction within 24h. Review page has at least 10 reviewed posts for the active user within a week.
- **Phase 4:** Scanner output is diagnostic-structured (no flat issues list). AI-tone markers cite exact sentences.
- **Phase 5:** Voluntary uptake of playbook / export features indicates user trust.

---

## 8. Critical files & paths

**New:**
- `src/lib/prompts/{algorithm,psychology,ai-detection,data-confidence,brand-voice,analyze}.md`
- `src/lib/brand-voice.ts`
- `src/lib/concept-library.ts`
- `src/lib/freshness-gate.ts`
- `src/lib/data-confidence.ts`
- `src/lib/post-review.ts`
- `src/components/dashboard/brand-voice-panel.tsx`
- `src/components/dashboard/concept-library-table.tsx`
- `src/components/dashboard/prediction-review-card.tsx`
- `src/components/ui/confidence-badge.tsx`
- `src/app/dashboard/understand/voice/page.tsx`
- `src/app/dashboard/understand/concepts/page.tsx`
- `src/app/dashboard/understand/reviews/page.tsx`
- Supabase tables: `brand_voice_profiles`, `concept_ledger`, `freshness_checks`, `post_predictions`

**Modified:**
- `src/lib/quality-llm.ts` (F5, F8)
- `src/lib/composer-prompt.ts` (F1, F7)
- `src/lib/engagement-prediction.ts` (F3)
- `src/lib/quality-scanner-shared.ts` (F5)
- `src/components/dashboard/quality-scanner.tsx` (F5, F8)
- `src/components/dashboard/composer.tsx` (F1, F7)
- `src/app/dashboard/page.tsx` (F3 Today Hub card)
- Understand + Insights pages (F4 badges)

---

## 9. Reference

- `docs/seo/AK-Threads-booster/REPORT.md` — full repo anatomy.
- `docs/seo/AK-Threads-booster/skills/voice/SKILL.md` — brand voice extraction spec.
- `docs/seo/AK-Threads-booster/skills/analyze/SKILL.md` — four-axis diagnostic spec.
- `docs/seo/AK-Threads-booster/skills/predict/SKILL.md` + `skills/review/SKILL.md` — prediction loop spec.
- `docs/seo/AK-Threads-booster/knowledge/algorithm.md` — R1–R12 + S1–S14.
- `docs/seo/AK-Threads-booster/knowledge/psychology.md` — behavioral science reference.
- `docs/seo/AK-Threads-booster/knowledge/ai-detection.md` — marker taxonomy.
- `docs/seo/AK-Threads-booster/knowledge/data-confidence.md` — five-tier rubric.
- `docs/seo/AK-Threads-booster/examples/brand-voice-example.md` — target output shape for F1.
