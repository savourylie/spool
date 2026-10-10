/**
 * Threads algorithm rule summaries for the Scanner's four-axis UI.
 *
 * One-line summaries per rule, derived from `src/lib/prompts/algorithm.md`.
 * Consumed by the Algorithm Alignment axis rule pill tooltips.
 *
 * Keep in sync with `src/lib/prompts/algorithm.md`. When that file changes,
 * update the summaries here. Build-time extraction is the durable fix — not
 * implemented because the markdown isn't strictly machine-friendly.
 */

export interface AlgorithmRule {
  tag: string;
  title: string;
  summary: string;
}

export const ALGORITHM_RULES: Record<string, AlgorithmRule> = {
  R1: {
    tag: "R1",
    title: "Engagement bait",
    summary:
      "Asking readers to react, comment, share, tag, or vote — Meta detects and suppresses account-wide.",
  },
  R2: {
    tag: "R2",
    title: "Clickbait",
    summary:
      "Sensationalist hooks, excessive punctuation, or first lines the body never pays off.",
  },
  R3: {
    tag: "R3",
    title: "Hook-body mismatch",
    summary:
      "Opening promises one topic; body delivers another. Flagged by Meta's 2025 spammy-content crackdown.",
  },
  R4: {
    tag: "R4",
    title: "Low-originality repost",
    summary:
      ">70% similarity to your own or others' work without new analysis, conclusion, or experience.",
  },
  R5: {
    tag: "R5",
    title: "Consecutive same-topic posts",
    summary:
      "3–5 near-identical posts in a row compresses reach via diversity enforcement.",
  },
  R6: {
    tag: "R6",
    title: "Low-quality outbound links",
    summary:
      "Ad-heavy, slow, or SEO-spam destinations drag the post down. Prefer high-trust sources.",
  },
  R7: {
    tag: "R7",
    title: "Sensitive-topic framing",
    summary:
      "Political, civic, health, or financial content needs explicit tone and grounded claims.",
  },
  R8: {
    tag: "R8",
    title: "Negative-feedback risk",
    summary:
      "Sensational hook with empty body, topic mismatch, or audience framing that invites 'Not interested'.",
  },
  R9: {
    tag: "R9",
    title: "Topic blending",
    summary:
      "One post, one topic. Multiple topics dilute the classification signal and lose distribution.",
  },
  R10: {
    tag: "R10",
    title: "Unlabeled AI content",
    summary:
      "Photorealistic AI-generated media without the AI label — fast path to reach loss.",
  },
  R11: {
    tag: "R11",
    title: "Image-text mismatch",
    summary:
      "Image, first line, and body must cover the same thing. Decoration kills dwell time.",
  },
  R12: {
    tag: "R12",
    title: "Soft de-ranking accumulators",
    summary:
      "Two or more weak hits (generic filler, low-effort replies, repetition) trigger a warning.",
  },
  S1: {
    tag: "S1",
    title: "DM sends",
    summary:
      "Strongest engagement signal — private shares weigh 3–5× a like.",
  },
  S2: {
    tag: "S2",
    title: "Deep comments",
    summary:
      "5+ word or media replies score 30× a like. Invite extension, not approval.",
  },
  S3: {
    tag: "S3",
    title: "Dwell time",
    summary:
      "Meta weighs time spent, not word count. Long is fine; long-with-no-new-info is not.",
  },
  S4: {
    tag: "S4",
    title: "Interactor identity",
    summary:
      "Core followers carry more weight than strangers. Write sharply for your closest readers.",
  },
  S5: {
    tag: "S5",
    title: "Likes",
    summary:
      "Weakest signal. High-likes/low-comments usually means no second distribution round.",
  },
  S6: {
    tag: "S6",
    title: "Image + text",
    summary:
      "Posts with images see ~60% higher median engagement than text-only when the image adds info.",
  },
  S7: {
    tag: "S7",
    title: "Semantic neighborhood",
    summary:
      "Threads classifies accounts into topic neighborhoods. Stay in lane, or bridge explicitly.",
  },
  S8: {
    tag: "S8",
    title: "Trust graph",
    summary:
      "Consistency of persona and subject compounds as trust. Chasing trends burns that compound.",
  },
  S9: {
    tag: "S9",
    title: "Publishable vs recommendable",
    summary:
      "Some content clears review but won't be widely recommended. Two different bars.",
  },
  S10: {
    tag: "S10",
    title: "Small-account boost",
    summary:
      "Small accounts get an initial exploration bump, conditional on minimum quality.",
  },
  S11: {
    tag: "S11",
    title: "Discovery surface",
    summary:
      "Where views come from changes their meaning. Feed vs profile vs topic tell different stories.",
  },
  S12: {
    tag: "S12",
    title: "Topic graph strength",
    summary:
      "Can the system tell the topic in the first two sentences? Clean labels = better distribution.",
  },
  S13: {
    tag: "S13",
    title: "Originality / spam-risk spectrum",
    summary:
      "Weak spam signals accumulate — caption mismatch, hashtag stuffing, duplicate-cluster risk.",
  },
  S14: {
    tag: "S14",
    title: "Topic freshness budget",
    summary:
      "Repeated semantic cluster + angle + promise burns freshness fast, even across different days.",
  },
};

/**
 * Look up a rule by its tag. Returns `null` if the tag isn't recognized,
 * letting callers fall back to a plain pill with just the code.
 */
export function getAlgorithmRule(tag: string): AlgorithmRule | null {
  return ALGORITHM_RULES[tag] ?? null;
}
