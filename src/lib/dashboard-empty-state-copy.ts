export function getPostsEmptyStateCopy(isImporting: boolean) {
  if (isImporting) {
    return {
      title: "Importing your posts",
      description:
        "Your Threads posts are still being imported in the background. This table will fill in automatically as the backfill continues.",
    };
  }

  return {
    title: "No posts yet",
    description:
      "We'll analyze your Threads posts and show you what the algorithm rewards most — shares and meaningful comments carry far more weight than likes.",
  };
}

export function getTimingEmptyStateCopy(isImporting: boolean) {
  if (isImporting) {
    return {
      title: "Importing posting data",
      description:
        "We're still importing your posts. Timing and cadence insights will appear automatically as the backfill continues.",
    };
  }

  return {
    title: "No posting data yet",
    description:
      "We'll find your optimal posting times and cadence — not just when to post, but how to space posts to avoid the algorithm's diversity filter.",
  };
}

export function getFollowerEmptyStateCopy(isImporting: boolean) {
  if (isImporting) {
    return {
      title: "Importing follower snapshots",
      description:
        "We're still importing your audience history. This chart will build automatically as the backfill continues.",
    };
  }

  return {
    title: "Tracking your growth",
    description:
      "Your follower trend will build over time as we collect daily snapshots. We'll also track whether your followers match your content niche.",
  };
}

export function getDemographicsEmptyStateCopy(isImporting: boolean) {
  if (isImporting) {
    return {
      title: "Importing audience data",
      description:
        "We're still importing your audience data. Demographics will appear automatically as the backfill continues.",
    };
  }

  return {
    title: "No data available yet",
    description:
      "Demographics data will appear after your next audience sync. This helps track whether your audience fits your content niche.",
  };
}

export function getCadenceEmptyStateCopy(isImporting: boolean) {
  if (isImporting) {
    return {
      title: "Importing posting data",
      description:
        "Cadence insights will appear automatically as the backfill continues.",
    };
  }

  return {
    title: "Not enough posts for cadence analysis",
    description:
      "Post at least 3 times to see how your posting frequency affects reach. We'll show you the optimal spacing to avoid the algorithm's diversity filter.",
  };
}

export function getFormatEmptyStateCopy(isImporting: boolean) {
  if (isImporting) {
    return {
      title: "Importing posting data",
      description:
        "Format analysis will appear automatically as the backfill continues.",
    };
  }

  return {
    title: "Not enough posts for format analysis",
    description:
      "Post at least 5 times with different formats to see which content types and lengths perform best for your audience.",
  };
}

export function getScannerEmptyStateCopy() {
  return {
    title: "Type or paste a draft post to analyze",
    description:
      "We'll check for patterns the algorithm demotes and suggest improvements.",
  };
}

export function getSemanticFocusEmptyStateCopy(isImporting: boolean) {
  if (isImporting) {
    return {
      title: "Importing your posts",
      description:
        "Topic analysis requires post text. Focus scores will appear automatically as the backfill continues.",
    };
  }

  return {
    title: "Not enough text posts for focus analysis",
    description:
      "Post at least 10 times with text to see how focused your content is. A high focus score signals niche authority to the algorithm.",
  };
}

export function getAudienceFitEmptyStateCopy(isImporting: boolean) {
  if (isImporting) {
    return {
      title: "Importing audience data",
      description:
        "Audience fit analysis requires multiple demographic snapshots over time. Data will appear as daily syncs continue.",
    };
  }

  return {
    title: "Not enough data for audience fit analysis",
    description:
      "We need at least 2 demographic snapshots to detect shifts. This data builds automatically with daily audience syncs.",
  };
}

export function getCommentQualityEmptyStateCopy(isImporting: boolean) {
  if (isImporting) {
    return {
      title: "Importing replies...",
      description:
        "Reply data will appear as the backfill continues.",
    };
  }

  return {
    title: "No replies yet",
    description:
      "When this post gets replies, we'll break them down by quality — longer, thoughtful replies signal higher algorithmic value.",
  };
}

export function getComposerEmptyStateCopy() {
  return {
    title: "Ready to compose",
    description:
      "Enter a topic to generate AI-powered draft variations optimized for your audience and the Threads algorithm.",
  };
}

export function getPulseEmptyStateCopy(isImporting: boolean) {
  if (isImporting) {
    return {
      title: "Gathering your first week of data",
      description:
        "Weekly pulse metrics will appear automatically as the backfill continues.",
    };
  }

  return {
    title: "Not enough data for weekly pulse",
    description:
      "Post and grow for a few days to see your weekly metrics — follower growth, posting frequency, and engagement trends.",
  };
}

export function getBestPostEmptyStateCopy(isImporting: boolean) {
  if (isImporting) {
    return {
      title: "Importing your post history",
      description:
        "Your best-performing post will appear here once the backfill completes.",
    };
  }

  return {
    title: "No posts in the last 7 days",
    description:
      "Post to see your top-performing content highlighted here with insights into why it worked.",
  };
}

export function getLatestReviewEmptyStateCopy(isImporting: boolean) {
  if (isImporting) {
    return {
      title: "Importing your post history",
      description:
        "Your first review lands here after your next published post.",
    };
  }

  return {
    title: "Your first review lands here",
    description:
      "After your next published post, we'll show how it performed against your predicted range.",
  };
}
