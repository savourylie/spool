import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { ThreadsAPIError } from "@/lib/threads";
import { getThreadsErrorMessage } from "@/lib/threads-api";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const POST_ID = "22222222-2222-4222-8222-222222222222";
const MEDIA_ID = "17900000000000001";
const THREADS_USER_ID = "threads-123";
const ENCRYPTED_TOKEN = "encrypted-token";
const DECRYPTED_TOKEN = "decrypted-token";
const THREADS_FAILURE_LOG = "Threads delete not confirmed; post kept in Spool";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  decrypt: vi.fn(),
  getMostRecentBackfillJob: vi.fn(),
  deletePost: vi.fn(),
  getDeleteQuota: vi.fn(),
  ThreadsAPI: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: mocks.decrypt,
}));

vi.mock("@/lib/backfill-recovery", () => ({
  getMostRecentBackfillJob: mocks.getMostRecentBackfillJob,
}));

// Only ThreadsAPI is replaced. The real getThreadsErrorMessage stays, because
// the message of a failed delete comes from it.
vi.mock("@/lib/threads-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/threads-api")>()),
  ThreadsAPI: mocks.ThreadsAPI,
}));

import { deletePostForUser, getDeleteQuotaForUser } from "../post-delete";

// --- Supabase query recorder -------------------------------------------------
//
// Every query is recorded with its table, operation, payload and `.eq()`
// filters, so the tests can check what was read or written and for whom. A
// query settles with the result configured under "<table>.<op>".
//
// A failed query's `error` is a plain `{ message }` object, as postgrest-js
// returns it. It is never an Error instance, so the code under test must not
// rely on `instanceof Error` to read it.

type QueryResult = { data: unknown; error: unknown };

type QueryRecord = {
  table: string;
  op: "select" | "update" | "delete";
  payload?: unknown;
  filters: [column: string, value: unknown][];
};

interface MockQuery extends PromiseLike<QueryResult> {
  select(fields: string): MockQuery;
  update(values: unknown): MockQuery;
  delete(): MockQuery;
  eq(column: string, value: unknown): MockQuery;
  maybeSingle(): Promise<QueryResult>;
  single(): Promise<QueryResult>;
}

let queries: QueryRecord[];
let results: Record<string, QueryResult>;
// Everything that touches Supabase, Threads or the backfill lookup, in the
// order it happened.
let events: string[];
let errorSpy: MockInstance<typeof console.error>;

function createQuery(table: string): MockQuery {
  const record: QueryRecord = { table, op: "select", filters: [] };
  queries.push(record);

  const settle = () => {
    events.push(`${table}.${record.op}`);
    return Promise.resolve(results[`${table}.${record.op}`]);
  };

  const query: MockQuery = {
    select(fields) {
      record.op = "select";
      record.payload = fields;
      return query;
    },
    update(values) {
      record.op = "update";
      record.payload = values;
      return query;
    },
    delete() {
      record.op = "delete";
      return query;
    },
    eq(column, value) {
      record.filters.push([column, value]);
      return query;
    },
    maybeSingle: settle,
    single: settle,
    then: (onFulfilled, onRejected) => settle().then(onFulfilled, onRejected),
  };

  return query;
}

function writes() {
  return queries.filter((query) => query.op !== "select");
}

function userRow(tokenExpiresAt: Date) {
  return {
    threads_user_id: THREADS_USER_ID,
    access_token: ENCRYPTED_TOKEN,
    token_expires_at: tokenExpiresAt.toISOString(),
  };
}

function inOneDay() {
  return new Date(Date.now() + 86_400_000);
}

function aMinuteAgo() {
  return new Date(Date.now() - 60_000);
}

function failThreadsDelete(error: unknown) {
  mocks.deletePost.mockImplementation(async () => {
    events.push("threads.deletePost");
    throw error;
  });
}

function loggedErrors() {
  return JSON.stringify(errorSpy.mock.calls);
}

// Resolves to whatever the promise rejects with, so a test can check both the
// type and the message of the thrown value.
async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("Expected the promise to reject");
}

beforeEach(() => {
  vi.clearAllMocks();

  queries = [];
  events = [];
  results = {
    "posts.select": {
      data: { id: POST_ID, threads_media_id: MEDIA_ID },
      error: null,
    },
    "users.select": { data: userRow(inOneDay()), error: null },
    "post_predictions.update": { data: null, error: null },
    "posts.delete": { data: null, error: null },
  };

  mocks.from.mockImplementation((table: string) => createQuery(table));
  mocks.decrypt.mockReturnValue(DECRYPTED_TOKEN);
  mocks.getMostRecentBackfillJob.mockImplementation(async () => {
    events.push("backfill.check");
    return null;
  });
  mocks.deletePost.mockImplementation(async () => {
    events.push("threads.deletePost");
  });
  mocks.getDeleteQuota.mockResolvedValue({
    permitted: true,
    used: 3,
    total: 100,
    remaining: 97,
  });
  mocks.ThreadsAPI.mockImplementation(function () {
    return {
      deletePost: mocks.deletePost,
      getDeleteQuota: mocks.getDeleteQuota,
    };
  });

  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("deletePostForUser", () => {
  describe("loading the post", () => {
    it("looks the post up by id and by the session user, selecting only the columns it needs", async () => {
      await deletePostForUser(USER_ID, POST_ID);

      expect(queries[0]).toEqual({
        table: "posts",
        op: "select",
        payload: "id, threads_media_id",
        filters: [
          ["id", POST_ID],
          ["user_id", USER_ID],
        ],
      });
    });

    it("returns not_found when the user has no such post, and goes no further", async () => {
      results["posts.select"] = { data: null, error: null };

      await expect(deletePostForUser(USER_ID, POST_ID)).resolves.toEqual({
        ok: false,
        code: "not_found",
        status: 404,
        message: "This post is no longer in Spool.",
      });

      expect(mocks.getMostRecentBackfillJob).not.toHaveBeenCalled();
      expect(mocks.ThreadsAPI).not.toHaveBeenCalled();
      expect(mocks.deletePost).not.toHaveBeenCalled();
      expect(writes()).toEqual([]);
    });

    it.each([
      "not-a-uuid",
      "",
      "12345",
      "22222222222222222222222222222222",
      `${POST_ID}0`,
      ` ${POST_ID}`,
      "22222222-2222-4222-8222-22222222222g",
      "1; drop table posts",
    ])(
      "returns not_found for the malformed id %j without querying",
      async (malformedId) => {
        await expect(
          deletePostForUser(USER_ID, malformedId),
        ).resolves.toEqual({
          ok: false,
          code: "not_found",
          status: 404,
          message: "This post is no longer in Spool.",
        });

        expect(mocks.from).not.toHaveBeenCalled();
        expect(mocks.getMostRecentBackfillJob).not.toHaveBeenCalled();
        expect(mocks.deletePost).not.toHaveBeenCalled();
      },
    );

    it("throws when loading the post fails, instead of reporting the post as gone", async () => {
      results["posts.select"] = {
        data: null,
        error: { message: "connection reset" },
      };

      const thrown = await rejectionOf(deletePostForUser(USER_ID, POST_ID));

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe(
        "Failed to load post: connection reset",
      );
      expect(mocks.getMostRecentBackfillJob).not.toHaveBeenCalled();
      expect(mocks.deletePost).not.toHaveBeenCalled();
      expect(writes()).toEqual([]);
    });
  });

  describe("while posts are importing", () => {
    it.each(["pending", "running"])(
      "returns import_in_progress when the most recent backfill job is %s",
      async (status) => {
        mocks.getMostRecentBackfillJob.mockResolvedValue({ status });

        await expect(deletePostForUser(USER_ID, POST_ID)).resolves.toEqual({
          ok: false,
          code: "import_in_progress",
          status: 409,
          message: "Deleting is paused while posts are importing.",
        });

        expect(mocks.ThreadsAPI).not.toHaveBeenCalled();
        expect(mocks.deletePost).not.toHaveBeenCalled();
        expect(writes()).toEqual([]);
      },
    );

    it("asks for the user's most recent backfill job, whatever its status", async () => {
      await deletePostForUser(USER_ID, POST_ID);

      expect(mocks.getMostRecentBackfillJob).toHaveBeenCalledTimes(1);
      expect(mocks.getMostRecentBackfillJob).toHaveBeenCalledWith(
        expect.anything(),
        USER_ID,
      );
    });

    it.each(["failed", "complete"])(
      "does not block when the most recent backfill job is %s",
      async (status) => {
        mocks.getMostRecentBackfillJob.mockResolvedValue({ status });

        await expect(deletePostForUser(USER_ID, POST_ID)).resolves.toEqual({
          ok: true,
        });

        expect(mocks.deletePost).toHaveBeenCalledWith(MEDIA_ID);
      },
    );

    it.each([
      {
        label: "a plain database error object",
        thrown: { message: "backfill lookup failed" },
        message: "Failed to check backfill status: backfill lookup failed",
      },
      {
        label: "an Error",
        thrown: new Error("backfill lookup failed"),
        message: "Failed to check backfill status: backfill lookup failed",
      },
      {
        label: "something without a message",
        thrown: "nope",
        message: "Failed to check backfill status: Unknown error",
      },
    ])(
      "fails closed when the backfill lookup itself fails ($label)",
      async ({ thrown, message }) => {
        mocks.getMostRecentBackfillJob.mockRejectedValue(thrown);

        const error = await rejectionOf(deletePostForUser(USER_ID, POST_ID));

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(message);
        expect(mocks.deletePost).not.toHaveBeenCalled();
        expect(writes()).toEqual([]);
      },
    );
  });

  describe("the Threads token", () => {
    it("reads only the columns it needs from the user row", async () => {
      await deletePostForUser(USER_ID, POST_ID);

      const userQuery = queries.find((query) => query.table === "users");
      expect(userQuery).toEqual({
        table: "users",
        op: "select",
        payload: "threads_user_id, access_token, token_expires_at",
        filters: [["id", USER_ID]],
      });
    });

    it("returns reconnect_required when the token has expired, without calling Threads", async () => {
      results["users.select"] = {
        data: userRow(aMinuteAgo()),
        error: null,
      };

      await expect(deletePostForUser(USER_ID, POST_ID)).resolves.toEqual({
        ok: false,
        code: "reconnect_required",
        status: 403,
        message: "Reconnect Threads to delete posts.",
      });

      expect(mocks.decrypt).not.toHaveBeenCalled();
      expect(mocks.ThreadsAPI).not.toHaveBeenCalled();
      expect(mocks.deletePost).not.toHaveBeenCalled();
      expect(writes()).toEqual([]);
    });

    it.each([
      {
        label: "a database error",
        result: { data: null, error: { message: "users read failed" } },
        message: "Failed to load user: users read failed",
      },
      {
        label: "a missing row",
        result: { data: null, error: null },
        message: "User not found",
      },
    ])(
      "fails closed when the user row can't be read ($label)",
      async ({ result, message }) => {
        results["users.select"] = result;

        const thrown = await rejectionOf(deletePostForUser(USER_ID, POST_ID));

        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as Error).message).toBe(message);
        expect(mocks.deletePost).not.toHaveBeenCalled();
        expect(writes()).toEqual([]);
      },
    );
  });

  describe("deleting on Threads", () => {
    it("deletes the stored media id with a client built from the decrypted token", async () => {
      await deletePostForUser(USER_ID, POST_ID);

      expect(mocks.decrypt).toHaveBeenCalledWith(ENCRYPTED_TOKEN);
      expect(mocks.ThreadsAPI).toHaveBeenCalledWith(
        DECRYPTED_TOKEN,
        THREADS_USER_ID,
      );
      expect(mocks.deletePost).toHaveBeenCalledTimes(1);
      expect(mocks.deletePost).toHaveBeenCalledWith(MEDIA_ID);
    });

    it("returns threads_error with the message from Threads and leaves the post in Spool", async () => {
      failThreadsDelete(
        new ThreadsAPIError("Failed to delete post", 400, {
          error: { message: "Boom" },
        }),
      );

      const result = await deletePostForUser(USER_ID, POST_ID);

      expect(result).toEqual({
        ok: false,
        code: "threads_error",
        status: 502,
        message: "Boom",
      });
      expect(writes()).toEqual([]);
      expect(JSON.stringify(result)).not.toContain(DECRYPTED_TOKEN);
      expect(JSON.stringify(result)).not.toContain(ENCRYPTED_TOKEN);
    });

    it.each([
      {
        label: "a plain Error",
        error: new Error("boom"),
      },
      {
        label: "a SyntaxError from an unreadable 200 response",
        error: new SyntaxError("Unexpected end of JSON input"),
      },
      {
        label: "a timeout",
        error: new ThreadsAPIError("Threads API request timed out", 408),
      },
      {
        label: "a network error",
        error: new ThreadsAPIError(
          "Threads API network request failed: fetch failed",
          undefined,
          { reason: "network_error" },
        ),
      },
    ])(
      "treats $label as not confirmed deleted and leaves the post in Spool",
      async ({ error }) => {
        failThreadsDelete(error);

        await expect(deletePostForUser(USER_ID, POST_ID)).resolves.toEqual({
          ok: false,
          code: "threads_error",
          status: 502,
          message: getThreadsErrorMessage(error),
        });

        expect(writes()).toEqual([]);
      },
    );

    // The literal strings below are the user-facing wording. They are spelled
    // out on purpose, not computed with getThreadsErrorMessage.
    it("uses the generic message when Threads refused the delete with a 4xx but gave no reason", async () => {
      failThreadsDelete(
        new ThreadsAPIError("Failed to delete post", 400, {
          error: { code: 100 },
        }),
      );

      await expect(deletePostForUser(USER_ID, POST_ID)).resolves.toEqual({
        ok: false,
        code: "threads_error",
        status: 502,
        message: "Threads couldn't delete this post.",
      });
      expect(writes()).toEqual([]);
    });

    it("says it could not confirm the delete when the failure is not a refusal from Threads", async () => {
      failThreadsDelete(new Error("boom"));

      await expect(deletePostForUser(USER_ID, POST_ID)).resolves.toEqual({
        ok: false,
        code: "threads_error",
        status: 502,
        message: "Couldn't confirm whether Threads deleted this post.",
      });
      expect(writes()).toEqual([]);
    });

    it.each([
      {
        label: "a 4xx refusal from Threads",
        error: new ThreadsAPIError("Failed to delete post", 400, {
          error: { message: "Boom" },
        }),
        logged: { status: 400, message: "Failed to delete post" },
      },
      {
        label: "a timeout",
        error: new ThreadsAPIError(
          "Threads API request timed out after 30s",
          408,
        ),
        logged: {
          status: 408,
          message: "Threads API request timed out after 30s",
        },
      },
      {
        label: "a network error",
        error: new ThreadsAPIError(
          "Threads API network request failed: fetch failed",
          undefined,
          {
            reason: "network_error",
            url: "https://graph.threads.net/v1.0/17900000000000001?access_token=REDACTED",
          },
        ),
        logged: { message: "Threads API network request failed: fetch failed" },
      },
      {
        label: "a 200 without success: true",
        error: new ThreadsAPIError("Threads did not confirm the delete", 200, {
          success: false,
        }),
        logged: { status: 200, message: "Threads did not confirm the delete" },
      },
      {
        label: "a plain Error",
        error: new Error("boom"),
        logged: { message: "boom" },
      },
      {
        label: "a value that is not an Error",
        error: "nope",
        logged: { message: "Unknown error" },
      },
    ])(
      "logs the post, the status and the message for $label, and nothing else",
      async ({ error, logged }) => {
        failThreadsDelete(error);

        await deletePostForUser(USER_ID, POST_ID);

        // Exactly one call with exactly these arguments: no response body, no
        // request URL and no error object.
        expect(errorSpy.mock.calls).toStrictEqual([
          [THREADS_FAILURE_LOG, { postId: POST_ID, ...logged }],
        ]);
      },
    );

    it.each([
      {
        label: "a network error that names the request URL",
        error: new ThreadsAPIError(
          "Threads API network request failed: fetch failed for https://graph.threads.net/v1.0/17900000000000001?fields=id&access_token=secret-token",
          undefined,
          {
            reason: "network_error",
            url: "https://graph.threads.net/v1.0/17900000000000001?access_token=secret-token",
          },
        ),
        loggedMessage:
          "Threads API network request failed: fetch failed for https://graph.threads.net/v1.0/17900000000000001?fields=id&access_token=REDACTED",
      },
      {
        label: "a TypeError that names the request URL",
        error: new TypeError(
          "Failed to parse URL from https://graph.threads.net/v1.0/17900000000000001?access_token=secret-token",
        ),
        loggedMessage:
          "Failed to parse URL from https://graph.threads.net/v1.0/17900000000000001?access_token=REDACTED",
      },
    ])(
      "keeps the access token out of the log and the result for $label",
      async ({ error, loggedMessage }) => {
        failThreadsDelete(error);

        const result = await deletePostForUser(USER_ID, POST_ID);

        expect(errorSpy.mock.calls).toStrictEqual([
          [THREADS_FAILURE_LOG, { postId: POST_ID, message: loggedMessage }],
        ]);
        expect(loggedErrors()).not.toContain("secret-token");
        expect(JSON.stringify(result)).not.toContain("secret-token");
      },
    );
  });

  describe("removing the post from Spool", () => {
    it("discards pending predictions first, then deletes the post row, and reports success", async () => {
      await expect(deletePostForUser(USER_ID, POST_ID)).resolves.toEqual({
        ok: true,
      });

      expect(writes()).toEqual([
        {
          table: "post_predictions",
          op: "update",
          payload: { review_state: "discarded" },
          filters: [
            ["post_id", POST_ID],
            ["user_id", USER_ID],
            ["review_state", "pending"],
          ],
        },
        {
          table: "posts",
          op: "delete",
          filters: [
            ["id", POST_ID],
            ["user_id", USER_ID],
          ],
        },
      ]);
    });

    it("removes nothing from Spool until Threads has confirmed the delete", async () => {
      await deletePostForUser(USER_ID, POST_ID);

      expect(events).toEqual([
        "posts.select",
        "backfill.check",
        "users.select",
        "threads.deletePost",
        "post_predictions.update",
        "posts.delete",
      ]);
    });

    it("returns spool_cleanup_failed and does not delete the post row when discarding predictions fails", async () => {
      results["post_predictions.update"] = {
        data: null,
        error: { message: "predictions update failed" },
      };

      await expect(deletePostForUser(USER_ID, POST_ID)).resolves.toEqual({
        ok: false,
        code: "spool_cleanup_failed",
        status: 500,
        message: "Deleted from Threads, but Spool couldn't remove it.",
      });

      expect(writes().map((query) => `${query.table}.${query.op}`)).toEqual([
        "post_predictions.update",
      ]);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const logged = loggedErrors();
      expect(logged).toContain("discard_pending_predictions");
      expect(logged).toContain(POST_ID);
      expect(logged).toContain("predictions update failed");
      expect(logged).not.toContain(ENCRYPTED_TOKEN);
      expect(logged).not.toContain(DECRYPTED_TOKEN);
    });

    it("returns spool_cleanup_failed when deleting the post row fails", async () => {
      results["posts.delete"] = {
        data: null,
        error: { message: "post delete failed" },
      };

      await expect(deletePostForUser(USER_ID, POST_ID)).resolves.toEqual({
        ok: false,
        code: "spool_cleanup_failed",
        status: 500,
        message: "Deleted from Threads, but Spool couldn't remove it.",
      });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const logged = loggedErrors();
      expect(logged).toContain("delete_post_row");
      expect(logged).toContain(POST_ID);
      expect(logged).toContain("post delete failed");
      expect(logged).not.toContain(ENCRYPTED_TOKEN);
      expect(logged).not.toContain(DECRYPTED_TOKEN);
    });
  });
});

describe("getDeleteQuotaForUser", () => {
  it("returns what the Threads quota call reports, using the stored token", async () => {
    await expect(getDeleteQuotaForUser(USER_ID)).resolves.toEqual({
      permitted: true,
      used: 3,
      total: 100,
      remaining: 97,
    });

    expect(queries).toEqual([
      {
        table: "users",
        op: "select",
        payload: "threads_user_id, access_token, token_expires_at",
        filters: [["id", USER_ID]],
      },
    ]);
    expect(mocks.decrypt).toHaveBeenCalledWith(ENCRYPTED_TOKEN);
    expect(mocks.ThreadsAPI).toHaveBeenCalledWith(
      DECRYPTED_TOKEN,
      THREADS_USER_ID,
    );
    expect(mocks.getDeleteQuota).toHaveBeenCalledTimes(1);
  });

  it("passes a not-permitted answer from Threads through", async () => {
    mocks.getDeleteQuota.mockResolvedValue({ permitted: false });

    await expect(getDeleteQuotaForUser(USER_ID)).resolves.toEqual({
      permitted: false,
    });
  });

  it("returns not permitted without calling Threads when the token has expired", async () => {
    results["users.select"] = { data: userRow(aMinuteAgo()), error: null };

    await expect(getDeleteQuotaForUser(USER_ID)).resolves.toEqual({
      permitted: false,
    });

    expect(mocks.decrypt).not.toHaveBeenCalled();
    expect(mocks.ThreadsAPI).not.toHaveBeenCalled();
    expect(mocks.getDeleteQuota).not.toHaveBeenCalled();
  });

  it("passes a quota check that got no answer from Threads on as a rejection, and still answers an expired token without calling Threads", async () => {
    const noAnswer = new ThreadsAPIError(
      "Threads API network request failed: fetch failed",
      undefined,
      { reason: "network_error" },
    );
    mocks.getDeleteQuota.mockRejectedValue(noAnswer);

    // Not turned into "not permitted": the route answers 500 instead.
    await expect(getDeleteQuotaForUser(USER_ID)).rejects.toBe(noAnswer);
    expect(mocks.getDeleteQuota).toHaveBeenCalledTimes(1);

    results["users.select"] = { data: userRow(aMinuteAgo()), error: null };

    await expect(getDeleteQuotaForUser(USER_ID)).resolves.toEqual({
      permitted: false,
    });
    expect(mocks.ThreadsAPI).toHaveBeenCalledTimes(1);
    expect(mocks.getDeleteQuota).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: "a database error",
      result: { data: null, error: { message: "users read failed" } },
      message: "Failed to load user: users read failed",
    },
    {
      label: "a missing row",
      result: { data: null, error: null },
      message: "User not found",
    },
  ])(
    "throws when the user row can't be read ($label)",
    async ({ result, message }) => {
      results["users.select"] = result;

      const thrown = await rejectionOf(getDeleteQuotaForUser(USER_ID));

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe(message);
      expect(mocks.getDeleteQuota).not.toHaveBeenCalled();
    },
  );
});
