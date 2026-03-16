# [TICKET-005] Token Encryption

## Status
`pending`

## Dependencies
- Requires: #004 ✅

## Description
Implement AES-256-GCM encryption for Threads access tokens at the application layer, as specified in CLAUDE.md. Tokens must be encrypted before storage and decrypted on read. Update the OAuth flow (#004) to use encryption when storing tokens.

## Acceptance Criteria
- [ ] `lib/crypto.ts` exports `encrypt(plaintext: string): string` and `decrypt(ciphertext: string): string`
- [ ] Encryption uses AES-256-GCM with a random 12-byte IV per encryption
- [ ] Ciphertext format: `iv:authTag:encrypted` (base64-encoded, colon-delimited)
- [ ] Encryption key sourced from `TOKEN_ENCRYPTION_KEY` environment variable (32-byte hex string)
- [ ] OAuth callback (#004) updated to encrypt token before inserting into `users` table
- [ ] All token reads decrypt before use (API service layer, token refresh)
- [ ] Missing or invalid `TOKEN_ENCRYPTION_KEY` throws a clear startup error
- [ ] Unit tests for encrypt/decrypt round-trip, invalid key handling, tampered ciphertext detection

## Implementation Notes
- Key files: `lib/crypto.ts`
- Per CLAUDE.md decision #2: "Encrypt access tokens at the app layer (AES-256-GCM) before storing in the `users` table"
- Use Node.js built-in `crypto` module — no external dependency needed
- The `TOKEN_ENCRYPTION_KEY` should be generated via `openssl rand -hex 32` and stored in `.env.local`
- Add `TOKEN_ENCRYPTION_KEY` to `.env.local.example` with a placeholder
- GCM provides authenticated encryption — detect tampering via auth tag verification

## Testing
- Unit test: encrypt a known string, decrypt it, verify round-trip
- Unit test: tamper with ciphertext, verify decrypt throws
- Unit test: use wrong key, verify decrypt throws
- Integration: connect a Threads account, verify `access_token` in DB is ciphertext (not readable)
- Integration: verify API calls still work (token decrypted correctly before use)
