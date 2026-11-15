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

  it("returns 500 quota_check_failed when the lookup throws, and logs only the message", async () => {
    const failure = new Error("database down");
    mocks.getDeleteQuotaForUser.mockRejectedValue(failure);

    const response = await callGet();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "quota_check_failed",
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [loggedArguments] = errorSpy.mock.calls;
    expect(loggedArguments).toHaveLength(1);
    expect(loggedArguments[0]).toEqual(expect.any(String));
    expect(loggedArguments[0]).toContain("database down");
    expect(loggedArguments).not.toContain(failure);
  });

  it("returns 500 quota_check_failed when something other than an Error is thrown", async () => {
    mocks.getDeleteQuotaForUser.mockRejectedValue("not an error object");

    const response = await callGet();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "quota_check_failed",
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
