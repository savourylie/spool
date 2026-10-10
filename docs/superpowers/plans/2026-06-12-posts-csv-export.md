# Posts CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Export CSV" button to the dashboard Posts page that downloads all of the user's posts with their latest metrics as a CSV file for AI analysis.

**Architecture:** A new SQL RPC (`export_posts_with_latest_metrics`) returns every post for a user joined with its most recent `post_metrics` snapshot. A new API route `GET /api/export/posts` authenticates via the existing session cookie, calls the RPC with the admin Supabase client, and serializes rows to RFC 4180 CSV using a small pure library in `src/lib/posts-export.ts` (unit-tested). The Posts page header gets an anchor-tag download button.

**Tech Stack:** Next.js 16 App Router (route handlers), Supabase (SQL migration + RPC), Vitest, Phosphor icons, cva `buttonVariants`.

**Spec:** `docs/superpowers/specs/2026-06-12-posts-csv-export-design.md`

**Prerequisites:**
- Local Supabase stack running for Task 2: `npm run db:start`
- Known pre-existing issue: `npx tsc --noEmit` reports a type error in `src/app/dev/backfills/page.tsx`. This predates this feature — ignore that one error; do not fix it and do not let it block any step.

**Conventions used below:**
- The codebase calls RPCs with `supabase.rpc("name" as never, args as never)` casts (see `src/app/dashboard/posts/page.tsx:85-94`). Follow that pattern; do not regenerate `database.types.ts`.
- `engagement_rate` in the CSV is a **percentage** rounded to 2 decimals — `(likes + replies + reposts + quotes + shares) / views * 100` — matching how the dashboard's `get_posts_with_metrics` RPC computes it, so users can spot-check the CSV against the dashboard. Empty string (not `0`, never `NaN`) when there is no metrics snapshot or `views` is 0.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/posts-export.ts` | Create | Pure CSV logic: row type, field escaping, engagement rate, CSV assembly |
| `src/lib/__tests__/posts-export.test.ts` | Create | Unit tests for the above |
| `supabase/migrations/20260612000000_export_posts_with_latest_metrics.sql` | Create | RPC returning all posts + latest metrics for a user |
| `src/app/api/export/posts/route.ts` | Create | Auth, RPC call, CSV response with download headers |
| `src/app/dashboard/posts/page.tsx` | Modify | Add "Export CSV" button to `ScreenHead` actions |

---

### Task 1: CSV export library (`posts-export.ts`)

Pure functions, no I/O — this is where all the fiddly logic lives, so it gets full TDD.

**Files:**
- Create: `src/lib/posts-export.ts`
- Test: `src/lib/__tests__/posts-export.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/posts-export.test.ts` with exactly:

```typescript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/__tests__/posts-export.test.ts`
Expected: FAIL — `Cannot find module '../posts-export'` (or similar resolution error).

- [ ] **Step 3: Write the implementation**

Create `src/lib/posts-export.ts` with exactly:

```typescript
/**
 * CSV export of posts with their latest metrics snapshot.
 * Shape matches the export_posts_with_latest_metrics RPC; metric
 * columns are null for posts that have no snapshot yet.
 */
export interface ExportPostRow {
  threads_media_id: string;
  media_type: string;
  text_full: string | null;
  text_preview: string | null;
  permalink: string | null;
  topic_tag: string | null;
  published_at: string;
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  shares: number | null;
  fetched_at: string | null;
}

const CSV_HEADER = [
  "published_at",
  "media_type",
  "text",
  "permalink",
  "topic_tag",
  "views",
  "likes",
  "replies",
  "reposts",
  "quotes",
  "shares",
  "engagement_rate",
  "metrics_fetched_at",
  "threads_media_id",
] as const;

/** RFC 4180: quote fields containing commas, quotes, or line breaks. */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Engagement rate as a percentage string with 2 decimals, matching the
 * dashboard's get_posts_with_metrics formula. Empty string when there
 * is no snapshot or no views — distinguishable from a true 0.
 */
export function computeEngagementRate(row: ExportPostRow): string {
  if (row.views === null || row.views === 0) {
    return "";
  }
  const interactions =
    (row.likes ?? 0) +
    (row.replies ?? 0) +
    (row.reposts ?? 0) +
    (row.quotes ?? 0) +
    (row.shares ?? 0);
  return ((interactions / row.views) * 100).toFixed(2);
}

export function buildPostsExportCsv(rows: ExportPostRow[]): string {
  const metric = (value: number | null) =>
    value === null ? "" : String(value);

  const lines = [CSV_HEADER.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvField(row.published_at),
        escapeCsvField(row.media_type),
        escapeCsvField(row.text_full ?? row.text_preview ?? ""),
        escapeCsvField(row.permalink ?? ""),
        escapeCsvField(row.topic_tag ?? ""),
        metric(row.views),
        metric(row.likes),
        metric(row.replies),
        metric(row.reposts),
        metric(row.quotes),
        metric(row.shares),
        computeEngagementRate(row),
        escapeCsvField(row.fetched_at ?? ""),
        escapeCsvField(row.threads_media_id),
      ].join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/__tests__/posts-export.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS (no other suite touched).

- [ ] **Step 6: Commit**

```bash
git add src/lib/posts-export.ts src/lib/__tests__/posts-export.test.ts
git commit -m "feat: CSV serialization for posts export"
```

---

### Task 2: Database migration — `export_posts_with_latest_metrics` RPC

**Files:**
- Create: `supabase/migrations/20260612000000_export_posts_with_latest_metrics.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260612000000_export_posts_with_latest_metrics.sql` with exactly:

```sql
-- All of a user's posts joined with the latest post_metrics snapshot,
-- for the CSV export endpoint. LEFT JOIN keeps posts that have no
-- snapshot yet (metric columns come back null, not 0 — the export
-- distinguishes "no data" from a true zero).
create or replace function export_posts_with_latest_metrics(p_user_id uuid)
returns table (
  threads_media_id text,
  media_type text,
  text_full text,
  text_preview text,
  permalink text,
  topic_tag text,
  published_at timestamptz,
  views int,
  likes int,
  replies int,
  reposts int,
  quotes int,
  shares int,
  fetched_at timestamptz
)
language sql stable
as $$
  with latest_metrics as (
    select distinct on (pm.post_id)
      pm.post_id,
      pm.views,
      pm.likes,
      pm.replies,
      pm.reposts,
      pm.quotes,
      pm.shares,
      pm.fetched_at
    from post_metrics pm
    inner join posts p on p.id = pm.post_id
    where p.user_id = p_user_id
    order by pm.post_id, pm.fetched_at desc
  )
  select
    p.threads_media_id,
    p.media_type,
    p.text_full,
    p.text_preview,
    p.permalink,
    p.topic_tag,
    p.published_at,
    m.views,
    m.likes,
    m.replies,
    m.reposts,
    m.quotes,
    m.shares,
    m.fetched_at
  from posts p
  left join latest_metrics m on m.post_id = p.id
  where p.user_id = p_user_id
  order by p.published_at desc;
$$;
```

Note: if creation fails with a type mismatch on the metric columns (e.g. "returned type bigint does not match expected type integer"), check the `post_metrics` column types in `supabase/migrations/20260316083909_initial_schema.sql` and match the `returns table` declarations to them.

- [ ] **Step 2: Apply the migration locally**

The local stack must be running (`npm run db:start` if not).

Run: `npx supabase migration up`
Expected: output includes `Applying migration 20260612000000_export_posts_with_latest_metrics.sql`, no errors.

Do **not** use `npm run db:reset` — it wipes local data, which may include backfilled real posts.

- [ ] **Step 3: Smoke-test the function exists**

Run:
```bash
npx supabase status # confirm DB URL, default is port 54322
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select export_posts_with_latest_metrics('00000000-0000-0000-0000-000000000000');"
```
Expected: empty result set (0 rows), **no error** — proves the function compiles and runs. (If `psql` is not installed, skip this step; Step 2's clean apply plus Task 5's end-to-end check cover it.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260612000000_export_posts_with_latest_metrics.sql
git commit -m "feat: export_posts_with_latest_metrics RPC"
```

---

### Task 3: API route — `GET /api/export/posts`

**Files:**
- Create: `src/app/api/export/posts/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/export/posts/route.ts` with exactly:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import {
  buildPostsExportCsv,
  type ExportPostRow,
} from "@/lib/posts-export";

export async function GET(request: NextRequest) {
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = (await supabase.rpc(
    "export_posts_with_latest_metrics" as never,
    { p_user_id: userId } as never,
  )) as unknown as {
    data: ExportPostRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("Posts export failed:", error.message);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }

  const csv = buildPostsExportCsv(data ?? []);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="spool-posts-export-${date}.csv"`,
    },
  });
}
```

(The `as never` casts on `rpc()` follow the existing convention in `src/app/dashboard/posts/page.tsx:85-94` — generated DB types don't cover these RPC signatures.)

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: only the known pre-existing error in `src/app/dev/backfills/page.tsx`. No errors in `src/app/api/export/posts/route.ts` or `src/lib/posts-export.ts`.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Verify auth gate works**

With the dev server running (`npm run dev`):

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/export/posts`
Expected: `401`

(The authenticated path is exercised end-to-end in Task 5 — it needs a real logged-in browser session.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/export/posts/route.ts
git commit -m "feat: posts CSV export API route"
```

---

### Task 4: Export button on the Posts page

**Files:**
- Modify: `src/app/dashboard/posts/page.tsx` (imports at top; `ScreenHead` at lines ~130-138)

`ScreenHead` (`src/components/dashboard/screen-head.tsx`) already supports an `actions` prop rendered right-aligned on the header rule — the page just doesn't pass one yet. The button is a plain anchor styled with `buttonVariants` (the `Button` component renders a base-ui `<button>`, which can't navigate/download; an `<a>` with the same classes is the server-component-friendly way).

- [ ] **Step 1: Add the imports**

In `src/app/dashboard/posts/page.tsx`, add to the import block at the top:

```typescript
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { buttonVariants } from "@/components/ui/button-variants";
```

- [ ] **Step 2: Add the actions prop to ScreenHead**

Change the existing `<ScreenHead ...>` call from:

```tsx
      <ScreenHead
        eyebrow="All · your library"
        title={
          <span className="flex items-center gap-3">
            {totalCount.toLocaleString()} posts
            <ConfidenceBadge sample={totalCount} compact />
          </span>
        }
      />
```

to:

```tsx
      <ScreenHead
        eyebrow="All · your library"
        title={
          <span className="flex items-center gap-3">
            {totalCount.toLocaleString()} posts
            <ConfidenceBadge sample={totalCount} compact />
          </span>
        }
        actions={
          <a
            href="/api/export/posts"
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <DownloadSimple weight="bold" className="size-3.5" />
            Export CSV
          </a>
        }
      />
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: only the known pre-existing `src/app/dev/backfills/page.tsx` error.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Visual check**

With `npm run dev` running and a logged-in session, open `http://localhost:3000/dashboard/posts`.
Expected: an outlined "Export CSV" button with a download icon sits right-aligned in the page header, baseline-aligned with the title, matching the Editorial Utility button style.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/posts/page.tsx
git commit -m "feat: Export CSV button on posts page"
```

---

### Task 5: End-to-end verification

No seed data exists in this project — this runs against a real logged-in Threads account (per spec).

- [ ] **Step 1: Run the full automated suite**

```bash
npm test && npm run lint
```
Expected: all tests pass, no new lint errors.

- [ ] **Step 2: Manual verification checklist**

1. Log in, open `/dashboard/posts`, click **Export CSV**.
2. File downloads as `spool-posts-export-<today>.csv` and opens cleanly in a spreadsheet app or text editor.
3. Row count (excluding header) matches the posts total shown in the page title.
4. Spot-check one post: its `views`/`likes`/`engagement_rate` in the CSV match the dashboard table.
5. Confirm a post with commas/newlines/emoji in its text round-trips as a single, correctly quoted row.
6. Smoke test the actual use case: upload the CSV to an AI chat (Claude/ChatGPT) and ask e.g. "which of my posts had the highest engagement rate?"

- [ ] **Step 3: Report results**

Report any mismatches against the spec (`docs/superpowers/specs/2026-06-12-posts-csv-export-design.md`) before considering the feature done.
