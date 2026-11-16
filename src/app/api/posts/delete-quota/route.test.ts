import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getDeleteQuotaForUser: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/post-delete", () => ({
  getDeleteQuotaForUser: mocks.getDeleteQuotaForUser,
}));

import { GET } from "./route";

function callGet() {
  return GET(new NextRequest("http://localhost/api/posts/delete-quota"));
}

describe("post delete quota route", () => {
  let errorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockReturnValue("user-uuid");
    mocks.getDeleteQuotaForUser.mockResolvedValue({
      permitted: true,
      used: 3,
      total: 100,
      remaining: 97,
    });
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getSession.mockReturnValue(null);

    const response = await callGet();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(mocks.getDeleteQuotaForUser).not.toHaveBeenCalled();
  });

  it.each([
    { permitted: true, used: 3, total: 100, remaining: 97 },
    { permitted: false },
  ])("returns the quota for the session user: %j", async (quota) => {
    mocks.getDeleteQuotaForUser.mockResolvedValue(quota);

    const response = await callGet();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(quota);
    expect(mocks.getDeleteQuotaForUser).toHaveBeenCalledTimes(1);
    expect(mocks.getDeleteQuotaForUser).toHaveBeenCalledWith("user-uuid");
  });

  it.each([
    {
      // postgrest-js returns a failed query's error as a plain object, not an
      // Error, so this is what a database failure looks like if it is thrown
      // as is.
      label: "a plain database error object",
      thrown: {
        code: "42P01",
        details: null,
        hint: null,
        message: 'relation "users" does not exist',
      },
      logged: 'Delete quota check failed: relation "users" does not exist',
    },
    {
      label: "an Error",
      thrown: new Error("Failed to load user: users read failed"),
      logged:
        "Delete quota check failed: Failed to load user: users read failed",
    },
    {
      label: "a string",
      thrown: "not an error object",
      logged: "Delete quota check failed: Unknown error",
    },
    {
      label: "an object whose message is not a string",
      thrown: { code: "42P01", message: 42 },
      logged: "Delete quota check failed: Unknown error",
    },
    {
      label: "null",
      thrown: null,
      logged: "Delete quota check failed: Unknown error",
    },
  ])(
    "returns 500 quota_check_failed and logs only the message when the lookup throws $label",
    async ({ thrown, logged }) => {
      mocks.getDeleteQuotaForUser.mockRejectedValue(thrown);

      const response = await callGet();

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: "quota_check_failed",
      });

      // Exactly one call with a single string argument: never the thrown
      // value itself, which can carry request details.
      expect(errorSpy.mock.calls).toStrictEqual([[logged]]);
    },
  );
});
