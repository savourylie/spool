# Concept Extraction

Reference for the LLM-powered classifier that extracts the concepts and
analogies a creator uses in a single post. Output is appended to the
creator's concept ledger so downstream features (Concept Library UI,
Composer pre-draft advisory) can warn when a concept is being reused
too often.

The goal is **descriptive, not prescriptive**. You are naming what is
already there in the post, not telling the creator what their ideas
*should* be. Err hard toward precision — **skip if uncertain**. A
post with no identifiable concepts is a valid result; it is much
better to return an empty list than to fabricate a concept to fill
space.

## Task

You will receive the full text of a single post. Read it carefully,
then output a compact JSON object listing every distinct concept the
post explains or references, along with any analogy used to explain
that concept.

A **concept** is a self-contained idea, claim, or framework the post
centers on. Think of it as what you would write on a library card if
you had to file the post:

- "compound interest"
- "premature optimization"
- "rainforest ecosystem"
- "parasocial relationships"
- "product-market fit"

An **analogy** is an explicit comparison the post uses to explain the
concept. Only record an analogy when the post actually draws the
comparison — do not infer one. If the post explains "compound interest"
by comparing it to a rolling snowball, the analogy is "snowball." If
the post just states the idea plainly, `analogy` is `null`.

## Rules

- **Concepts are short noun phrases, lowercase, 1–4 words.** Strip
  articles ("the", "a"). No sentences, no verbs, no trailing
  punctuation. Examples of good concepts: `compound interest`,
  `loss aversion`, `rainforest ecosystem`. Examples of bad concepts:
  `Compound Interest Is Powerful`, `the concept of compound interest`,
  `investing`.
- **Concept must be specific.** Reject generic umbrellas like
  `business`, `life`, `advice`, `writing`, `people`. If you can't
  distinguish it from 50 other posts, it is too broad.
- **Only surface concepts the post actually explains or argues
  about.** A passing reference in a single sentence is not a concept
  for this post.
- **Analogies are verbatim source domains, lowercase.** If the post
  says "product development is like tending a garden," record
  `analogy: "garden"`. If no comparison is drawn, `analogy: null`. Do
  not invent domains the post never mentions.
- **Dedupe within the post.** A single post rarely has more than
  3–5 distinct concepts. If the post circles the same idea in
  different words, emit one concept, not multiple.
- **Empty is fine.** Short, mundane, or purely personal posts
  ("Good morning everyone, coffee time") legitimately have zero
  concepts. Return `"concepts": []`. Do not force a result.

## Output Format

Return exactly one minified JSON object — no markdown fences, no prose
before or after. The JSON must be a single object with a `concepts`
array. Do not include evidence quotes; the ledger only stores concept
and analogy.

```
{"concepts":[{"concept":"compound interest","analogy":null}]}
```

An empty array is valid: `{ "concepts": [] }`.

## Example Output

Given a post about compound interest explained via a rolling snowball:

```json
{"concepts":[{"concept":"compound interest","analogy":"snowball"}]}
```

Given a short personal post with no concept:

```json
{"concepts":[]}
```

Given a post that explains two concepts with no analogies:

```json
{"concepts":[{"concept":"premature optimization","analogy":null},{"concept":"profiler-driven work","analogy":null}]}
```
