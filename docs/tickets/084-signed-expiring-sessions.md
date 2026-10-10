# [TICKET-084] Signed, Versioned, Expiring Sessions

## Status
`pending`

## Dependencies
- Requires: None

## Description
Replace the raw user UUID stored in `spool_session` with a versioned HMAC-signed token. Today `getSession` trusts the cookie value as the user ID, so anyone who learns a user's UUID can impersonate them, read their data through service-role routes, and spend AI budget on their behalf. This intentionally invalidates every legacy session once and makes every API route and server component reject forged, expired, malformed, or unknown-version cookies. It is independent of the deferred subscription-AI work and should land before the agent assistant acts on user data.

## Acceptance Criteria
- [ ] `src/lib/session.ts` exports `createSessionToken(userId, now?)`, `verifySessionToken(token, now?)`, `getSession(request)`, and `setSessionCookie(response, userId)`; the signed payload contains exactly `v`, `sub`, `iat`, and `exp` claims.
- [ ] Version 1 tokens use HMAC-SHA-256 with `SESSION_SIGNING_KEY`, URL-safe encoding, and constant-time signature comparison. The configured key must contain at least 32 bytes of entropy; there is no default or development fallback key.
- [ ] Session lifetime remains 60 days to preserve the existing product behavior. `iat` and `exp` are validated as integer epoch seconds, `sub` must be a UUID, and unknown versions, future-issued tokens beyond a 60-second clock skew, expired tokens, raw legacy UUIDs, malformed payloads, and tampered signatures return no authenticated user.
- [ ] `src/lib/server-session.ts` exports `getServerSession(): Promise<string | null>` so server components verify the cookie through the same implementation instead of treating `cookie.value` as a user ID.
- [ ] Every direct server-component/page read of `spool_session` is replaced with `getServerSession`; `SESSION_COOKIE_NAME` is read directly only inside the session helpers and tests.
- [ ] `setSessionCookie` preserves `httpOnly`, production-only `secure`, `sameSite: "lax"`, `path: "/"`, and the 60-day `maxAge`; `clearSessionCookie` preserves the same scope and clears the signed token.
- [ ] Missing or invalid `SESSION_SIGNING_KEY` fails closed: verification never authenticates a request, and login/callback token creation fails with a configuration error rather than issuing an unsigned cookie.
- [ ] Threads OAuth callback, sign-out, root/dashboard redirects, API `getSession` consumers, and the current replies page continue to work with the verified user ID.
- [ ] `src/lib/__tests__/session.test.ts` covers round-trip signing, signature tampering, payload tampering, expiry boundary, future `iat`, invalid UUID, wrong key, unknown version, raw UUID rejection, cookie attributes, and missing-key behavior.

## Implementation Notes
- Modify `src/lib/session.ts` and create `src/lib/server-session.ts`; use Node's built-in `crypto.createHmac` and `crypto.timingSafeEqual`, so no authentication dependency is required.
- Replace direct cookie reads in `src/app/page.tsx`, `src/app/loading/page.tsx`, `src/app/dev/backfills/page.tsx`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/posts/page.tsx`, `src/app/dashboard/timing/page.tsx`, `src/app/dashboard/settings/page.tsx`, `src/app/dashboard/insights/page.tsx`, `src/app/dashboard/create/page.tsx`, `src/app/dashboard/create/compose/page.tsx`, `src/app/dashboard/create/scanner/page.tsx`, `src/app/dashboard/understand/page.tsx`, `src/app/dashboard/understand/audience/page.tsx`, `src/app/dashboard/understand/concepts/page.tsx`, `src/app/dashboard/understand/reviews/page.tsx`, `src/app/dashboard/understand/voice/page.tsx`, and `src/app/dashboard/replies/page.tsx` if the replies work is present when this ticket starts.
- `src/app/api/auth/callback/route.ts` may keep calling `setSessionCookie`; its tests must set `SESSION_SIGNING_KEY` and assert a signed value rather than a UUID.
- Use one active signing key in v1. Rotating it deliberately signs out every user; document that behavior in `.env.local.example` instead of adding multi-key rotation before it is needed.
- Add `SESSION_SIGNING_KEY=<run: openssl rand -hex 32>` to `.env.local.example`. Never copy the real value into source, fixtures, logs, or browser-visible configuration.

## Testing
- Run `npm test -- src/lib/__tests__/session.test.ts src/app/api/auth/callback/route.test.ts`.
- Run `rg -n "cookies\(\)|SESSION_COOKIE_NAME|spool_session" src/app src/lib --glob '!src/lib/session.ts' --glob '!src/lib/server-session.ts' --glob '!**/*.test.*'`; inspect every result and confirm none treats a raw cookie value as `userId`.
- In development, sign in through Threads, load representative dashboard pages, sign out, and confirm the cleared cookie cannot reopen a protected route.
- Modify one character in the browser cookie and confirm API routes return 401 while protected server pages redirect to `/`.
