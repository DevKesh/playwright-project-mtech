# Framework Walkthrough and SDET Interview Guide

Research review dated 19 October 2026; operational sections updated for the 5 November 2026 single-config revamp. Based on the supplied May dissertation, with implementation differences in [TEST_FRAMEWORK_ARCHITECTURE.md](TEST_FRAMEWORK_ARCHITECTURE.md). Start with [FRAMEWORK_NAVIGATION_GUIDE.md](FRAMEWORK_NAVIGATION_GUIDE.md) for short onboarding. No live acceptance is claimed by this update.

This guide is for understanding and explaining the project, not memorizing a claim that AI was never involved. Describe your actual contribution honestly. Ownership means being able to explain decisions, validate output, debug failures, and identify limitations. Use the suggested interview wording only where it matches work you personally did.

## 1. Your Project in One Minute

> "This is a Playwright framework for testing Total Connect 2.0, a home-security web application. It checks workflows such as authentication, security-panel state, devices, cameras, and activity. I added optional AI assistance around the normal automation: when a supported locator action fails, it can inspect the current page, suggest another locator, try it, and let the original test continue. A separate process investigates tests that still fail and proposes changes for review. The project also includes test generation from English, historical analysis, cloud execution, CI workflows, and reporting. The important boundary is that a successful repair is not automatically proof of a correct business result; the assertions still matter."

Avoid "AI fixes every failure" or "100% accurate." Your strongest explanation is the distinction between automating an action and verifying a result.

## 2. The Problem You Are Solving

Imagine a test opens Cameras by finding a button called Cameras. A UI change alters the name or structure. The camera feature might still work, but the automation cannot find it. An engineer must inspect the page, identify the intended control, update the selector, and rerun the test.

Your framework assists with that repair loop. It also improves ordinary automation: shared login, reusable page objects, clearer failure messages, meaningful content checks, and consistent reporting.

There are three different problems to distinguish:

| Problem | Example | Appropriate response |
|---|---|---|
| Broken locator | The intended Cameras control exists under a different locator | A candidate for bounded locator repair. |
| Timing or environment failure | Content is still loading, a popup blocks interaction, or the panel is offline | Wait for a meaningful condition, handle known optional UI, or report the environment problem. |
| Genuine behavior defect | A command is rejected or a partition never reaches the required state | Fail and investigate; do not change the expected result to make it pass. |

Your rule-based and AI classifications are diagnostic aids, not unquestionable root-cause evidence. The same timeout can arise from several causes.

## 3. Small Vocabulary, Clear Meanings

| Term | Plain meaning in this project |
|---|---|
| Browser | Chrome running locally or remotely. |
| Context | A separate browser session with its own cookies/storage. |
| Page | A tab within that session. |
| Locator | A repeatable instruction for finding an element, not a saved screenshot coordinate. |
| Assertion | The check deciding whether the observed result meets the requirement. |
| Page object | A class that owns a page's locators and interactions. |
| Flow | A reusable sequence spanning several interactions or pages. |
| Fixture | Setup/cleanup and dependencies supplied by the test runner. |
| DOM | The browser's structured representation of the page. |
| iframe | Another document embedded inside the page; Cameras uses one. |
| Agent | A specialized module with a task, prompt, input, and output. |
| Graph/state | A workflow with named steps and a shared record of progress. |
| Runtime healing | Recovery while the failing test is still executing. |
| Post-mortem | Investigation after a test attempt has failed. |
| Cache | Reuse an exact previously recorded answer. |
| RAG | Retrieve related evidence before asking the model; only partially connected here. |
| Embedding | A numeric representation used to compare text similarity. |
| Correlation ID | An identifier intended to connect related evidence records. |
| CI/CD | Automatically running checks and publishing outputs through pipeline jobs. |
| Flaky test | An inconsistent result under otherwise unchanged relevant conditions, not simply any timeout. |

## 4. Where Things Live

Start from [package.json](../package.json), then follow the selected configuration, spec, helper, page object, and any optional AI path. A file's presence is not proof it participates in your chosen run.

| Area | Responsibility and useful starting point |
|---|---|
| Root configuration | [One runner](../playwright.config.js): `tc2`, `monitoring`, `alarmnet-login-security`, `alarmnet-mobile-security`, `alarmnet-forgot-login-security`, `framework`. |
| Environment/accounts | [Environment loader](../framework/config/environment.js), [named accounts](../framework/config/accounts.js); ignored `.env.qa` locally, CI secret injection, no import-time credential/provider loading. |
| Authentication/browser helpers | [Login session](../framework/utils/login-session.js), [browser launcher](../framework/utils/browser-launcher.js). |
| Main tests | [Eight-test smoke](../tests/tc2/smoke-suite.spec.js), [login/recovery](../tests/monitoring/login-forgot-password-repeat.spec.js), [clip export](../tests/tc2/export-clip.spec.js); security under `tests/security/`, new NL output under `tests/tc2/nl-authored/`. |
| Page objects | [Login](../framework/pages/tc2/LoginPage.js), [Home](../framework/pages/tc2/TotalConnectHomePage.js), [Devices](../framework/pages/tc2/DevicesPage.js), [Cameras](../framework/pages/tc2/CamerasPage.js), [Activity](../framework/pages/tc2/ActivityPage.js). Old generated/smoke modules are thin re-exports. |
| Conventional reuse | [TC session fixture](../framework/fixtures/tc.fixture.js), [smoke POM fixtures](../framework/fixtures/smoke.fixture.js), [security fixtures](../framework/fixtures/login-security.fixture.js), [demo fixture](../framework/fixtures/app.fixture.js). |
| AI integration | [TC AI fixture](../framework/ai/fixtures/tc.ai.fixture.js), [demo AI fixture](../framework/ai/fixtures/app.ai.fixture.js), [locator patch](../framework/ai/core/locator-proxy.js). |
| AI orchestration | [Runtime graph](../framework/ai/graph/runtime-graph.js), [post-mortem graph](../framework/ai/graph/healing-graph.js), [lifecycle](../framework/ai/graph/lifecycle-graph.js), [exploration](../framework/ai/graph/exploration-graph.js), [NL authoring](../framework/ai/graph/nl-authoring-graph.js). |
| Provider access | [Common factory](../framework/ai/core/ai-client-factory.js), [OpenAI client](../framework/ai/core/openai-client.js), [Azure client](../framework/ai-azure/core/azure-ai-client.js). |
| Records | [Healing history](../framework/ai/storage/healing-history.js), [cache](../framework/ai/storage/healing-cache.js), [report writer](../framework/ai/storage/report-writer.js), [audit trail](../framework/ai/audit/audit-trail.js). |
| Reporting | [AI reporter](../framework/ai/reporters/ai-healing-reporter.js), [Allure reporter](../framework/reporters/allure-auto-reporter.js), [Slack notifier](../framework/utils/slack-notify.js). |
| Framework checks | [Page-object checks](../framework/utils/__tests__/smoke-page-objects.test.cjs), [cookie-consent checks](../framework/utils/__tests__/login-cookie-consent.test.cjs), [Slack checks](../framework/utils/__tests__/slack-notify.test.cjs). |

Generated reports and artifacts are outputs, not framework logic. Historical report folders are useful only when you can identify the producing run and configuration.

## 5. Follow One Smoke Run End to End

### Step 1: Select the Test Lane

For an approved live smoke run, use `npm run test:smoke`, which selects project `tc2` and native `@smoke`. Bare `npm test` is offline Node validation; `npm run test:framework:browser` runs synthetic browser contracts. One root config separates project discovery. Live fixtures require `RUN_LIVE_TESTS=true`, set by live scripts; collection does not resolve credentials or providers.

The `tc2` project and smoke command use one worker with full parallelism disabled. Each smoke test has its own browser/context, but the physical panel is still shared. CI serializes shared panel/account work; a separate local process can still interfere. Preserve `@panel`, the approved account and test-owned cleanup.

### Step 2: Prepare Results

The root config writes raw Playwright/Allure results without the old global cleanup hook. Shared CI execution owns isolated current-run outputs and report validation. Local runs sharing an Allure directory can accumulate/intermix results; inspect run scope before generating a report or clean deliberately before an approved run.

### Step 3: Authenticate

Smoke defaults to the approved equipment-enabled account `approved_monitor`, resolved from `ACCOUNT_APPROVED_MONITOR_USERNAME` and `ACCOUNT_APPROVED_MONITOR_PASSWORD`. Non-panel tests can select another privately provisioned name via `test.use({ account: 'secondary' })`; `@panel` cannot. A test-scoped fixture invokes the login helper separately for each test. The helper launches Chrome or connects to LambdaTest, handles cookie consent, fills credentials, waits for the home URL, and waits for a Devices navigation control.

Names match `^[a-z][a-z0-9_]*$`. Legacy `LOGIN_MONITOR_*` maps only to `approved_monitor`, and `TC_*` only to `configured`, when the entire canonical pair is absent. Empty or partial pairs fail; never mix pairs. Secrets belong only in ignored `.env.qa` or CI secrets, not config/specs/prompts. Public tests use guarded unauthenticated fixtures and never resolve these accounts.

Why both URL and element? A single-page application can update the address before its content is ready. An authenticated page is also not proof that the security panel is online.

The session fixture has its own 180-second setup/teardown budget, separate from the test timeout. That is a maximum budget, not an intentional three-minute pause. Failed browser/context/login setup closes resources already acquired without replacing the original error.

### Step 4: Build Page Objects

If eligible AI healing is enabled, the smoke fixture patches the authenticated page before constructing page objects. Tests request only their named dependencies: `authenticatedPage`, `loginPage`, `homePage`, `devicesPage`, `camerasPage`, and `activityPage`. These all refer to the same test-owned page.

The naming is intentional: `smoke.fixture` owns named POMs over `tc.fixture`, which owns session lifecycle. Reuse this layering for business tests; do not introduce aliases or duplicate authentication. Add routine tests in the existing folder with native tags and `test.step`, without config/YAML edits. The shared Copilot agent and five task prompts help author these ordinary specs; they are not runtime AI agents or a security sandbox.

Why before construction? A locator created earlier is a separate object; patching future locator creation does not automatically retrofit everything already created. Smoke login itself is outside this repair path.

### Step 5: Run Eight Tests

Each test describes a business check using page-object methods and starts from a newly authenticated home page. No browser context, cookies, or local storage are reused between smoke tests. The suite uses default mode rather than serial mode, allowing later tests to be attempted instead of automatically skipped as a serial group. Eight tests now require eight logins rather than one: runtime and cloud-session cost may increase; no new performance benchmark is claimed.

### Step 6: Close and Report

The authenticated-session fixture captures a masked screenshot on unexpected failure and closes its helper-created browser in teardown. It does not attach raw HTML, authentication state, or URLs. Playwright and Allure record results. The optional AI reporter investigates failed attempts. Reporting/publication and notifications depend on the selected configuration or CI job, not merely on importing a page object.

Manual authenticated sessions now consume passed headless/channel/action/navigation settings. Fixture-owned evidence remains explicit; native runner artifact behavior is not automatically inherited merely because a helper launches a browser. Configuration only works where the owner consumes it.

### Fixture Reuse Assessment (27 October 2026)

Measured against the pre-refactor source; counts include blank lines and comments, not a subjective readability score:

This is a dated October assessment, not a recount of the November working tree.

| Migrated spec | Before | After | Lines removed from spec |
|---|---:|---:|---:|
| Smoke (eight tests) | 206 | 139 | 67 |
| Login/logout and recovery monitor | 239 | 212 | 27 |
| Clip export | 56 | 38 | 18 |
| TC2 synthetic login | 32 | 25 | 7 |
| AlarmNet login | 42 | 35 | 7 |
| AlarmNet Mobile | 50 | 45 | 5 |
| AlarmNet Forgot Login | 35 | 30 | 5 |
| Total | 660 | 524 | 136 |

Across those seven specs, five fixture modules, and three runtime helpers, source decreases from 1,183 to 1,147 lines (36 fewer), including the newly added runtime files. This excludes generator changes, documentation and added regression tests; total checked-in code need not shrink when coverage is added. Four existing demo flow specs retain their existing fixture API. All eleven application specs now consume custom fixtures, but standalone utilities and Node tests keep their own appropriate lifecycle.

Three authenticated spec-owned setup/teardown pairs become one lazy session fixture. Four duplicated security pacing hooks become one automatic fixture. Three fixture artifact-capture blocks use one helper. Business assertions, navigation steps, challenge observations, test titles, repetition settings and panel cleanup remain in their specs.

At the October checkpoint, monitor requested `authenticatedSession` only for login/logout; recovery requested native `page`. Export selected the legacy `credentialProfile: 'configured'`, and smoke/monitor used the `approved-monitor` profile. The November authoring contract uses `account` names and guarded public pages instead. Do not copy legacy profile selection into new specs. Security remains unauthenticated with synthetic inputs, pacing and optional POMs, without account/provider loading.

The shared artifact helper hides form inputs and strips URL query/fragment data. Raw HTML is off by default; only the legacy demo fixture explicitly opts in, so its HTML artifacts still require privacy review. The old `tc`/`tcLoggedIn` flow fixtures are lazy and retain their existing API, but their missing generated POM dependencies are not repaired by this refactor.

Offline verification commands (no real application requests, login, reset, panel commands or paid AI):

```powershell
node --test framework/utils/__tests__/fixture-lifecycle.test.cjs framework/utils/__tests__/test-artifacts.test.cjs framework/utils/__tests__/fixture-generation.test.cjs
node --test framework/utils/__tests__/smoke-page-objects.test.cjs framework/utils/__tests__/login-cookie-consent.test.cjs framework/utils/__tests__/login-security.test.cjs
npm run test:framework:browser
npx playwright test --project tc2 --grep @smoke --list
npx playwright test --project monitoring --list --repeat-each 1
```

The runner-level fixture harness intercepts all requests and includes an expected assertion failure to verify teardown. Node and installed Chrome are required. Live smoke, monitor, exports, security submissions and cloud execution remain separately authorized validation; offline success is not live feature parity or playback evidence.

## 6. What the Eight Tests Really Prove

| Test | What you can say | What you cannot infer |
|---|---|---|
| Home loaded | Authenticated home UI is present and the password field is hidden. | Panel connectivity or all dashboard features work. |
| Arm Home/disarm | All visible observed partition statuses reach required states; cleanup is attempted. | Exactly-once physical commands under retries, or independently verified hardware state. |
| Devices | A recognized device-category label is visible after readiness checks. | Every device exists or responds correctly. |
| Cameras page | Route, iframe, and heading load. | Camera inventory or playback correctness. |
| Activity | A timestamped activity row appears on the Events route. | That a particular action created a matching new event. |
| Camera inventory | Nonempty live inventory; every discovered card is visible. | Every backend camera was rendered or device identity verified. |
| Camera names | Each card has a nonempty visible name; renames and duplicates are allowed. | That names are unique, fixed, or proof of playback. |
| Feed sections | Player/feed containers are rendered. | Video is playing, fresh, or recording correctly. |

Good interview answer: "I tightened checks so sidebar text or a generic heading cannot stand in for actual feature content. I still distinguish visible UI from full backend or playback verification."

## 7. Security-Panel Decisions Worth Explaining

Read [TotalConnectHomePage.js](../framework/pages/tc2/TotalConnectHomePage.js) beside this section.

**Preconditions:** A prior run or user may have left partitions armed. `ensureDisarmed()` examines actual visible statuses, selects armed partitions when states are mixed, and disarms them before the test's arm operation.

**Selection:** Selection can reset after arming. Select partitions again before disarming. When individual checkboxes exist, `setChecked(true)` is safer than blind clicking: requesting "checked" twice does not undo the first selection.

**All partitions:** One successful partition must not mask another still showing Arming or Disarming. The check requires at least one visible status and every observed status to match.

**Cleanup:** The test uses `finally` to attempt disarm after sending the arm command, even if the armed-state assertion fails. Cleanup can also fail, so this is best effort, not a guarantee that physical equipment is restored.

**Errors:** "Unable to perform the action" and offline-panel messages are surfaced. The method historically named `dismissErrorDialog()` now checks and throws instead of hiding application failure.

**Remaining risk:** The page methods do not deliberately retry physical commands. Runner/CI retries are zero and CI has no healing rerun; never enable generic action recovery for physical commands. Hard cancellation can prevent `finally` cleanup, requiring an operator panel check. Software cleanup is not an exactly-once hardware guarantee.

## 8. Why Cameras Needed Special Handling

Cameras renders inside the `#fenixPagetarget` iframe. Searching only the outer page does not search that document. The page object gets a frame reference, then searches inside it.

Modern UI checks are scoped to live camera cards so camera names appearing in activity history do not satisfy inventory assertions. Full names may appear in tooltip text while the visible link is shortened. Smoke uses dynamic inventory, requiring at least one card and nonempty visible names rather than fixed camera names or counts. Other callers can still use explicit-name/fixed-count modes.

Feed-container checks are separate from name checks. A visible offline/no-live-video panel can still be a rendered section. To prove playback in future, add a suitable observable signal such as media time progression or a supported stream-status API, with clear handling of intentionally offline cameras.

The generic locator patch does not automatically follow `contentFrame()` into every frame locator. "Every camera interaction self-heals" is not a supported claim.

## 9. Explain Runtime Healing Without Jargon

Use this example: the test tries Cameras but its locator has been intentionally changed to Cameras-broken. In the supplied report screenshot the eventual replacement is `#menu-CamerasMenu`, not a username field.

1. The action tries its original locator.
2. If a recognized failure occurs, the wrapper checks whether healing is enabled and whether repair is already in progress.
3. It looks for a trusted exact cached replacement. If that fails, it discards the stale cache entry.
4. It tries removing a blocking popup and retries the original action.
5. If still unsuccessful, the graph asks the locator-healer module for candidates using current page evidence.
6. The healer checks candidate matches and tries the original action on a candidate.
7. If the action works, it returns the result. The test continues to its original checks.
8. If nothing works, the original error is reported.

### Why Patch the Locator?

The TC path replaces selected methods on the actual Playwright object. It does not substitute a fake object for assertions. A file still named "proxy" can therefore implement direct method patching; the file name is historical, not proof of the mechanism.

### Why Keep Original Methods?

Repair also needs to find and click elements. If those repair actions invoke the same recovery wrapper indefinitely, the system can recurse. Stored unpatched locator factories and the in-progress guard avoid that loop.

### Why a Short Timeout?

If the original action consumes the entire test budget, there is no time left to inspect and recover. The patch injects seven seconds where a supported method has no explicit timeout. It does not override explicit options or guarantee that the model/retry will finish before teardown.

### What Counts as a Successful Repair?

The candidate action completed. That is weaker than "the candidate was semantically correct." Matching the wrong similarly named control can still be a false repair. Business assertions and human review are essential.

### What Does Not Automatically Heal?

All `expect` failures, raw page actions, APIs outside the patch list, earlier-created locators, and iframe-derived locator paths are not universally covered. A boolean check returning false is not the same as a thrown failure.

## 10. The Graphs and Agents

LangGraph keeps workflow progress explicit: what failed, which strategy is being attempted, what was tried, and whether to continue or stop. Its state declarations describe expected fields, not proof that model output is valid.

| Graph | One-sentence explanation |
|---|---|
| Runtime healing | Try a supported repair strategy, then continue or stop based on the outcome. |
| Post-mortem | Classify a failed test, propose a source fix or only report, then summarize. |
| Lifecycle | Inspect the repository before tests and summarize records afterward. |
| Exploration | Visit pages, understand their structure, generate source artifacts. |
| NL authoring | Turn an English scenario into steps, execute them, then generate artifacts. |

Six main roles: locator healer finds alternatives; failure analyzer investigates; test-case healer proposes source edits; drift detector compares source with a live page; flaky analyzer interprets history; explorer discovers page structure. Separate registry-healer and registry-generator modules also exist.

Why split roles? They need different evidence and rules. Locating a button is different from diagnosing a failed business assertion. Why not just functions? Functions could handle a small sequence; a graph makes branching and repeated attempts more explicit, at the cost of more state and configuration to maintain. Do not claim a graph makes AI output deterministic.

The intended runtime strategies are CSS, role, and text. Current default routing can reach a fourth attempt with an `exhausted` hint. Explain this as a known boundary defect, not an exact three-attempt guarantee.

## 11. After a Test Fails

The reporter collects the spec path, title, errors, step context, and a screenshot when available. Analyzing nested errors matters because the top-level message may say only "test timed out."

The failure analyzer requests a category and explanation. Screenshot analysis has text-only fallback. The graph may suggest test changes or decide to report an infrastructure problem. The source healer follows local imports using regular expressions, including one further import level; it does not build a complete syntax tree.

Suggested changes are saved for review, not automatically proven fixes. The reviewer must ask:

- Does the proposal preserve the requirement and original assertion?
- Is the application wrong, rather than the test?
- Is the replacement element the intended element?
- Does the proposal introduce retries or unsafe side effects?
- Does a focused rerun with healing off pass after the approved change?

The post-mortem route does not itself turn a failed Playwright test into a pass. Some audit labels use "healing succeeded" to mean suggestions were produced; distinguish that from a verified repair.

A separate registry-healing utility can modify source directly. Therefore "all AI changes always require approval" describes the desired policy, not a universal implementation guarantee.

## 12. Cache Versus RAG

**Cache:** "For this exact original locator description, we previously recorded this replacement." It is checked after the original failure. Entries require two recorded high-confidence successes, expire after seven days, and are invalidated when reuse fails. New cache writes require confidence at least 0.9. Cache keys are not scoped by application/account.

**RAG:** "Find evidence similar to this problem, then provide it to the model." Your repository has an embedding service, four index categories, storage, and a similarity-query helper. The active healer does not currently retrieve that evidence into its prompt.

Interview wording: "I built knowledge-indexing components and an exact repair cache. The final retrieval-to-healing integration is still incomplete." This is more defensible than calling the cache a trained model or claiming the system learns continuously.

A local JSON vector store does not eliminate the remote embedding call. Saving examples does not retrain GPT.

## 13. Explain the Six-Phase Lifecycle Accurately

1. Discovery finds page objects, tests, and flows and builds an approximate source relationship map.
2. Strategy asks AI which page objects seem risky based on inventory and history.
3. Pre-execution reads up to three candidates and records locator counts/readability. It does not currently visit the live application.
4. Playwright executes tests outside this graph.
5. Runtime repair operates independently during eligible test actions.
6. Synthesis calculates metrics and can index recent healing records.

Important distinctions: the strategy is not automatic risk-based test selection; a summary checkpoint is not durable browser-session recovery; a separately invoked post phase does not inherit every in-memory pre-phase detail. A success-only npm chain can skip synthesis after a failing test, which is a reliability gap.

## 14. English-to-Test and Exploration

### Preview

An AI call converts English to a structured plan. Code builds a rough template, prints it, and saves a Markdown report. No browser is launched. "No browser" does not mean no cost or no file writes.

### Generate from Existing Page Objects

The generator sends an API description and your scenario to the model, then writes a spec. This narrows the model's choices. The embedded API description can still lag the actual code, and generated files need review and validation. `--run` opts into executing the generated test immediately.

### Full Authoring

The graph parses the scenario, launches/logs in, captures page evidence, asks for a step implementation, executes it, and records whether actions/assertions succeeded. It can try fallback code and generate source from the action history. DOM caching and invalidation reduce repeated extraction; they do not guarantee freshness.

This path executes generated JavaScript with `new Function`. That is not an isolation boundary. Do not run untrusted instructions or expose powerful credentials. Artifact generation can occur after failed steps, so inspect the recorded assertion outcomes, not merely the existence of a file.

### Exploration

The exploration graph visits a bounded set of pages, extracts UI structure, classifies pages, proposes flows, and generates artifacts. A crawler discovering a page does not establish complete business coverage. The older generated patterns can reference page objects no longer present.

### Registries and Markdown Suites

Registry JSON stores named elements, selector expressions, and context. The Markdown parser turns suite descriptions into structured input. Recording conversion, validation, and registry generation offer another source-driven route. Registries and page-object source can drift apart; they are not automatically interchangeable sources of truth.

Source: [Markdown parser](../framework/ai/utils/md-suite-parser.js), [registry conversion](../framework/ai/scripts/codegen-to-registry.js), [validation](../framework/ai/scripts/validate-registry.js), [suite source](../tests/suites/smoke.md).

## 15. Newer Authentication Work

### Login and Logout

The dedicated suite verifies login readiness, handles optional consent/transient UI, performs logout, and checks the login form returns with an empty password and disabled Sign In. It requires the explicitly configured monitor account.

### Forgot Password

It navigates to the recovery form, checks its heading/input/button states, and returns to login. It does not send a password-reset request. That reduces unwanted account/email side effects and also defines the coverage limit.

### Explicit Monitoring Repetition

`repeatEach` creates separate executions rather than hiding cycles inside one passing result. The `monitoring` project defaults to 20 repetitions of each test; the environment setting accepts 1-100. Use finite native repetition selection, e.g. `npm run test:monitoring -- --repeat-each 1`, only after live approval. Repetition is not automatic failure retry.

No AI healing or automatic local Slack publishing is installed by this monitor command. Named step reporting avoids some credential-bearing automatic step details, and custom screenshots mask inputs. Any retained artifacts still require review before sharing. CI reporting is owned by the shared workflow, not a separate monitor config.

### Negative-Login Observation

The dedicated security command currently selects the AlarmNet spec; an older TC negative-login spec also remains in the repository. Synthetic inputs and response observations are not a penetration test or proof of lockout/rate limiting. Treat any repeated or scheduled login submissions as an explicitly authorized activity with account and request-rate controls.

Source: [root configuration](../playwright.config.js), [AlarmNet spec](../tests/security/alarmnet-security.spec.js), [observation helper](../framework/utils/login-security.js), [guarded security fixture](../framework/fixtures/login-security.fixture.js). Each AlarmNet URL has a native project; do not use raw Playwright imports to bypass its live guard.

## 16. Local, Cloud, and CI Execution

Local execution launches Chrome. LambdaTest execution connects to a remote browser using `chromium.connect()` and configured capabilities. The tests still run from Node; the browser runs remotely. Cloud access requires its own credentials and may incur cost.

There are two browser creation paths: guarded Playwright `page` for public flows and the helper-created authenticated browser. `tc.fixture` owns the latter and explicitly passes selected config settings. Fresh sessions remain per test; no shared login cache was introduced.

Thin GitHub Actions wrappers for general, smoke, monitoring and the three security URLs call [test-execution.yml](../.github/workflows/test-execution.yml). CI executes once with retries zero and no healing rerun. New tests under an existing project/tag need no YAML edits. Only new schedules or policies need wrapper changes; CI maps existing monitor secrets to canonical account variables, without supplying them to public security runs.

Reports use current-run results and retain versioned paths/latest publication. Shared execution validates nonempty parseable records and the generated summary before deployment. Valid failed-test reports may publish; zero-result reports may not replace latest. Failed, cancelled or incomplete execution remains distinct even if partial counts pass. Slack receives a report URL only after validated deployment.

CI locks serialize shared physical-account execution and report publication. Hard cancellation can still prevent resource cleanup/upload. Some optional local lifecycle chains remain success-only; they are not the shared CI path. Deployment configuration does not prove a workflow or live test ran successfully. Every live/public, panel, paid AI, cloud, Slack and deployment operation requires explicit approval.

## 17. Reports, Audit, and Notifications

**Playwright HTML:** test results and available debugging artifacts.

**Allure:** business-oriented steps, attachments, categories, and run summaries. Root execution writes raw results; generate local reports explicitly after execution. The optional auto-reporter remains a separate tool, not the root CI publisher. Regenerate after optional AI augmentation when necessary.

**AI reports:** locator attempts, proposed code changes, failure analysis, cost/latency, and historical outcomes.

**Audit:** records who/what produced a diagnostic event and links post-mortem events through IDs. Runtime events lack equally complete test/run linkage, and cache recoveries are not equivalently represented. This is not a tamper-proof compliance system.

**Slack:** summarizes current-run evidence and preserves execution state. Shared CI does not substitute historical results; report links require validated deployment. Missing, failed and incomplete results are not passes. Notification delivery is separate from test success.

**Portable report:** [bundler](../framework/utils/bundle-allure-report.js) packages reporting assets for sharing. Portability is not permission to share sensitive screenshots or internal application data.

**Cloud status:** [LambdaTest status updater](../framework/utils/lambdatest-status.js) is a separate integration step, not an automatic consequence of a passed local assertion.

## 18. Metrics You Can Defend

Do not equate eight passing tests with comprehensive coverage or a proven maintenance reduction.

| Metric | Meaning | Current caution |
|---|---|---|
| Pass@k | Logged sessions recovered within their first k events | Sessions are grouped heuristically by adjacent selector/time, not stable failure IDs. |
| SHE | Applied events divided by recorded final failed tests | Recovered tests can pass; timeouts are excluded; numerator/denominator are not aligned and the ratio can exceed 1. |
| Latency | Distribution of instrumented AI method durations | May include retries; not the whole QA cycle. |
| Token cost | Usage multiplied by configured prices | Estimate, not invoice; provider/model paths may differ. |
| Confidence | A score produced by the model | Not a measured probability of correct repair. |

To establish real benefit, compare the same scenarios/settings with AI off/on across multiple runs, include genuine defects as well as broken locators, manually judge recovered targets, and measure human repair effort. Separate cold/cache runs and include login/reporting in wall time. Report sample size, variability, and false recoveries.

Useful future measurement: correct recoveries divided by independently identified recoverable failures. This is a recommended evaluation measure, not a claim that the current engine computes it correctly.

## 19. Supporting Utilities and Older Paths

| Component | Why it exists / limitation |
|---|---|
| [Readiness helper](../framework/utils/waitForPageReady.js) | Shared loader/readiness handling; does not establish business correctness. |
| [Assertion helper](../framework/utils/assertion-helper.js) | Preserves context and labels likely synchronization, timeout, or functional failure using message rules. |
| [Popup interceptor](../framework/utils/popupInterceptor.js) | Generic popup handling used by recovery; application error dialogs need stricter treatment than optional consent. |
| [Page metrics](../framework/utils/pageLoadMetrics.js) | Browser timing measurements; a few UI timings are not a load-testing program. |
| [Step helper](../framework/utils/steps.js) | Reusable step/reporting conventions. |
| [Runtime input](../framework/utils/runtimeInput.js), [user factory](../framework/utils/userFactory.js) | Input/test-user support for older demo flows. |
| [Auth page](../framework/pages/AuthPage.js), [products page](../framework/pages/ProductsPage.js) | Demo application's page objects, separate from TC. |
| [Auth flow](../framework/flows/auth/AuthFlow.js), [cart](../framework/flows/cart/CartFlow.js), [checkout](../framework/flows/checkout/CheckoutFlow.js), [orders](../framework/flows/orders/OrdersFlow.js) | Examples of grouping business operations; not all follow the newer smoke path. |
| [Audit report generator](../framework/ai/audit/audit-report-generator.js), [traceability matrix](../framework/ai/audit/traceability-matrix.js) | Present relationships in recorded evidence; missing event IDs limit completeness. |
| [Knowledge indexer](../framework/ai/rag/rag-indexer.js), [embeddings](../framework/ai/rag/embedding-service.js) | Prepare four categories of searchable evidence; live prompt retrieval remains disconnected. |
| [Azure router](../framework/ai-azure/router.js), [Azure factory](../framework/ai-azure/core/azure-ai-client-factory.js) | Additional provider experiments beside the changed common factory; avoid describing all routes as equivalent. |

The older performance specs are disabled. The clip-export spec uses fixed IDs/coordinates and checks interaction steps, not the resulting video file. The repository is an evolved prototype with several generations of implementation, not a uniformly production-hardened platform.

## 20. Interview Questions and Honest Answers

**Why Playwright?** It gives locator-based actions, automatic actionability waiting, retrying assertions, browser isolation, and useful artifacts. Your own logic adds domain checks and optional recovery, rather than replacing the runner.

**Why not use retries alone?** A retry repeats the same test or action. A stale locator may fail identically each time. Healing proposes a different locator, but adds cost and wrong-target risk.

**Why not heal assertion failures?** Assertions express the requirement. Changing an expectation to match a broken application can hide a defect. Your post-mortem tool may suggest changes, but these require review.

**Why separate sessions?** Each authenticated test gets a fresh browser/context, avoiding shared mutable session state and serial skip dependencies. More logins cost time, but shared physical equipment still requires one-worker execution and cleanup. The fixture layers share code, not browser state between tests.

**Why not add long sleeps?** A sleep waits even when ready and may still be too short when slow. Wait for the meaningful state. Some older helpers still contain fixed waits; do not claim they were all removed.

**How do you prevent false positives?** Check actual partition states, scope camera checks to live cards, distinguish feed rendering from playback, and retain original assertions. Complete prevention is not established; false-heal evaluation is still needed.

**What is human-in-the-loop here?** Post-mortem suggestions are reviewed instead of automatically applied. Separate registry/generation tools can write files, so approval is not enforced everywhere yet.

**How does it learn?** It stores exact repairs and has knowledge-indexing components. It does not retrain the model, and runtime semantic retrieval is not connected yet.

**What did Azure change?** Provider selection moved into a common factory and an Anthropic-compatible client was added. Optional local routing is retained, but live provider parity is unverified and the embedding/RAG path remains OpenAI-specific. Do not claim full interchangeability from mocked tests alone.

**What is your hardest engineering issue?** Choose one you actually worked on: late cookie overlays, home URL preceding real readiness, mixed panel states, iframe inventory, method-patch recursion, or stale report duplication. Explain evidence, root cause, decision, verification, and remaining risk.

**How did you use AI?** "I used AI-assisted tooling for parts of development. My responsibility was defining requirements, checking generated code, integrating it, validating behavior, and deciding where automation should stop." Follow with a concrete decision you can explain from source.

**What would you validate before production?** Approved live panel cleanup, provider parity, redaction and historical secret exposure, generated-code isolation, complete event identity, correct metrics and RAG integration. Account and CI safeguards are now implemented contracts, not evidence that every deployed/live path has passed.

## 21. Three Stories to Prepare

Use real evidence from your own work. Do not invent results or saved hours.

### Story A: Login Looked Complete but the Test Was Early

Situation: URL changed before usable content appeared. Diagnosis: authentication/navigation completion was being confused with readiness. Decision: check a real home control after navigation and handle known consent UI. Tradeoff: readiness must be application-specific. Evidence: show the login helper and an actual trace from your run.

### Story B: A Pass Was Too Weak

Situation: seeing one partition state or a camera name could produce misleading confidence. Decision: require all observed partitions, scope expected camera inventory, and separate feed sections from names. Verification: synthetic positive and negative cases. Limit: UI status still does not prove video playback or backend state independently.

### Story C: Repair Could Consume the Test Budget

Situation: a long action wait leaves no time for diagnosis. Decision: inject a shorter initial timeout where none was specified, preserve original methods, and prevent recursive repair. Verification: an isolated navigation mutation, original assertions, and recorded outcomes. Limit: explicit timeouts and multiple API retries still need a real end-to-end deadline budget.

## 22. Study and Demonstration Plan

1. Explain sections 1-8 with AI disabled: test ownership, login, pages, assertions, safety, iframe behavior.
2. Draw the normal flow and failure flow from memory, then locate each arrow in source.
3. Explain runtime versus whole-test retries versus a separate CI rerun.
4. Study cache, graphs, post-mortem, and RAG boundaries; name what is only partially integrated.
5. Inspect a real run's original failure, proposed repair, final assertion, and evidence IDs.
6. Practice the interview questions aloud without reading scripts.

For a safe demonstration, start with offline framework checks or a read-only navigation case in an approved QA account. Keep physical commands, reset requests, security submissions, and paid services out unless explicitly approved. Do not alter a working page object merely to stage a demo without an isolated change and restoration plan.

Before claiming a feature, answer four questions: Where is it called? What does it verify? What happens when it fails? What evidence proves it worked?

Commands and prerequisites are maintained in the [README](../README.md). The [architecture report](TEST_FRAMEWORK_ARCHITECTURE.md) contains the detailed claim-to-code corrections and outstanding risks. This review did not run live QA, AI, cloud, or notification workflows.