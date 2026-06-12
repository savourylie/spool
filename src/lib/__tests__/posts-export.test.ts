import { describe, expect, it } from "vitest";
import {
  buildPostsExportCsv,
  computeEngagementRate,
  escapeCsvField,
  type ExportPostRow,
} from "../posts-export";

function makeRow(overrides: Partial<ExportPostRow> = {}): ExportPostRow {
  return {
    threads_media_id: "17890000000000001",
    media_type: "TEXT",
    text_full: "Hello world",
    text_preview: "Hello world",
    permalink: "https://www.threads.net/@user/post/ABC123",
    topic_tag: null,
    published_at: "2026-05-01T10:00:00+00:00",
    views: 1000,
    likes: 30,
    replies: 10,
    reposts: 5,
    quotes: 3,
    shares: 2,
    fetched_at: "2026-06-01T00:00:00+00:00",
    ...overrides,
  };
}

describe("escapeCsvField", () => {
  it("passes through plain values unchanged", () => {
    expect(escapeCsvField("hello")).toBe("hello");
    expect(escapeCsvField("emoji 🎉 ok")).toBe("emoji 🎉 ok");
  });

  it("quotes fields containing commas", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("quotes fields containing newlines", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvField("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("quotes and doubles embedded double quotes", () => {
    expect(escapeCsvField('she said "hi"')).toBe('"she said ""hi"""');
  });
});

describe("computeEngagementRate", () => {
  it("computes (likes+replies+reposts+quotes+shares)/views as a percentage", () => {
    // (30+10+5+3+2)/1000 * 100 = 5
    expect(computeEngagementRate(makeRow())).toBe("5.00");
  });

  it("returns empty string when views is 0", () => {
    expect(computeEngagementRate(makeRow({ views: 0 }))).toBe("");
  });

  it("returns empty string when there is no metrics snapshot", () => {
    expect(
      computeEngagementRate(
        makeRow({
          views: null,
          likes: null,
          replies: null,
          reposts: null,
          quotes: null,
          shares: null,
          fetched_at: null,
        }),
      ),
    ).toBe("");
  });

  it("treats null individual metrics as 0 when views are present", () => {
    expect(
      computeEngagementRate(makeRow({ likes: null, quotes: null })),
    ).toBe("1.70"); // (0+10+5+0+2)/1000 * 100
  });
});

describe("buildPostsExportCsv", () => {
  const HEADER =
    "published_at,media_type,text,permalink,topic_tag," +
    "views,likes,replies,reposts,quotes,shares," +
    "engagement_rate,metrics_fetched_at,threads_media_id";

  it("returns only the header row for an empty list", () => {
    expect(buildPostsExportCsv([])).toBe(HEADER + "\r\n");
  });

  it("renders one row per post with all columns", () => {
    const csv = buildPostsExportCsv([makeRow()]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe(
      "2026-05-01T10:00:00+00:00,TEXT,Hello world," +
        "https://www.threads.net/@user/post/ABC123,," +
        "1000,30,10,5,3,2,5.00," +
        "2026-06-01T00:00:00+00:00,17890000000000001",
    );
    expect(lines[2]).toBe("");
    expect(lines).toHaveLength(3); // header, row, trailing empty from final CRLF
  });

  it("uses text_full and falls back to text_preview when text_full is null", () => {
    const csv = buildPostsExportCsv([
      makeRow({ text_full: "full text", text_preview: "preview" }),
      makeRow({ text_full: null, text_preview: "preview only" }),
      makeRow({ text_full: null, text_preview: null }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toContain("full text");
    expect(lines[2]).toContain("preview only");
    expect(lines[3].split(",")[2]).toBe("");
  });

  it("escapes post text containing commas, quotes, and newlines", () => {
    const csv = buildPostsExportCsv([
      makeRow({ text_full: 'Hot take, really:\n"npm > pnpm"' }),
    ]);
    expect(csv).toContain('"Hot take, really:\n""npm > pnpm"""');
  });

  it("renders empty metric columns for posts without a snapshot", () => {
    const csv = buildPostsExportCsv([
      makeRow({
        views: null,
        likes: null,
        replies: null,
        reposts: null,
        quotes: null,
        shares: null,
        fetched_at: null,
      }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe(
      "2026-05-01T10:00:00+00:00,TEXT,Hello world," +
        "https://www.threads.net/@user/post/ABC123,," +
        ",,,,,,," +
        ",17890000000000001",
    );
  });
});
