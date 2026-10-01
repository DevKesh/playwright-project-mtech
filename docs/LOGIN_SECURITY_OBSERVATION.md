# Unique-Credential Login Submission — Detailed Test Guide

**Document updated:** October 1, 2026

**Target application:** Total Connect 2.0 QA2

**Entry URL:** https://qa2.totalconnect2.com/login

**Mode:** Submission-only observation; no login-result assertions

## 1. What this case actually does

This case repeatedly opens the login page, enters a **new synthetic username and
password**, and clicks **Sign In once** per attempt. Your monitoring team can
correlate those attempts with application, authentication and security logs.

The case does **not** create accounts, log in using a pool of valid accounts, or
perform the successful-login/logout flow. The generated credentials are intended
to be invalid because no matching accounts are provisioned by this test. Their
nonexistence is not checked against an account database.

There are no assertions that login must succeed, fail, display a particular
message, return a particular HTTP status, or redirect to a particular page.
**A green test means the automated submission actions completed—not that login
succeeded, rejection was correct, or the application prevented an attack.**

The existing successful-login/logout monitor, Forgot Password case, shared login
helper, and LoginPage locators are unchanged. This is a separate suite.

## 2. Implementation map

| Component | Responsibility |
|---|---|
| [Submission spec](../tests/generated/nl-authored/login-security.spec.js) | Creates individual attempts, navigates, submits, paces and writes the audit |
| [Data and observation helper](../framework/utils/login-security.js) | Generates credentials, validates settings, records HTTP metadata and detects stop signals |
| [Run setup](../framework/utils/login-security-setup.js) | Checks approval and resolved execution limits before running |
| [Dedicated Playwright config](../playwright.login-security.config.js) | QA2 target, browser mode, timeouts, one worker and isolated reports |
| [Existing LoginPage](../framework/pages/generated/smoke/LoginPage.js) | Existing Username, Password, Sign In locators and cookie handling |
| [npm scripts](../package.json) | Exposes `test:login-security` and supplies the approval flag |
| [Manual GitHub workflow](../.github/workflows/login-security.yml) | Accepts attempt count, pacing and approval; uploads evidence |
| [Normal Playwright config](../playwright.config.js) | Excludes this security spec from ordinary project discovery |

## 3. Exact username and password generation

### Data source

The credential generator is `uniqueInvalidCredentials(attempt, runId, now)`.
It does **not** fetch a username or password from application config, dotenv,
repository secrets, the monitor account, or the smoke account.

The pieces used are:

| Piece | Exact source | Changes when? |
|---|---|---|
| Run identifier | Node.js `randomUUID()` | Once per run |
| Run prefix | `runId.slice(0, 8)` | Once per run; used only in username |
| Timestamp | JavaScript `Date.now()` | Evaluated when each credential pair is generated |
| Attempt number | Integer `1` through configured maximum | Each attempt |
| Shared random suffix | `randomBytes(6).toString('hex')` | Each pair; 12 hexadecimal characters |
| Password-only suffix | `randomBytes(8).toString('hex')` | Each password; 16 hexadecimal characters |

`Date.now()` returns milliseconds since the Unix epoch. It is a timestamp, not
just the millisecond component of the current second. It is captured before
navigation and submission, so it is **not the exact server-receipt time**.

### Exact format

The generator builds a shared suffix as:

**`<epochMilliseconds>-<attemptNumber>-<12HexCharacters>`**

Then it returns:

| Field | Format |
|---|---|
| Username | `qa-neg-<first8RunIdCharacters>-<epochMilliseconds>-<attemptNumber>-<12HexCharacters>` |
| Password | `Qa!<epochMilliseconds>-<attemptNumber>-<same12HexCharacters>-<16PasswordOnlyHexCharacters>` |

- `qa-neg-` is a fixed synthetic-username prefix for identifying test traffic.
- `Qa!` is a fixed prefix containing uppercase, lowercase and a special character.
- Username and password share the timestamp, attempt number and 12-character suffix.
- The password includes an additional independently generated random suffix.
- No timestamp is appended to a real user's name or password.
- With a current 13-digit timestamp and attempts 1–100, usernames are 44–46
  characters and passwords are 48–50 characters, below the observed 80-character
  input limits.

### Illustrative test-data examples

**These are made-up examples of the exact format, not credentials recovered from
a live run and not valid account credentials.** Assume the run ID starts with
`a1b2c3d4`:

| Attempt | Username passed to the Username field | Password passed to the Password field |
|---|---|---|
| 1 | `qa-neg-a1b2c3d4-1790847542769-1-112233aabbcc` | `Qa!1790847542769-1-112233aabbcc-0123456789abcdef` |
| 2 | `qa-neg-a1b2c3d4-1790847557769-2-ddeeff445566` | `Qa!1790847557769-2-ddeeff445566-fedcba9876543210` |
| 3 | `qa-neg-a1b2c3d4-1790847572769-3-778899aabbcc` | `Qa!1790847572769-3-778899aabbcc-a1b2c3d4e5f60718` |

The example timestamps are illustrative. Actual spacing also includes page load,
cookie handling and UI action time; it is not a fixed timestamp increment.

### Why values differ on every attempt

Within a run, the attempt number changes, so even two pairs generated within the
same millisecond differ. Each pair also receives new random material. Separate
runs get new UUIDs and random suffixes. This makes cross-run collisions extremely
unlikely; there is no global database that mathematically guarantees uniqueness
across all executions.

### Can a previously submitted password be retrieved?

**Not from the custom audit.** Older Playwright automatic failure snapshots could
contain synthetic passwords; the dedicated config now disables those snapshots.
Previously uploaded or downloaded artifacts remain unchanged. The full
synthetic username is retained in the audit for server-log correlation. Passwords
exist in memory and are filled into the password input, then sent through the
application's normal browser login flow. The password-only random suffix cannot
be reconstructed from the username or audit. This document does not enable
password logging.

## 4. Step-by-step execution

### Before the first attempt

1. Read attempt-count and pacing settings from the process environment, with
  defaults of five attempts and a 10,000 ms gap.
2. Validate the settings and resolved Playwright configuration.
3. Require approval. The dedicated npm script sets the approval flag; the manual
  GitHub workflow has a separate authorization checkbox.
4. Generate one run UUID and initialize a sanitized audit record.
5. Open one browser context and one page. These are reused throughout the run.
6. Install HTTP-status observation and the existing persistent cookie handler.

### For each numbered attempt

1. Skip the attempt if a previous safety stop ended the run.
2. Generate a new username/password pair and start an audit entry.
3. Check for a pre-existing safety stop **before** reloading or submitting again.
4. Navigate to `/login` and wait for `domcontentloaded`.
5. Check for a safety stop on the newly loaded page and reuse cookie dismissal.
6. Record `startedAt` immediately before the login actions.
7. Call `LoginPage.login(generatedUsername, generatedPassword)`:
  - Fill `getByLabel('Username')` with the generated username.
  - Fill `getByLabel('Password')` with the generated password.
  - Click `getByRole('button', { name: 'Sign In' })` once.
8. When that call returns, record `submitted: true` and
  `outcome: 'submitted_without_assertions'`.
9. Wait the configured pacing interval. This also occurs after the final
  submission to allow observation of a delayed stop signal.
10. Check for a safety stop. If present, annotate the attempt and skip the
   remaining attempts; otherwise proceed.
11. Save the audit and attach the sanitized attempt record to the test report.

`submitted: true` means the fill-and-click method returned successfully. It is
not an assertion that the server received, processed or rejected the request.
The test does not intercept or modify the submitted request body.

### After the run

Record the finish time and number of browser JavaScript errors, detach the
observers, and close the context. Playwright handles its browser teardown.
There is no logout step because authentication is not the expected action path.

### Why the successful-login helper is not used

`createLoginSession()` waits for authenticated `/home` content. Synthetic invalid
credentials normally cannot meet that requirement. Using it here would turn
invalid submissions into login timeouts. This suite instead reuses the existing
`LoginPage.login()` method without modifying the successful-session helper.

## 5. What “no assertions” means here

The new submission flow has no `expect()` checks for login results, no error-text
matching to declare rejection, and no polling until an expected rejection occurs.

There are still:

- Playwright's normal actionability checks for filling/clicking controls.
- Configuration guards for the bounded run.
- Operational safety checks that can stop further submissions.
- Existing cookie-dismissal verification inside the unchanged LoginPage helper.

A missing/blocked input or button can therefore cause an automation error.
Removing login-result assertions does not make every broken UI action pass.

## 6. Scope and limits

- Each attempt generates a username/password from `Date.now()`, an attempt number,
  and cryptographic random suffixes. No real credentials or dotenv values are used.
- Default **5**, maximum **100** attempts. One test per attempt, one worker, no
  retries, no repeat multiplication or sharding. Consult the audit for actual submissions.
- At least 5 seconds between attempts (default 10 seconds after the prior one).
- Same browser context, cookies, network identity and page throughout the run.
  No proxy rotation, CAPTCHA solving, lockout bypass or automatic resumption.
- Stops on HTTP 429/403/423, a challenge, lockout, server error or unexpected
  authentication. Remaining attempts are skipped. UI automation failures stop
  the run too. These are operational safeguards, not response assertions.
- Never creates users, requests resets, or invokes panel actions.
- No assertions on error messages, HTTP status, redirect, rejection or success.
  Existing LoginPage cookie handling is reused unchanged.
- Five submissions do **not** prove attack prevention. Unique nonexistent users
  do not test existing-account lockout. An agreed policy/threshold and server-side
  security telemetry are necessary for that assessment.

### Execution model and time budgets

`Array.from()` declares one separate test per attempt. It does not submit all
credentials inside a single test. The generated tests run serially; native
`repeatEach` remains **1**. The configured count is the maximum number of attempts,
not a promise that every attempt will be submitted.

| Setting | Current value |
|---|---|
| Workers / projects | One worker; dedicated config uses one project |
| Parallel execution | Disabled; describe uses serial mode |
| Retries | 0 |
| Maximum failures | 1 |
| Repeat multiplier | 1 |
| Test timeout | 90 seconds per attempt |
| Run timeout | 30 minutes |
| Page action timeout | 10 seconds |
| Page navigation timeout | 45 seconds |
| GitHub job timeout | 35 minutes |

The limits apply together. For example, requesting 100 attempts does not override
the 30-minute run deadline. Large pacing values or slow navigation may prevent
completion of the full requested count.

## 7. Safety stops—not security-result assertions

| Signal observed | Recorded stop reason | Meaning for this runner |
|---|---|---|
| QA2 HTTP 429 | `rate_limited` | Stop sending further attempts |
| QA2 response with `cf-mitigated: challenge` | `security_challenge` | Do not attempt to bypass the challenge |
| QA2 HTTP 403 or 423 | `access_blocked` | Stop for operator review |
| QA2 HTTP 5xx | `server_error` | Do not continue against an unhealthy service |
| Visible CAPTCHA/challenge or known blocking text | `security_control` | Stop; do not solve or dismiss it to continue |
| `/home` route or visible Devices navigation | `unexpected_authenticated` | Stop rather than access authenticated features |
| Failure of navigation, fill, click or other automation | `automation_error` | Fail the attempt and halt execution |

The network observer considers same-origin QA2 responses, not only a proven
authentication endpoint. A blocked QA2 asset can therefore stop the run too.
Third-party telemetry responses are ignored. These conservative signals do not
establish that the application's authentication policy caused a block.

HTTP responses are observed as they arrive; visible UI signals are checked at
the defined checkpoints, not continuously. A transient or differently worded
challenge may be missed. The implementation is not an exhaustive security-control
detector, and an HTTP 200 response alone does not mean authentication succeeded.

A stop detected **before submission** skips that attempt and subsequent attempts.
A stop detected **after submission** records an annotation; that submitted test
can remain green while subsequent attempts are skipped. Always inspect the audit
status and actual submission count, not just the green test count or process exit.

## 8. Manual GitHub Actions

After this change is pushed to the default branch, select **Negative Login Security
Observation**. Set `attempts` (1–100), `interval_ms` (5000–60000), and check the
authorization checkbox only when the QA2 security team is ready. There is no
scheduled or push trigger and no credentials are injected.

The workflow uses the same per-branch concurrency group as the authentication
monitors. This does not serialize local runs, runs on other branches, or smoke
tests: coordinate those separately with the monitoring team.

## 9. Local execution

Run the `test:login-security` npm script only when your team is ready. Explicitly
invoking this dedicated script opts in to the QA2 run: it sets the approval flag
for its child process using `cross-env` (Windows/Linux compatible). No credential
configuration is needed. Defaults are five submissions with ten-second pacing.
Local runs open a visible Chrome browser; GitHub Actions stays headless.
The GitHub workflow still requires its authorization checkbox before this step.

Optional settings and direct-Playwright invocation:

| Variable | Meaning |
|---|---|
| `LOGIN_SECURITY_APPROVED=true` | Set automatically by the npm script; required manually when invoking Playwright directly |
| `LOGIN_SECURITY_ATTEMPTS=5` | Attempt count, hard limit 100 |
| `LOGIN_SECURITY_INTERVAL_MS=10000` | Minimum gap after an attempt, in milliseconds |

Normal project test discovery excludes this spec. Dedicated config fixes the
target to QA2 and checks resolved CLI settings before allowing execution.

This dedicated config intentionally does not load dotenv. To change the count or
gap locally, supply the process environment settings before invoking the script;
editing values in a dotenv file alone does not configure this suite. In GitHub
Actions, use the workflow inputs instead. No real username/password settings are
required in either case.

The earlier startup error about `LOGIN_SECURITY_APPROVED` was an approval flag
check, not a failure fetching credentials. The npm command now sets that flag for
its child process without permanently changing the terminal environment.

Local browser mode is controlled by `CI`: visible Chrome when `CI` is not exactly
`'true'`, headless Chrome when it is `'true'`. Browser mode does not alter credential
generation, pacing or submission logic.

## 10. Evidence and audit fields

- [Security audit](../test-results/login-security/security-audit.json): run and attempt metadata.
- [Playwright JSON results](../test-results/login-security/results.json): machine-readable execution results.
- [HTML report](../playwright-report/login-security/index.html): human-readable execution report.
- GitHub Actions uploads these as a separate security-evidence artifact; existing
  Allure publication and Slack workflows remain unchanged.

The local audit/report locations are reused by subsequent runs. Copy evidence
needed for a particular investigation before running again. The GitHub artifact
name includes run ID and attempt number; retention is configured for 14 days.

### Run-level audit fields

| Field | Meaning |
|---|---|
| `runId` | UUID for correlation; first eight characters appear in usernames |
| `target` | `QA2` |
| `startedAt`, `finishedAt` | UTC ISO timestamps for the run |
| `requestedAttempts` | Requested maximum, not actual submission count |
| `minimumGapMs` | Configured post-submission pacing interval |
| `status` | `running`, `completed_submissions`, `stopped`, or `incomplete` |
| `stopReason` | Included when the runner stops early |
| `pageErrorCount` | Count of browser page errors; messages are not recorded |
| `scope` | Reminder that the run has no authentication/security-result assertions |
| `attempts` | Records for attempts that began execution |

### Per-attempt audit fields

| Field | Meaning |
|---|---|
| `attempt` | One-based attempt number |
| `username` | Exact generated username, deliberately retained for correlation |
| `submitted` | Whether the login fill-and-click call returned successfully |
| `outcome` | `not_submitted`, `submitted_without_assertions`, `stopped_before_submission`, or `automation_error` |
| `startedAt` | Recorded just before the login method; absent if stopped earlier |
| `finishedAt` | When the attempt's final audit is saved |
| `stopReason` | May be present for a post-submission stop |
| `httpResponses` | Observed status code, method and resource type metadata |

The audit does not currently store a separate `durationMs` field. Its timestamps
include automation/pacing effects and must not be interpreted as isolated server
authentication latency. Playwright also records test execution durations.

Attempts skipped after an earlier stop do not get credential pairs or new audit
records. Use Playwright's skipped count together with the audit when assessing
how much of the requested run actually executed.

### What is deliberately not collected

Passwords, response bodies, request bodies, headers, tokens and cookies are not
included in the custom audit records. Trace, video, screenshots and automatic
Allure fill steps are disabled. Application error messages are not collected.
The dedicated config also sets `PLAYWRIGHT_NO_COPY_PROMPT=1` to suppress Playwright
1.58's automatic failure-context snapshot: the CI artifact from run 36847706958
showed that this snapshot included a synthetic password despite other recording
options being off. Existing downloaded/uploaded artifacts are not changed by
this fix. Treat those earlier artifacts as containing generated test passwords.
Only synthetic usernames are deliberately retained so the team can correlate
requests with application/security logs.

The first live validation is limited to **five** attempts and stops early if any
control intervenes. Further runs require a new monitored execution.

## 11. What the monitoring team should use

1. Note the run UUID, UTC start/finish times and requested attempt count.
2. Filter server logs by the synthetic `qa-neg-` username prefix, then correlate
  exact usernames from the audit. The prefix's presence is not itself an attack verdict.
3. Confirm server-side receipt and actual authentication/security outcomes; the
  browser case deliberately makes no assertions about these.
4. Distinguish ordinary invalid-user responses from rate limits, challenges,
  gateway errors, account-level controls and infrastructure issues.
5. Review actual submitted count, skipped attempts and any stop reason before
  deciding whether another authorized run is needed.

This is not password guessing against a known account, a valid-user rotation
test, an existing-account lockout test, or a load/denial-of-service test. Do not
infer those behaviors from five successful submission actions.

## 12. Quick answers

| Question | Answer |
|---|---|
| Does every attempt use a different username? | Yes, the generation includes the attempt number and fresh random material. |
| Does every attempt use a different password? | Yes, including a separate password-only random suffix. |
| Are real credentials taken from config? | No. |
| Are generated users registered first? | No. |
| Does it verify rejection or successful login? | No login-result assertions are present. |
| Does it sign out? | No; it stops if authenticated UI is unexpectedly observed. |
| Can I see the exact submitted usernames? | Yes, in the audit. |
| Can I recover submitted passwords from the audit? | No. Older automatic failure snapshots could expose synthetic passwords; those snapshots are now disabled for this suite. |
| Will it always send 100 attempts? | No; 100 is a maximum, default is five, and stops/timeouts can end a run earlier. |
| Does a green run prove protection against attacks? | No; the team must assess server-side security evidence. |