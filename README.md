# Analytics Traffic Simulator

Drive **real browser sessions** (via BrowserStack Automate) against a website **you own**, so you can check that your analytics tools (GA4, Plausible, PostHog, etc.) correctly record browsers, devices, countries, and session behavior.

> **Ethical use:** runs only work against domains you have proven you own (DNS TXT record or well-known file). Do not use this to inflate traffic, commit ad fraud, or test sites you don't control.

## Features

- **Traffic mix builder** – pick browsers/devices, BrowserStack geolocation countries, pages per session, dwell time, bounce rate, and paths.
- **Real sessions** – each session is a genuine BrowserStack WebDriver session (no IP spoofing, no fake hits).
- **Domain verification** – server-side ownership check before any run can start.
- **Per-user encrypted credentials** – BrowserStack username/access key are tested, then stored AES-256-GCM encrypted.
- **Run history & live progress** – every run and session is saved per user with row-level security.

## Tech stack

- TanStack Start v1 (React 19, SSR, server functions) + Vite 8
- Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres, Auth incl. Google, RLS)
- Nitro build targeting **Cloudflare Workers** (`cloudflare-module`)
- BrowserStack Automate (W3C WebDriver over `fetch`)

```text
Browser (React UI)
   |  server functions (auth bearer token)
   v
Worker (TanStack Start / Nitro)
   |-- Supabase: runs, run_sessions, verified_domains, user_browserstack_credentials
   |-- DNS-over-HTTPS / well-known file: domain verification
   '-- BrowserStack hub: create session -> navigate -> quit
```

## Project layout

| Path | Purpose |
| --- | --- |
| `src/routes/index.tsx` | Landing page |
| `src/routes/auth.tsx` | Sign in / sign up (email + Google) |
| `src/routes/_authenticated/console.tsx` | Traffic console (runs, credentials, domains) |
| `src/lib/traffic.functions.ts` | All server functions (auth-protected) |
| `src/lib/traffic-planner.ts` / `traffic-presets.ts` | Session planning and browser/country presets |
| `src/lib/traffic-runner.server.ts` | Executes batches of sessions |
| `src/lib/browserstack.server.ts` | BrowserStack WebDriver client |
| `src/lib/browserstackAuth.server.ts`, `browserstackCredentials.server.ts`, `bsCredentialsCrypto.server.ts` | Credential test/save/encrypt |
| `src/lib/domainVerification.server.ts` | Domain ownership verification |
| `supabase/migrations/` | Database schema + RLS policies |
| `scripts/postbuild.mjs` | Copies build output into `dist/` for hosts that expect it |

## Prerequisites

- Node.js 22+ and Bun 1.3+ (npm also works)
- A Supabase project
- A BrowserStack Automate account
- A Cloudflare account (or a host that runs Cloudflare-Worker output, e.g. Spacefast)

## Environment variables

| Name | Where | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | build + browser | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | build + browser | Supabase anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | build + browser | Supabase project ref |
| `SUPABASE_URL` | server | Same URL as above |
| `SUPABASE_PUBLISHABLE_KEY` | server | Same publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | server (secret) | Service role key – used only for credential storage |
| `BROWSERSTACK_CREDENTIALS_KEY` | server (secret) | 32-byte base64 key: `openssl rand -base64 32` |
| `BROWSERSTACK_USERNAME` | server (optional) | Fallback credentials if a user hasn't saved their own |
| `BROWSERSTACK_ACCESS_KEY` | server (optional) | Fallback credentials |

`VITE_*` values are baked in at build time, so set them in your build environment. Server values must be set as Worker secrets/vars at runtime. Never commit real secrets — keep `.env` out of git for your own deployments.

## Database setup

```sh
npm i -g supabase
supabase link --project-ref <your-ref>
supabase db push          # applies supabase/migrations/*
```

Then in Supabase Auth: enable Email, and optionally Google (add your site URL to the redirect allow-list).

## Local development

```sh
bun install
cp .env .env.local   # then fill in your own values
bun run dev          # http://localhost:3000 (or the port Vite prints)
```

## Build

```sh
bun run build
```

Output:

- `.output/public` – static assets
- `.output/server` – Cloudflare Worker (`index.mjs`, `wrangler.json`)
- `dist/client`, `dist/server` – copies created by `postbuild` for hosts that expect `dist/`

## Deploying

### Spacefast

The build itself succeeds; earlier deploys failed only because Spacefast looked for `dist/client`. The `postbuild` script now creates it. Settings:

- Install: `bun install --frozen-lockfile` (auto)
- Build: `bun run build` (auto)
- Output directory: `dist/client` (auto) — or set it to `.output/public`
- Add all environment variables above

This app **needs its server** (login, BrowserStack calls, domain checks). If Spacefast only serves static files, pages will load but those features won't work — deploy the Worker from `dist/server` / `.output/server` as well (see below).

### Cloudflare Workers

```sh
bun run build
npx wrangler deploy --config .output/server/wrangler.json
# or: npx nitro deploy --prebuilt
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # repeat for each server secret
```

## Using the app

1. Sign up / sign in, open **Console**.
2. **BrowserStack credentials** – paste the *username* and *access key* from BrowserStack Automate settings (not a URL or email). They're tested before saving.
3. **Domains** – add your domain, then either add the TXT record shown or serve the token at `/.well-known/traffic-simulator-verify.txt`, and click **Verify**.
4. Enter the target URL, build the traffic mix, click **Start run**, and watch sessions complete. Check your analytics dashboard.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Build output directory does not exist: dist/client` | Make sure `postbuild` ran (`package.json` scripts), or set output dir to `.output/public` |
| `BrowserStack plan check failed (401)` | Wrong username/access key. Remove saved credentials and re-enter from Automate settings |
| "Verify ownership of … before starting a run" | Complete domain verification; DNS changes can take minutes to propagate |
| `BROWSERSTACK_CREDENTIALS_KEY is not configured` | Set that secret on the server |
| Login redirects fail | Add your deployed URL to Supabase Auth redirect URLs |

## Moving off Lovable

1. Create your own Supabase project and run the migrations (users must re-sign up; existing data isn't carried over automatically).
2. Set every environment variable above in your new host.
3. Deploy and confirm sign-in, credentials, domain verification, and a small run all work.
4. Only then delete the Lovable project (Project settings → Delete). Keep it until step 3 passes so you can roll back.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Dev server |
| `bun run build` | Production build (+ `postbuild` copy) |
| `bun run preview` | Preview the production build |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |
