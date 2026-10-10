import { describe, expect, it } from "vitest";
import {
  CAPS_THRESHOLD,
  EMOJI_DENSITY_THRESHOLD,
  HASHTAG_THRESHOLD,
  MIN_POST_LENGTH,
  MIN_ALPHA_FOR_CAPS_CHECK,
  analyzeHeuristics,
  computeHeuristicScore,
  type QualityIssue,
} from "../quality-heuristics";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("HASHTAG_THRESHOLD is 5", () => {
    expect(HASHTAG_THRESHOLD).toBe(5);
  });

  it("CAPS_THRESHOLD is 0.3", () => {
    expect(CAPS_THRESHOLD).toBe(0.3);
  });

  it("EMOJI_DENSITY_THRESHOLD is 0.2", () => {
    expect(EMOJI_DENSITY_THRESHOLD).toBe(0.2);
  });

  it("MIN_POST_LENGTH is 20", () => {
    expect(MIN_POST_LENGTH).toBe(20);
  });

  it("MIN_ALPHA_FOR_CAPS_CHECK is 10", () => {
    expect(MIN_ALPHA_FOR_CAPS_CHECK).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// analyzeHeuristics — clean text
// ---------------------------------------------------------------------------

describe("analyzeHeuristics — clean text", () => {
  it("returns no issues for well-formed text", () => {
    const issues = analyzeHeuristics(
      "Here is a thoughtful post about software engineering and design patterns.",
    );
    expect(issues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// analyzeHeuristics — clickbait detection
// ---------------------------------------------------------------------------

describe("analyzeHeuristics — clickbait detection", () => {
  it("detects 'You won't believe' opener", () => {
    const issues = analyzeHeuristics(
      "You won't believe what happened at the conference yesterday!",
    );
    const clickbait = issues.find((i) => i.id === "clickbait-opener");
    expect(clickbait).toBeDefined();
    expect(clickbait!.severity).toBe("medium");
    expect(clickbait!.category).toBe("clickbait");
  });

  it("detects 'This will change' opener", () => {
    const issues = analyzeHeuristics(
      "This will change everything you know about productivity.",
    );
    expect(issues.find((i) => i.id === "clickbait-opener")).toBeDefined();
  });

  it("detects 'Nobody talks about' opener", () => {
    const issues = analyzeHeuristics(
      "Nobody talks about the real cost of scaling.",
    );
    expect(issues.find((i) => i.id === "clickbait-opener")).toBeDefined();
  });

  it("does not flag normal sentences starting with 'You'", () => {
    const issues = analyzeHeuristics(
      "You should definitely try this new framework for your next project.",
    );
    expect(issues.find((i) => i.id === "clickbait-opener")).toBeUndefined();
  });

  it("does not flag sentences with clickbait words mid-sentence", () => {
    const issues = analyzeHeuristics(
      "I think you won't believe how simple this is once you see the code.",
    );
    expect(issues.find((i) => i.id === "clickbait-opener")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// analyzeHeuristics — engagement bait detection
// ---------------------------------------------------------------------------

describe("analyzeHeuristics — engagement bait detection", () => {
  it("detects 'Like if you agree'", () => {
    const issues = analyzeHeuristics(
      "Working from home is the future. Like if you agree!",
    );
    const bait = issues.find((i) => i.id === "engagement-bait");
    expect(bait).toBeDefined();
    expect(bait!.severity).toBe("high");
    expect(bait!.category).toBe("engagement-bait");
  });

  it("detects 'Share with someone'", () => {
    const issues = analyzeHeuristics(
      "Great advice here. Share with someone who needs this!",
    );
    expect(issues.find((i) => i.id === "engagement-bait")).toBeDefined();
  });

  it("detects 'Tag a friend'", () => {
    const issues = analyzeHeuristics(
      "This is hilarious. Tag a friend who does this!",
    );
    expect(issues.find((i) => i.id === "engagement-bait")).toBeDefined();
  });

  it("detects 'Comment YES'", () => {
    const issues = analyzeHeuristics(
      "Want to learn more? Comment YES below!",
    );
    expect(issues.find((i) => i.id === "engagement-bait")).toBeDefined();
  });

  it("does not flag normal use of 'like'", () => {
    const issues = analyzeHeuristics(
      "I like this approach because it simplifies the codebase significantly.",
    );
    expect(issues.find((i) => i.id === "engagement-bait")).toBeUndefined();
  });

  it("does not flag normal use of 'share'", () => {
    const issues = analyzeHeuristics(
      "Let me share my experience with this new testing framework and what I learned.",
    );
    expect(issues.find((i) => i.id === "engagement-bait")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// analyzeHeuristics — excessive hashtags
// ---------------------------------------------------------------------------

describe("analyzeHeuristics — excessive hashtags", () => {
  it("allows 5 hashtags", () => {
    const issues = analyzeHeuristics(
      "Great day! #coding #react #nextjs #webdev #typescript",
    );
    expect(issues.find((i) => i.id === "excessive-hashtags")).toBeUndefined();
  });

  it("flags 6+ hashtags", () => {
    const issues = analyzeHeuristics(
      "Great day! #coding #react #nextjs #webdev #typescript #javascript",
    );
    const issue = issues.find((i) => i.id === "excessive-hashtags");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("medium");
    expect(issue!.category).toBe("hashtags");
    expect(issue!.description).toContain("6");
  });

  it("flags no hashtags as clean", () => {
    const issues = analyzeHeuristics(
      "No hashtags in this post, just good content for everyone to read.",
    );
    expect(issues.find((i) => i.id === "excessive-hashtags")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// analyzeHeuristics — ALL CAPS detection
// ---------------------------------------------------------------------------

describe("analyzeHeuristics — ALL CAPS detection", () => {
  it("flags when >30% of alpha chars are uppercase", () => {
    const issues = analyzeHeuristics(
      "THIS IS A REALLY IMPORTANT ANNOUNCEMENT for the team about upcoming changes!",
    );
    const caps = issues.find((i) => i.id === "excessive-caps");
    expect(caps).toBeDefined();
    expect(caps!.severity).toBe("high");
    expect(caps!.category).toBe("caps");
  });

  it("does not flag normal sentence casing", () => {
    const issues = analyzeHeuristics(
      "This is a normal sentence with proper capitalization and good content.",
    );
    expect(issues.find((i) => i.id === "excessive-caps")).toBeUndefined();
  });

  it("skips check when fewer than 10 alpha chars", () => {
    const issues = analyzeHeuristics("ALL CAPS!");
    expect(issues.find((i) => i.id === "excessive-caps")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// analyzeHeuristics — emoji density
// ---------------------------------------------------------------------------

describe("analyzeHeuristics — emoji density", () => {
  it("flags excessive emoji density", () => {
    const issues = analyzeHeuristics("🎉🎊🥳🎈🎆🎇✨💫⭐🌟🔥💥");
    const emoji = issues.find((i) => i.id === "excessive-emoji");
    expect(emoji).toBeDefined();
    expect(emoji!.severity).toBe("medium");
    expect(emoji!.category).toBe("emoji");
  });

  it("allows normal emoji usage", () => {
    const issues = analyzeHeuristics(
      "Had a great day at the conference today! 🎉 Learned so much about design systems.",
    );
    expect(issues.find((i) => i.id === "excessive-emoji")).toBeUndefined();
  });

  it("handles empty text without error", () => {
    const issues = analyzeHeuristics("");
    expect(issues.find((i) => i.id === "excessive-emoji")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// analyzeHeuristics — too-short posts
// ---------------------------------------------------------------------------

describe("analyzeHeuristics — too-short posts", () => {
  it("flags posts under 20 characters", () => {
    const issues = analyzeHeuristics("hi");
    const short = issues.find((i) => i.id === "too-short");
    expect(short).toBeDefined();
    expect(short!.severity).toBe("low");
    expect(short!.category).toBe("length");
  });

  it("allows posts with 20+ characters", () => {
    const issues = analyzeHeuristics("This post is long enough to be fine.");
    expect(issues.find((i) => i.id === "too-short")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// analyzeHeuristics — multi-issue detection
// ---------------------------------------------------------------------------

describe("analyzeHeuristics — multi-issue detection", () => {
  it("detects multiple issues in one post", () => {
    const issues = analyzeHeuristics(
      "You won't believe what happened! LIKE IF YOU AGREE #one #two #three #four #five #six",
    );
    expect(issues.length).toBeGreaterThanOrEqual(3);

    const ids = issues.map((i) => i.id);
    expect(ids).toContain("clickbait-opener");
    expect(ids).toContain("engagement-bait");
    expect(ids).toContain("excessive-hashtags");
  });
});

// ---------------------------------------------------------------------------
// computeHeuristicScore
// ---------------------------------------------------------------------------

describe("computeHeuristicScore", () => {
  it("returns 100 for no issues", () => {
    expect(computeHeuristicScore([])).toBe(100);
  });

  it("subtracts 25 for a high-severity issue", () => {
    const issues: QualityIssue[] = [
      {
        id: "test",
        severity: "high",
        category: "caps",
        description: "test",
        suggestion: "test",
      },
    ];
    expect(computeHeuristicScore(issues)).toBe(75);
  });

  it("subtracts 15 for a medium-severity issue", () => {
    const issues: QualityIssue[] = [
      {
        id: "test",
        severity: "medium",
        category: "clickbait",
        description: "test",
        suggestion: "test",
      },
    ];
    expect(computeHeuristicScore(issues)).toBe(85);
  });

  it("subtracts 5 for a low-severity issue", () => {
    const issues: QualityIssue[] = [
      {
        id: "test",
        severity: "low",
        category: "length",
        description: "test",
        suggestion: "test",
      },
    ];
    expect(computeHeuristicScore(issues)).toBe(95);
  });

  it("floors at 0", () => {
    const issues: QualityIssue[] = Array.from({ length: 10 }, () => ({
      id: "test",
      severity: "high" as const,
      category: "caps" as const,
      description: "test",
      suggestion: "test",
    }));
    expect(computeHeuristicScore(issues)).toBe(0);
  });

  it("handles mixed severities correctly", () => {
    const issues: QualityIssue[] = [
      {
        id: "a",
        severity: "high",
        category: "caps",
        description: "t",
        suggestion: "t",
      },
      {
        id: "b",
        severity: "medium",
        category: "clickbait",
        description: "t",
        suggestion: "t",
      },
      {
        id: "c",
        severity: "low",
        category: "length",
        description: "t",
        suggestion: "t",
      },
    ];
    // 100 - 25 - 15 - 5 = 55
    expect(computeHeuristicScore(issues)).toBe(55);
  });
});
