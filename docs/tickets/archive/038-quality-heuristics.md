# [TICKET-038] Quality Heuristics Library

## Status
`done`

## Dependencies
- Requires: None (v0 complete)

## Description
Create a client-side heuristic analysis library for the Content Quality Scanner. This is the first of two analysis layers — it runs instantly in the browser without any API calls, detecting common anti-patterns that the algorithm demotes. Each check returns a typed issue with severity, description, and suggested fix. The heuristic score updates in real-time as the user types.

## Acceptance Criteria
- [x] `analyzeHeuristics()` accepts post text and returns an array of typed `QualityIssue` objects
- [x] Detects clickbait openers: "You won't believe...", "This will change...", "Nobody talks about..." etc.
- [x] Detects engagement bait: "Like if you agree", "Share with someone who...", "Tag a friend", "Comment YES" etc.
- [x] Detects excessive hashtags: flags when hashtag count exceeds 5
- [x] Detects ALL CAPS: flags when >30% of alphabetic characters are uppercase (excluding short posts)
- [x] Detects excessive emoji density: flags when emoji count > 20% of total characters
- [x] Detects too-short posts: flags posts under 20 characters as low-effort
- [x] `computeHeuristicScore()` returns a quality score (0-100) based on detected issues, weighted by severity
- [x] Each `QualityIssue` includes: `id`, `severity` (high/medium/low), `category`, `description`, `suggestion` (fix text)
- [x] All functions are pure and synchronous — no API calls, no side effects
- [x] Unit tests cover all detection patterns with positive and negative cases

## Implementation Notes
- Create `src/lib/quality-heuristics.ts`
- Issue severity mapping:
  - **High**: engagement bait (account-level demotion risk), excessive ALL CAPS
  - **Medium**: clickbait openers, excessive hashtags, emoji density
  - **Low**: too-short posts
- Clickbait patterns: regex array of common openings (case-insensitive)
- Engagement bait patterns: regex array for "like if", "share if", "tag someone", "comment below" etc.
- Hashtag count: match `/#\w+/g` and count
- ALL CAPS: count uppercase alpha chars / total alpha chars (skip if total < 10)
- Emoji detection: use Unicode emoji regex range
- Score computation: start at 100, subtract per issue (high: -25, medium: -15, low: -5), floor at 0
- Export types: `QualityIssue`, `IssueSeverity`, `IssueCategory`
- Export constants: `HASHTAG_THRESHOLD = 5`, `CAPS_THRESHOLD = 0.3`, `EMOJI_DENSITY_THRESHOLD = 0.2`, `MIN_POST_LENGTH = 20`
- Create `src/lib/__tests__/quality-heuristics.test.ts`

## Testing
- Run `npm test -- quality-heuristics` for all unit tests
- Test with clean text: score = 100, no issues
- Test with "You won't believe what happened! LIKE IF YOU AGREE #hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5 #hashtag6": multiple issues detected across categories
- Test with "hi": too-short post detected
