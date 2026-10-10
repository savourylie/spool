# Data Confidence Rubric

Reference for every analytic surface that makes a claim off the user's
historical posts. The rule is simple: honest weak labels beat
confident wrong labels. A reader can act on *"directional — 3 posts in
this band"*; they can't recover from *"your best hook is X"* when X
came from two noisy observations.

Every downstream feature that cites user history must tag the claim
with one of the five tiers below. The tier is determined by
**comparable posts** — the count of historical posts that match the
current comparison on at least two of: content type, hook type, topic
cluster, word-count band.

## Part 1 — The Five Tiers

### Directional ( < 5 comparable posts )

Not enough data to call a pattern. Each observation is one-off; any
apparent direction could flip with one more post.

- *Example UI copy:* "For your reference — sample is too small to
  call a pattern yet."
- *What prompts may claim:* describe the observation literally, with
  the count attached. Do not use comparative words like "better",
  "consistently", "stronger". No predictions, no ranges.

### Weak ( 5–9 )

Enough to notice a lean, not enough to treat as evidence.

- *Example UI copy:* "There's a lean toward X in your recent
  posts — confidence is low."
- *What prompts may claim:* name the lean, attach the count, prefer
  hedged phrasing ("tends to", "seems to"). Avoid ranges; avoid
  single-point predictions.

### Usable ( 10–19 )

Stable enough to guide decisions, still sensitive to outliers.

- *Example UI copy:* "Based on your history, X outperforms Y — for
  your reference."
- *What prompts may claim:* comparative statements with the count
  attached. Ranges with wide bands are acceptable; single-point
  predictions are not.

### Strong ( 20–49 )

Reliable working baseline. The number of posts is enough that one
outlier doesn't move the aggregate.

- *Example UI copy:* "Your data consistently shows X."
- *What prompts may claim:* assertive comparative statements, narrower
  ranges, and conditional predictions ("posts in this band tend to
  land between p25 and p75"). Still attach the count.

### Deep ( 50+ )

Cross-analysis becomes meaningful — hook × topic × time-of-day splits
start being trustworthy, not just topline averages.

- *Example UI copy:* "Multi-dimensional patterns hold in your data."
- *What prompts may claim:* multi-axis splits, segmented predictions,
  and long-term trend claims. Still attach the count on each split.

## Part 2 — Dataset-Level Gates

Independent of per-task comparable-post counts, the full-tracker
size gates what features run at all.

- **Fewer than 5 posts total.** Descriptive only. Do not run
  prediction ranges or data-backed analysis. Say why out loud.
- **5–9 posts total.** Analysis and topic suggestions may run, but
  every output must note the reference base is limited.
- **10–19 posts total.** Most features run; predictions can quote
  wide ranges; voice extraction remains directional.
- **20+ posts total.** Working baseline for all features.
- **50+ posts total.** Full cross-analysis. Voice extraction can
  surface micro-features reliably.

## Part 3 — Surfacing in Output

Every claim that leans on user history must carry the tier and the
count where the reader can see it. This is a contract on the UI side:

- A small pill or inline label near the headline — "Performance by
  hook · Strong (47 posts)" — not buried in a tooltip.
- The count is the *comparable* count for that specific claim, not
  the total tracker size. If the total is 120 but only 4 posts match
  the current comparison, the label reads Directional (4), not Deep
  (120).
- Multi-claim surfaces (e.g. a table of topic performance) carry the
  label per row, because different rows may have different tiers.

## Part 4 — Honest-Degrade Rules

When data is thin, the prompt and UI should degrade honestly, not
paper over the gap:

- **Never substitute generic platform benchmarks silently.** If a
  claim falls back to "Threads creators generally see...", that
  fallback must be stated, not disguised as the user's own pattern.
- **Never upgrade Weak to Strong.** The tier label is the truth; the
  prose must match it. "Tends to" and "consistently" are not
  interchangeable.
- **Name which specific comparison failed.** If a surface has five
  cards and one of them has too-thin data, say which one. "Hook-type
  breakdown is Directional — only 3 question-style posts in the
  window" is more useful than suppressing the card.
- **Temporary data is labeled temporary.** If the reader pasted a
  draft for one-off analysis instead of running on their persisted
  tracker, the analysis carries "Temporary — not persisted" as its
  tier-context, separate from the usual five tiers.

A reader can make a good decision with a Directional or Weak label.
They cannot recover from a Strong label that should have been Weak.
