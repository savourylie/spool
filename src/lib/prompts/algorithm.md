# Threads Algorithm Reference

Reference for LLM-powered features in spool. Two zones: **red lines**
(R1–R12) are hard rules — hitting any is grounds for a warning.
**Signals** (S1–S14) are dynamic inputs the model weighs when judging
algorithmic fit. Cite rules by their tag (e.g. "R4", "S12") so
downstream code and reviews can cross-reference.

The rules are our current best reading of Meta's public guidelines,
leaked Facebook Papers material, patent filings, and repeated
post-mortem observations. When Meta changes its rules, edit this file
and every consumer picks it up.

## Part 1 — Red Lines (R1–R12)

Hitting any red line is grounds for a direct warning to the author.
These are not suggestions.

### R1. Engagement bait

Any phrasing that asks the reader to react, comment a specific word,
share, tag, or vote using a Reaction. Covers five sub-types: vote bait
("heart for A, haha for B"), react bait ("like if you agree"), share
bait ("share this"), tag bait ("tag someone who needs this"), and
comment bait ("reply YES", "+1"). Meta detects this with an ML model
across 25+ languages and OCRs embedded text in images. Repeated hits
suppress the whole account's reach, not just the single post.

### R2. Clickbait

Sensationalist first lines ("you won't believe"), excessive
exclamation, deliberate topic withholding, or a hook that the body
never actually pays off. The rule: the hook can be strong, it cannot
be a con.

### R3. Hook-body mismatch

The opening promises one topic and the body delivers another. Meta's
2025 spammy-content crackdown explicitly targets captions that don't
match the content. A hook that says "most people get X wrong" must
actually show where they got X wrong.

### R4. Low-originality repost

Re-posting someone else's content without substantial new value,
watermark carry-over, or >70% similarity to your own recent posts.
Adding a logo, subtitle, or paraphrased voiceover is not original
transformation. Original work needs at least one of: your own analysis,
your own conclusion, your own experience/test, or your own framework.

### R5. Consecutive same-topic posts

Meta's diversity enforcement compresses reach when the last 3–5 posts
look near-identical. Same domain is fine; same angle on the same
conclusion in quick succession is not.

### R6. Low-quality outbound links

Links to ad-heavy, slow, or SEO-spam-looking pages drag the post down.
If you can make the point inside the post, do. If a link is necessary,
prefer high-trust sources.

### R7. Sensitive-topic framing

Political, civic, health, and financial content faces tighter
personalized-distribution rules or stricter review. Keep the topic
explicit, the audience explicit, the tone measured, and claims
grounded. Avoid absolutes, miracle results, or unverified return
promises. Publishable and recommendable are different bars.

### R8. Negative-feedback risk

The worst outcome isn't low engagement; it's the wrong readers hitting
"Not interested." Meta treats explicit negative feedback as training
data. High-risk patterns: sensational first line with empty body, hook
topic different from body topic, the same point repeated, or framing
that badly mismatches audience expectation.

### R9. Topic blending

One post, one topic. Threads now explicitly gives distribution boost
to posts where the system can quickly classify the topic. A post that
opens on SEO and pivots to startup mindset half-way dilutes that
signal.

### R10. Unlabeled AI content

Photorealistic AI-generated images or video without the AI label.
Publishable is not the same as recommendable — deceptive media is the
fastest way to lose reach even without a takedown.

### R11. Image-text mismatch

The image, the first line, and the body must be about the same thing.
Images should do one of three jobs: visualize the main point, provide
evidence, or raise comprehension. Decoration that wanders off-topic
lowers dwell time and raises negative feedback.

### R12. Soft de-ranking accumulators

Secondary scan — two or more hits triggers a warning. Includes: reads
more written-for-algorithm than written-for-readers; generic filler
with no new information; comment sections full of low-effort one-liners
(tracked over time); several consecutive posts saying nearly the same
thing; high passive-scroll ratio signaling a weak first line.

## Part 2 — Signals (S1–S14)

Dynamic inputs, not hard rules. Use them to reason about *this* post's
algorithmic ceiling and *this* account's durable health. When citing a
signal in analysis, phrase it as observation about the account's data,
not a universal prescription.

### S1. DM sends (strongest engagement signal)

Mosseri confirmed in 2025: private shares weigh 3–5× a like. They
matter because the reader is willing to put their own social capital
behind the post. Content that gets sent tends to say something the
reader couldn't say themselves, saves someone time, hits a
counterintuitive-but-grounded conclusion, or hands over a framework
worth quoting. The check: does the reader finish the post with a
specific person in mind?

### S2. Deep comments

Meaningful comments (5+ words, or image/video replies) scored 30× a
like in the leaked MSI rubric, and the 2020 reweighting didn't lower
them. What counts: disagreement with reason, a more extreme personal
version, or a "what if we changed the variable" extension. What
doesn't: "what do you think?" (that's you begging for comments), "tell
me below" (that's comment bait, R1), "+1". Ends that invite extension
beat ends that ask for approval.

### S3. Dwell time

Meta weighs time spent, not word count. Long is fine; long-with-no-
new-information is not. First 1–2 sentences must stop the target
reader. Every paragraph after must add something, not repeat the last
paragraph in different words.

### S4. Interactor identity

Core followers and prior interactors carry more weight than strangers.
Writing to please everyone flattens your edges. The move is to be
sharp enough that your closest readers want to respond.

### S5. Likes (weak signal)

Likes were 1 point in the MSI rubric and have stayed near the bottom.
High-likes/low-comments usually means the post didn't earn a second
distribution round. Priority order: deep comments > DM sends > shares
> likes.

### S6. Image + text combination

Buffer's 2026 cross-platform study (52M+ posts): Threads posts with an
image had ~60% higher median engagement than text-only and 37% higher
than posts with a link. Images belong when they add — screenshots,
data, diagrams — not as decoration.

### S7. Semantic neighborhood

Threads classifies accounts into content neighborhoods via repeated
keywords and themes. Stay in neighborhood, or bridge when you leave.
Jumping cold to an unrelated topic hurts more than staying in the
lane.

### S8. Trust graph (2026 focus signal)

Mosseri's 2025 year-end letter: Meta is moving from Social Graph →
Interest Graph → Trust Graph. Consistency — same persona, same subject
universe, same cross-platform identity — compounds as trust. Chasing
trends by breaking the persona burns that compound.

### S9. Publishable vs recommendable

Some content is allowed but won't be widely recommended. Politics and
civic topics face personalization limits. Health and financial claims
face stricter review. Sexual-suggestive, graphic, or borderline-hate
content is publishable but rarely promoted. The question is not "will
this violate policy?"; it's "if it clears review, will the system want
to show it to strangers?"

### S10. Small-account boost

Small accounts get an initial exploration bump, conditional on
minimum quality. Weak content doesn't ride the bump; it just dies
slower.

### S11. Discovery surface

Where a view came from changes what it means. A view from Threads feed
says topic and account trust are landing. A view from Instagram or
Facebook says cross-app interest graph is picking up. A view from your
profile says existing follower fit. A view from a topic feed says the
topic labeling is clean. 1,000 views from different surfaces tell very
different stories; don't flatten them.

### S12. Topic graph strength

Not "did you hashtag?" but "can the system tell what this post is
about in the first two sentences?" Strong: one central question, one
topic, tag and body aligned, consistent with the account's historical
subjects. Weak: tag is trendy but the body isn't really on that topic;
or the account pivots to an unrelated subject without context.

### S13. Originality / spam-risk spectrum

Weak spam signals don't kill a post alone but accumulate into a
low-quality distribution bucket. Watch for caption/body mismatch,
hashtag stuffing, duplicate-cluster risk against recent posts,
minor-edit repost, low-value reaction bait, or unnatural engagement
patterns. Several weak hits together is the danger.

### S14. Topic freshness budget

Freshness is account-relative, not platform-wide. Repeatedly publishing
posts that sit in the same semantic cluster, from the same angle, with
the same promise shape burns freshness fast even across different days.
Same domain is fine. Same semantic cluster + same angle + same promise
is not. When fatigue risk is high, a hit post is less likely because
the system reads the batch as redundant supply.

## Part 3 — First-Three-Hours Window

The first hour sets whether the post earns a second round of
distribution. The move is not to refresh the metrics; it's to shape the
comment thread.

- **Reply fast, reply to the right comments.** Prioritize comments
  sharing a personal case, disagreeing, or extending the question.
  Skip pure emoji, "agreed", or plain praise.
- **Make each reply push the thread forward.** The goal isn't
  politeness; it's new content. "Your example actually exposes a
  different blind spot" beats "thanks!".
- **Fix misreadings early.** If someone's reading the post sideways,
  clarify in a reply — the comment thread is a second content layer
  the system scores.
- **Your own replies are weighed.** Meta's ranking doesn't stop when
  the post ships. Replies that add a case, take a counter-position, or
  generate a second round of conversation help.
- **Old posts aren't dead.** New engagement on older posts can pull
  them back into candidate pools. Occasional replies to sleeper posts
  are not wasted.

## Part 4 — 4×4 Post-Publish Matrix

Four post types worth chasing:

- **Shareable.** The reader knows immediately who to send it to.
  Triggers S1 (DM sends).
- **Discussable.** Not everyone agrees, but everyone understands the
  claim. Triggers S2 (deep comments).
- **Applicable.** The reader maps it onto their own situation and
  comments with their case. Triggers S2 via self-expression.
- **Saveable.** A framework, a breakdown, a structured summary worth
  keeping. Triggers dwell time (S3) and later sends (S1).

Four post types that fail:

- **Pseudo-deep.** Pretty sentences, no information gain. Short dwell,
  high scroll-past.
- **Pseudo-controversy.** Provocation without argument. Triggers R8
  negative feedback from readers who feel bait-and-switched.
- **Pseudo-original.** Restating someone else's content in your voice.
  Flags R4.
- **Pseudo-engagement.** Begging interactions via CTA. Flags R1 as
  engagement bait.

## Part 5 — Floor Rules

Independent of structure, these hold:

- The first line must stop the *target* reader, not everyone.
- The body cannot betray the first line's promise.
- The close should leave an opening for the reader to add or push
  back — not ask for interactions.
- Every paragraph advances. No paragraph repeats the previous one in
  different words.

The real scoreboard isn't likes. It's four questions: did this stop
the right reader, did it make them write a full sentence, did it make
them want to DM it to someone, and did the comment thread become a
second content layer worth reading?
