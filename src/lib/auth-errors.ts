/**
 * Shared mapping between the error codes the auth callback redirects with
 * (`/?error=<code>`) and the copy shown on the landing page.
 *
 * The callback is the only place these codes are produced; the landing page is
 * the only place they are consumed.
 */

export const AUTH_ERROR_MESSAGES = {
  access_denied: "Threads sign-in was cancelled before it finished.",
  state_mismatch:
    "The sign-in link expired or was opened in a different browser. Please start again.",
  invalid_code: "Threads rejected the sign-in code. Please try again.",
  token_exchange_failed:
    "We couldn't exchange your Threads sign-in for an access token. Please try again.",
  profile_fetch_failed:
    "We signed you in but couldn't read your Threads profile. Please try again.",
  db_unavailable:
    "We couldn't reach the Spool database, so your sign-in wasn't saved.",
  db_error: "We couldn't save your Threads account. Please try again.",
  unknown: "Something went wrong during sign-in. Please try again.",
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGES;

/** Extra, development-only detail shown under the message. */
const AUTH_ERROR_HINTS: Partial<Record<AuthErrorCode, string>> = {
  db_unavailable:
    "Local dev: start Supabase with `npm run db:start`, then sign in again.",
  db_error: "Check the dev server logs for the Postgres error details.",
};

function normalizeCode(code: string | null | undefined): AuthErrorCode | null {
  if (!code) return null;
  return code in AUTH_ERROR_MESSAGES ? (code as AuthErrorCode) : "unknown";
}

/** User-facing message for a `?error=` code, or null when there is no error. */
export function getAuthErrorMessage(
  code: string | null | undefined,
): string | null {
  const normalized = normalizeCode(code);
  return normalized ? AUTH_ERROR_MESSAGES[normalized] : null;
}

/** Development-only hint for a `?error=` code. Never shown in production. */
export function getAuthErrorHint(
  code: string | null | undefined,
): string | null {
  const normalized = normalizeCode(code);
  return normalized ? (AUTH_ERROR_HINTS[normalized] ?? null) : null;
}

export type DatabaseFailureCode = "db_unavailable" | "db_error";

const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EPIPE",
]);

const MAX_CAUSE_DEPTH = 5;

/**
 * Node's fetch wraps socket failures (`fetch failed`) around a `cause`, and
 * sometimes an `AggregateError` whose `errors` hold the real ECONNREFUSED.
 * Walk that chain so "database is down" is distinguishable from a bad query.
 */
function hasConnectionErrorCode(error: unknown, depth = 0): boolean {
  if (depth > MAX_CAUSE_DEPTH || typeof error !== "object" || error === null) {
    return false;
  }

  const { code, cause, errors } = error as {
    code?: unknown;
    cause?: unknown;
    errors?: unknown;
  };

  if (typeof code === "string" && CONNECTION_ERROR_CODES.has(code)) {
    return true;
  }

  if (hasConnectionErrorCode(cause, depth + 1)) {
    return true;
  }

  if (Array.isArray(errors)) {
    return errors.some((nested) => hasConnectionErrorCode(nested, depth + 1));
  }

  return false;
}

/**
 * Classifies a failure from the "upsert user / create backfill job" step.
 * `db_unavailable` means the database could not be reached at all; `db_error`
 * means it was reachable but rejected the write.
 */
export function classifyDatabaseError(error: unknown): DatabaseFailureCode {
  if (error instanceof Error && error.message === "fetch failed") {
    return "db_unavailable";
  }

  return hasConnectionErrorCode(error) ? "db_unavailable" : "db_error";
}
