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
      "Connect your Threads account and run a backfill to see your post analytics here.",
  };
}

export function getTimingEmptyStateCopy(isImporting: boolean) {
  if (isImporting) {
    return {
      title: "Importing posting data",
      description:
        "We're still importing your posts. Timing insights will appear automatically as the backfill continues.",
    };
  }

  return {
    title: "No posting data yet",
    description:
      "Start posting on Threads and your optimal timing insights will appear here.",
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
      "Your follower trend will build over time as we collect daily snapshots. Check back soon!",
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
      "Demographics data will appear after your next audience sync.",
  };
}
