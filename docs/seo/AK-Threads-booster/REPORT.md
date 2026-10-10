# AK-Threads-Booster: How This Skill Repo Works

> An analysis of the `AK-Threads-booster` Claude Code plugin — what it does, how it's structured, and how its eight sub-skills compose into a decision-driven content workflow for Threads creators.

---

## 1. Executive Summary

**AK-Threads-Booster** is a Claude Code plugin (also usable via Codex, Cursor, and Windsurf through `AGENTS.md`) that turns a Threads creator's own post history into a repeatable, evidence-backed content workflow. It ships **eight sub-skills** that cover the full lifecycle of a post — from initial account import, through topic selection, drafting, pre-publish analysis, and performance prediction, to post-publish review — with a shared knowledge base on algorithm mechanics, social psychology, AI-tone detection, and data confidence.

The central design choice is **consultant, not ghostwriter**: every recommendation traces back to the user's own tracker data and cites original post excerpts. Skills analyze and advise; they do not rewrite the user's text unless explicitly asked to draft from scratch. When data is thin, skills honestly downgrade their confidence rather than fabricate precision.

---

## 2. Problem & Target User

### The problem

Threads creators who post consistently still hit the same walls:

- Inconsistent performance they can't explain.
- Guessing what to write next, or cycling through the same angles.
- Generic AI drafts that don't sound like them.
- No feedback loop between what published well and the next topic they pick.

The repo's stated thesis: a creator's own post history is an underused dataset. Instead of chasing viral templates, mine your own tracker for what actually distributes on *your* account.

### Target user

- Established Threads creators with enough post history (the system works best at 20+ posts; degrades gracefully below that).
- Users who want a decision-driven process rather than vibes-based posting.
- Users on the Meta Threads API, or willing to use Meta's data export / Chrome MCP fallback scraping.

The repo is not a viral-post generator, not a spam tool, and explicitly not an "AI-writer" — `/draft` is the only skill that composes new text, and it is a starting point expected to be edited.

---

## 3. Repository Layout

```
AK-Threads-booster/
├── README.md                    Chinese entry-point readme
├── README.en.md                 English entry-point readme
├── SKILL.md                     Root-level routing skill for Claude Code
├── AGENTS.md                    Entry point for Codex / Cursor / Windsurf
├── LICENSE                      MIT
├── .gitignore                   Protects user data artifacts (tracker, voice, logs)
├── .claude-plugin/
│   └── plugin.json              Plugin registration metadata
├── skills/
│   ├── setup/SKILL.md           Import history, generate style + concept files
│   ├── voice/SKILL.md           Deep brand-voice analysis
│   ├── topics/SKILL.md          Mine next-best topics from comments + history
│   ├── draft/SKILL.md           Generate a draft from topic + brand voice
│   ├── analyze/SKILL.md         Diagnostic review of a finished post
│   ├── predict/SKILL.md         24-hour performance range estimate
│   ├── refresh/SKILL.md         Update tracker via API or Chrome MCP
│   └── review/SKILL.md          Post-publish learning loop
├── knowledge/
│   ├── _shared/
│   │   ├── principles.md        Consultant principles loaded by every skill
│   │   └── discovery.md         File-locator patterns for skills
│   ├── algorithm.md             Meta/Threads algorithm mechanics (R1–R12, S1–S14)
│   ├── psychology.md            Social psychology reference (~859 lines)
│   ├── ai-detection.md          AI-tone detection checklist (~602 lines)
│   ├── data-confidence.md       Five-tier data confidence rubric
│   └── chrome-selectors.md      DOM selectors for Chrome MCP fallback
├── scripts/
│   ├── fetch_threads.py         Pull posts + metrics via Meta Threads API
│   ├── parse_export.py          Parse Meta official data export (JSON/HTML)
│   ├── update_snapshots.py      Generate markdown companion archives
│   ├── update_topic_freshness.py Freshness audit + semantic-cluster fatigue
│   ├── render_companions.py     Render templates/companions from tracker
│   └── requirements.txt         Single dep: requests>=2.28.0
├── templates/
│   ├── tracker-template.json    Minimal tracker scaffold
│   ├── style-guide-template.md  Style guide schema
│   └── concept-library-template.md  Concept library schema
└── examples/
    ├── tracker-example.json     Populated sample tracker (8 posts)
    ├── style-guide-example.md   Generated style guide output
    └── brand-voice-example.md   Generated brand voice output
```

---

## 4. Plugin Configuration

The repo registers as a Claude Code plugin via `.claude-plugin/plugin.json`:

```json
{
  "name": "ak-threads-booster",
  "description": "AK體：數據驅動的社交媒體寫文顧問系統。...",
  "version": "1.0.0",
  "author": { "name": "AK SEO Labs", "url": "https://threads.net/@darkseoking" },
  "homepage": "https://github.com/akseolabs-seo/AK-Threads-booster",
  "license": "MIT"
}
```

**Installation**: `claude install-plugin https://github.com/akseolabs-seo/AK-Threads-booster`

Two sibling routing files live at the repo root:

- **`SKILL.md`** — the Claude Code entry point. Classifies user intent and routes to one of the eight sub-skills via relative Glob paths.
- **`AGENTS.md`** — same purpose, but for non-Claude-Code agent environments (Codex CLI, Cursor, Windsurf). Same routing logic, portable phrasing.

Both enforce a critical discipline: `/analyze` vs `/draft`.
- User pastes their own text → `/analyze` (diagnostic, no rewrite).
- User has no text and wants something generated from a topic → `/draft`.

---

## 5. The Eight Sub-Skills

### Quick reference

| Skill | Trigger phrases | Primary input | Primary output | Tracker writes? |
|---|---|---|---|---|
| `setup` | `/setup`, backfill, init | API / export / JSON | tracker, style guide, concept library | ✅ |
| `voice` | `/voice`, brand voice, 語感分析 | tracker + comments | `brand_voice.md` | ❌ |
| `topics` | `/topics`, what to write | tracker + comments | 3–5 topic candidates | ❌ (logs only) |
| `draft` | `/draft`, write a post | topic + brand voice | post draft | ❌ (logs only) |
| `analyze` | `/analyze`, check this post | user-pasted post | diagnostic report | ❌ |
| `predict` | `/predict`, how will this do | draft + tracker | Conservative/Baseline/Optimistic | ✅ (optional) |
| `refresh` | `/refresh`, update tracker | API / Chrome MCP | updated tracker | ✅ |
| `review` | `/review`, post-publish | actual metrics + tracker | comparison + updates | ✅ |

### 5.1 `/setup` — Initialize the system

**Location:** `skills/setup/SKILL.md`

First-time initialization. Imports historical post data from one of five paths and builds the foundation that every other skill reads:

1. **Threads API** (preferred) — via `scripts/fetch_threads.py` with a User Access Token.
2. **Meta account data export** — via `scripts/parse_export.py` (JSON or HTML format).
3. **Direct user data** — user pastes JSON/CSV already in tracker shape.
4. **Chrome MCP scraping** — when API isn't available.
5. **Legacy migration** — rehydrates from an older tracker schema.

After normalization, `/setup` auto-generates:
- `threads_daily_tracker.json` (canonical tracker; all other skills depend on it)
- `style_guide.md` (quantitative style snapshot)
- `concept_library.md` (concepts already explained to the audience)
- Markdown companions via `scripts/render_companions.py`

Reports a data confidence tier at completion (Directional / Weak / Usable / Strong / Deep).

### 5.2 `/voice` — Brand voice analysis

**Location:** `skills/voice/SKILL.md`

Deep qualitative pass over all posts and comment replies. Analyzes 11 dimensions, each with original-text evidence:

1. Sentence structure (length distribution, clipped vs flowing)
2. Tone switching patterns (baseline vs corrective vs cynical)
3. Emotional expression style
4. Knowledge presentation (results-first vs definition-first)
5. Fan-reply vs critic-reply tone
6. Analogy style (concrete vs abstract)
7. Humor style and frequency
8. Self-reference patterns (I / you / we)
9. Taboo phrases (words the user never uses)
10. Paragraph rhythm
11. Comment-reply characteristics

Output: `brand_voice.md` — the **only** skill input that `/draft` treats as a composition driver. Every other skill treats `brand_voice.md` as observation-only (used to flag drift, never to pull text toward it).

### 5.3 `/topics` — What to write next

**Location:** `skills/topics/SKILL.md`

Mines comment threads and historical post data to recommend the next 3–5 worthwhile topics. Key mechanics:

- **Signal weighting**: the user's own replies to their own comments are the strongest signal; anonymous comments are weaker.
- **Historical performance lookup** by content type and topic tag.
- **Semantic freshness** from `update_topic_freshness.py` enrichment (clusters, fatigue_risk, days_since_similar_post).
- **External freshness filter**: WebSearch on each candidate — Green (recommend), Yellow (reframe), Red (drop).
- Writes each check to `threads_freshness.log` with a `run_id` and verdict for later audit.

Output: ranked candidates with source, data-backed reasoning, related historical posts, estimated range, external freshness, self-repetition risk, suggested angle.

### 5.4 `/draft` — Generate a post

**Location:** `skills/draft/SKILL.md`

The only skill that composes new text. Workflow:

1. Load `brand_voice.md` as primary composition driver.
2. **Freshness gate**: WebSearch classifies the topic Green/Yellow/Red before writing. Writes the verdict to `threads_freshness.log`. Drops Red topics.
3. Research and fact-check claims — first against `concept_library.md`, then WebSearch.
4. Draft with brand voice alignment, algorithm red-line avoidance (from `algorithm.md`), psychology application, and low AI-tone (from `ai-detection.md`).
5. Deliver draft + writing logic notes + reminder to edit + suggestion to run `/analyze` after.

### 5.5 `/analyze` — Diagnostic review

**Location:** `skills/analyze/SKILL.md`

Runs after the user has written a post (or when they paste text for feedback). **Does not rewrite**. Operates strictly diagnostic:

1. Extract features (content type, hook type, topic tags, word count, emotional arc, ending pattern).
2. Build comparison sets from user's history (nearest neighbors, top-quartile, recent repetition, semantic clusters).
3. Analyze across four axes:
   - Style matching (vs `style_guide.md` and top-quartile posts)
   - Psychology triggers (hooks, share motives, retellability, cognitive biases)
   - Algorithm alignment (R1–R12 red lines, S1–S14 suppression risks)
   - AI-tone detection (sentence/structure/content-level markers)
4. Output: pointed changes with exact locations and concrete alternatives — never bundled rewrites.

### 5.6 `/predict` — 24-hour performance range

**Location:** `skills/predict/SKILL.md`

Estimates a performance range for views, likes, replies, reposts, shares based on three comparison sets (nearest neighbors, top-quartile, recent trend). Key behaviors:

- Trend analysis on the last 10 posts (growth vs decline, topic freshness vs fatigue).
- Outputs a **Conservative / Baseline / Optimistic** table, never a single number — explicitly avoids false precision.
- Optionally persists a `prediction_snapshot` to the tracker (with backup + overwrite confirmation; keeps the five most recent backups).
- Positioned as a "judgment aid, not a target."

### 5.7 `/refresh` — Update the tracker

**Location:** `skills/refresh/SKILL.md`

Pulls latest metrics and comments and merges them into `threads_daily_tracker.json`. Two paths:

- **API path** (preferred): faster, schedulable, reliable.
- **Chrome MCP path** (fallback): navigates to the profile, runs a selector health check against `knowledge/chrome-selectors.md`, scrolls to load posts, opens reply permalinks.

Merge discipline:

- Sweeps expired prediction placeholders (>7 days old) into `discarded_drafts[]` before merging.
- Preserves `prediction_snapshot`, appends new metric snapshots, appends new replies, fills `performance_windows`.
- Backs up tracker before write; regenerates companions via `scripts/render_companions.py`.
- In headless/scheduled mode, writes success/failure to `threads_refresh.log`.

### 5.8 `/review` — Post-publish learning loop

**Location:** `skills/review/SKILL.md`

Closes the loop. After a post has been live long enough to have real numbers:

1. Sweep expired `pending-*` draft placeholders into `discarded_drafts[]`.
2. Collect actual metrics (user-provided or tracker-backed from `/refresh`).
3. Compare prediction vs actual across Conservative / Baseline / Optimistic bands; analyze which upside drivers and uncertainty factors played out.
4. **Deviation analysis**: posting time, hook quality, topic fatigue, account trend, stranger-fit, external events, discovery surface.
5. **3-file transaction** (backups first, all-or-nothing) updating:
   - `threads_daily_tracker.json` — metrics, snapshots, algorithm/psychology signals, `review_state`, `performance_windows`.
   - `style_guide.md` — cautiously (one post extends a trend, does not overturn a stable one).
   - `concept_library.md` — new concepts/analogies.
6. Monitors `threads_freshness.log` and `threads_refresh.log` health; flags degradation patterns.

Output: prediction comparison, deviation analysis, signal validation, cumulative learning.

---

## 6. Knowledge Base Architecture

The `knowledge/` directory is the repo's most architecturally interesting decision: **skills do not hardcode rules**. Every algorithm red line, psychology principle, and AI-tone marker lives in a markdown file that skills load into context at runtime. When Meta changes behavior or Threads updates its DOM, a single-file edit propagates to all eight skills.

### Shared layer — loaded by every skill

| File | Purpose |
|---|---|
| `_shared/principles.md` | Ten consultant principles: observation, user-data-first, honest degrade, user authority, preserve user text, advisor tone, red-line exception, reversibility, transparency, bilingual neutrality. |
| `_shared/discovery.md` | File-locator patterns — where to find tracker, style guide, brand voice, scripts. Establishes a standard load order and fallback rules. |

### Domain knowledge — loaded when relevant

| File | Size | What's in it |
|---|---|---|
| `psychology.md` | ~859 lines | 14 sections across hooks (information gap, pattern interruption, Zeigarnik), engagement (Fogg, Hook Model), trust (Pratfall, parasocial), persuasion (Cialdini, ELM), identity (social identity, Dunbar, SDT). Cites behavioral science sources. |
| `algorithm.md` | ~750 lines | 12 red-line rules (R1–R12: engagement bait, clickbait, plagiarism, etc.), 14 signal-zone rules (S1–S14: private shares, deep comments, topic graph, originality risk), first-3-hour-window strategy, 4×4 matrix of content types. |
| `ai-detection.md` | ~602 lines | 10 sentence-level markers, 5 structure-level markers, 5 content-level markers, 6 de-AI-ification methods, scan sequence. Written in Chinese. |
| `data-confidence.md` | ~74 lines | Five tiers: Directional (<5 posts), Weak (5–9), Usable (10–19), Strong (20–49), Deep (50+). Dataset-level gates — e.g., <5 posts = description only, no prediction. |
| `chrome-selectors.md` | ~67 lines | 13 DOM selectors for Threads profile scraping, health-check logic, localized number parsing (K/M/B variants across languages). Isolates `/refresh` from DOM drift. |

The payoff: swap `algorithm.md` when Meta changes, and all skills' algorithm awareness updates simultaneously. No code edit.

---

## 7. Data Artifacts & Flow

The system operates on a small set of canonical files in the user's working directory.

### Machine-readable (JSON / logs)

- **`threads_daily_tracker.json`** — the backbone. All post data, metrics snapshots, comments, predictions, semantic tags, `performance_windows`, `review_state`.
- **`threads_freshness.log`** — JSON audit log of every `/draft` and `/topics` freshness check (`run_id`, topic, verdict).
- **`threads_refresh.log`** — JSON audit log of every `/refresh` run (success/failure, in headless mode).

### Human-readable (Markdown)

- **`style_guide.md`** — quantitative style snapshot (hook rankings, word-count bands, content-type frequencies).
- **`brand_voice.md`** — qualitative voice profile (11 dimensions with original excerpts).
- **`concept_library.md`** — concepts already explained, analogies used, reuse risk.
- **`posts_by_date.md`** / `歷史貼文-按時間排序.md` — archive sorted by publish date.
- **`posts_by_topic.md`** / `歷史貼文-按主題分類.md` — archive sorted by semantic topic.
- **`comments.md`** / `留言記錄.md` — flat comment log.

### Who writes what

| Artifact | Written by | Read by |
|---|---|---|
| `threads_daily_tracker.json` | `/setup`, `/refresh`, `/predict`, `/review` | all skills |
| `style_guide.md` | `/setup`, updated by `/review` | `/analyze`, `/draft`, `/predict`, `/topics` |
| `brand_voice.md` | `/voice` | `/draft` (driver); `/analyze`, `/predict`, `/review` (observation only) |
| `concept_library.md` | `/setup`, updated by `/review` | `/draft`, `/topics` |
| `threads_freshness.log` | `/draft`, `/topics` | `/review` (health monitor) |
| `threads_refresh.log` | `/refresh` | `/review` (health monitor) |
| Markdown companions | `/setup`, `/refresh` via `render_companions.py` | user (browsing) |

### The `brand_voice.md` discipline

Critical rule repeated across skills: `brand_voice.md` is a **composition driver only for `/draft`**. For `/analyze`, `/predict`, and `/review`, it is **observation only** — they flag drift but never pull text toward the profile. This prevents the system from homogenizing the user's voice over time.

---

## 8. Scripts

All under `scripts/`, single dependency `requests>=2.28.0`.

| Script | Size | What it does |
|---|---|---|
| `fetch_threads.py` | ~15 KB | Pulls all historical posts + metrics (views, likes, replies, reposts, quotes) via Meta Threads API. Requires Meta Developer App + User Access Token with `threads_basic`, `threads_content_publish`, etc. Rate-limited to 250 calls/hour. |
| `parse_export.py` | ~17 KB | Parses Meta's official account data export (downloadable from accountscenter.meta.com). Handles both JSON and HTML formats; auto-detects Threads data within the export bundle. |
| `update_snapshots.py` | ~12 KB | Generates markdown companion archives (`posts_by_date.md`, `posts_by_topic.md`, `comments.md`) from tracker JSON. Bilingual filenames supported. |
| `update_topic_freshness.py` | ~13 KB | Audits topic freshness, detects semantic-cluster fatigue, enriches tracker with `clusters`, `fatigue_risk`, `days_since_similar_post`. |
| `render_companions.py` | ~9 KB | Unified renderer: templates → companion guides from tracker data. Used by `/setup` and `/refresh`. |
| `requirements.txt` | — | `requests>=2.28.0` |

Skills shell out to these scripts rather than reimplement the logic — keeps the skill markdown files focused on instructions and decision rules.

---

## 9. Templates & Examples

### Templates (`templates/`)

- **`tracker-template.json`** — minimal tracker scaffold showing the expected structure.
- **`style-guide-template.md`** — schema for dominant content types, hook types, word-count ranges, top-quartile patterns, emotional arcs.
- **`concept-library-template.md`** — table schema for concepts already explained, analogies reuse risk, concept clusters, repeat-watch notes.

### Examples (`examples/`)

Worked outputs for a fictional user `@seo_lisa`, showing "what good looks like":

- **`tracker-example.json`** (~259 lines) — 8 posts with full metrics, comments, content-type tags, semantic topics. All posts dated March 2026.
- **`style-guide-example.md`** (~132 lines) — generated from the 8-post tracker: high-frequency phrases, hook-type rankings, pronoun density, ending patterns, word-count bands, emotional arc preferences. Includes a sample-size warning: "only 8 posts — reference only until 20+ accumulated."
- **`brand-voice-example.md`** (~262 lines) — qualitative profile across the 11 voice dimensions, each with original-post excerpts. Ends with a quick-reference checklist `/draft` uses to reproduce the voice.

The examples are the clearest teaching asset in the repo — a new user can read them to understand what each skill will produce from their own data.

---

## 10. Design Principles

Cross-cutting rules observable across every skill:

- **User data first.** Every claim cites the user's tracker, style guide, or pasted history. No generic benchmarks.
- **Honest degrade.** When data is thin, skills label confidence (Directional → Deep) rather than overstate. Below 5 posts, skills describe instead of predict.
- **Preserve user text.** `/analyze` diagnoses without rewriting. `/draft` is the only composition skill, and its output is framed as a starting point.
- **Advisor tone.** "When you did this before, X happened" — not prescriptive "you should." The one exception: algorithm red-line matches trigger a direct warn.
- **Reversibility.** `/predict`, `/refresh`, `/review` back up mutated files before writing. Five most recent backups retained. `/review` treats updates to tracker + style guide + concept library as an all-or-nothing 3-file transaction.
- **Audit trails.** `threads_freshness.log` and `threads_refresh.log` capture every decision for later debugging. `/review` monitors log health and flags degradation.
- **Knowledge-as-data.** Algorithm rules, psychology theory, AI-tone markers, DOM selectors all live in markdown under `knowledge/`. Adapting to Meta changes is a one-file edit, not a code change.
- **Scheduler-friendly.** `/refresh` supports `--headless` for cron-based automation. `/review` sweeps expired placeholders on entry so long gaps don't corrupt state.
- **Bilingual.** Chinese and English filenames, README files, and examples. Neither language is the "default" — both are first-class.

---

## 11. Typical User Journey

A canonical lifecycle, one cycle per post:

1. **`/setup`** — first-time only. Import historical posts, generate `style_guide.md` and `concept_library.md`, produce markdown companions.
2. **`/voice`** — (recommended) deep analysis builds `brand_voice.md`. Rerun as the dataset grows; `/draft` output quality depends on this.
3. **`/topics`** — get ranked candidates for the next post, with freshness gate verdicts.
4. **`/draft`** — generate a draft for the chosen topic, voice-aligned, freshness-gated.
5. **`/analyze`** — diagnostic review before publishing. Pointed suggestions, no rewrites.
6. **`/predict`** — conservative/baseline/optimistic ranges; optionally save a `prediction_snapshot` to the tracker.
7. **Publish** on Threads.
8. **`/refresh`** — hours or days later, pull actual metrics and new comments into the tracker. Can be scheduled.
9. **`/review`** — compare prediction vs actual, analyze deviations, carefully update style guide and concept library, validate signals. Loop closes; accumulated learning feeds the next `/topics` run.

---

## 12. Installation & Quick Start

Claude Code:

```
claude install-plugin https://github.com/akseolabs-seo/AK-Threads-booster
```

First run inside the working directory where you want your tracker to live:

```
/setup
```

`/setup` will prompt for the data source (Threads API token, Meta export file, existing tracker, or Chrome MCP scraping) and build the foundation. From there, `/voice` and `/topics` are the usual next steps.

For non-Claude-Code agents (Codex CLI, Cursor, Windsurf), `AGENTS.md` is the entry point — the routing logic is identical.

---

## 13. License & Credits

- **License:** MIT (2026 AK SEO Labs) — `LICENSE`.
- **Author:** AK SEO Labs, [@darkseoking on Threads](https://threads.net/@darkseoking).
- **Homepage:** https://github.com/akseolabs-seo/AK-Threads-booster
- **Language support:** bilingual zh / en throughout (README, filenames, examples).
- **User-data protection:** `.gitignore` excludes `threads_daily_tracker.json`, `style_guide.md`, `brand_voice.md`, `concept_library.md`, `/idea/`, `/topics/`, and logs — so the plugin directory itself never leaks a user's real posts or metrics.

---

## Appendix: What makes this repo well-designed

A few patterns worth highlighting for anyone studying skill-repo architecture:

1. **Separation of instruction and knowledge.** Skill markdown files say *what to do*; `knowledge/` files are the *what to know*. A skill is a short instruction file plus a set of knowledge references, not a monolith.
2. **Shared principles, loaded first.** Every skill pulls `_shared/principles.md` before anything else — a single place to enforce tone and discipline across eight skills.
3. **One composition driver, many observers.** `brand_voice.md` has exactly one writer (`/voice`) and exactly one composition consumer (`/draft`). Every other consumer is observation-only. This prevents feedback-loop homogenization.
4. **Data confidence as a first-class concept.** `data-confidence.md` is loaded by every analytical skill, and the five-tier rubric forces honest labeling instead of false precision.
5. **Audit logs between skills.** `threads_freshness.log` is written by `/draft` and `/topics` and read by `/review` — skills communicate asynchronously through append-only logs.
6. **Transactional updates.** `/review` treats three-file updates as all-or-nothing with backups, so a failure mid-write never leaves the user in an inconsistent state.
7. **Graceful degradation paths.** API → export → direct data → Chrome MCP → legacy migration. Selector health check in `/refresh` before scraping. Sample-size warnings in style-guide output. At every seam where things can fail, the system prefers "do less, honestly" over "guess."

These are the kinds of decisions that separate a skill repo that works once from one that compounds value as a user's dataset grows.
