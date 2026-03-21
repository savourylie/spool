# [TICKET-022] QA & Final Polish

## Status
`blocked`

## Dependencies
- Requires: #001 ✅, #002 ✅, #003 ✅, #004 ✅, #005 ✅, #006 ✅, #007 ✅, #008 ✅, #009, #010 ✅, #011 ✅, #012 ✅, #013 ✅, #014 ✅, #015 ✅, #016 ✅, #017 ✅, #018 ✅, #019 ✅, #020 ✅, #021 ✅

## Description
Final quality assurance pass and polish before launch. Covers end-to-end user flow testing, performance optimization, visual consistency checks, and cleanup of any remaining rough edges.

## Acceptance Criteria
- [ ] **E2E flow**: fresh user → landing page → Connect Threads → OAuth → backfill → dashboard (all 3 tabs) works without errors
- [ ] **Returning user**: browser refresh → dashboard loads with persisted session
- [ ] **Performance**: Lighthouse performance score ≥ 80 on all pages
- [ ] **Bundle size**: no unnecessary dependencies; tree-shaking verified
- [ ] **Loading states**: all async operations show loading indicators (not blank screens)
- [ ] **Error boundaries**: unhandled errors caught by React error boundaries with friendly fallback UI
- [ ] **Visual consistency**: all pages match DESIGN.md tokens (colors, fonts, shadows, radii)
- [ ] **Console**: no errors or warnings in browser console during normal flows
- [ ] **TypeScript**: no `any` types in production code; strict mode passes
- [ ] **Environment**: `.env.local.example` lists all required environment variables with descriptions
- [ ] **Cron jobs**: all 3 cron endpoints (`/api/cron/metrics`, `/api/cron/daily`, `/api/cron/token-refresh`) verified working
- [ ] **Security**: no tokens or secrets exposed in client-side code or API responses
- [ ] **Vercel config**: `vercel.json` has correct cron schedules for all scheduled jobs
- [ ] **README**: basic setup instructions (clone, install, env vars, supabase start, npm run dev)

## Implementation Notes
- Key files: various (this is a sweep, not a feature)
- Create a manual test script checklist for the full E2E flow
- Run `npm run build` to catch any build-time TypeScript errors
- Check network tab for unnecessary API calls or large payloads
- Verify all environment variables are documented
- Ensure `.env.local` is in `.gitignore`

## Testing
- Full E2E test: new Threads test account → connect → backfill → explore all 3 dashboard tabs
- Test with slow network (Chrome DevTools throttling) → verify loading states appear
- Test token expiry flow: manually expire token → verify banner appears → reconnect
- Run `npm run build` → verify clean build with no errors
- Run Lighthouse on landing page and dashboard → verify scores
- Check `.env.local.example` matches all required vars
