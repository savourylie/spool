import { describe, expect, it } from "vitest";

import {
  classifyDatabaseError,
  getAuthErrorHint,
  getAuthErrorMessage,
} from "@/lib/auth-errors";

function withCause(error: Error, cause: unknown): Error {
  (error as Error & { cause?: unknown }).cause = cause;
  return error;
}

function withCode(error: Error, code: string): Error {
  (error as Error & { code?: string }).code = code;
  return error;
}

describe("getAuthErrorMessage", () => {
  it("returns null when there is no error code", () => {
    expect(getAuthErrorMessage(undefined)).toBeNull();
    expect(getAuthErrorMessage(null)).toBeNull();
    expect(getAuthErrorMessage("")).toBeNull();
  });

  it("has distinct copy for a database outage and a database rejection", () => {
    const unavailable = getAuthErrorMessage("db_unavailable");
    const rejected = getAuthErrorMessage("db_error");

    expect(unavailable).toContain("couldn't reach the Spool database");
    expect(rejected).toContain("couldn't save your Threads account");
    expect(unavailable).not.toBe(rejected);
  });

  it("falls back to the generic message for unknown codes", () => {
    expect(getAuthErrorMessage("something_new")).toBe(
      "Something went wrong during sign-in. Please try again.",
    );
  });
});

describe("getAuthErrorHint", () => {
  it("points at npm run db:start when the database is unreachable", () => {
    expect(getAuthErrorHint("db_unavailable")).toContain("npm run db:start");
  });

  it("has no hint for codes without extra detail", () => {
    expect(getAuthErrorHint("access_denied")).toBeNull();
    expect(getAuthErrorHint(undefined)).toBeNull();
  });
});

describe("classifyDatabaseError", () => {
  it("treats a bare `fetch failed` as an unreachable database", () => {
    expect(classifyDatabaseError(new TypeError("fetch failed"))).toBe(
      "db_unavailable",
    );
  });

  it("walks the cause chain to find a connection error", () => {
    const cause = withCode(
      new Error("connect ECONNREFUSED 127.0.0.1:55321"),
      "ECONNREFUSED",
    );

    expect(
      classifyDatabaseError(withCause(new TypeError("fetch failed"), cause)),
    ).toBe("db_unavailable");
  });

  it("walks AggregateError causes", () => {
    const refused = withCode(
      new Error("connect ECONNREFUSED 127.0.0.1:55321"),
      "ECONNREFUSED",
    );
    const aggregate = new AggregateError([refused], "all connection attempts failed");

    expect(
      classifyDatabaseError(withCause(new TypeError("fetch failed"), aggregate)),
    ).toBe("db_unavailable");
  });

  it("treats a Postgres rejection as a database error, not an outage", () => {
    expect(
      classifyDatabaseError({ code: "23505", message: "duplicate key value" }),
    ).toBe("db_error");
  });

  it("treats unexpected thrown values as a database error", () => {
    expect(classifyDatabaseError(null)).toBe("db_error");
    expect(classifyDatabaseError("boom")).toBe("db_error");
  });
});
