import { describe, expect, it } from "vitest";
import {
  POSTS_PAGE_SIZE,
  getPostsPageRange,
  getPostsTotalPages,
} from "../posts-pagination";

describe("posts pagination helpers", () => {
  it("returns the first-page range for a full page", () => {
    expect(
      getPostsPageRange({
        currentPage: 1,
        totalCount: 63,
        pageItemCount: POSTS_PAGE_SIZE,
      }),
    ).toEqual({ start: 1, end: 20 });
  });

  it("returns the middle-page range", () => {
    expect(
      getPostsPageRange({
        currentPage: 3,
        totalCount: 63,
        pageItemCount: POSTS_PAGE_SIZE,
      }),
    ).toEqual({ start: 41, end: 60 });
  });

  it("returns the last-page partial range", () => {
    expect(
      getPostsPageRange({
        currentPage: 4,
        totalCount: 63,
        pageItemCount: 3,
      }),
    ).toEqual({ start: 61, end: 63 });
  });

  it("returns null when there are no rows on the page", () => {
    expect(
      getPostsPageRange({
        currentPage: 1,
        totalCount: 0,
        pageItemCount: 0,
      }),
    ).toBeNull();
  });

  it("calculates total pages from the shared page size", () => {
    expect(getPostsTotalPages(63)).toBe(4);
  });
});
