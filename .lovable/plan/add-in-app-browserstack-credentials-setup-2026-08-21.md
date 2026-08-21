# Add in-app BrowserStack credentials setup

## Goal
Replace the passive "Add your BrowserStack credentials before starting a run." warning with an in-app form that lets each authenticated user save their own BrowserStack username and access key securely, then tests the connection immediately.

## What we'll build

### 1. Encrypted per-user credential storage
- New migration: `user_browserstack_credentials` table
  - `id uuid pk`, `user_id uuid references auth.users(id) on delete cascade`
  - `username_ciphertext text`, `access_key_ciphertext text`
  - `created_at`, `updated_at`
  - RLS enabled; only `service_role` can read/write (server functions use `supabaseAdmin`)
- Generate a runtime secret `BROWSERSTACK_CREDENTIALS_KEY` used as the AES-256-GCM encryption key.
- Server-only crypto helper (`src/lib/bsCredentialsCrypto.server.ts`):
  - `encryptCredential(plaintext)` → base64 ciphertext (iv + auth tag + ciphertext)
  - `decryptCredential(stored)` → plaintext
  - Derives a 32-byte key from the secret with SHA-256 so any generated key works.

### 2. Server functions
- `saveBrowserStackCredentials({ username, accessKey })`
  - Authenticated via `requireSupabaseAuth`
  - Validates inputs with Zod (trimmed, non-empty, length limits)
  - Encrypts both values, upserts row keyed to `context.userId` via `supabaseAdmin`
  - Returns `{ saved: true }`; never echoes the access key back
- `hasBrowserStackCredentials()`
  - Returns `{ configured: true/false }` and a masked username preview (e.g. `mik*******`) without decrypting the access key to the client.
- Update `checkBrowserStack()`
  - Loads the current user's encrypted credentials, decrypts server-side, and calls BrowserStack's plan API.
  - Distinguishes `missingCredentials: true` (no row yet) from an invalid key.
- Update `runBatch()` / `traffic-runner.server.ts`
  - Loads and decrypts credentials before each batch and passes them into the WebDriver helpers.

### 3. BrowserStack client refactor
- Update `src/lib/browserstack.server.ts` so `bsAuthHeader`, `bsPlan`, `createSession`, `navigate`, `getTitle`, `quitSession` accept `{ username, accessKey }` instead of reading `process.env`.
- Keep the existing env-var credentials as a fallback for the project owner / single-tenant case, but per-user credentials take precedence when present.

### 4. Console UI
- When credentials are missing, render a setup card at the top of the console with:
  - Inputs for BrowserStack Username and Access Key
  - "Save & test connection" button
  - Inline error if the test fails
  - Short helper text explaining credentials are encrypted and stored server-side
- When credentials are configured:
  - Show a compact success state (masked username + "Connected" or plan info)
  - "Update credentials" button that re-opens the form
- Keep the Start run button disabled until `checkBrowserStack` returns `connected: true`.
- Remove the old passive warning and replace it with the setup card.

### 5. Security
- No plaintext credential storage in the database.
- Access key is never returned to the browser.
- Input validation with Zod and length limits.
- All credential reads/writes happen inside authenticated server functions using the service-role client.

## Outcome
Users can add their BrowserStack credentials directly from `/console`, the app validates and stores them encrypted, and the "Add your BrowserStack credentials" warning becomes an actionable setup step.
