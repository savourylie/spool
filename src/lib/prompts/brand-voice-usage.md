# Brand Voice Usage Discipline

> **Read this before wiring the `brand_voice_profiles` data into any new
> LLM pipeline.** The asymmetry below is load-bearing — getting it wrong
> makes the product worse over time, not better.

The brand voice profile (11 dimensions of a creator's writing patterns,
stored in `brand_voice_profiles`) is consumed by two subsystems with
fundamentally different roles. Mixing the roles creates a feedback loop
that homogenizes the creator's content.

## Composer — DRIVER

**Role:** compose *toward* the profile. The dimensions are creative
constraints that make drafts sound like the creator wrote them.

**Gate:** only inject when `confidenceTier !== "directional"` AND
`sourcePostCount > 0`. Below that threshold the profile is noise — fall
back to the top-10-posts anchor alone. Using an unreliable profile as a
driver pulls every draft toward a bad fingerprint and compounds the error
each time it runs.

**How to inject:** add a system block titled
`## User's brand voice (compose to match)` listing all 11 dimensions,
each with its pattern and 2 evidence excerpts. Place the block in the
uncached suffix (per-user data must not pollute the cached knowledge
prefix).

**Do:**

- Instruct the LLM to match `sentence_structure`, `paragraph_rhythm`, and
  `humor` patterns in every draft.
- Use `taboo_phrases` as a negative constraint ("avoid these phrases").
- Use `analogies.pattern` to pick metaphor source domains the creator
  actually uses.

**Don't:**

- Copy the evidence excerpts verbatim into drafts. They're diagnostic
  samples, not templates.
- Inject when the profile is the stub written on empty corpus
  (`sourcePostCount === 0`). The stub has `pattern: "Not enough data yet."`
  for every dimension and would overwhelm the prompt with noise.

## Scanner — OBSERVER

**Role:** flag *drift* when a draft diverges from the established voice.
The profile is a **reference**, not a target.

**Gate:** inject whenever the profile exists with `sourcePostCount > 0`.
Tier does **not** gate Scanner — even a "weak" profile is useful for
spotting obvious departures.

**How to inject:** add a system block titled
`## User's established voice (flag drift only — do not rewrite toward this)`
with all 11 dimensions, `pattern` + **1** evidence excerpt each (truncate
aggressively; the observer doesn't need exhaustive evidence). Same uncached
placement as Composer.

**Do:**

- Emit a `voice-drift` issue when a draft's sentence structure, tone,
  humor, or other dimensions materially diverge from the established
  pattern. Severity reflects magnitude of drift.
- In the issue `description`, cite which dimension drifted and how
  (e.g., "draft uses 40-word sentences; `sentence_structure.pattern`
  is 'short, fragment-heavy, rare semicolons'").

**Don't:**

- Generate rewrites that rephrase the draft in the established voice using
  evidence excerpts as templates. **That's Composer's job.** Scanner
  rewrites must restore the creator's *own* patterns (as flagged), never
  impose a generic or "improved" voice.
- Use the profile to make stylistic suggestions beyond drift ("your posts
  are usually funnier, add a joke"). Scanner is descriptive, not
  prescriptive.

## Why the Asymmetry Matters

If Scanner rewrites pull drafts *toward* the profile, every Scanner run
laundering content through the same voice fingerprint accelerates
homogenization. Over time:

1. Drafts get flattened into the creator's median style.
2. The next extraction over those drafts produces a more concentrated
   profile.
3. The next Scanner pass flattens further. Repeat.

The profile becomes a self-reinforcing stereotype rather than a living
reflection of the creator. Composer-as-driver is fine because the creator
still edits before posting. Scanner-as-driver is not, because Scanner
outputs look like objective quality signals — users trust them and ship.

Keep the driver/observer split sharp.

## Shared Helper

Both subsystems fetch via `getActiveVoiceProfile(userId)` in
`src/lib/brand-voice.ts`. The helper returns the raw `BrandVoiceRecord | null`
with no gating — each caller applies its own rule above.
