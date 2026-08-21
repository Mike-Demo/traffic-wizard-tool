# Analytics Traffic Simulator (BrowserStack)

A control panel that drives **real browser sessions on BrowserStack** against a site you own, so your analytics tool records genuine hits from varied browsers, devices, and locations.

Important: only sites you own or are authorized to test. Runs are rate-limited and every run is logged with the target domain, so this stays a testing tool rather than a traffic-faking one.

## What you get

**1. Target & credentials setup**
- Enter the site URL to test plus a required "I own or am authorized to test this domain" confirmation.
- BrowserStack username + access key stored as backend secrets (never in the frontend).
- Connection check that calls BrowserStack's plan API and shows remaining parallel sessions.

**2. Traffic mix builder**
- *Browsers & devices*: pick from a live list pulled from BrowserStack (Chrome/Safari/Firefox/Edge on Windows, macOS, iPhone, Android). Set a weight per entry so the mix looks realistic.
- *Geography*: choose countries; BrowserStack's IP geolocation routes each session through that country, so hits arrive with real regional IPs.
- *Session behavior*: number of sessions, pages visited per session, path list to walk, dwell time range, bounce percentage, and an optional click target per page.

**3. Run & watch**
- Start a run; sessions execute in batches respecting your BrowserStack parallel limit.
- Live table: session status (queued / running / passed / failed), browser, country, pages visited, duration, and a link to the BrowserStack session replay.
- Stop button cancels queued sessions and quits running ones.

**4. History**
- Past runs stored with their config, so you can re-run the same mix and compare against what your analytics dashboard reported.

## Technical notes

- **Backend**: Lovable Cloud is enabled for run/session storage and for holding BrowserStack credentials.
- **Driving browsers**: server functions talk to `hub-cloud.browserstack.com/wd/hub` over the W3C WebDriver HTTP protocol using plain `fetch` — no Node-only Selenium package, which keeps it compatible with the edge runtime.
- **Per-session flow**: create session with capabilities (browser, OS, `geoLocation`, `sessionName`) → navigate to each path → wait the dwell interval → optional click → mark status → delete session.
- **Orchestration**: a run row plus one session row per planned session; a server function claims and executes pending sessions in batches, updating status as it goes. The UI polls run progress.
- **Data model**: `runs` (target URL, config JSON, status, counts) and `run_sessions` (browser caps, country, status, BrowserStack session id, pages visited, error). RLS scopes both to the signed-in owner, with explicit grants.
- **Auth**: email/password sign-in, since runs consume your BrowserStack quota and must be owner-scoped.
- **Guardrails**: max sessions per run, max pages per session, enforced pacing between page loads, and the authorization confirmation persisted with each run.

## Design

Dark operations-console aesthetic: near-black surfaces, a single signal-green accent for live/running states, amber for queued, red for failed. Monospace for session IDs and metrics, clean sans for everything else. Layout is a two-pane console — configuration on the left, live session grid on the right.

## Out of scope

- No IP spoofing or proxy rotation beyond BrowserStack's own geolocation feature.
- No running against domains you haven't confirmed authorization for.
