import { describe, expect, it } from "vitest";

import {
  getLinkSiteName,
  parseYouTubeUrl,
} from "../link-preview";

describe("parseYouTubeUrl", () => {
  it("parses watch, short and shorts URLs", () => {
    const watch = parseYouTubeUrl(
      "https://www.youtube.com/watch?v=lHw6yoyPkpo&t=42s",
    );
    expect(watch?.id).toBe("lHw6yoyPkpo");
    expect(watch?.thumbnailUrl).toBe(
      "https://i.ytimg.com/vi/lHw6yoyPkpo/hqdefault.jpg",
    );

    expect(parseYouTubeUrl("https://youtu.be/BsfjQDSeTwI?si=abc")?.id).toBe(
      "BsfjQDSeTwI",
    );
    expect(parseYouTubeUrl("https://youtube.com/shorts/abc123XYZ_-")?.id).toBe(
      "abc123XYZ_-",
    );
  });

  it("ignores non-YouTube hosts and malformed values", () => {
    expect(parseYouTubeUrl("https://vimeo.com/12345")).toBeNull();
    expect(parseYouTubeUrl("not a url")).toBeNull();
    expect(parseYouTubeUrl("ftp://youtube.com/watch?v=abc123")).toBeNull();
    expect(parseYouTubeUrl("https://youtube.com/watch?v=")).toBeNull();
  });
});

describe("getLinkSiteName", () => {
  it("strips www and returns the host", () => {
    expect(getLinkSiteName("https://www.threads.com/@user/post/1")).toBe(
      "threads.com",
    );
    expect(getLinkSiteName("bad value")).toBeNull();
  });
});
