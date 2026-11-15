import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  deletePostForUser: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/post-delete", () => ({
  deletePostForUser: mocks.deletePostForUser,
}));

import { DELETE } from "./route";

const POST_ID = "22222222-2222-4222-8222-222222222222";

function callDelete(postId = POST_ID) {
  return DELETE(
    new NextRequest(`http://localhost/api/posts/${postId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ postId }) },
  );
}

describe("post delete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockReturnValue("user-uuid");
    mocks.deletePostForUser.mockResolvedValue({ ok: true });
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getSession.mockReturnValue(null);

    const response = await callDelete();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(mocks.deletePostForUser).not.toHaveBeenCalled();
  });

  it("deletes the post from the URL for the session user", async () => {
    const response = await callDelete(POST_ID);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
    expect(mocks.deletePostForUser).toHaveBeenCalledTimes(1);
    expect(mocks.deletePostForUser).toHaveBeenCalledWith("user-uuid", POST_ID);
  });

  it.each([
    {
      code: "not_found",
      status: 404,
      message: "This post is no longer in Spool.",
    },
    {
      code: "import_in_progress",
      status: 409,
      message: "Deleting is paused while posts are importing.",
    },
    {
      code: "reconnect_required",
      status: 403,
      message: "Reconnect Threads to delete posts.",
    },
    {
      code: "threads_error",
      status: 502,
      message: "Boom",
    },
    {
      code: "spool_cleanup_failed",
      status: 500,
      message: "Deleted from Threads, but Spool couldn't remove it.",
    },
  ])(
    "maps a $code result to status $status with its error and message",
    async ({ code, status, message }) => {
      mocks.deletePostForUser.mockResolvedValue({
        ok: false,
        code,
        status,
        message,
      });

      const response = await callDelete();

      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({
        error: code,
        message,
      });
    },
  );

  it("lets an unexpected failure propagate, so Next answers with its default 500", async () => {
    mocks.deletePostForUser.mockRejectedValue(new Error("database down"));

    await expect(callDelete()).rejects.toThrow("database down");
  });
});
