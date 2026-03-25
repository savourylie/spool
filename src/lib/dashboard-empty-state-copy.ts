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
    title: "Content Quality Scanner",
    description:
      "Analyze your posts for patterns the algorithm demotes — clickbait, engagement bait, and semantic duplicates. Coming soon.",
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

export function getComposerEmptyStateCopy() {
  return {
    title: "AI Content Composer",
    description:
      "Draft algorithm-optimized posts based on your performance history, audience data, and what triggers shares. Coming soon.",
  };
}
