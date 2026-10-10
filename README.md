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
export SUPABASE_VAULT_SECRET_KEY=<run: openssl rand -hex 32>
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

### HTTPS dev mode

To run the dev server over HTTPS (required by some OAuth providers and useful for
testing secure cookies):

```bash
npm run dev:https
```

This runs `next dev --experimental-https`, which auto-generates a self-signed
cert into `./certificates/` via `mkcert`. The first run prompts for sudo to
install the local CA into your system keychain. The app then serves at
`https://localhost:3000`.

If you use HTTPS locally, make sure OAuth redirect URIs and any
`http://localhost:3000` env vars have matching `https://` variants.

## Supabase Cron

Spool uses Supabase Cron as the scheduler of record for recurring jobs. The
database schedules HTTP calls to the existing internal cron routes:

- `/api/cron/metrics` — refresh post metrics (every 6 hours)
- `/api/cron/daily` — poll follower counts and demographics (daily at 6 AM UTC)
- `/api/cron/token-refresh` — refresh Threads tokens before expiry (daily at 7 AM UTC)
- `/api/cron/velocity` — capture engagement snapshots for recent posts (every 30 minutes)

### Local setup

After starting local Supabase and applying migrations, store the scheduler
secrets in Vault:

```sql
select vault.create_secret(
  'http://host.docker.internal:3000',
  'cron_app_base_url',
  'Spool local app base URL'
);

select vault.create_secret(
  '<same value as CRON_SECRET in .env.local>',
  'cron_secret',
  'Spool cron route auth secret'
);
```

`host.docker.internal` is required for local database-originated HTTP calls on
macOS. Do not use `localhost` for the Vault `cron_app_base_url` value.

The local Vault key must be configured before starting Supabase:

```bash
export SUPABASE_VAULT_SECRET_KEY=<run: openssl rand -hex 32>
npx supabase stop
npx supabase start
```

If you previously created cron secrets before configuring the Vault key, recreate
them after the restart so `vault.decrypted_secrets` can return usable values.

### Production setup

Store the same secrets in your hosted Supabase project:

```sql
select vault.create_secret(
  'https://<your-app-domain>',
  'cron_app_base_url',
  'Spool production app base URL'
);

select vault.create_secret(
  '<your-production-cron-secret>',
  'cron_secret',
  'Spool production cron route auth secret'
);
```

### Observability

Inspect scheduled jobs:

```sql
select jobid, jobname, schedule, active
from cron.job
order by jobid;
```

Inspect recent job runs:

```sql
select jobid, status, start_time, end_time, return_message
from cron.job_run_details
order by start_time desc
limit 20;
```

The HTTP execution details still live in your app logs because Supabase Cron is
calling the existing `/api/cron/*` routes.

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start dev server                     |
| `npm run dev:https` | Start dev server over HTTPS (self-signed cert) |
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
