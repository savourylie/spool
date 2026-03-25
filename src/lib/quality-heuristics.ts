/**
 * Quality Heuristics Library
 *
 * Client-side heuristic analysis for the Content Quality Scanner.
 * Detects common anti-patterns that the Threads algorithm demotes:
 * clickbait openers, engagement bait, excessive hashtags, ALL CAPS,
 * emoji spam, and too-short posts.
 *
 * All functions are pure and synchronous — no API calls, no side effects.
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const HASHTAG_THRESHOLD = 5;
export const CAPS_THRESHOLD = 0.3;
export const EMOJI_DENSITY_THRESHOLD = 0.2;
export const MIN_POST_LENGTH = 20;
export const MIN_ALPHA_FOR_CAPS_CHECK = 10;

const SEVERITY_DEDUCTIONS = { high: 25, medium: 15, low: 5 } as const;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type IssueSeverity = "high" | "medium" | "low";

export type IssueCategory =
  | "clickbait"
  | "engagement-bait"
  | "hashtags"
  | "caps"
  | "emoji"
  | "length";

export interface QualityIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  description: string;
  suggestion: string;
}

/* ------------------------------------------------------------------ */
/*  Detection patterns                                                 */
/* ------------------------------------------------------------------ */

const CLICKBAIT_PATTERNS: RegExp[] = [
  /^you won't believe/i,
  /^this will change/i,
  /^nobody talks about/i,
  /^what happens next/i,
  /^the secret to/i,
  /^here'?s why everyone/i,
  /^stop everything/i,
  /^i can't believe/i,
];

const ENGAGEMENT_BAIT_PATTERNS: RegExp[] = [
  /like if you agree/i,
  /share with someone/i,
  /tag a friend/i,
  /tag someone who/i,
  /comment (yes|below|if)/i,
  /follow for more/i,
  /repost if you/i,
  /drop a .{0,10} if you/i,
  /like and share/i,
  /share this with/i,
];

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function detectClickbait(text: string): QualityIssue | null {
  const trimmed = text.trim();
  for (const pattern of CLICKBAIT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        id: "clickbait-opener",
        severity: "medium",
        category: "clickbait",
        description: "Post starts with a clickbait-style opener",
        suggestion:
          "Lead with your actual insight instead of a teaser phrase",
      };
    }
  }
  return null;
}

function detectEngagementBait(text: string): QualityIssue | null {
  for (const pattern of ENGAGEMENT_BAIT_PATTERNS) {
    if (pattern.test(text)) {
      return {
        id: "engagement-bait",
        severity: "high",
        category: "engagement-bait",
        description: "Contains engagement bait language",
        suggestion:
          "Remove calls to like/share/comment — the algorithm demotes these at the account level",
      };
    }
  }
  return null;
}

function detectExcessiveHashtags(text: string): QualityIssue | null {
  const hashtags = text.match(/#\w+/g);
  const count = hashtags ? hashtags.length : 0;
  if (count > HASHTAG_THRESHOLD) {
    return {
      id: "excessive-hashtags",
      severity: "medium",
      category: "hashtags",
      description: `Post contains ${count} hashtags (limit: ${HASHTAG_THRESHOLD})`,
      suggestion: "Use 1-3 relevant hashtags for best reach",
    };
  }
  return null;
}

function detectAllCaps(text: string): QualityIssue | null {
  const alphaChars = text.replace(/[^a-zA-Z]/g, "");
  if (alphaChars.length < MIN_ALPHA_FOR_CAPS_CHECK) return null;

  const upperCount = alphaChars.replace(/[^A-Z]/g, "").length;
  const ratio = upperCount / alphaChars.length;
  if (ratio > CAPS_THRESHOLD) {
    return {
      id: "excessive-caps",
      severity: "high",
      category: "caps",
      description: `${Math.round(ratio * 100)}% of text is ALL CAPS`,
      suggestion: "Use standard capitalization — excessive caps hurts readability and reach",
    };
  }
  return null;
}

function detectEmojiDensity(text: string): QualityIssue | null {
  const emojiMatches = text.match(/\p{Emoji_Presentation}/gu);
  const emojiCount = emojiMatches ? emojiMatches.length : 0;
  if (text.length === 0) return null;

  const density = emojiCount / text.length;
  if (density > EMOJI_DENSITY_THRESHOLD) {
    return {
      id: "excessive-emoji",
      severity: "medium",
      category: "emoji",
      description: "Emoji density is too high",
      suggestion: "Use emoji sparingly to emphasize key points, not as filler",
    };
  }
  return null;
}

function detectTooShort(text: string): QualityIssue | null {
  if (text.trim().length < MIN_POST_LENGTH) {
    return {
      id: "too-short",
      severity: "low",
      category: "length",
      description: `Post is under ${MIN_POST_LENGTH} characters`,
      suggestion: "Add context or detail to give the algorithm more to work with",
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Public functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Run all heuristic checks against the given post text.
 * Returns an array of detected quality issues (empty if none found).
 */
export function analyzeHeuristics(text: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  const clickbait = detectClickbait(text);
  if (clickbait) issues.push(clickbait);

  const engagementBait = detectEngagementBait(text);
  if (engagementBait) issues.push(engagementBait);

  const hashtags = detectExcessiveHashtags(text);
  if (hashtags) issues.push(hashtags);

  const caps = detectAllCaps(text);
  if (caps) issues.push(caps);

  const emoji = detectEmojiDensity(text);
  if (emoji) issues.push(emoji);

  const tooShort = detectTooShort(text);
  if (tooShort) issues.push(tooShort);

  return issues;
}

/**
 * Compute a quality score (0-100) from detected issues.
 * Starts at 100 and subtracts per issue weighted by severity.
 */
export function computeHeuristicScore(issues: QualityIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    score -= SEVERITY_DEDUCTIONS[issue.severity];
  }
  return Math.max(0, score);
}
