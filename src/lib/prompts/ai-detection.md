# AI-Tone Markers

Reference for LLM-powered features that evaluate whether a draft
reads as AI-generated. The core idea: "AI-tone" is not any single
sentence; it's *uniformity*. A draft that's evenly polished, evenly
paced, evenly confident across twenty choices reads as not-a-person.
One polished sentence is fine. Twenty in a row is the marker.

Use the marker tags `S01`–`S10`, `ST01`–`ST05`, and `C01`–`C05` when
citing findings so downstream code and reviews can cross-reference.
The six de-AI methods at the end are rewrite levers, not a checklist.

## Part 1 — Sentence-Level Markers

Patterns that appear sentence by sentence. Hitting a few is fine;
hitting many is the signal.

### S01. Canned liveness phrases

Phrases the model uses to *sound* alive: "let me break this down",
"picture this", "here's the thing", "let's be real". Humans use these
too — unevenly. Models use them at predictable positions in
predictable densities.

### S02. Over-symmetric contrast

"Not X, but Y." "Used to be A, now it's B." "Stop doing X, start
doing Y." Pretty parallelism with roughly equal word counts on each
side. Real thinking is messier — people hedge, qualify, and don't
always stick the rhyme.

### S03. High gold-sentence density

Back-to-back lines that each feel quotable on their own. Humans
write a quotable line and then a throwaway line; models tend to keep
every line at quotability, which reads as too-good.

### S04. Performative transitions

"So what does this mean?" "Here's where it gets interesting." "But
here's the twist." A performative pivot followed by an answer the
writer already had ready. Real pivots are abrupter and less
announced.

### S05. Rhetorical-question closures

Paragraphs or posts that end with "isn't that exactly the point?" or
"what more proof do you need?". The rhetorical question stands in
for an argument. Humans usually just assert or explicitly flag
uncertainty; they rarely lock an argument with a question.

### S06. Too-complete causal chains

"X happened because Y, and Y was driven by Z, which ultimately traces
to W." One sentence that carries phenomenon + cause + deeper cause +
meta-cause. Social posts aren't legal briefs — humans leave pieces
implicit.

### S07. Over-use of formal connectors

"Furthermore." "Moreover." "Consequently." "It is worth noting that."
These signal formal essay writing; casual connectors ("but", "so",
"though") are what people actually use on Threads. Three or more
formal connectors in a short post is a reliable marker.

### S08. Uniform bullet lists

Lists where every item is the same length, the same grammatical
shape, and the same rhythm. When humans list things, one item gets
three sentences because it's the point, and another gets four words
because it's obvious.

### S09. Labeled-emotion intros

"Shockingly," "Interestingly," "Worryingly," "Fascinatingly" —
emotion labels tacked onto the front of a sentence to tell the reader
what to feel. Human emotion shows up in word choice, not in a label
on top.

### S10. Philosophical closers

The last line pivots from specifics into a cosmic summary: "In the
end, what really matters is..." or "Maybe the real lesson is about
how we..." A post about Threads reach shouldn't suddenly close on a
statement about "how we engage with each other." Models do this
because training data rewards it; Threads readers read it as fake
weight.

## Part 2 — Structure-Level Markers

Patterns that only show up when you zoom out to the paragraph and
post level.

### ST01. Frictionless argument

Every paragraph pushes the conclusion forward. No detour, no
exception, no "though in this one case I got it wrong." Real thinking
has stubble on it — a counter-example the writer can't quite
dismiss, a footnote that partly weakens the claim.

### ST02. Over-complete close

The last paragraph does three jobs: restate the claim, give a step-
by-step recipe, and append a CTA. Reads like a deck's final slide.
Human posts usually pick one of those three — a conclusion, a next
action, or a question — not all three.

### ST03. Every paragraph has a tidy close

Each paragraph ends with a small summary line that restates what the
paragraph just said. Real writing leaves some paragraphs trailing
mid-thought; models close them all politely.

### ST04. Perfect narrative arc

Hook → context → tension → turn → resolution, in clean order, in
roughly the right proportions. It reads *right* — too right. Real
posts skip stages, invert them, or double back.

### ST05. Uniform info density across paragraphs

Paragraphs are roughly the same length, carry roughly the same
number of new ideas, and give equal airtime to each. Humans put the
weight where they actually care, leaving other paragraphs thin.

## Part 3 — Content-Level Markers

Patterns about *what* is claimed, not how it's written.

### C01. Unsourced hanging numbers

"70% of creators struggle with this." "Engagement jumped 3×." Precise
numbers with no source, no sample, no "roughly", no "I've seen".
Humans anchor numbers to experience ("on the accounts I've looked
at", "in my own data") or hedge them.

### C02. One-directional evidence

Every example, statistic, and quote supports the same conclusion.
Nothing cuts against it. Real experience almost always includes a
case that doesn't fit, and real posts usually include that tension.

### C03. Abstract claim without a concrete case

"Many accounts see this pattern." Which accounts? What niche? Over
what period? With what result? Models default to abstract claims
because concrete specifics require real memory. Humans write "my
pet-niche site, two years old, lost 60% after last Core Update, but
the YMYL site I run actually gained" — specifics that can't be
faked.

### C04. Too-neutral stance

"There are arguments on both sides." "It depends." "Both approaches
have merit." The conclusion is calibrated not to offend. Readers
follow accounts for opinions; posts that refuse to take one read as
hedge bots.

### C05. Unnecessary knowledge display

A paragraph exists to explain background the target reader already
knows. "Google's PageRank, introduced in 1998..." for an SEO-
audience post. The paragraph's function is to *look* informed, not
to advance the argument.

## Part 4 — De-AI-ification Methods

Six rewrite levers. Applying any one reduces uniformity; applying
three shifts most drafts out of the AI-slop zone.

### Method 1 — Anchor to a concrete case

Replace the abstract claim with a specific one: named niche, real
timeframe, real result. "Some sites get hit by updates" → "my
pet-niche site, DR 45, got hit in the March update — lost 60% in two
weeks." Hits C01, C03, C04.

### Method 2 — Admit a prior misread

Add a line where the writer was wrong before. "I used to think core
updates only hit low-quality content; it turns out topical authority
matters more than I thought." Human judgment evolves; showing the
evolution is anti-AI. Hits ST01, C02.

### Method 3 — Acknowledge an exception

Add "but" in the middle of the argument. "This is mostly true in
content niches — though local-service sites still seem to get away
with programmatic pages." A crack in the argument reads as honest;
seamless reads as generated. Hits ST01, C02, C04.

### Method 4 — Hedge numbers with source or feel

Precise numbers get a qualifier. "70% of accounts see this" → "the
accounts I've looked at, maybe two-thirds — small sample, take it
with salt." Hits C01.

### Method 5 — Leave imperfect phrasing in

Keep the messy sentence. "SEO — is it even a technical skill anymore
— feels more like reading Google's mind than writing code at this
point." Overly clean rewrites erase the human. Hits S03, S06.

### Method 6 — Close with what *I* do

End the post with your own next move, not a reader checklist. "What
I'm doing now is a monthly backlink audit and disavowing anything
suspicious. Annoying, but less annoying than getting hit." Not:
"1. Audit regularly 2. Use disavow 3. Keep quality high." Hits S10,
ST02.

## Part 5 — Boundary Reminder

AI-tone is not polish. A single polished sentence is fine. A single
neat contrast is fine. A single well-crafted ending is fine. The
marker is *density* — many choices in the same direction.

A draft reads as human when it has at least some of:

- **Asymmetry.** One paragraph three sentences, the next paragraph
  one. One bullet long, one bullet short. Emphasis where the writer
  actually cared, not evenly distributed.
- **Gaps.** Something left unsaid, a caveat dropped halfway, a number
  offered without a source because the writer doesn't pretend to
  have one.
- **Mid-flight corrections.** "I used to think X — actually, that's
  wrong, the real pattern is closer to Y." The trace of a judgment
  being formed, not delivered finished.

If the draft has those, don't sand them off. They are the signal.
