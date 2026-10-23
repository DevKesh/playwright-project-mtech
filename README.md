# Multi-Agent AI Self-Healing Test Framework

Playwright automation for Total Connect 2.0 QA, with optional AI locator recovery, failure analysis, English-to-test authoring, Allure reporting, LambdaTest execution, and GitHub Actions. Developed as Keshav TN's MTech dissertation project at BITS Pilani WILP.

Documentation reviewed against the working tree on 19 October 2026. The supplied May dissertation establishes the research baseline; implementation differences and newer concepts are explicitly recorded, not presented as proven historical results.

## Start Here

- [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md): complete plain-language walkthrough, design decisions, limitations, interview answers, and study plan.
- [docs/TEST_FRAMEWORK_ARCHITECTURE.md](docs/TEST_FRAMEWORK_ARCHITECTURE.md): current architecture, dissertation correction matrix, implementation evidence, and remaining work.
- [.github/copilot-instructions.md](.github/copilot-instructions.md): rules for generating new Total Connect tests. These rules are not proof that older generated files comply.

The two guides above supersede older usage/architecture narratives where they conflict. Historical screenshots and timing claims are not current benchmarks.

## Setup

Use Node.js 22 LTS, matching the pinned authentication workflows, and npm. Chrome is the configured browser channel; installing only bundled Chromium does not install Chrome.

```powershell
npm install
npx playwright install chrome
```

Use the existing lockfile with `npm ci` for reproducible CI installs. Configure required environment variables privately; never put credentials in prompts, generated tests, screenshots, or shared reports. Some legacy configuration still has credential fallbacks and needs hardening; the current smoke account is explicitly required.

| Purpose | Variables |
|---|---|
| Approved smoke/monitor account | `LOGIN_MONITOR_USERNAME`, `LOGIN_MONITOR_PASSWORD` |
| Older helper callers | `TC_USERNAME`, `TC_PASSWORD`; do not depend on fallback values |
| Manual browser sessions | `EXECUTION_PLATFORM=local` or `lambda`, `HEADLESS`, `BROWSER_CHANNEL` |
| OpenAI healing | `AI_HEALING_ENABLED=true`, `OPENAI_API_KEY`; defaults: `gpt-4o-mini` healing, `gpt-4o` analysis |
| LambdaTest | `LT_USERNAME`, `LT_ACCESS_KEY`, optional browser/platform/build settings |
| Slack | `SLACK_ENABLED=true`, `SLACK_WEBHOOK_URL`; optional report/run URLs |
| Local report opening | `OPEN_REPORT`; Playwright HTML uses separate `PW_OPEN_REPORT` |

Azure routing exists through `AI_PROVIDER=azure` and `AZURE_ANTHROPIC_ENDPOINT`, `AZURE_ANTHROPIC_API_KEY`, `AZURE_ANTHROPIC_MODEL`. It is an Anthropic-compatible Azure Foundry client, not Azure OpenAI. OpenAI-specific guards and model overrides remain in some entry points, so it is not yet a fully interchangeable provider.

## Choose the Execution Lane

Live smoke can arm/disarm physical security equipment. Run it only with an approved QA account and panel. Negative-login runs and cloud/AI calls require separate authorization and may have side effects or cost.

```powershell
# List smoke tests only; do not execute them
npx playwright test --config playwright.smoke-validation.config.js --list

# Live smoke, isolated outputs, AI/retries disabled (still sends panel commands)
npx playwright test --config playwright.smoke-validation.config.js

# Standard live smoke with main reporting configuration
npx playwright test --project tc-smoke

# One repetition of each login/logout and recovery-form test
npm run test:login-pages:once

# Default 20 repetitions of each monitor test
npm run test:login-pages

# Only login/logout or only recovery-form navigation
npm run test:login-logout
npm run test:forgot-password
```

The monitor configuration uses local Chrome, one worker, no AI, and no retries. Recovery navigation does not request a password reset. `LOGIN_MONITOR_REPETITIONS` accepts 1-100. `test:login-pages:continuous` runs batches until stopped unless `LOGIN_MONITOR_MAX_BATCHES` is set; default interval after a batch is 30 seconds. Do not leave it running unintentionally.

Three AlarmNet suites use [playwright.login-security.config.js](playwright.login-security.config.js), with unique tags and separate result directories. All URLs use `https://services.qa.alarmnet.com`:

| URL path | Unique tag | Command |
|---|---|---|
| `/AlarmNet360/AlarmNetDirectV/Login/Login/SignIn?lang=en-US` | `@alarmnet-login-security` | `npm run test:alarmnet-login-security` |
| `/AlarmNet360/Mobile` | `@alarmnet-mobile-security` | `npm run test:alarmnet-mobile-security` |
| `/AlarmNet360/AlarmNetDirectV/UserManagement/UserRegistration/ForgotLogin` | `@alarmnet-forgot-login-security` | `npm run test:alarmnet-forgot-login-security` |

The broader `@login-security` tag remains a category, not a URL-specific selector. Each command sets `LOGIN_SECURITY_SUITE` explicitly. `npm run test:login-security` remains an alias for Sign In only. Sign In and Mobile submit unique synthetic invalid credentials once per iteration; review request counts/rates and authorization before running them. Forgot Login is read-only and never submits recovery requests. This is not the ordinary login monitor or proof of security resistance.

All three suites use `LOGIN_SECURITY_ATTEMPTS` (five iterations locally unless set, 100 by default in each workflow) with no hard 100-iteration ceiling. Counts must be positive safe integers. Each iteration has a default 10-second post-test delay per worker; there are five workers and no retries. Mobile uses the actual Username/Password placeholders and Login button, and observes for challenges for up to 10 seconds both before and after submission. Forgot Login observes for 10 seconds without submitting. A detected challenge fails the test. These two suites use fresh contexts without Sign In storage setup and attach JSON observations; failures capture screenshots. A pass only covers the observation window, not future challenges or verified security resistance.

Each URL has its own independently triggered workflow, report, artifact names, and Slack notification:

| Workflow | Schedule (minutes each hour, UTC) |
|---|---|
| [.github/workflows/alarmnet-login-security.yml](.github/workflows/alarmnet-login-security.yml) | 00, 10, 20, 30, 40, 50 |
| [.github/workflows/alarmnet-mobile-security.yml](.github/workflows/alarmnet-mobile-security.yml) | 03, 13, 23, 33, 43, 53 |
| [.github/workflows/alarmnet-forgot-login-security.yml](.github/workflows/alarmnet-forgot-login-security.yml) | 06, 16, 26, 36, 46, 56 |

Change the single `jobs.<job-name>.with.iterations: 100` value in the desired workflow to 250, 500, or another positive integer, then commit and push. That value controls scheduled runs and manual runs without an override. Alternatively, enter `iterations` in GitHub Actions > the desired workflow > Run workflow; leaving it blank uses the YAML value. No spec changes are needed. `interval_ms` can also be overridden for manual runs (5000-60000).

The three workflows share a concurrency group so different URL runs do not overlap; running workflows are not canceled by newer triggers. GitHub retains only one pending run per group, so newer triggers can replace older pending runs when batches take longer than the schedule allows. Increase the schedule interval or temporarily disable schedules before large manual batches. Schedules run from the default branch and may be delayed. The reusable runner has a six-hour job limit; large counts are not a guarantee that every iteration finishes within that limit.

[.github/workflows/alarmnet-security-runner.yml](.github/workflows/alarmnet-security-runner.yml) contains shared execution/reporting only and has no independent schedule or manual trigger. It selects exactly one suite per invocation. Allure artifacts and Pages paths use that suite's identifier; reports are no longer combined under `alarmnet-security-all-urls`.

Append `-- --list --reporter=list` to any command above to preview selection without submitting requests. Run the offline observer/count regression check with `node --test framework/utils/__tests__/login-security.test.cjs`. Tags do not create workflows automatically; each additional URL needs its own spec, unique tag, configuration entry, command, and workflow launcher.

Bare `npm test` discovers multiple projects and unrelated suites, including overlapping test ownership. Prefer an explicit project/configuration. The `total-connect` project currently contains disabled performance specs, and `tc-plan` excludes the main smoke file.

## Smoke Coverage

| Test | Current check |
|---|---|
| TC-001 | Authenticated home content and password field hidden |
| TC-002 | Disarmed precondition, partition selection, Arm Home, all visible status checks, disarm cleanup |
| TC-003 | Real device-category label, not arbitrary page content |
| TC-004 | Cameras route, iframe, heading |
| TC-005 | Timestamped activity entry |
| TC-006 | Explicit expected camera inventory |
| TC-007 | Camera names; overlaps inventory checks |
| TC-008 | Rendered feed sections, not streaming playback |

Source: [tests/generated/smoke/smoke-suite.spec.js](tests/generated/smoke/smoke-suite.spec.js). Setup has a 180-second budget, panel test 300 seconds, camera tests 90 seconds. Budgets are maximums, not measured duration. No new live pass rate or timing is claimed here.

## Optional AI and Cloud

```powershell
# Standard smoke with optional live locator repair
npx cross-env AI_HEALING_ENABLED=true playwright test --project tc-smoke

# Standard smoke on LambdaTest
npx cross-env EXECUTION_PLATFORM=lambda playwright test --project tc-smoke

# Review existing local evidence
npm run ai:review
npm run ai:metrics
npm run ai:audit
```

Runtime repair is installed only on eligible patched pages/locators. Smoke login precedes patching; assertions and iframe interactions are not universally healed. A successful repair does not prove the correct business result. Generic action recovery and whole-test retries can repeat commands, so do not enable them for safety-sensitive actions without an explicit policy.

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

The full authoring route executes model-produced JavaScript; it is not sandboxed. The generator's API description can lag page-object changes. Existing source checks and focused execution are required; generation is not a correctness guarantee.

Additional current entry points: `ai:drift`, `ai:flaky`, `ai:lifecycle:pre`, `ai:lifecycle:post`, `ai:lifecycle:full`. Live drift can open the app; strategy/flaky analysis can call AI; optional indexing generates embeddings. Inspect each route before execution. Historical `demo:*` aliases are no longer package scripts.

## Reporting and CI

```powershell
# Run after execution so completed AI augmentation can be included
npm run report:allure:generate
npm run report:allure:open

# Produce the portable reporting artifact
npm run report:bundle
```

The main runner generates timestamped Allure reports, while dedicated suites use isolated outputs. Manual browser contexts do not automatically inherit runner artifact settings. The auto-report generation order is not a guarantee that all AI evidence is included; explicitly regenerate when needed.

Five GitHub Actions workflows cover general testing, weekday smoke, login/recovery, login/logout, and negative-login observation. Some perform a separate healing rerun on failure. Publishing supports versioned run reports and a latest pointer; original/healed result sets are kept separate rather than merged into duplicate test counts. Slack is an optional summary, not the test verdict.

The convenience `execute:smoke` scripts contain single `&`, whose meaning differs across Windows and POSIX shells. Several other scripts use success-only `&&` chains, which can skip report/notification steps after failure. Prefer explicit commands for controlled execution and inspect workflow failure propagation before using it as a release gate.

## Offline Framework Checks

These existing tests use synthetic pages or mocked integrations, not the live QA application:

```powershell
node --test framework/utils/__tests__/smoke-page-objects.test.cjs framework/utils/__tests__/login-cookie-consent.test.cjs framework/utils/__tests__/slack-notify.test.cjs
```

Chrome is needed for the synthetic-browser checks. The isolated *smoke validation configuration* is different: it runs the real smoke suite and is not an offline test.

## Limits and Next Steps

Before production use, address physical-action retry policies, secret fallbacks/redaction, provider-aware guards/models, enforced AI feature flags, generated-code isolation, run-scoped recovery evidence, metric denominators, retrieval integration, and failure-safe reporting. Historical statements about absolute accuracy, universal human approval, zero cost, or guaranteed sub-second healing are not supported guarantees.

The [architecture report](docs/TEST_FRAMEWORK_ARCHITECTURE.md) explains these gaps with source evidence. The [interview guide](docs/PROJECT_GUIDE.md) shows how to discuss the implemented work, tradeoffs, and remaining improvements confidently and honestly.