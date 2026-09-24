# Make the site load on Spacefast

## Goal
Replace the current Spacefast directory listing with the app’s public home page.

## Changes
- Generate static HTML for `/` and `/auth` during every production build, while explicitly excluding the account-protected console from static generation.
- Keep the existing `dist/client` output location that Spacefast publishes.
- Make the post-build step fail clearly if the static home page was not produced, instead of publishing an incomplete folder.
- Correct the README so Spacefast is documented as static hosting: the public and sign-in pages can load there, but BrowserStack runs, domain checks, encrypted credentials, and the protected console still require a server-capable deployment.
- Add the missing Google sign-in setup notes and clarify that Cloudflare-style deployments have execution limits for long traffic batches.

## Verification
- Run the production build and confirm `dist/client/index.html` and `dist/client/auth/index.html` exist.
- Serve `dist/client` locally and verify the home page renders instead of a file list.
- Check the latest build diagnostics before completion.

## Limitation
This fixes Spacefast page loading only. It cannot make server-powered BrowserStack features run on a static host; those remain available through the current Lovable deployment or another server-capable host.

## Rollback
Remove the static page-generation settings and restore the previous post-build validation behavior; the server-capable deployment remains unchanged throughout.
