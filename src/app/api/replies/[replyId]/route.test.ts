import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateResult: { data: null as unknown, error: null as unknown },
  updates: [] as Array<{
    table: string;
    payload: unknown;
    filters: Array<[string, unknown]>;
    selected: string | null;
  }>,
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      update: (payload: unknown) => {
        const record = {
          table,
          payload,
          filters: [] as Array<[string, unknown]>,
          selected: null as string | null,
        };
        mocks.updates.push(record);
        const query = {
          eq: (column: string, value: unknown) => {
            record.filters.push([column, value]);
            return query;
          },
          select: (columns: string) => {
            record.selected = columns;
            return query;
          },
          maybeSingle: () => Promise.resolve(mocks.updateResult),
        };
        return query;
      },
    }),
  }),
}));

import { PATCH } from "./route";

function patchRequest(body: string) {
  return new NextRequest("http://localhost/api/replies/reply-row-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

const routeContext = { params: Promise.resolve({ replyId: "reply-row-1" }) };

describe("reply review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updates.length = 0;
    mocks.getSession.mockReturnValue("user-uuid");
    mocks.updateResult = {
      data: { id: "reply-row-1", review_status: "reviewed" },
      error: null,
    };
  });

  it.each([
    ["reviewed"],
    ["needs_review"],
  ])("sets the review status to %s on the current user's reply", async (status) => {
    mocks.updateResult = {
      data: { id: "reply-row-1", review_status: status },
      error: null,
    };

    const response = await PATCH(
      patchRequest(JSON.stringify({ reviewStatus: status })),
      routeContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "reply-row-1",
      reviewStatus: status,
    });
    expect(mocks.updates).toEqual([
      {
        table: "user_replies",
        payload: { review_status: status },
        filters: [
          ["id", "reply-row-1"],
          ["user_id", "user-uuid"],
        ],
        selected: "id, review_status",
      },
    ]);
  });

  it("rejects unauthenticated requests without writing", async () => {
    mocks.getSession.mockReturnValue(null);

    const response = await PATCH(
      patchRequest(JSON.stringify({ reviewStatus: "reviewed" })),
      routeContext,
    );

    expect(response.status).toBe(401);
    expect(mocks.updates).toHaveLength(0);
  });

  it.each([
    ["an unknown status", JSON.stringify({ reviewStatus: "approved" })],
    ["a missing status", JSON.stringify({})],
    ["a malformed body", "{not json"],
  ])("rejects %s without writing", async (_label, body) => {
    const response = await PATCH(patchRequest(body), routeContext);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid review status",
    });
    expect(mocks.updates).toHaveLength(0);
  });

  it("returns 404 when the reply does not belong to the current user", async () => {
    mocks.updateResult = { data: null, error: null };

    const response = await PATCH(
      patchRequest(JSON.stringify({ reviewStatus: "reviewed" })),
      routeContext,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Reply not found" });
  });

  it("returns 500 when the update fails", async () => {
    mocks.updateResult = { data: null, error: { message: "db down" } };

    const response = await PATCH(
      patchRequest(JSON.stringify({ reviewStatus: "reviewed" })),
      routeContext,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to update reply",
    });
  });
});
