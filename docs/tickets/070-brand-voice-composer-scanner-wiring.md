# [TICKET-070] Brand Voice Composer + Scanner Wiring

## Status
`blocked`

## Dependencies
- Requires: #068

## Description
Wire the brand voice profile into the Composer as the primary voice driver and into the Scanner as an observer. This codifies the AK discipline: the profile **drives composition** only in Composer; Scanner uses it as reference to flag drift but never pulls text toward it. Prevents feedback-loop homogenization. Also publish a short discipline doc so future LLM-integrators don't accidentally invert the pattern.

## Acceptance Criteria
- [ ] `src/lib/composer-prompt.ts` — `buildComposerPrompt` fetches `brand_voice_profiles` for the user and injects the profile as a new system-prompt section titled "User's brand voice (compose to match)". Gated by `confidence_tier !== "directional"`; below that, Composer falls back to current top-10-posts style anchor.
- [ ] `src/lib/quality-llm.ts` — scanner prompt injects the profile as a new section titled "User's established voice (flag drift only — do not rewrite toward this)". Always included when profile exists, regardless of tier.
- [ ] `src/lib/prompts/brand-voice-usage.md` documents the composition-driver vs observer discipline with concrete do/don't examples. Referenced from both `composer-prompt.ts` and `quality-llm.ts` comment blocks.
- [ ] Composer output (3 variations) visibly reflects the profile — a manual sanity check shows the variations match pattern summaries for at least 3 dimensions (e.g., sentence length, analogy style).
- [ ] Scanner output, when a draft drifts from the profile, surfaces a "Voice drift" signal within axis-1 output (shape detail is handled in #077; for now emit as a new issue category compatible with current Scanner schema).
- [ ] Unit or integration test covers the gating: directional tier → Composer does NOT inject; usable-or-higher → Composer DOES inject.

## Implementation Notes
- Do not duplicate the profile fetch in the Scanner vs Composer — add a shared helper `getActiveVoiceProfile(userId)` in `src/lib/brand-voice.ts` (created in #068) that returns `null` when tier is directional-gating applies (Composer) or always returns the row (Scanner observer).
- Respect prompt caching from #067: the profile is user-variable, so it goes in the uncached suffix block, not the cached knowledge prefix.
- Keep the Scanner's current output shape (issues + rewrites + shareability + tone) — do not refactor to 4-axis yet; that's #077.
- Watch for prompt length blowup: the profile can be ~2KB of JSON. Truncate excerpts to 1 per dimension in Scanner (observer doesn't need exhaustive evidence).

## Testing
- Draft a post in Composer with a populated profile → sanity check the variations match profile patterns.
- Draft a deliberately off-voice post in Scanner → "Voice drift" issue appears.
- Seed a 3-post account → Composer prompt does NOT contain the profile block (log or snapshot test); Scanner still references it as observer.
- Re-run #067 cache metrics → user-variable profile does not pollute cache hit rate.
