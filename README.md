# Multi-Agent AI Self-Healing Test Framework

Playwright automation for Total Connect 2.0 QA, with optional AI locator recovery, failure analysis, English-to-test authoring, Allure reporting, LambdaTest execution, and GitHub Actions. Developed as Keshav TN's MTech dissertation project at BITS Pilani WILP.

Operational documentation updated for the 5 November 2026 revamp. The supplied May dissertation establishes the research baseline; implementation differences and newer concepts are explicitly recorded, not presented as proven historical results. This update does not claim live verification.

## Start Here

- [docs/FRAMEWORK_NAVIGATION_GUIDE.md](docs/FRAMEWORK_NAVIGATION_GUIDE.md): short onboarding, named accounts, native tags and old-to-new command/path mapping.
- [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md): complete plain-language walkthrough, design decisions, limitations, interview answers, and study plan.
- [docs/TEST_FRAMEWORK_ARCHITECTURE.md](docs/TEST_FRAMEWORK_ARCHITECTURE.md): current architecture, dissertation correction matrix, implementation evidence, and remaining work.
- [.github/copilot-instructions.md](.github/copilot-instructions.md): rules for generating new Total Connect tests. These rules are not proof that older generated files comply.

Use onboarding and commands here for current execution. The longer guides retain dated research evidence; historical screenshots and timing claims are not current benchmarks. In VS Code select `framework-maintainer`, then use `/add-test`, `/add-suite`, `/add-account`, `/configure-ci`, or `/diagnose-failure`. These customizations guide behavior, not sandbox it or authorize execution.

## Setup

Use Node.js 22 LTS, matching the pinned authentication workflows, and npm. Chrome is the configured browser channel; installing only bundled Chromium does not install Chrome.

```powershell
npm install
npx playwright install chrome
```

Use the existing lockfile with `npm ci` for reproducible installs. Privately provision one ignored `.env.qa` from the committed blank template, not files per account. Shell environment takes precedence; CI uses injected secrets. Never put credentials in config, prompts, specs, screenshots, or shared reports. Config imports and collection do not load credentials/providers; accounts resolve only at authenticated execution.

| Purpose | Variables |
|---|---|
| Approved smoke/monitor account | `ACCOUNT_APPROVED_MONITOR_USERNAME`, `ACCOUNT_APPROVED_MONITOR_PASSWORD` |
| Additional named account, e.g. secondary | `ACCOUNT_SECONDARY_USERNAME`, `ACCOUNT_SECONDARY_PASSWORD`; select with `test.use({ account: 'secondary' })` |
| Manual browser sessions | `EXECUTION_PLATFORM=local` or `lambda`, `HEADLESS`, `BROWSER_CHANNEL` |
| OpenAI healing | `AI_HEALING_ENABLED=true`, `OPENAI_API_KEY`; defaults: `gpt-4o-mini` healing, `gpt-4o` analysis |
| LambdaTest | `LT_USERNAME`, `LT_ACCESS_KEY`, optional browser/platform/build settings |
| Slack | `SLACK_ENABLED=true`, `SLACK_WEBHOOK_URL`; optional report/run URLs |
| Local report opening | Explicit `npm run report:allure:open`; root HTML reporting uses `open: 'never'` |

`getAccount(name)` accepts `^[a-z][a-z0-9_]*$` names and resolves `ACCOUNT_<UPPER_NAME>_USERNAME/PASSWORD`. `approved_monitor` is the default authenticated account and the only permitted `@panel` account. Transitional `LOGIN_MONITOR_*` (approved_monitor) and `TC_*` (configured) apply only when the entire canonical pair is absent. Empty or partial pairs fail; sources are never mixed. Existing CI monitor secret names are bound to canonical variable names.

Azure routing exists through `AI_PROVIDER=azure` and `AZURE_ANTHROPIC_ENDPOINT`, `AZURE_ANTHROPIC_API_KEY`, `AZURE_ANTHROPIC_MODEL`. It is an Anthropic-compatible Azure Foundry client, not Azure OpenAI. Optional local routing is retained; live parity remains unverified. RAG embeddings are OpenAI-specific and retrieval is not connected to live healing prompts.

## Choose the Execution Lane

Live smoke can arm/disarm physical security equipment. Run it only with an approved QA account and panel. Negative-login runs and cloud/AI calls require separate authorization and may have side effects or cost.

```powershell
# Offline Node checks and synthetic browser contracts
npm test
npm run test:framework:browser

# Collection only, without credentials or live requests
npx playwright test --project tc2 --grep @smoke --list

# Approved live smoke; still sends panel commands
npm run test:smoke -- --headed

# Approved live regression selection
npm run test:regression -- --grep @devices

# One repetition of each login/logout and recovery-form test
npm run test:monitoring -- --repeat-each 1

# Default 20 repetitions of each monitor test
npm run test:monitoring

# Only login/logout or only recovery-form navigation
npm run test:login-logout
npm run test:forgot-password
```

All live fixtures require `RUN_LIVE_TESTS=true`; live scripts set it. Keep that flag out of a global shell default. Public tests use the guarded native page from `tc.fixture` or `login-security.fixture`, not raw Playwright `test`. No public authentication or healing is allowed. Business tests use named POMs from `smoke.fixture`, intentionally layered on `tc.fixture` for fresh per-test session lifecycle.

The `monitoring` project uses local Chrome through its script, one worker, no AI, and no retries. Recovery navigation does not request a password reset. `LOGIN_MONITOR_REPETITIONS` accepts 1-100; native `--repeat-each` is explicit repetition, not failure retry. Use finite batches and review request rates before execution.

Three AlarmNet suites use named projects in [playwright.config.js](playwright.config.js), with unique tags and separate test-result directories. All URLs use `https://services.qa.alarmnet.com`:

| URL path | Unique tag | Command |
|---|---|---|
| `/AlarmNet360/AlarmNetDirectV/Login/Login/SignIn?lang=en-US` | `@alarmnet-login-security` | `npm run test:alarmnet-login-security` |
| `/AlarmNet360/Mobile` | `@alarmnet-mobile-security` | `npm run test:alarmnet-mobile-security` |
| `/AlarmNet360/AlarmNetDirectV/UserManagement/UserRegistration/ForgotLogin` | `@alarmnet-forgot-login-security` | `npm run test:alarmnet-forgot-login-security` |

The broader `@login-security` tag remains a category, not a URL-specific selector. Each command selects its matching native project. `npm run test:login-security` remains an alias for Sign In only. Sign In and Mobile submit unique synthetic invalid credentials once per iteration; review request counts/rates and authorization before running them. Forgot Login is read-only and never submits recovery requests. This is not the ordinary login monitor or proof of security resistance.

All three suites use `LOGIN_SECURITY_ATTEMPTS` (five iterations locally unless set, 100 by default in each workflow) with no hard 100-iteration ceiling. Counts must be positive safe integers. Each iteration has a default 10-second post-test delay per worker; there are five workers and no retries. Mobile uses the actual Username/Password placeholders and Login button, and observes for challenges for up to 10 seconds both before and after submission. Forgot Login observes for 10 seconds without submitting. A detected challenge fails the test. These two suites use fresh contexts without Sign In storage setup and attach JSON observations; failures capture screenshots. A pass only covers the observation window, not future challenges or verified security resistance.

Each URL has its own independently triggered workflow, report, artifact names, and Slack notification:

| Workflow | Schedule (minutes each hour, UTC) |
|---|---|
| [.github/workflows/alarmnet-login-security.yml](.github/workflows/alarmnet-login-security.yml) | 00, 10, 20, 30, 40, 50 |
| [.github/workflows/alarmnet-mobile-security.yml](.github/workflows/alarmnet-mobile-security.yml) | 03, 13, 23, 33, 43, 53 |
| [.github/workflows/alarmnet-forgot-login-security.yml](.github/workflows/alarmnet-forgot-login-security.yml) | 06, 16, 26, 36, 46, 56 |

For an approved schedule/policy change, update the fallback `'100'` in the selected wrapper's `iterations: ${{ inputs.iterations || '100' }}` expression. It controls scheduled runs and manual runs without an override; no spec change is needed. Alternatively, enter `iterations` when explicitly dispatching the workflow; blank uses that fallback. `interval_ms` can also be overridden for approved manual runs (5000-60000). Editing a wrapper does not authorize dispatch, live requests or publication.

The three workflows share a concurrency group so different URL runs do not overlap; running workflows are not canceled by newer triggers. GitHub retains only one pending run per group, so newer triggers can replace older pending runs when batches take longer than the schedule allows. Increase the schedule interval or temporarily disable schedules before large manual batches. Schedules run from the default branch and may be delayed. The reusable runner has a six-hour job limit; large counts are not a guarantee that every iteration finishes within that limit.

[.github/workflows/alarmnet-security-runner.yml](.github/workflows/alarmnet-security-runner.yml) is a compatibility wrapper over [test-execution.yml](.github/workflows/test-execution.yml), the shared executor/report pipeline. It selects one suite per invocation. Allure artifacts and Pages paths use that suite's identifier; reports are not combined under `alarmnet-security-all-urls`.

Append `-- --list --reporter=list` to a test script to preview selection without submitting requests. Run the offline observer/count regression check with `node --test framework/utils/__tests__/login-security.test.cjs`. Routine tests within an existing project need only the appropriate folder and native tags, not config/YAML changes. A genuinely new application, isolated project or schedule needs a reviewed policy change.

The one root config has six projects: `tc2`, `monitoring`, `alarmnet-login-security`, `alarmnet-mobile-security`, `alarmnet-forgot-login-security`, and offline `framework`. Bare `npm test` runs offline Node checks. Retired runner configs and broad legacy projects are not current execution entry points; see the onboarding migration table.

## Smoke Coverage

| Test | Current check |
|---|---|
| TC-001 | Authenticated home content and password field hidden |
| TC-002 | Disarmed precondition, partition selection, Arm Home, all visible status checks, disarm cleanup |
| TC-003 | Real device-category label, not arbitrary page content |
| TC-004 | Cameras route, iframe, heading |
| TC-005 | Timestamped activity entry |
| TC-006 | Nonempty live camera inventory; every discovered card is visible |
| TC-007 | Nonempty displayed names on every card; renames and duplicate names allowed |
| TC-008 | Rendered feed sections, not streaming playback |

Source: [tests/tc2/smoke-suite.spec.js](tests/tc2/smoke-suite.spec.js). Setup has a 180-second budget, panel test 300 seconds, camera tests 90 seconds. Budgets are maximums, not measured duration. Preserve the eight assertions and arm/disarm `try/finally`. No new live pass rate or timing is claimed here.

Camera smoke uses `{ dynamicInventory: true }` in the smoke fixture, with no hard-coded names or camera count. It waits for the modern live-camera section inside `#fenixPagetarget`, requires at least one card, and reads the current count on each check. Additions, removals, and renames do not require test changes. Empty inventory, hidden cards, blank names, and missing per-card feed sections still fail. DOM discovery cannot prove that every backend device was rendered, verify device identity, or prove streaming playback. Explicit-name and fixed-count constructor modes remain available for callers that require them.

Camera tests attach `camera-live-state` (current labels, feed text, and a size-limited DOM snapshot) and `camera-live-section` (cropped screenshot) before session cleanup. DOM capture excludes form fields, media elements, and URL attributes; screenshots hide editable fields but still contain camera imagery and names. Capture problems are annotated without changing the original result. Failed tests pass this scoped evidence to the existing AI analysis; renames alone require no AI call. Look for these attachments in the test report, not in an older report generated before the run.

## Optional AI and Cloud

```powershell
# Optional local repair on an approved non-panel regression selection
npx cross-env RUN_LIVE_TESTS=true AI_HEALING_ENABLED=true playwright test --project tc2 --grep @regression --grep-invert @panel --workers 1

# Cloud smoke requires separate cloud and panel approval
npm run test:lambda:smoke

# Review existing local evidence
npm run ai:review
npm run ai:metrics
npm run ai:audit
```

Runtime repair is installed only on eligible patched pages/locators. Smoke login precedes patching; assertions and iframe interactions are not universally healed. A successful repair does not prove the correct business result. Never use generic healing/replay for physical commands. Live/public runs, panel actions, paid AI, cloud execution, Slack and deployment each require explicit approval; enabling one does not approve the others.

Current cache behavior: exact selector lookup after failure, high-confidence writes, two recorded successes before reuse, seven-day expiry. Semantic knowledge indexing exists, but retrieval is not connected to the live healing prompt. Post-mortem source changes are suggestions; separate registry tools can modify files directly.

## Authoring

These commands make AI calls. Use reviewed, non-sensitive instructions; inspect generated files before execution.

```powershell
# No browser, but does save a preview report
npm run ai:author:preview -- --instructions "Navigate to Devices and verify device categories"

# Generate a spec using existing page-object APIs; no automatic run
npm run ai:author:generate -- --instructions "Navigate to Devices and verify device categories"

# Full authoring executes steps in a real browser before generating artifacts
npm run ai:author:login -- --instructions "Navigate to Devices and verify device categories"
```

New TC2 NL output belongs in `tests/tc2/nl-authored/` with native `@nl-authored` and `@regression` tags, using named fixtures. Canonical POMs live in `framework/pages/tc2/`; old generated/smoke modules are thin re-exports. Do not silently overwrite human-authored specs. The full authoring route executes model-produced JavaScript; it is not sandboxed. API descriptions can lag source. Generation is not a correctness guarantee, and `--run` requires separate live approval.

Additional current entry points: `ai:drift`, `ai:flaky`, `ai:lifecycle:pre`, `ai:lifecycle:post`, `ai:lifecycle:full`. Live drift can open the app; strategy/flaky analysis can call AI; optional indexing generates embeddings. Inspect each route before execution. Historical `demo:*` aliases are no longer package scripts.

## Reporting and CI

```powershell
# Run after execution so completed AI augmentation can be included
npm run report:allure:generate
npm run report:allure:open

# Produce the portable reporting artifact
npm run report:bundle
```

The root runner writes raw Allure results; local report generation is explicit. CI uses isolated current-run outputs through [test-execution.yml](.github/workflows/test-execution.yml), called by thin general/smoke/monitoring/security wrappers. There is one test execution, retries zero, and no automatic healing rerun. Optional AI/cloud tools remain separate local opt-ins.

Shared execution retains available raw evidence on failure and validates nonempty parseable results and a nonempty generated summary before publication. Failed-test reports can publish; empty results must not replace the latest report. Failed, timed-out and incomplete runs remain failures/incomplete even when partial counts pass. Slack receives a report link only after validated deployment; otherwise it must describe the unavailable report without a fabricated link. Hard runner cancellation can still prevent cleanup/upload and may require an operator panel check.

Manual authenticated sessions consume passed headless/channel/timeout settings, but artifact capture remains explicitly owned by the fixture. Generating a local report does not prove live acceptance or deployed workflow success. Legacy convenience aliases may forward to canonical scripts; use the canonical set above. Some optional lifecycle chains still skip later work after failure, so they are not the shared CI executor.

## Offline Framework Checks

These existing tests use synthetic pages or mocked integrations, not the live QA application:

```powershell
npm test
npm run test:framework:browser
```

Chrome is needed for synthetic-browser checks. Live smoke is a different lane and is never an offline check. No terminal tests were run as part of this documentation/customization update.

## Limits and Next Steps

Before production use, validate live panel cleanup and provider parity under explicit approval, review redaction and legacy secret exposure, and address generated-code isolation, run-scoped recovery evidence, metric denominators and retrieval integration. Single-config/account/CI safeguards are implemented contracts, not proof of live acceptance. Historical statements about absolute accuracy, universal human approval, zero cost, or guaranteed sub-second healing are not supported guarantees.

The [architecture report](docs/TEST_FRAMEWORK_ARCHITECTURE.md) explains these gaps with source evidence. The [interview guide](docs/PROJECT_GUIDE.md) shows how to discuss the implemented work, tradeoffs, and remaining improvements confidently and honestly.