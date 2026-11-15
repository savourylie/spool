import { describe, expect, it } from "vitest";
import {
  POSTS_PAGE_SIZE,
  getPostsFirstPageHref,
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

describe("getPostsFirstPageHref", () => {
  it("returns the bare posts path when there are no search params", () => {
    expect(getPostsFirstPageHref({})).toBe("/dashboard/posts");
  });

  it("drops the page, and with nothing else left returns the bare posts path", () => {
    expect(getPostsFirstPageHref({ page: "3" })).toBe("/dashboard/posts");
  });

  it("keeps sort, order and filters in their original order, encoded as a query string", () => {
    expect(
      getPostsFirstPageHref({
        page: "2",
        sort: "views",
        order: "asc",
        types: "TEXT,IMAGE",
        from: "2026-01-01",
        to: "2026-02-01",
      }),
    ).toBe(
      "/dashboard/posts?sort=views&order=asc&types=TEXT%2CIMAGE&from=2026-01-01&to=2026-02-01",
    );
  });

  it("leaves the other params in place when page sits in the middle", () => {
    expect(
      getPostsFirstPageHref({ sort: "likes", page: "4", order: "asc" }),
    ).toBe("/dashboard/posts?sort=likes&order=asc");
  });

  it("repeats the key once per element of an array value", () => {
    expect(getPostsFirstPageHref({ types: ["TEXT", "IMAGE"] })).toBe(
      "/dashboard/posts?types=TEXT&types=IMAGE",
    );
  });

  it("skips undefined values", () => {
    expect(
      getPostsFirstPageHref({ sort: undefined, order: "asc", from: undefined }),
    ).toBe("/dashboard/posts?order=asc");
    expect(getPostsFirstPageHref({ sort: undefined })).toBe("/dashboard/posts");
  });

  it("drops page even when it is an array", () => {
    expect(getPostsFirstPageHref({ page: ["2", "3"], sort: "likes" })).toBe(
      "/dashboard/posts?sort=likes",
    );
    expect(getPostsFirstPageHref({ page: ["2", "3"] })).toBe(
      "/dashboard/posts",
    );
  });

  it("returns the bare posts path when an array value is empty", () => {
    expect(getPostsFirstPageHref({ types: [] })).toBe("/dashboard/posts");
  });

  it("encodes characters that would otherwise change the query", () => {
    expect(getPostsFirstPageHref({ from: "a&b=c d" })).toBe(
      "/dashboard/posts?from=a%26b%3Dc+d",
    );
  });
});
