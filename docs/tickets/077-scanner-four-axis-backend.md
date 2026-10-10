# [TICKET-077] Scanner Four-Axis Backend

## Status
`done`

## Dependencies
- Requires: #065 ✅, #067 ✅

## Description
Replace the Scanner's `{issues[], rewrites[], shareability, tone}` output with a structured four-axis diagnostic matching AK's `/analyze`: Style Matching, Psychology Triggers, Algorithm Alignment, AI-Tone Detection. Each axis returns `findings[]` with rule references and neighbor-post citations. Remove automatic rewrites — the Scanner becomes diagnostic; rewriting lives in the Composer (explicit CTA in #078). Keep the old output shape behind a feature flag during migration.

## Acceptance Criteria
- [x] `src/lib/prompts/analyze.md` contains the new four-axis prompt template, referencing `algorithm.md`, `psychology.md`, `ai-detection.md` via the loader from #067.
- [x] `src/lib/quality-scanner-shared.ts` exports new types: `ScannerDiagnosticV2 = { styleMatch, psychology, algorithm, aiDetection }` where each axis is `{ summary: string; findings: Finding[]; neighborPosts?: NeighborPost[] }`; `Finding = { rule?: string; severity: "info"|"flag"|"warn"; message: string; evidence?: string }`.
- [x] `src/lib/quality-llm.ts` — `analyzeWithLLMStream` uses the new prompt when `SCANNER_V2_ENABLED` env flag is true; otherwise falls back to existing shape.
- [x] Style-match axis cites nearest-neighbor posts (top-3 by WES + cosine similarity) and flags drift from brand voice (uses observer hook from #070 if profile present).
- [x] Algorithm axis emits findings with explicit `rule: "R3"` or `rule: "S7"` references mapping to `algorithm.md`.
- [x] Psychology axis emits findings covering hook type (Information Gap / Zeigarnik / etc.), cognitive biases present/missing, retellability.
- [x] AI-Tone axis emits a placeholder array that #079 will extend with the 10+5+5 markers.
- [x] Zod schema validates the LLM output; on schema failure, fall back to v1 shape and log.
- [x] No rewrites in v2 output — the UI's "Get rewrite suggestions" CTA (in #078) routes to Composer instead.

## Implementation Notes
- Feature flag: use a simple `process.env.SCANNER_V2_ENABLED === "true"` check at request time; no runtime toggle UI needed.
- Neighbor-post retrieval reuses `src/lib/topic-model.ts` for cluster membership and WES from existing post metrics — don't reimplement.
- The streaming shape changes: emit one event per axis (`axis_start`, `axis_text`, `axis_end`) so the UI in #078 can render progressively.
- Keep backwards-compatible parsing in `quality-scanner-shared.ts` — both v1 and v2 parsers exist during migration.
- Document the discipline in `src/lib/prompts/analyze.md`: "Scanner diagnoses; Composer rewrites."

## Testing
- `SCANNER_V2_ENABLED=true npm run dev` → `/api/scanner` returns the v2 shape.
- Unset flag → v1 shape still returned (regression test for existing Scanner UI).
- Feed a draft with an obvious red-line (e.g., engagement bait) → algorithm axis emits `rule: "R1"`.
- Schema violation test: mock malformed LLM output → falls back to v1 with a logged warning.
- Neighbor posts include at least 1 entry for accounts with 10+ posts.
