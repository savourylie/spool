# Brand Voice Extraction

Reference for the LLM-powered feature that extracts a creator's brand
voice from their own posts and comment replies. The output is a
structured profile across 11 dimensions. Downstream features use the
profile as a primary voice driver (Composer) or drift detector
(Scanner).

The goal is **descriptive, not prescriptive**. You are naming what is
already there in the creator's writing, not telling them what their
voice *should* be. Every claim must be grounded in a verbatim excerpt
from the provided corpus.

## Task

You will receive a corpus with two sections:

- `[postId: <uuid>] <text>` — the creator's own posts, ranked by
  engagement.
- `[replyId: <uuid>] <text>` — the creator's replies to commenters on
  their posts.

Read the corpus carefully. Then output a single JSON object describing
the creator's voice across the 11 dimensions listed below. Every
dimension key must be present, even if the corpus shows only a weak
signal for it (say so in `pattern`).

## Dimensions

1. **`sentence_structure`** — How they build sentences. Length, rhythm,
   use of fragments, lists, parallelism. "Mostly short declarative
   sentences with occasional one-word fragments for emphasis" is the
   level of detail to aim for.

2. **`tone_switching`** — How (or whether) they shift register within a
   single post. Formal → casual, data → emotion, statement → question.
   Note the transition moves they actually use.

3. **`emotional_expression`** — How feelings surface. Stated directly?
   Implied by specific detail? Routed through metaphor? Withheld
   entirely? Name the mechanism, not just "warm" or "cold."

4. **`knowledge_presentation`** — How they share expertise. Didactic
   ("here's how it works"), Socratic (asking questions they then
   answer), confessional ("I used to get this wrong"), or observational
   ("I noticed this"). Name the stance.

5. **`fan_vs_critic_reply_tone`** — How their reply voice changes
   between appreciative commenters and challenging ones. Look only at
   the `[replyId:...]` entries for this dimension. If the corpus has
   no critic-style exchanges, say so.

6. **`analogies`** — The domains they reach for when explaining
   something. Sports, cooking, nature, software, family life, physics.
   Name the two or three most frequent source domains you see.

7. **`humor`** — What kind of humor they use, if any. Dry, absurdist,
   self-deprecating, observational, pun-driven, sincere (no humor).
   Describe the *mechanism* ("understatement followed by a concrete
   image"), not a label.

8. **`self_reference`** — How they position themselves. First-person
   density, use of credentials, distance from their own expertise,
   reliance on "we" vs "I." Note when they cite themselves by name or
   role, if at all.

9. **`taboo_phrases`** — Words, phrases, or clichés they conspicuously
   *don't* use. Buzzwords of their field that are absent. Emoji they
   avoid. If nothing stands out as avoided, say so — don't invent.

10. **`paragraph_rhythm`** — Line breaks, paragraph lengths, pacing
    within a post. Single-line posts vs multi-paragraph structures. How
    they use white space for emphasis.

11. **`comment_reply_characteristics`** — How their replies differ
    from their original posts. Shorter? Warmer? More technical? Any
    recurring opening moves ("Good question," "Yes, and...")? If
    there are no replies in the corpus, set `pattern` to
    "No reply data available." and leave evidence empty.

## Output Format

Return exactly one fenced JSON block — no prose before or after. The
JSON must be a single object with the 11 dimension keys listed above.
Each value must have this shape:

```
{
  "pattern": "<a 1–3 sentence description of the observed pattern>",
  "evidence": [
    { "postId": "<uuid from the corpus>", "excerpt": "<verbatim quote>" },
    { "postId": "<uuid from the corpus>", "excerpt": "<verbatim quote>" }
  ]
}
```

Rules for `evidence`:

- 2 or 3 entries per dimension. More is not better.
- `postId` must be copied exactly from a `[postId: ...]` or
  `[replyId: ...]` tag in the corpus. For replies, use the `replyId`
  value verbatim.
- `excerpt` must be a verbatim quote from the tagged post or reply.
  Do not paraphrase. Do not stitch together non-contiguous phrases.
- Keep excerpts short — a single sentence or clause is usually enough.
  Absolute cap: 200 characters.
- If the corpus truly has no usable evidence for a dimension, return
  one evidence entry with `"excerpt": ""` and a `pattern` that
  explicitly says the signal is weak or absent.

Rules for `pattern`:

- Describe what you *see*, not what you recommend. No "should,"
  "could," or "try" language.
- If the signal is thin, say so ("Only one post shows this — pattern is
  provisional"). Honest weak descriptions beat confident fabricated
  ones.
- No reference to these rules or to the dimension names — write the
  pattern as a standalone observation.

## Example Output Shape

```json
{
  "sentence_structure": {
    "pattern": "Short declarative sentences punctuated by one-word fragments for emphasis. Rarely runs over 20 words per sentence.",
    "evidence": [
      { "postId": "3f2...", "excerpt": "It didn't work. Obvious now. Wasn't then." },
      { "postId": "a81...", "excerpt": "We kept adding features. Every release. Nobody used half of them." }
    ]
  },
  "tone_switching": {
    "pattern": "...",
    "evidence": [ ... ]
  }
  // ... 9 more dimensions
}
```
