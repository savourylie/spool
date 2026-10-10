# Feature Catalog: Spool

> Generated from codebase analysis on 2026-03-26
> Application type: Web app (Next.js 16, App Router)

## Summary

Spool is an algorithm-aware analytics and content creation platform for Threads creators. It imports post data via the Threads API, surfaces engagement insights through interactive dashboards, and provides AI-powered tools for drafting optimized content.

**36 features** across **7 areas**

---

## Authentication & Onboarding

### Sign In with Threads
Authenticate using your Threads account via OAuth. Grants Spool read access to your posts, insights, and replies.

### Sign Out
End your session and return to the landing page.

### Automatic Token Refresh
OAuth tokens are refreshed automatically before expiry so you stay connected without manual re-authentication.

### Historical Data Import
On first login, Spool imports all your Threads posts (from April 2024 onward) with engagement metrics, replies, and topic classification. A real-time progress screen shows import status.

### Resume or Retry Failed Imports
If a data import stalls or fails, resume or retry it from the status banner without re-authenticating.

---

## Post Performance

### View Post Performance Table
See all your posts in a sortable table with views, likes, replies, reposts, quotes, shares, engagement rate, and Weighted Engagement Score (WES).

### Sort Posts by Any Metric
Click any column header to sort posts by views, likes, replies, reposts, quotes, shares, engagement rate, or WES in ascending or descending order.

### Filter Posts by Media Type
Narrow the post table to specific formats: Text, Image, Video, or Carousel.

### Filter Posts by Date Range
Restrict the post table to posts published within a specific date window.

### Expand Post Details
Click a post row to reveal a detailed view with full post text, engagement-over-time sparkline charts, and a link to view the post on Threads.

### View Comment Quality Analysis
See a breakdown of reply quality for any post: short, medium, and long replies with a Discussion Quality Score indicating how meaningful the conversation is.

### View Launch Velocity Indicators
Each recent post shows a velocity badge (Strong, Average, or Slow Launch) based on how quickly it gained engagement in the first 3 hours.

### View Format Analysis
See which content formats (Text, Image, Video, Carousel) and text lengths perform best, with average views and WES comparisons.

### Reselection Alerts
Get notified when older posts are gaining renewed engagement from the algorithm, with a direct link to engage with new comments.

---

## Timing & Cadence

### Best Time to Post Heatmap
View a 7-day by 24-hour grid showing average engagement rate for each time slot, color-coded from low to high performance.

### Change Heatmap Timezone
Switch the heatmap to your local timezone using a dropdown selector.

### Cadence Optimizer
See how posting frequency affects reach: average posts per day, gap analysis, and a scatter chart showing the relationship between post spacing and views. Includes recommendations when suboptimal patterns are detected.

---

## Audience Insights

### Follower Growth Chart
Track follower count over time with an area chart. Growth spikes are highlighted and linked to the post that likely caused them.

### Audience Demographics
View your audience breakdown by country, city, and gender in bar and donut charts. Requires 100+ followers.

### Semantic Focus Score
See how concentrated your content is around core topics. A focus score (0-100) with trend line helps you understand whether your content strategy is coherent or scattered.

### Audience Fit Score
Measure alignment between your content topics and audience demographics over time. Includes engagement trend comparisons and actionable recommendations when alignment is low.

---

## Content Scanner

### Analyze Draft Post Quality
Paste or type a draft post and get an instant quality score (0-100) with a visual gauge. The scanner checks for AI-sounding language, engagement bait, topic coherence, and near-duplicate content.

### View Quality Issues
See a categorized list of issues found in your draft with severity badges (High, Medium, Low) and specific improvement suggestions.

### Apply AI-Suggested Rewrites
Review and apply one-click rewrite suggestions that fix detected quality issues while preserving your voice.

### View Shareability Score
See a shareability rating (0-100) indicating how likely the post is to be privately shared, with the dominant share trigger identified (Voice of the Reader, Time-Saving Compilation, Counterintuitive Data, or Conversation Framework).

### View Engagement Prediction
See predicted view ranges (25th, 50th, 75th percentile) based on similar historical posts, with an AI-refined adjustment and reasoning.

### Scan Existing Posts
Select any of your published posts to run through the quality scanner and see how it scores.

---

## AI Composer

### Generate AI Draft Variations
Enter a topic and style preset (Professional, Casual, Provocative, Educational, Humorous) to generate three distinct draft variations, each targeting a different share trigger.

### Get Random Topic Inspiration
Click "Generate ideas for me" when you need a starting point and don't have a specific topic in mind.

### Edit, Copy, and Regenerate Drafts
Select any generated draft to copy it to your clipboard, edit the text inline, or regenerate just that variation while keeping the others.

### View Topic Suggestions
See AI-recommended topics organized by semantic distance: Near (deeper dives), Medium (adjacent fields), and Far (creative crossovers) with relevance scores.

### Best Time Recommendations
See the top 3 optimal posting windows based on your historical engagement data, displayed alongside the composer.

---

## Alerts & Status

### Viral Recovery Guidance
When a post goes viral, a card appears with the follower spike magnitude, a countdown timer for when it's safe to post next, and a 4-step recovery playbook. Auto-dismisses after 7 days.

### Token Expiry Warning
A banner warns you when your Threads connection is expiring soon, with a one-click reconnect button.

### Data Import Status Banner
A persistent banner shows ongoing import progress with a progress bar, current stage, and resume/retry buttons if something goes wrong. Auto-refreshes every 5 seconds.

---

## Coverage Notes

### Explored
- `src/app/` — All pages, layouts, and API routes
- `src/components/dashboard/` — All dashboard feature components
- `src/components/ui/` — UI primitives (Button, Card, Input)
- `src/hooks/` — Custom hooks (useBackfillJob)
- `src/lib/` — Business logic, LLM prompts, API clients, utilities
- `src/lib/__tests__/` and `src/components/__tests__/` — Test descriptions
- `supabase/migrations/` — Database schema and functions
- `docs/` — PRD and API documentation

### Limitations
- No feature flags detected; all features appear to be unconditionally available
- Developer debug pages (`/dev/*`) excluded from catalog as they are not user-facing
- Drafts generated by the AI Composer are saved to the database but there is no dedicated "saved drafts" browsing UI visible in the current codebase
