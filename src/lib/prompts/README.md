# `src/lib/prompts/` — Knowledge-as-Data

## What this directory is

LLM-context fragments used by spool's server-side AI features. Every
file here is written *for a model to read*, not for a developer.
Editing one of these files updates every downstream feature that loads
it — Scanner, Composer, Freshness Gate, Concept Library — in one
place.

The pattern is borrowed from AK-Threads-Booster: instead of embedding
large rule lists into TypeScript templates, we keep them as markdown
that can be versioned, diffed, and edited without a code change.

## How to consume

Downstream features read these files at request time and splice them
into the system prompt. The loader and Anthropic `cache_control`
breakpoints land in ticket 067 — until that ships, nothing in the
codebase imports from this directory at runtime. The directory exists
now so ticket authors can cite the rules (R4, S12, M7, Directional,
STEPPS) in their design docs and prompts.

Consumers planned by the v3 plan:

- Scanner 4-axis diagnostic (ticket 077) — loads `algorithm.md`,
  `psychology.md`, `ai-detection.md`.
- Composer (ticket 070) — loads `algorithm.md`, `psychology.md`.
- Freshness Gate (ticket 071) — loads `algorithm.md` for S14.
- Concept Library (ticket 080) — loads `ai-detection.md` for marker
  definitions.
- Every analytic surface (ticket 066) — cites tiers from
  `data-confidence.md` via the `<ConfidenceBadge />` primitive.

## Editing rules

- **Keep H2 headings stable.** Ticket 067 attaches prompt-cache
  breakpoints at heading boundaries; renaming H2s invalidates every
  cached request. Adding H3s under existing H2s is safe.
- **Keep the tag names verbatim.** R1–R12, S1–S14, M1–M20, and the
  five tier names (Directional / Weak / Usable / Strong / Deep) are
  grepped by downstream code and referenced in other tickets. Prose
  around them can evolve; the tags cannot.
- **English only.** The AK sources are bilingual; spool ships
  English-first. Translate, don't transliterate.
- **No spool-internal references inside the bodies.** These files are
  LLM context, not engineering docs — no Supabase table names, no
  API route paths, no React component names. Runtime wiring lives in
  ticket 067.
- **Distill, don't copy.** AK's sources run 600–850 lines; our
  equivalents cap at ~400. If a taxonomy genuinely needs more depth,
  open a focused sub-file rather than letting a top-level file
  sprawl.

## Line budgets

| File | Range | Purpose |
| --- | --- | --- |
| `algorithm.md` | 200–400 | R1–R12 red lines, S1–S14 signals, first-3-hour window, 4×4 matrix |
| `psychology.md` | 200–400 | Hook triggers, STEPPS, Cialdini 7, ELM |
| `ai-detection.md` | 150–300 | 10+5+5 marker taxonomy, 6 de-AI methods |
| `data-confidence.md` | 80–150 | 5-tier rubric + UI treatment per tier |
| `README.md` | 50–120 | This file |

Check budgets after edits with `wc -l src/lib/prompts/*.md`.

## Attribution

These files are adapted from the MIT-licensed AK-Threads-Booster skill
repo, vendored at `docs/seo/AK-Threads-booster/` (Copyright (c) 2026 AK
SEO Labs). We adapted the content to spool's voice and English-first
surface rather than copying verbatim; the full MIT license text lives
in `docs/seo/AK-Threads-booster/LICENSE`.

The taxonomies that carry through (R1–R12, S1–S14, the 10+5+5 marker
framework, the five-tier confidence rubric) originate with AK. The
distillation, framing, and prose here are spool's.
