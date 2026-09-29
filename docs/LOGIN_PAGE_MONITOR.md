# Login and Forgot Password page monitor

Spec: [login-forgot-password-repeat.spec.js](../tests/generated/nl-authored/login-forgot-password-repeat.spec.js).
Config: [playwright.login-monitor.config.js](../playwright.login-monitor.config.js).

## Two separate tests

Each test execution performs **one flow**. Native Playwright `repeatEach` repeats each test
independently, with `workers: 1` and `retries: 0`; there are no internal `for` loops.
`LOGIN_MONITOR_REPETITIONS` defaults to **20** and is validated as an integer from **1 to 100**.
The default batch schedules **40 test executions: 20 login/logout + 20 recovery**.

### 1. Configured login/logout — one flow per execution

- Uses `createLoginSession()` with `LOGIN_MONITOR_USERNAME` and `LOGIN_MONITOR_PASSWORD`
	from the Git-ignored local environment configuration. The corrected monitor account
	does not change smoke-suite credentials. Missing settings fail explicitly rather than using another account.
	No credentials are hardcoded in this spec or printed, and authentication traces are disabled.
- Login happens in `beforeAll`, which Playwright reruns for each repetition with a fresh login session.
- Every cycle asserts the authenticated `/home` page and Devices navigation are visible,
	dismisses any cookie dialog that locks scrolling, scrolls to the bottom **every cycle**,
	brings `#menu-SignOutMenu` into the viewport, clicks **Sign Out**,
	and verifies the login page (`/` or `/login`) with a cleared password
	and disabled Sign In button. Each browser is closed after logout; the next cycle starts fresh.
	- Waits up to 10 seconds for the asynchronous panel out-of-sync notice. If present,
	  dismisses it with Escape and records an environment-warning annotation before scrolling.
	  Never clicks SYNC MANUALLY or changes panel state.
- Each execution passes only if its login/logout flow succeeds, with an independent result per repetition.
- Setup and teardown timeouts: 180 seconds each. Test timeout: 180 seconds per execution. No retries.
- Does not arm/disarm the security system or modify account settings.

### 2. Forgot Password — one unauthenticated flow per execution

Each repetition uses a fresh, unauthenticated fixture browser context and performs the following once:

Consent handling is registered before navigation and remains active through the entire flow.
Playwright dismisses late or recurring **Cookie Information** popups during actionability checks
using **ACCEPT ALL**, **CONFIRM MY CHOICES**, the legacy TrustArc button, or the cookie-specific
**OK** dialog. It waits for dismissal rather than forcing clicks through the overlay. An unrelated
error dialog is not dismissed, and a consent popup that cannot close still fails the test.

1. Load `/login`; require a successful document response.
2. Verify visible, editable, empty username/password inputs and a disabled Sign In button.
3. Follow **Problems signing in? → Forgot your password**.
4. Verify the recovery heading, instructions, empty editable username input, and disabled NEXT button.
5. Follow **Return To Sign In** and verify the login form again.

Each execution passes only after its complete flow succeeds, with a 90-second timeout.
Each successful flow is logged as `Forgot Password iteration N PASS`, using a one-based repetition index.

This recovery test does not submit a reset request, change a password, or verify email/OTP delivery.
It intentionally does not use the authenticated `createLoginSession()` helper.
Browser JavaScript/console errors are attached as diagnostics, not treated as functional assertion failures.
A passing recovery test confirms navigation/form behavior, not an error-free console or reset delivery.

## Run modes

Use these npm scripts from the project root:

| Command | Behavior |
| --- | --- |
| `npm run test:login-pages:once` | Explicit `--repeat-each 1`: one login/logout + one recovery flow, two test executions |
| `npm run test:login-pages` | One batch with configured repetitions of each test; default 40 executions, 20 each |
| `npm run test:login-logout` | Only login/logout, with configured repetitions; default 20 executions |
| `npm run test:forgot-password` | Only recovery navigation/form checks, with configured repetitions; default 20 executions |
| `npm run test:login-pages:continuous` | Repeat configured batches until Ctrl+C; default 40 executions per batch |

`LOGIN_MONITOR_REPETITIONS=N` configures native `repeatEach`, producing **N real logins**
and **N recovery flows**, or **2 × N test executions** per full batch.
An explicit CLI `--repeat-each N` overrides the configured repeat count; the `:once` script
always uses `--repeat-each 1`. The environment setting must still pass config validation.

Chrome is visible by default. Stop continuous monitoring with **Ctrl+C** in its terminal.
Monitoring continues after ordinary test failures, with timestamps and cumulative failed-batch counts;
interruptions or runner errors stop it.
All cycles are sequential (one worker); a 30-second pause separates batches. This is a functional monitor, not a load test.
Repetitions control the number of executions within a batch, not how often batches or workflow runs start.

Optional environment variables (set in the shell before starting):

| Variable | Default | Purpose |
| --- | --- | --- |
| `LOGIN_MONITOR_USERNAME` | Required, local configuration | Corrected account for every login repetition |
| `LOGIN_MONITOR_PASSWORD` | Required, local configuration | Password for that account; never log or commit |
| `LOGIN_MONITOR_BASE_URL` | `https://qa2.totalconnect2.com` | Recovery test URL only; authenticated login uses the existing test-data config URL |
| `LOGIN_MONITOR_REPETITIONS` | `20` | Executions of each test per batch; validated integer 1–100 |
| `LOGIN_MONITOR_INTERVAL_MS` | `30000` | Pause between batches, minimum 1000 ms |
| `LOGIN_MONITOR_MAX_BATCHES` | `0` | Batch limit; zero means continuous |
| `HEADLESS` | `false` | Set `true` to hide Chrome; CI is always headless |

The monitor loads dotenv settings for the configured login helper, but does not load the normal
Playwright config, clear Allure output, invoke AI healing, notify Slack, or use LambdaTest.
It forces local browser execution even if the normal environment selects LambdaTest.
Use the dedicated scripts/config rather than the default smoke command.

## Results

- Terminal: individual repetition outcomes (default 40 executions), plus batch timestamps and cumulative failed-batch counts in continuous mode.
- Each execution records a one-based Allure `iteration` parameter. It is not excluded from history identity,
  so repetitions have distinct Allure history IDs and appear as separate results, not collapsed retries or nested cycles.
- HTML report: `playwright-report/login-monitor/index.html` (latest completed batch).
- Failure screenshots: `test-results/login-monitor/` (latest batch); traces/video are disabled for this spec to avoid recording credential entry.
- The recovery test attaches `browser-diagnostics` JSON, including JavaScript exceptions and console errors.
- The authenticated test captures a masked screenshot on assertion failure; its manually created
	sessions do not produce automatic fixture traces. Each successful cycle is logged without credentials.

The next batch replaces the previous batch's report and artifacts, avoiding unlimited screenshot growth.
Stop the monitor before inspecting or copying evidence you need to retain. Do not run multiple monitor instances concurrently.
Finite monitoring exits nonzero if any batch failed; continuous monitoring must be explicitly stopped.

## GitHub Actions, Allure and Slack

Workflow: [login-monitor.yml](../.github/workflows/login-monitor.yml).

- **Manual only:** use **Actions → Login and Forgot Password Tests → Run workflow**.
- No push, pull-request, or scheduled trigger is configured. You control when and how often to run it.
- Set **repetitions** in the **Run workflow** UI (default **20**, integer **1–100**) to change the count for that run.
	To change the prefilled default for future manual runs, edit `on.workflow_dispatch.inputs.repetitions.default`
	in [login-monitor.yml](../.github/workflows/login-monitor.yml). This does not change the local config default.
- Every workflow run makes a **single `npm run test:login-pages` invocation**, passing the input through
	`LOGIN_MONITOR_REPETITIONS` to native Playwright `repeatEach`; there are no shell `for` loops or retries.
- Runs one bounded batch: **20 executions of each test by default, 40 total**.
	The continuous local runner is deliberately not used on GitHub-hosted runners.
- Uses headless hosted Chrome, one worker, zero retries, no healing, and serialized report-publishing jobs.
- The job limit is **120 minutes**; Playwright has a **100-minute CI global timeout**, leaving time for reporting.
	High repetition counts can exhaust this budget before all executions complete; accepting 100 does not guarantee completion.
- Repetition count and run frequency are separate: changing the count does not schedule future runs.
- The normal Playwright configuration excludes this spec so existing smoke/generated workflows do not run it with the wrong account.

### Required repository Actions secrets

Set these under **Settings → Secrets and variables → Actions** (not workflow inputs or tracked files):

| Secret | Purpose |
| --- | --- |
| `LOGIN_MONITOR_USERNAME` | Corrected monitor account username from local configuration |
| `LOGIN_MONITOR_PASSWORD` | Corrected monitor account password from local configuration |
| `SLACK_WEBHOOK_URL` | Reuse the existing smoke-suite Slack channel webhook |

The CI workflow does not fall back to the smoke suite's account. Missing secrets fail the run.
GitHub must permit the workflow's `contents: write` permission for the existing `gh-pages` deployment.
The local environment configuration is ignored by Git and must never be committed.

### Report delivery

- CI enables the existing `allure-playwright` reporter; results are isolated under `allure-results/login-monitor/`.
- Publishes with the same GitHub Pages action used by smoke tests, retaining existing reports.
- All three publishing workflows share the `allure-gh-pages` job concurrency group,
  preventing simultaneous `gh-pages` pushes and the resulting non-fast-forward rejection.
  The authentication job may wait for an existing report job to finish before starting.
- Permanent report: `https://devkesh.github.io/playwright-project-mtech/login-monitor/runs/<run-id>/<attempt>/`.
- Latest authentication report: `https://devkesh.github.io/playwright-project-mtech/login-monitor/latest/`.
- The existing Slack notifier sends the suite name with the configured repetition count, aggregated test results
	(**40 executions by default when the batch completes**), and the hosted per-run Allure report link.
	Each repetition is a separate result with an Allure `iteration` parameter; steps describe that execution's single flow.
- Raw results/screenshots are retained for 14 days; Allure report and portable HTML artifacts for 30 days.
- Reports and Slack notification are attempted even after test failure. A failed test still fails the workflow.
- If Pages publishing fails or the run is on a non-main branch, Slack links only to the Actions run; the report remains a downloadable artifact.

For local Allure verification, set `LOGIN_MONITOR_ALLURE=true` before a finite run.
Normal continuous local execution keeps Allure disabled unless explicitly opted in.