# [TICKET-065] Knowledge Prompts Library

## Status
`done`

## Dependencies
- Requires: None

## Description
Create `src/lib/prompts/` as the canonical directory for large, stable prompt fragments used by LLM-powered features. Seed it with four distilled knowledge files (algorithm, psychology, AI-detection, data-confidence) rewritten in spool's voice from the AK-Threads-Booster source material. This is infrastructure for every subsequent AK-integration ticket — Scanner, Composer, brand voice, freshness gate, and concept library all load from here.

## Acceptance Criteria
- [x] `src/lib/prompts/` directory exists with five markdown files: `algorithm.md`, `psychology.md`, `ai-detection.md`, `data-confidence.md`, `README.md`.
- [x] `algorithm.md` enumerates rules R1–R12 (engagement-bait, shortened view time, hashtag hygiene, etc.) and suppression risks S1–S14, each with a 1–2 sentence explanation; also documents the 4×4 post-publish matrix and first-3-hour strategy, rewritten in spool voice (not copied verbatim).
- [x] `psychology.md` covers hook triggers (Information Gap, Zeigarnik, Peak-End), STEPPS framework, Cialdini's 7 principles, and ELM central/peripheral routes, with short actionable summaries.
- [x] `ai-detection.md` lists the 10 sentence-level + 5 structure-level + 5 content-level AI-tone markers, each with one example and one remediation hint; plus the 6 de-AI-ification methods.
- [x] `data-confidence.md` defines the five tiers (Directional <5, Weak 5–9, Usable 10–19, Strong 20–49, Deep 50+) and recommended UI treatment per tier.
- [x] `README.md` explains the knowledge-as-data pattern, documents how tickets load these files, and includes MIT attribution to the AK-Threads-Booster source repo (`docs/seo/AK-Threads-booster/`).

## Implementation Notes
- Distill, don't copy: AK source is bilingual (zh/en); these files should be English-only and in spool's voice.
- Each file should have stable, flat headings so that downstream prompt-caching breakpoints can be cleanly attached (ticket #067).
- Do not add runtime code in this ticket. This is pure content authoring.
- Reference AK sources: `docs/seo/AK-Threads-booster/knowledge/algorithm.md`, `psychology.md`, `ai-detection.md`, `data-confidence.md`.
- Keep each file under ~400 lines; longer content belongs in a focused sub-file rather than a sprawling top-level doc.

## Testing
- `ls src/lib/prompts/` → 5 files present.
- `wc -l src/lib/prompts/*.md` → each file ≥ 50 lines, ≤ 400 lines.
- Spot-check: grep each file for R1, S1, STEPPS, Directional, etc., to confirm the key taxonomies made it in.
