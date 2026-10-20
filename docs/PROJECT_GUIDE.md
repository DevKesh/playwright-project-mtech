# Framework Walkthrough and SDET Interview Guide

Reviewed against the current workspace on 19 October 2026. Based on the purpose and structure of the supplied May dissertation, with implementation differences corrected in [TEST_FRAMEWORK_ARCHITECTURE.md](TEST_FRAMEWORK_ARCHITECTURE.md).

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
| Root configuration | [Main runner](../playwright.config.js), [login monitor](../playwright.login-monitor.config.js), [negative-login runner](../playwright.login-security.config.js), [smoke validation](../playwright.smoke-validation.config.js). |
| Runtime/test data | [Runtime settings](../framework/config/runtime.config.js), [test data](../framework/config/test-data.config.js). Multiple consumers have their own defaults. |
| Authentication/browser helpers | [Login session](../framework/utils/login-session.js), [browser launcher](../framework/utils/browser-launcher.js). |
| Main tests | [Eight-test smoke](../tests/generated/smoke/smoke-suite.spec.js), [login/recovery](../tests/generated/nl-authored/login-forgot-password-repeat.spec.js), [clip export](../tests/export-clip.spec.js). |
| Page objects | [Login](../framework/pages/generated/smoke/LoginPage.js), [Home](../framework/pages/generated/smoke/TotalConnectHomePage.js), [Devices](../framework/pages/generated/smoke/DevicesPage.js), [Cameras](../framework/pages/generated/smoke/CamerasPage.js), [Activity](../framework/pages/generated/smoke/ActivityPage.js). |
| Conventional reuse | [TC fixture](../framework/fixtures/tc.fixture.js), [TC flow](../framework/flows/totalconnect/TotalConnectFlow.js), [demo fixture](../framework/fixtures/app.fixture.js). Not the same route as the smoke suite's manual session. |
| AI integration | [TC AI fixture](../framework/ai/fixtures/tc.ai.fixture.js), [demo AI fixture](../framework/ai/fixtures/app.ai.fixture.js), [locator patch](../framework/ai/core/locator-proxy.js). |
| AI orchestration | [Runtime graph](../framework/ai/graph/runtime-graph.js), [post-mortem graph](../framework/ai/graph/healing-graph.js), [lifecycle](../framework/ai/graph/lifecycle-graph.js), [exploration](../framework/ai/graph/exploration-graph.js), [NL authoring](../framework/ai/graph/nl-authoring-graph.js). |
| Provider access | [Common factory](../framework/ai/core/ai-client-factory.js), [OpenAI client](../framework/ai/core/openai-client.js), [Azure client](../framework/ai-azure/core/azure-ai-client.js). |
| Records | [Healing history](../framework/ai/storage/healing-history.js), [cache](../framework/ai/storage/healing-cache.js), [report writer](../framework/ai/storage/report-writer.js), [audit trail](../framework/ai/audit/audit-trail.js). |
| Reporting | [AI reporter](../framework/ai/reporters/ai-healing-reporter.js), [Allure reporter](../framework/reporters/allure-auto-reporter.js), [Slack notifier](../framework/utils/slack-notify.js). |
| Framework checks | [Page-object checks](../framework/utils/__tests__/smoke-page-objects.test.cjs), [cookie-consent checks](../framework/utils/__tests__/login-cookie-consent.test.cjs), [Slack checks](../framework/utils/__tests__/slack-notify.test.cjs). |

Generated reports and artifacts are outputs, not framework logic. Historical report folders are useful only when you can identify the producing run and configuration.

## 5. Follow One Smoke Run End to End

### Step 1: Select the Test Lane

For an approved live smoke run, use the explicit `tc-smoke` project. Bare `npm test` can discover multiple projects and unrelated suites. The broad Chrome project overlaps with more specific projects, so it can run the same source under multiple project names.

The main configuration sets one worker and disables full parallel execution. This protects shared session and panel state from simultaneous actions within that run. It does not stop another process or workflow from using the same account.

### Step 2: Prepare Results

Main global setup removes the current shared Allure results/report. This prevents old results from appearing as new ones, but means simultaneous runs sharing those directories can interfere. Dedicated monitor/validation configurations isolate their own outputs and avoid this cleanup.

### Step 3: Authenticate

Smoke explicitly requires the approved equipment-enabled account through `LOGIN_MONITOR_USERNAME` and `LOGIN_MONITOR_PASSWORD`. The login helper launches Chrome or connects to LambdaTest, handles cookie consent, fills credentials, waits for the home URL, and waits for a Devices navigation control.

Why both URL and element? A single-page application can update the address before its content is ready. An authenticated page is also not proof that the security panel is online.

The setup timeout is 180 seconds. That is a maximum budget, not an intentional three-minute pause.

### Step 4: Build Page Objects

If eligible AI healing is enabled, the suite patches the authenticated page before constructing page objects. The page objects then store locators that may have recovery behavior attached.

Why before construction? A locator created earlier is a separate object; patching future locator creation does not automatically retrofit everything already created. Smoke login itself is outside this repair path.

### Step 5: Run Eight Tests

Each test describes a business check using page-object methods. Tests normally share the setup session within a worker. Playwright can restart the worker after failure and rerun setup, so "one browser for the entire run under all circumstances" is inaccurate. The suite uses default mode rather than serial mode, allowing later tests to be attempted instead of automatically skipped as a serial group.

### Step 6: Close and Report

Teardown closes the manually launched browser. Playwright and Allure record results. The optional AI reporter investigates failed attempts. Reporting/publication and notifications depend on the selected configuration or CI job, not merely on importing a page object.

A manual browser context does not automatically inherit the runner's screenshot, trace, video, or action-timeout settings. This is an important interview detail: configuration only works where the owning code consumes it.

## 6. What the Eight Tests Really Prove

| Test | What you can say | What you cannot infer |
|---|---|---|
| Home loaded | Authenticated home UI is present and the password field is hidden. | Panel connectivity or all dashboard features work. |
| Arm Home/disarm | All visible observed partition statuses reach required states; cleanup is attempted. | Exactly-once physical commands under retries, or independently verified hardware state. |
| Devices | A recognized device-category label is visible after readiness checks. | Every device exists or responds correctly. |
| Cameras page | Route, iframe, and heading load. | Camera inventory or playback correctness. |
| Activity | A timestamped activity row appears on the Events route. | That a particular action created a matching new event. |
| Camera inventory | Each configured expected camera has a visible live tile/name. | There are no unexpected extra cameras. |
| Camera names | Expected names are visible; much of this overlaps inventory verification. | Independent additional coverage just because the test count increased. |
| Feed sections | Player/feed containers are rendered. | Video is playing, fresh, or recording correctly. |

Good interview answer: "I tightened checks so sidebar text or a generic heading cannot stand in for actual feature content. I still distinguish visible UI from full backend or playback verification."

## 7. Security-Panel Decisions Worth Explaining

Read [TotalConnectHomePage.js](../framework/pages/generated/smoke/TotalConnectHomePage.js) beside this section.

**Preconditions:** A prior run or user may have left partitions armed. `ensureDisarmed()` examines actual visible statuses, selects armed partitions when states are mixed, and disarms them before the test's arm operation.

**Selection:** Selection can reset after arming. Select partitions again before disarming. When individual checkboxes exist, `setChecked(true)` is safer than blind clicking: requesting "checked" twice does not undo the first selection.

**All partitions:** One successful partition must not mask another still showing Arming or Disarming. The check requires at least one visible status and every observed status to match.

**Cleanup:** The test uses `finally` to attempt disarm after sending the arm command, even if the armed-state assertion fails. Cleanup can also fail, so this is best effort, not a guarantee that physical equipment is restored.

**Errors:** "Unable to perform the action" and offline-panel messages are surfaced. The method historically named `dismissErrorDialog()` now checks and throws instead of hiding application failure.

**Remaining risk:** The page methods do not deliberately retry physical commands, but the generic healing patch and whole-test runner retries can repeat them. Keep healing/retries disabled for safety-sensitive demonstrations until an explicit action-level policy is implemented.

## 8. Why Cameras Needed Special Handling

Cameras renders inside the `#fenixPagetarget` iframe. Searching only the outer page does not search that document. The page object gets a frame reference, then searches inside it.

Modern UI checks are scoped to live camera cards so camera names appearing in activity history do not satisfy inventory assertions. Full names may appear in tooltip text while the visible link is shortened. Smoke passes an explicit expected inventory rather than relying on the older default camera names.

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

### Repetition and Continuous Monitoring

`repeatEach` creates separate test executions rather than hiding many cycles inside one passing result. Default configuration repeats each of the two tests 20 times. The continuous wrapper runs batches until stopped or a configured limit, waits between completed batches, tracks failed batches, and stops on runner-level interruption.

No AI healing or automatic local Slack/report publishing is installed by this monitor config. This keeps the original failure evidence visible. Named step reporting avoids some credential-bearing automatic step details, and custom screenshots mask inputs. Retained traces and automatic screenshots still require review before sharing.

### Negative-Login Observation

The dedicated security command currently selects the AlarmNet spec; an older TC negative-login spec also remains in the repository. Synthetic inputs and response observations are not a penetration test or proof of lockout/rate limiting. Treat any repeated or scheduled login submissions as an explicitly authorized activity with account and request-rate controls.

Source: [security configuration](../playwright.login-security.config.js), [AlarmNet spec](../tests/generated/nl-authored/alarmnet-security.spec.js), [observation helper](../framework/utils/login-security.js), [storage setup](../framework/utils/alarmnet-storage-setup.js).

## 16. Local, Cloud, and CI Execution

Local execution launches Chrome. LambdaTest execution connects to a remote browser using `chromium.connect()` and configured capabilities. The tests still run from Node; the browser runs remotely. Cloud access requires its own credentials and may incur cost.

There are two browser owners: the runner's fixture configuration and the manual browser launcher. Both need cloud configuration because smoke manually creates its own session. Do not claim there is one universal browser setup path.

GitHub Actions provides five workflows covering general tests, weekday smoke, login/recovery, login/logout, and negative-login observations. General/smoke workflows can run a separate healing-enabled attempt after failure. That second whole-suite run differs from repairing an action inside the first test attempt.

Reports preserve versioned runs and a latest pointer. Publishing jobs use locks to reduce conflicting writes. The final report chooses healing-run results when available rather than merging two complete UUID-based result sets. Keep original results for comparison: passing on a second run is not itself proof AI caused the improvement.

Known operational limits: some commands use shell separators that differ between Windows and Linux; some success-only chains skip reports/notifications after failure; several workflows use `continue-on-error`, so inspect final failure propagation before calling them release gates. Deployment configuration does not prove a workflow ran successfully.

## 17. Reports, Audit, and Notifications

**Playwright HTML:** test results and available debugging artifacts.

**Allure:** business-oriented steps, attachments, categories, and run summaries. The custom auto-reporter builds timestamped reports. Its execution is not a guaranteed barrier after all AI augmentation; regenerate after completion when necessary.

**AI reports:** locator attempts, proposed code changes, failure analysis, cost/latency, and historical outcomes.

**Audit:** records who/what produced a diagnostic event and links post-mortem events through IDs. Runtime events lack equally complete test/run linkage, and cache recoveries are not equivalently represented. This is not a tamper-proof compliance system.

**Slack:** summarizes available Allure results and links to reports. It supports current and older summary layouts plus fallback sources. Confirm that a notification is for the intended run, especially when fallback history is used. Notification success is separate from test success.

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

**Why share a session?** It reduces repeated authentication and suits a sequential smoke flow. The tradeoff is shared state and worker-restart behavior. Independent tests need separate contexts/accounts when parallelism matters.

**Why not add long sleeps?** A sleep waits even when ready and may still be too short when slow. Wait for the meaningful state. Some older helpers still contain fixed waits; do not claim they were all removed.

**How do you prevent false positives?** Check actual partition states, scope camera checks to live cards, distinguish feed rendering from playback, and retain original assertions. Complete prevention is not established; false-heal evaluation is still needed.

**What is human-in-the-loop here?** Post-mortem suggestions are reviewed instead of automatically applied. Separate registry/generation tools can write files, so approval is not enforced everywhere yet.

**How does it learn?** It stores exact repairs and has knowledge-indexing components. It does not retrain the model, and runtime semantic retrieval is not connected yet.

**What did Azure change?** Provider selection moved into a common factory and an Anthropic-compatible client was added. Some OpenAI-specific guards/model overrides remain, so migration is incomplete.

**What is your hardest engineering issue?** Choose one you actually worked on: late cookie overlays, home URL preceding real readiness, mixed panel states, iframe inventory, method-patch recursion, or stale report duplication. Explain evidence, root cause, decision, verification, and remaining risk.

**How did you use AI?** "I used AI-assisted tooling for parts of development. My responsibility was defining requirements, checking generated code, integrating it, validating behavior, and deciding where automation should stop." Follow with a concrete decision you can explain from source.

**What would you fix before production?** Action-specific safety policies, credential fallback removal and redaction, provider-independent configuration, generated-code isolation, complete event identity, correct metrics, enforced flags, and failure-safe reporting.

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