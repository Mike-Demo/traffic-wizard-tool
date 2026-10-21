# Security audit triage — 2026-10-21

Parent: https://github.com/Mike-Demo/traffic-wizard-tool/issues/1

This is the fallback backlog because this session cannot create GitHub issues.
Each “Issue title” and following body is ready to file in this repository.
No application code was changed, no deployed endpoint was probed, and no
execution-dependent claim was promoted to a confirmed vulnerability.

## Prioritization and grouping

The supplied audit reports one high and three medium findings. Source references
below describe checkout `58135afa960d457e938d851604d7b3581e321c29`, which already
contains safeguards absent from parts of the audit narrative. Audit severity is
preserved in issue titles; it is not a claim that those safeguards are bypassable.

| Audit risk order | Finding | Reachability and fix trade-off |
| --- | --- | --- |
| 1 | Absolute URL path bypass (high) | As reported, an authenticated registrant could direct real traffic outside their verified host. A narrow input/execution guard is small; current guards require verification before treating this as still exploitable. |
| 2 | Stale ownership verification (medium) | A former domain owner retains authority after losing control or failing a re-check. Still present; failed-check clearing is small, while a bounded freshness policy and re-verification require explicit failure handling. |
| 3 | Missing batch authorization re-check (medium) | As reported, a user could continue queued traffic after removing verification. A small gate fixes the missing check; that gate already exists in this checkout. |
| 4 | Duplicate queued sessions (medium) | An authenticated user with an authorized run and usable credentials can overlap batches to duplicate paid sessions. Still present; atomic claiming and concurrent completion accounting are more involved than a single authorization gate. |

For **current implementation work**, address stale verification first and atomic
claiming second. Then verify the existing path and batch gates, closing their
issues if the acceptance checks pass rather than duplicating fixes. This accounts
for actual reachability, not severity labels alone.

Stale verification and the missing batch gate belong to the same authorization
lifecycle theme, but have distinct root causes: invalid persisted authority versus
a missing enforcement point. Keep separate issues because fixing either alone
does not fix the other. URL resolution and session claiming are independent.
Thus there are four remediation drafts and exactly one leads checklist.

## Remediation draft 1

### Issue title

`[security][high] Keep planned navigation on the verified origin`

### Issue body

Parent: https://github.com/Mike-Demo/traffic-wizard-tool/issues/1

Fingerprint: `absolute-url-path-bypasses-domain-verification`

**Audit evidence and impact:** The audit reports that `createRun` authorized only
`targetUrl`, while arbitrary string paths passed through planning into
`new URL(path, base)`. Absolute and protocol-relative values replace the verified
base, allowing an authenticated registrant to navigate a BrowserStack session to
an unverified host. The audit's example destinations were
`https://unverified.example/x` and `//unverified.example/`.

**Current source evidence:** In
`/home/runner/work/traffic-wizard-tool/traffic-wizard-tool/src/lib/traffic-planner.ts:14-16,34-57`,
normalization only trims paths, planning copies them, and `joinUrl` resolves them
without an origin check. However,
`/home/runner/work/traffic-wizard-tool/traffic-wizard-tool/src/lib/traffic.functions.ts:7-16`
already requires paths to start with one slash and excludes whitespace/backslashes;
`/home/runner/work/traffic-wizard-tool/traffic-wizard-tool/src/lib/traffic-runner.server.ts:40-46`
already rejects a resolved host change before navigation. The reported
cross-host exploit is therefore guarded on these inspected paths; no bypass is
asserted here. The execution guard compares host, not full origin.

**Root cause:** In the audited flow, URL resolution trusted path input without
binding the resolved destination to the authorized target.

**Smallest fix:** First verify the existing guards. If hardening is needed,
centralize same-origin relative-path validation in normalization and defensively
at execution/URL resolution: reject absolute or protocol-relative inputs and any
resolved origin differing from the target. Check persisted planned paths too,
not only newly submitted configuration. Fail closed rather than silently
substituting the base URL.

**Acceptance checks:**
- [ ] Absolute URLs, protocol-relative URLs, backslash/whitespace authority tricks,
      and scheme/host/port changes cannot cause navigation off the target origin.
- [ ] Ordinary same-origin paths, queries, and fragments remain usable.
- [ ] Invalid stored planned paths are rejected before navigation.
- [ ] Record regression evidence; close as already addressed if current safeguards
      fully meet the reported requirement, distinguishing optional origin hardening.

## Remediation draft 2

### Issue title

`[security][medium] Expire domain verification and clear failed proofs`

### Issue body

Parent: https://github.com/Mike-Demo/traffic-wizard-tool/issues/1

Fingerprint: `domain-verification-never-expires-or-revokes`

**Evidence and impact:**
`/home/runner/work/traffic-wizard-tool/traffic-wizard-tool/src/lib/domainVerification.server.ts:182-188`
updates `last_checked_at` on every completed check but writes `verified_at` only
on success, preserving a previous success after failure. At lines 203-232,
`assertTargetAuthorized` accepts any non-null `verified_at` without an age bound.
A user who formerly controlled a domain can retain traffic authorization after
proof removal or domain transfer. The batch gate at
`/home/runner/work/traffic-wizard-tool/traffic-wizard-tool/src/lib/traffic.functions.ts:135-148`
uses this same stale authority, so merely having that gate does not resolve this
finding.

**Root cause:** Persisted verification never expires or clears on a failed
re-check; authorization treats historical ownership as current ownership.

**Smallest fix:** Explicitly set `verified_at` to null when a completed re-check
fails; persist and handle update errors. Define a bounded verification lifetime,
enforce it in the shared authorization helper, and re-verify ownership at run
creation. Keep batch authorization subject to the same freshness bound so
queued work cannot outlive it. Fail closed when fresh proof cannot be established.

**Acceptance checks:**
- [ ] Successful verification records a fresh timestamp.
- [ ] A subsequent failed check clears authority and denies new runs/batches.
- [ ] Null, expired, and boundary-age timestamps are handled by a documented
      lifetime policy; `last_checked_at` alone never renews authority.
- [ ] Run creation requires current proof; valid owners can re-verify and proceed.
- [ ] Verification persistence failures do not return misleading success.

## Remediation draft 3

### Issue title

`[security][medium] Re-check domain authorization before every batch`

### Issue body

Parent: https://github.com/Mike-Demo/traffic-wizard-tool/issues/1

Fingerprint: `runbatch-executes-without-rechecking-domain-verification`

**Audit evidence and impact:** The audit reports that `createRun` enforced
ownership but `runBatch` did not, allowing queued sessions to execute after the
user removed domain verification. `removeDomain` deletes the ownership row at
`/home/runner/work/traffic-wizard-tool/traffic-wizard-tool/src/lib/domainVerification.server.ts:67-75`.

**Current source evidence:**
`/home/runner/work/traffic-wizard-tool/traffic-wizard-tool/src/lib/traffic.functions.ts:135-148`
already loads the target and calls
`assertTargetAuthorized(context.userId, run.target_url)` before loading credentials
or invoking `executeBatch`. The original missing-gate claim does not match this
checkout. The runner itself at
`/home/runner/work/traffic-wizard-tool/traffic-wizard-tool/src/lib/traffic-runner.server.ts:74-108`
has no ownership check, so retain the handler gate as an execution invariant.
The audit describes sessions as “claimed,” but current lines 88-96 only select
them; atomic claiming is tracked separately.

**Root cause:** In the audited flow, authority was checked only when work was
created, not at the later execution boundary.

**Smallest fix:** Preserve/verify the existing handler gate before any queued-row
claim or remote session creation. If an execution entry point lacks it, add the
same check there and fail the batch or stop the run when verification is absent.
Do not add a redundant gate merely to match an outdated audit narrative.
Freshness of the helper's decision is tracked in the separate expiry issue.

**Acceptance checks:**
- [ ] Create queued work, remove its domain verification, and request another
      batch: authorization fails with zero new BrowserStack sessions.
- [ ] A still-authorized target executes normally.
- [ ] Every batch execution entry point is covered by the authorization gate.
- [ ] Record regression evidence and close as already addressed if the existing
      gate meets these checks.

## Remediation draft 4

### Issue title

`[security][medium] Atomically claim queued sessions before remote creation`

### Issue body

Parent: https://github.com/Mike-Demo/traffic-wizard-tool/issues/1

Fingerprint: `concurrent-runbatch-duplicates-queued-sessions`

**Evidence and impact:**
`/home/runner/work/traffic-wizard-tool/traffic-wizard-tool/src/lib/traffic-runner.server.ts:88-108`
selects queued rows without claiming them.
At lines 28-37, `runOne` creates a remote BrowserStack session before updating
the row to `running`, with no `status = 'queued'` guard. Two overlapping batches
can select the same row and each create a paid session. The handler limits each
batch to five at
`/home/runner/work/traffic-wizard-tool/traffic-wizard-tool/src/lib/traffic.functions.ts:129-133`,
but does not serialize concurrent requests. An authenticated caller with an
authorized run and usable credentials can waste quota and corrupt accounting.

**Root cause:** The queued-to-running transition is not an atomic ownership
claim made before external side effects.

**Smallest fix:** Before any remote call, conditionally update candidate rows
from `queued` to `running` and return the successfully claimed rows, for example
`UPDATE run_sessions SET status='running' WHERE id IN (...) AND status='queued'
RETURNING ...`. Execute only those returned rows, preserving run/user scoping
and checking database errors. Losing a claim race must not trigger a remote call.
Reconcile completion with in-flight claims: the current no-pending branch and
queued-only completion check at runner lines 97-115 must not finalize a run while
another batch owns running sessions. Define recovery for failed/stalled claims
without blindly duplicating remote work.

**Acceptance checks:**
- [ ] Overlapping batches targeting the same queued rows create at most one
      remote session per row.
- [ ] Unclaimed rows and failed claims create no remote sessions.
- [ ] A losing batch cannot mark a run finished while another batch is active.
- [ ] Claimed work reaches passed/failed states and aggregate counts remain
      correct; normal sequential execution and stopped-run behavior still work.

## Validation checklist draft

### Issue title

`[security][needs-validation] Audit leads to validate`

### Issue body

Parent: https://github.com/Mike-Demo/traffic-wizard-tool/issues/1

These are leads, not confirmed findings. Do not assign severity until the missing
facts and resulting reachability are established. Use operator-approved staging
checks or deployment-policy evidence; do not probe production/internal services
or disclose secret values in this issue.

- [ ] **Operator BrowserStack fallback credentials are shared by every user
      without saved credentials**
  - Fingerprint: `env-fallback-browserstack-credentials-shared-across-users`
  - Claimed root cause: The per-user credential loader falls back to operator
    credentials for users without saved credentials, potentially spending the
    operator's quota if the optional environment variables are set in production.
  - Evidence:
    `/home/runner/work/traffic-wizard-tool/traffic-wizard-tool/src/lib/browserstackAuth.server.ts:9-17`
    returns the environment fallback after no saved credentials;
    `/home/runner/work/traffic-wizard-tool/traffic-wizard-tool/README.md:68-69`
    documents both variables as optional.
  - **Exact missing fact:** Whether the production deployment sets the optional BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY environment variables (documented in README as optional); no env/deployment configuration in the repo records this.
  - Validation: Ask the operator for presence/absence and intended tenant access
    policy, never values. Record whether an ordinary account without saved
    credentials can reach the fallback. Promote to remediation only if unintended
    shared-quota access is established; otherwise document why it is inapplicable.

- [ ] **Domain verification well-known fetch follows redirects and accepts
      IP-literal hosts (blind SSRF hypothesis)**
  - Fingerprint: `wellknown-verification-blind-ssrf-redirect-ip-literal`
  - Claimed root cause: Verification could follow unchecked redirects or accept
    IP literals and steer a server-side GET toward private, link-local, or
    unrelated origins.
  - Current evidence differs from the audit:
    `/home/runner/work/traffic-wizard-tool/traffic-wizard-tool/src/lib/domainVerification.server.ts:90-150`
    checks public DNS answers and uses manual redirects, validating HTTPS,
    default port, and the domain or its `www` host on each hop. This is not
    evidence of an unchecked redirect in the current source and does not by
    itself establish deployed fetch/egress behavior.
  - **Exact missing fact:** Whether the deployed runtime's fetch permits requests to IP-literal, private, or link-local hosts and to redirect targets on other origins/schemes (the production Worker egress/fetch policy), which is not recorded anywhere in the repository.
  - Validation: Obtain runtime policy/configuration and confirm which source
    revision is deployed. Use an authorized controlled environment to assess the
    alleged paths under the existing guards, including whether DNS validation and
    fetch use consistent destinations. Record policy and reachability evidence;
    do not label this confirmed SSRF based on static inspection alone.

For each lead, record the evidence source, deployment/revision, date, and outcome
(confirmed and filed separately, not applicable, or still awaiting the exact
missing fact). Keep any unresolved fact explicit.
