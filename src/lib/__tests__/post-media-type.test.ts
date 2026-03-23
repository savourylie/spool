import { describe, expect, it } from "vitest";
import { normalizeThreadsMediaType } from "../post-media-type";

describe("normalizeThreadsMediaType", () => {
  it("passes through stored media types", () => {
    expect(normalizeThreadsMediaType("TEXT")).toBe("TEXT");
    expect(normalizeThreadsMediaType("IMAGE")).toBe("IMAGE");
    expect(normalizeThreadsMediaType("VIDEO")).toBe("VIDEO");
    expect(normalizeThreadsMediaType("CAROUSEL")).toBe("CAROUSEL");
  });

  it("maps Threads *_POST media types to stored media types", () => {
    expect(normalizeThreadsMediaType("TEXT_POST")).toBe("TEXT");
    expect(normalizeThreadsMediaType("IMAGE_POST")).toBe("IMAGE");
    expect(normalizeThreadsMediaType("VIDEO_POST")).toBe("VIDEO");
    expect(normalizeThreadsMediaType("CAROUSEL_POST")).toBe("CAROUSEL");
  });

  it("maps carousel album media types to stored carousel posts", () => {
    expect(normalizeThreadsMediaType("CAROUSEL_ALBUM")).toBe("CAROUSEL");
  });

  it("throws on unsupported media types", () => {
    expect(() => normalizeThreadsMediaType("REPOST_FACADE")).toThrow(
      "Unsupported Threads media type: REPOST_FACADE",
    );
  });
});
