# [TICKET-079] AI-Tone Marker Taxonomy

## Status
`done`

## Dependencies
- Requires: #078 ✅

## Description
Upgrade the Scanner's AI-tone detection from a generic "sounds AI-generated" vibe check to the structured 10 + 5 + 5 marker taxonomy from `src/lib/prompts/ai-detection.md`: 10 sentence-level markers (fixed phrases, balanced-contrast patterns, etc.), 5 structure-level markers (too-smooth arguments, perfect narrative arc), 5 content-level markers (floating numbers, one-directional evidence). Each matched marker cites its exact location in the draft, and the UI highlights the offending sentence on hover. Ships the 6 de-AI-ification remediation actions as recommended next steps.

## Acceptance Criteria
- [x] `src/lib/quality-scanner-shared.ts` extends the `aiDetection` axis type with `aiMarkers: MarkerMatch[]` where `MarkerMatch = { id: "S01".."S10" | "ST01".."ST05" | "C01".."C05"; category: "sentence"|"structure"|"content"; location: { charStart: number; charEnd: number; quote: string }; hint: string }`.
- [x] `src/lib/quality-llm.ts` — analyze prompt (`src/lib/prompts/analyze.md`) extended to ask the LLM to emit marker matches with character spans when present.
- [x] `src/components/dashboard/quality-scanner.tsx` — AI-Tone card now renders marker list grouped by category, each entry showing id, one-line hint, and a "Highlight" button.
- [x] Draft preview (the input textarea region) supports overlay highlighting: hovering a marker in the card underlines/highlights the matched span in the draft.
- [x] A "Remediation" sub-section on the AI-Tone card lists the 6 de-AI-ification methods from `ai-detection.md` (e.g., "Break perfect arc", "Add concrete case", "Drop rhetorical closer").
- [x] Accessibility: marker highlight triggered by focus as well as hover; keyboard users can tab through markers and see spans highlighted.
- [x] When the LLM emits out-of-range `charStart/charEnd`, the client silently ignores that marker and logs a warning.

## Design Reference
- **Components**: extends the AI-Tone card from #078; shadcn `Tooltip` for marker hints; existing highlight utility or a lightweight inline span wrapper.
- **Typography**: marker IDs use `font-mono text-xs`; hints use body text.

## Visual Reference
The AI-Tone card now has three sub-sections: Sentence (10 possible markers), Structure (5), Content (5). Each row is tight: left shows the marker id (`S03` in monospace gray), middle shows a short hint ("Balanced contrast: avoid 'not only... but also'"), right shows a "Highlight" button. Clicking or hovering "Highlight" paints a subtle yellow underline under the matched span inside the draft preview directly above. A "Remediation" row at the bottom of the card lists 6 bulleted actions the user can try. Markers not detected in the draft are grayed out with a muted "—".

## Implementation Notes
- Use a small utility to splice marker highlights into the draft preview without breaking React reconciliation — render the draft as a sequence of `<span>` chunks keyed by char offsets.
- Keep the highlight interaction cheap — use CSS hover/focus states, no JavaScript state for pure hover feedback.
- Marker IDs come from `ai-detection.md` — generate a JSON mapping file at build time (reuse the loader pattern from #067) so the UI has stable ids.
- If the LLM misses character spans (emits only sentence references), fall back to string-search to locate the span client-side.

## Testing
- Feed a deliberately AI-sounding paragraph → several markers emit with correct spans; hovering a marker highlights the right sentence.
- Keyboard navigation: Tab through markers → spans highlight via focus state.
- Draft with no AI markers → all rows gray, "Remediation" section still renders.
- Out-of-range spans are silently dropped; no crash.
- Accessibility: screen reader announces marker id + hint on focus.
