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
| [Submission spec](../tests/generated/nl-authored/login-security.spec.js) | Independent attempts: open login, fill credentials, click Sign In |
| [Data helper](../framework/utils/login-security.js) | Generates credentials and reads count/pacing settings |
| [Dedicated Playwright config](../playwright.login-security.config.js) | QA2 target, browser mode, timeouts, one worker and isolated reports |
| [Existing LoginPage](../framework/pages/generated/smoke/LoginPage.js) | Existing Username, Password, Sign In locators and cookie handling |
| [npm scripts](../package.json) | Exposes `test:login-security` without an approval flag |
| [Manual GitHub workflow](../.github/workflows/login-security.yml) | Accepts attempt count and pacing; uploads evidence |
| [Normal Playwright config](../playwright.config.js) | Excludes this security spec from ordinary project discovery |

## 3. Exact username and password generation

### Data source

The credential generator is `uniqueInvalidCredentials(attempt, runId, now)`.
It does **not** fetch a username or password from application config, dotenv,
repository secrets, the monitor account, or the smoke account.

The pieces used are:

| Piece | Exact source | Changes when? |
|---|---|---|
| Run identifier | Node.js `randomUUID()` | Once per worker; regenerated when Playwright replaces a failed worker |
| Run prefix | `runId.slice(0, 8)` | Once per worker; used only in username |
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

## 4. Simple execution and results

Each numbered test uses Playwright's standard independent `page` fixture:

1. Generate a unique synthetic username and password.
2. Open `/login` and dismiss the cookie popup through the existing LoginPage.
3. Fill Username and Password, then click Sign In once using `LoginPage.login()`.
4. Report **passed** if those actions complete, or **failed** with the original
   Playwright error, locator and call log if they do not.
5. Capture a failure screenshot automatically and continue to the next test.

The configured pacing interval runs after every attempt, including failures.
There are no approval gates, blocker/status checks, custom audit, generic
`automation_error` replacement, serial dependencies, or fail-fast limit.
Each test has a fresh browser context/page. Playwright manages teardown and
replaces a failed worker automatically; this is normal test isolation, not a retry.

There are still no login-result assertions. A pass means submission actions
completed, not that authentication succeeded or rejection was correct.
The existing cookie helper and Playwright's normal actionability waits remain.
If the login form is unavailable, the action fails normally; the runner does not
solve CAPTCHA, bypass access controls or special-case a blocked page.

`createLoginSession()` is deliberately not used: it waits for successful
authentication, which is not the purpose of these synthetic submissions.

## 5. Run locally or in GitHub Actions

- Locally, use the `test:login-security` npm script. Chrome opens visibly.
- In GitHub Actions, start **Negative Login Security Observation** on the desired
  branch, enter the attempt count and pacing interval, and click **Run workflow**.
  There is no approval checkbox. CI uses headless Chrome.
- No real credentials, repository secrets or dotenv settings are needed.
- For local settings, use process environment variables; this config does not
  load dotenv. In GitHub Actions, use the workflow inputs.

| Setting | Default / range |
|---|---|
| `LOGIN_SECURITY_ATTEMPTS` / `attempts` | 5; accepts 1–100 |
| `LOGIN_SECURITY_INTERVAL_MS` / `interval_ms` | 10000 ms; accepts 5000–60000 |
| Workers | 1; tests execute sequentially but independently |
| Retries / repeatEach | 0 / 1 |
| `maxFailures` | 0 (no fail-fast limit) |
| Test timeout | 90 seconds |
| Action / navigation timeouts | 10 / 45 seconds |
| GitHub job timeout | 35 minutes |

Basic numeric input validation remains so the count and pacing settings are
usable. The custom resolved-configuration setup has been removed. A failed test
does not stop later attempts; explicit cancellation, a job timeout or a runner
failure can still interrupt execution. Large counts with slow pacing can exceed
the GitHub job timeout.

The workflow remains manual-only, shares the existing per-branch authentication
concurrency group, and does not change the positive monitor, Allure or Slack.

## 6. Failure messages, screenshots and reports

The HTML report shows each attempt's status, failing step, original Playwright
error and attached screenshot. The JSON report contains machine-readable results.
Screenshots are saved in each failed test's output folder and included in the
existing GitHub artifact. They are captured after test hooks, including pacing.

Input fields are hidden only during screenshot capture so credential values do
not appear inside those fields in the image. Trace, video and automatic DOM
failure snapshots remain disabled. The original Playwright error is no longer
replaced: fill-action call logs may contain the generated **synthetic** values.
This suite never reads real account credentials. Treat reports as test evidence,
not as guaranteed credential-free artifacts.

If the browser has crashed or closed, Playwright may be unable to capture a
screenshot; the original failure still appears. The custom security audit and
HTTP observer are no longer produced. Older downloaded artifacts are unchanged.

The workflow uploads the results and HTML report for 14 days. A later local run
reuses its report/output locations, so preserve evidence before rerunning.