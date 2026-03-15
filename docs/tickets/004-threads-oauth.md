# [TICKET-004] Threads OAuth Flow

## Status
`blocked`

## Dependencies
- Requires: #002

## Description
Implement the full Threads OAuth 2.0 flow: redirect to Meta's consent screen, handle the callback to exchange the authorization code for a short-lived token, exchange for a long-lived token, create the user record in Supabase, and kick off the backfill job.

## Acceptance Criteria
- [ ] "Connect Threads" button redirects to Threads OAuth consent URL with scopes: `threads_basic`, `threads_manage_insights`
- [ ] OAuth callback route (`/api/auth/callback`) receives the authorization code
- [ ] Authorization code exchanged for short-lived token via Meta's token endpoint
- [ ] Short-lived token exchanged for long-lived token (60-day expiry)
- [ ] User record created/updated in `users` table with encrypted access token and `token_expires_at`
- [ ] `threads_user_id` and `username` fetched from `GET /me` and stored
- [ ] Backfill job record created in `backfill_jobs` table with status `pending`
- [ ] User redirected to loading/backfill screen after successful auth
- [ ] Error handling: invalid code, expired code, denied permissions → redirect to landing with error message
- [ ] Environment variables: `THREADS_APP_ID`, `THREADS_APP_SECRET`, `THREADS_REDIRECT_URI`

## Implementation Notes
- Key files: `app/api/auth/threads/route.ts` (initiate), `app/api/auth/callback/route.ts` (handle callback), `lib/auth.ts` (token exchange helpers)
- OAuth flow per Threads API docs: authorization URL → code → short-lived token → long-lived token
- Token encryption happens via #005's `lib/crypto.ts` — for now, store plaintext and encrypt in #005
- The callback should set a session cookie or Supabase auth session to identify the user
- Per PRD user flow: after auth → create backfill job → redirect to loading screen

## Testing
- Set up a Threads test app in Meta Developer Dashboard
- Click "Connect Threads" → verify redirect to consent screen
- Approve permissions → verify callback creates user record
- Check `users` table has correct `threads_user_id`, `username`, `token_expires_at`
- Check `backfill_jobs` table has a `pending` job for the user
- Test error cases: deny permissions, use expired code
