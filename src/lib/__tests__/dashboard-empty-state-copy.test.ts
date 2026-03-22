import { describe, expect, it } from "vitest";
import {
  getDemographicsEmptyStateCopy,
  getFollowerEmptyStateCopy,
  getPostsEmptyStateCopy,
  getTimingEmptyStateCopy,
} from "../dashboard-empty-state-copy";

describe("dashboard import empty state copy", () => {
  it("uses import-aware posts copy while backfill is running", () => {
    expect(getPostsEmptyStateCopy(true)).toEqual({
      title: "Importing your posts",
      description:
        "Your Threads posts are still being imported in the background. This table will fill in automatically as the backfill continues.",
    });
  });

  it("uses import-aware timing copy while backfill is running", () => {
    expect(getTimingEmptyStateCopy(true).description).toContain(
      "as the backfill continues",
    );
  });

  it("uses import-aware audience copy while backfill is running", () => {
    expect(getFollowerEmptyStateCopy(true).title).toBe(
      "Importing follower snapshots",
    );
    expect(getDemographicsEmptyStateCopy(true).description).toContain(
      "as the backfill continues",
    );
  });
});
