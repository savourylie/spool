# [TICKET-011] Scheduled Token Refresh

## Status
`pending`

## Dependencies
- Requires: #005 ✅, #006 ✅

## Description
Implement the scheduled cron job that refreshes long-lived Threads tokens before they expire. Per CLAUDE.md, tokens are refreshed every 50 days (conservative buffer against the 60-day expiry). Refreshed tokens are re-encrypted before storage.

## Acceptance Criteria
- [ ] Cron API route `GET /api/cron/token-refresh` runs daily
- [ ] Route secured with `CRON_SECRET` header check
- [ ] Identifies users whose `token_expires_at` is within the next 15 days (catches the 50-day mark with buffer)
- [ ] For each eligible user:
  - [ ] Decrypt current access token
  - [ ] Call `GET /refresh_access_token` via ThreadsAPI service
  - [ ] Encrypt the new token
  - [ ] Update `users` row with new encrypted token and new `token_expires_at` (90 days from now)
- [ ] Log successful refreshes and failures
- [ ] Failed refresh: log error, do not update token (user retains current token until next attempt)
- [ ] If token is already expired: log warning, skip (user needs to re-authenticate)

## Implementation Notes
- Key files: `app/api/cron/token-refresh/route.ts`
- Per CLAUDE.md decision #7: "API extends token by 90 days on refresh; the 50-day refresh schedule is fine (conservative buffer)"
- The cron runs daily but only acts on tokens expiring within 15 days — this means it effectively refreshes around the 45–50 day mark
- Decrypt → refresh → re-encrypt cycle ensures the DB never has plaintext tokens
- Vercel cron config in `vercel.json` with daily schedule

## Testing
- Create a test user with `token_expires_at` set to 10 days from now
- Trigger `GET /api/cron/token-refresh` → verify token is refreshed and re-encrypted
- Verify `token_expires_at` updated to ~90 days from now
- Create a test user with `token_expires_at` 30 days from now → verify it's skipped
- Test with invalid/expired token → verify error logged, row not updated
