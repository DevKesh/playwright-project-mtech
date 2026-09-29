# Login and Forgot Password page monitor

Spec: [login-forgot-password-repeat.spec.js](../tests/generated/nl-authored/login-forgot-password-repeat.spec.js).
Config: [playwright.login-monitor.config.js](../playwright.login-monitor.config.js).

## Two separate tests

### 1. Configured login/logout — five successful cycles

- Uses `createLoginSession()` with `LOGIN_MONITOR_USERNAME` and `LOGIN_MONITOR_PASSWORD`
	from the Git-ignored local environment configuration. The corrected monitor account
	does not change smoke-suite credentials. Missing settings fail explicitly rather than using another account.
	No credentials are hardcoded in this spec or printed, and authentication traces are disabled.
- The first login happens in `beforeAll`; four further logins happen inside the test.
- Every cycle asserts the authenticated `/home` page and Devices navigation are visible,
	dismisses any cookie dialog that locks scrolling, scrolls to the bottom **every cycle**,
	brings `#menu-SignOutMenu` into the viewport, clicks **Sign Out**,
	and verifies the login page (`/` or `/login`) with a cleared password
	and disabled Sign In button. Each browser is closed after logout; the next cycle starts fresh.
	- Waits up to 10 seconds for the asynchronous panel out-of-sync notice. If present,
	  dismisses it with Escape and records an environment-warning annotation before scrolling.
	  Never clicks SYNC MANUALLY or changes panel state.
- The single test passes only if all **five** complete login/logout cycles succeed.
- Setup timeout: 180 seconds. Test timeout: 900 seconds for all five cycles. No retries.
- Does not arm/disarm the security system or modify account settings.

### 2. Forgot Password — three unauthenticated cycles

Uses a fresh, unauthenticated browser context and repeats the following **three times**
in the same context, reloading the login page at the start of each cycle:

1. Load `/login`; require a successful document response.
2. Verify visible, editable, empty username/password inputs and a disabled Sign In button.
3. Follow **Problems signing in? → Forgot your password**.
4. Verify the recovery heading, instructions, empty editable username input, and disabled NEXT button.
5. Follow **Return To Sign In** and verify the login form again.

The single test passes only after all **three** complete cycles succeed, with a 270-second timeout.
Each successful cycle is logged as `Forgot Password 1/3`, `2/3`, and `3/3`.

This recovery test does not submit a reset request, change a password, or verify email/OTP delivery.
It intentionally does not use the authenticated `createLoginSession()` helper.
Browser JavaScript/console errors are attached as diagnostics, not treated as functional assertion failures.
A passing recovery test confirms navigation/form behavior, not an error-free console or reset delivery.

## Run modes

Use these npm scripts from the project root:

| Command | Behavior |
| --- | --- |
| `npm run test:login-pages:once` | Both tests once: five login/logout cycles + three recovery cycles |
| `npm run test:login-pages` | Both tests once: five login/logout cycles + three recovery cycles |
| `npm run test:login-logout` | Only the five-cycle authenticated login/logout test |
| `npm run test:forgot-password` | Only the three-cycle recovery navigation/form test |
| `npm run test:login-pages:continuous` | Repeat both tests in batches until Ctrl+C |

`--repeat-each N` repeats each entire test N times, producing **5 × N real logins**
and **3 × N recovery cycles** per batch.

Chrome is visible by default. Stop continuous monitoring with **Ctrl+C** in its terminal.
Monitoring continues after failed test batches, with timestamps and cumulative failed-batch counts.
All cycles are sequential (one worker); a 30-second pause separates batches. This is a functional monitor, not a load test.

Optional environment variables (set in the shell before starting):

| Variable | Default | Purpose |
| --- | --- | --- |
| `LOGIN_MONITOR_USERNAME` | Required, local configuration | Corrected account for all five logins |
| `LOGIN_MONITOR_PASSWORD` | Required, local configuration | Password for that account; never log or commit |
| `LOGIN_MONITOR_BASE_URL` | `https://qa2.totalconnect2.com` | Recovery test URL only; authenticated login uses the existing test-data config URL |
| `LOGIN_MONITOR_INTERVAL_MS` | `30000` | Pause between batches, minimum 1000 ms |
| `LOGIN_MONITOR_MAX_BATCHES` | `0` | Batch limit; zero means continuous |
| `HEADLESS` | `false` | Set `true` to hide Chrome; CI is always headless |

The monitor loads dotenv settings for the configured login helper, but does not load the normal
Playwright config, clear Allure output, invoke AI healing, notify Slack, or use LambdaTest.
It forces local browser execution even if the normal environment selects LambdaTest.
Use the dedicated scripts/config rather than the default smoke command.

## Results

- Terminal: individual test outcomes, batch timestamps, and cumulative failed-batch counts.
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
- Every workflow invocation executes the single spec **once** (`--repeat-each 1`, zero retries).
- Runs one bounded batch: **two tests**, containing **five login/logout cycles** and **three recovery cycles**.
	The continuous local runner is deliberately not used on GitHub-hosted runners.
- Uses headless hosted Chrome with a 30-minute job limit, no retries/healing, and no overlapping workflow runs.
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
- The existing Slack notifier sends the suite name, **two test results**, and a link to the per-run Allure report.
	The five/three cycles appear as nested steps, not eight separate test cases.
- Raw results/screenshots are retained for 14 days; Allure report and portable HTML artifacts for 30 days.
- Reports and Slack notification are attempted even after test failure. A failed test still fails the workflow.
- If Pages publishing fails or the run is on a non-main branch, Slack links only to the Actions run; the report remains a downloadable artifact.

For local Allure verification, set `LOGIN_MONITOR_ALLURE=true` before a finite run.
Normal continuous local execution keeps Allure disabled unless explicitly opted in.