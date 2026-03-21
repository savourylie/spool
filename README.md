# Spool

Analytics dashboard for Threads creators. See what's working, when to post, and who's listening.

## Prerequisites

- Node.js 20+
- npm
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- A Threads app via the [Meta Developer Portal](https://developers.facebook.com/) for OAuth credentials

## Getting Started

```bash
# 1. Clone and install
git clone <repo-url> && cd spool
npm install

# 2. Set up environment variables
cp .env.local.example .env.local
# Fill in values — see .env.local.example for descriptions

# 3. Start local Supabase
npx supabase start
# Copy the anon key, service role key, and API URL into .env.local

# 4. Apply database migrations
npm run db:reset

# 5. Generate TypeScript types
npm run db:types

# 6. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start dev server                     |
| `npm run build`   | Production build                     |
| `npm run start`   | Start production server              |
| `npm run lint`    | Run ESLint                           |
| `npm run test`    | Run tests (Vitest)                   |
| `npm run db:start`| Start local Supabase                 |
| `npm run db:stop` | Stop local Supabase                  |
| `npm run db:reset`| Reset database and run migrations    |
| `npm run db:types`| Regenerate Supabase TypeScript types |

## Environment Variables

See [`.env.local.example`](.env.local.example) for all required variables and descriptions.
