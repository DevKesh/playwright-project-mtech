# Project Guide — What Every File Does & How to Run Tests

> Quick-reference guide for the Playwright + AI Self-Healing automation framework  
> targeting **Total Connect** (qa2.totalconnect2.com).

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Project Tree — File-by-File Explanation](#2-project-tree--file-by-file-explanation)
3. [The Three Layers: Fixtures → Flows → Pages](#3-the-three-layers-fixtures--flows--pages)
4. [How a Test Runs End-to-End](#4-how-a-test-runs-end-to-end)
5. [Running Tests — Single, Suite, All](#5-running-tests--single-suite-all)
6. [Reports — Allure & HTML](#6-reports--allure--html)
7. [AI Self-Healing — How to Enable & Use](#7-ai-self-healing--how-to-enable--use)
8. [AI Explore — Auto-Generate Page Objects & Tests](#8-ai-explore--auto-generate-page-objects--tests)
9. [AI Natural Language Test Author — Describe → Execute → Generate](#9-ai-natural-language-test-author--describe--execute--generate)
10. [Writing a New Test — Step by Step](#10-writing-a-new-test--step-by-step)
11. [Environment Variables Cheat Sheet](#11-environment-variables-cheat-sheet)
12. [npm Scripts Cheat Sheet](#12-npm-scripts-cheat-sheet)
13. [Quick Reference Card](#13-quick-reference-card)
14. [Live Demo Walkthrough](#14-live-demo-walkthrough)

---

## 1. High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│  TEST FILES  (tests/)                                  │
│  Only contain: test logic, assertions, allure tags     │
└──────────────────────┬─────────────────────────────────┘
                       │ uses fixtures
┌──────────────────────▼─────────────────────────────────┐
│  FIXTURES  (framework/fixtures/)                       │
│  Provide: login, failure artifacts, perf helpers       │
│  tc.fixture.js  — Total Connect tests                  │
│  app.fixture.js — Demo/sample-app tests                │
└──────────────────────┬─────────────────────────────────┘
                       │ uses flows
┌──────────────────────▼─────────────────────────────────┐
│  FLOWS  (framework/flows/)                             │
│  Multi-step business actions: login, navigate, etc.    │
│  TotalConnectFlow.js — all TC navigation methods       │
└──────────────────────┬─────────────────────────────────┘
                       │ uses page objects
┌──────────────────────▼─────────────────────────────────┐
│  PAGE OBJECTS  (framework/pages/)                      │
│  Locators + single-step interactions per page          │
│  TotalConnect2LoginPage.js, TotalConnectHomePage.js…   │
└────────────────────────────────────────────────────────┘
```

**Optional AI layer** — wraps `page` with a Proxy so if a locator breaks at runtime, the AI agent suggests a fix without stopping the test.

---

## 2. Project Tree — File-by-File Explanation

### Root Files

| File | What it does |
|---|---|
| `playwright.config.js` | Central Playwright config — projects, reporters (Allure + HTML), global settings (headless in CI, screenshots, video on failure) |
| `global-setup.js` | Runs **before every test run** — deletes old `allure-results/` and `allure-report/` so reports always show fresh data |
| `package.json` | npm scripts (see §11) and dependency list |
| `jsconfig.json` | Enables VS Code Ctrl+Click navigation into framework files |

### `framework/config/` — Configuration

| File | What it does |
|---|---|
| `test-data.config.js` | **Single source of truth** for test data — TC base URL, login credentials, exploration parameters. Every test/flow reads from here instead of hardcoding values |

### `framework/fixtures/` — Playwright Test Hooks

| File | What it does |
|---|---|
| `tc.fixture.js` | **Total Connect fixture** — provides `tc` (not logged in), `tcLoggedIn` (auto-login), `perf` (timing helpers). Auto-attaches failure screenshot + URL + HTML on any test failure |
| `app.fixture.js` | **Demo app fixture** — provides `authPage`, `productsPage`, flow helpers for the sample e-commerce app. Same failure-artifact behavior |

### `framework/flows/` — Reusable Business Flows

| File | What it does |
|---|---|
| `totalconnect/TotalConnectFlow.js` | All TC navigation: `openLoginPage()`, `fillConfiguredCredentials()`, `submitLogin()` (handles Security Notifications popup), `navigateToSecurity()`, `navigateToDevices()`, `navigateToCameras()`, `navigateToActivity()`, `navigateToScenes()`, `navigateToMyProfile()`, `navigateToLocations()`, `loginWithConfiguredUser()` (does all login steps in one call) |
| `auth/AuthFlow.js` | Demo app login/logout flow |
| `cart/CartFlow.js` | Demo app add-to-cart flow |
| `checkout/CheckoutFlow.js` | Demo app checkout flow |
| `orders/OrdersFlow.js` | Demo app order verification flow |

### `framework/pages/` — Page Object Models

| File | What it does |
|---|---|
| `generated/TotalConnect2LoginPage.js` | Login page locators — username input, password input, sign-in button, consent banner, forgot password/username links |
| `generated/TotalConnectHomePage.js` | Home/dashboard page — sidebar navigation links (Security, Devices/Automation, Cameras, Activity, Scenes, My Profile, Locations) |
| `generated/TotalConnectDevicesPage.js` | Devices/Automation page locators |
| `generated/TotalConnectActivityPage.js` | Activity/Events page locators |
| `generated/TotalConnectScenesPage.js` | Scenes page locators |
| `generated/TotalConnectCamerasPage.js` | Cameras page locators |
| `generated/TotalConnectForgotPasswordPage.js` | Forgot password page locators |
| `generated/TotalConnectForgotUsernamePage.js` | Forgot username page locators |
| `AuthPage.js` | Demo app login page locators |
| `ProductsPage.js` | Demo app products page locators |

### `framework/utils/` — Shared Utilities

| File | What it does |
|---|---|
| `pageLoadMetrics.js` | `measureNavigation()` — wraps any action with a stopwatch + browser Performance API metrics. `attachLoadMetrics()` — saves JSON to Allure. `assertOptionalLoadThreshold()` — optional pass/fail based on `PW_TC_MAX_LOAD_MS` env var |
| `popupInterceptor.js` | Pattern-based + AI-powered popup/modal dismissal. Used by the self-healing layer to clear blocking dialogs before retrying actions |
| `steps.js` | Allure step decorator helper |
| `runtimeInput.js` | Helpers for runtime test data injection |
| `userFactory.js` | Test user creation helpers |

### `tests/` — Test Specs

| File | What it does |
|---|---|
| `total-connect/page-load-timings.spec.js` | **8 performance tests** (TC-PERF-01 to 08) — measures page load time for login, dashboard, security, devices, cameras, activity, scenes, my-profile, locations. Uses `tc.fixture.js` |
| `total-connect/basic-smoke-and-performance.spec.js` | **4 basic smoke tests** (TC-BASIC-01 to 04) — login, dashboard verify, page navigation, performance baseline |
| `total-connect/_TEMPLATE.spec.js` | **Not a real test** — educational template showing 3 styles of writing tests |
| `generated/*.spec.js` | AI-explored specs — auto-generated by `npm run ai:explore` |
| `flows/auth/` | Demo app authentication tests |
| `flows/cart/` | Demo app cart tests |
| `flows/checkout/` | Demo app checkout tests |

### `framework/ai/` — AI Self-Healing Engine

| File | What it does |
|---|---|
| **`config/ai.config.js`** | Master config — reads `AI_HEALING_ENABLED`, `OPENAI_API_KEY`, model names, confidence thresholds from `.env` |
| **`fixtures/app.ai.fixture.js`** | AI-enhanced fixture — wraps `page` with the healing proxy. Tests that `require()` this fixture get self-healing automatically |
| **`core/page-proxy.js`** | Intercepts `page.locator()`, `page.getByRole()`, etc. and wraps returned locators with the healing proxy |
| **`core/locator-proxy.js`** | Intercepts locator actions (`click`, `fill`, etc.). On failure: (1) try popup dismissal, (2) invoke LangGraph healing graph |
| **`core/openai-client.js`** | Thin wrapper around OpenAI API — sends DOM snapshots to GPT and returns healed selectors |
| **`core/ai-client-factory.js`** | Creates the appropriate AI client based on config |
| **`graph/runtime-graph.js`** | LangGraph state machine for runtime healing — tries CSS → role → text strategies |
| **`graph/healing-graph.js`** | Offline healing analysis graph |
| **`graph/exploration-graph.js`** | Drives AI exploration (page discovery + test generation) |
| **`graph/lifecycle-graph.js`** | Pre/post test run lifecycle |
| **`agents/locator-healer.agent.js`** | Main healer agent — takes broken selector + DOM → returns working selector |
| **`agents/exploratory.agent.js`** | Explores the app, discovers pages, generates page objects |
| **`agents/failure-analyzer.agent.js`** | Post-run failure analysis |
| **`agents/drift-detection.agent.js`** | Detects UI drift between runs |
| **`agents/flaky-test.agent.js`** | Identifies flaky test patterns |
| **`agents/test-case-healer.agent.js`** | Heals entire test case logic (not just locators) |
| **`rag/`** | ChromaDB vector store for knowledge-base retrieval (page schemas, past healings) |
| **`prompts/`** | GPT prompt templates for each agent |
| **`metrics/`** | Latency tracking and metrics computation |
| **`audit/`** | Audit trail, traceability matrix |
| **`reporters/ai-healing-reporter.js`** | Custom Playwright reporter — logs healing events to `ai-reports/` |
| **`storage/`** | Healing history persistence |
| **`scripts/`** | CLI entry points for AI features (see npm scripts below) |

#### NL Test Authoring files (new)

| File | What it does |
|---|---|
| **`prompts/nl-test-authoring.prompt.js`** | 4 prompt builders: parse NL instructions, resolve actions against DOM, generate PO from recording, generate spec from recording |
| **`graph/nl-authoring-state.js`** | LangGraph state schema — tracks instructions, parsed steps, browser, recorded actions, generated artifacts |
| **`graph/nl-authoring-conditions.js`** | Edge routing — loops `executeStep` until all steps are done, then routes to `generateArtifacts` |
| **`graph/nl-authoring-nodes.js`** | Core engine — 5 nodes: `parseInstructions`, `launchBrowser`, `executeStep`, `generateArtifacts`, `writeFiles`. Includes `ensurePageSettled()` helper, DOM snapshot caching, IST timestamps, assertion verdict tracking |
| **`graph/nl-authoring-graph.js`** | Compiles the LangGraph state machine: `parseInstructions → launchBrowser → executeStep* → generateArtifacts → writeFiles → END` |
| **`scripts/nl-test-author.js`** | CLI entry point — interactive mode (stdin prompt), inline (`--instructions`), file (`--file`), with `--login` and `--headless` options |

---

## 3. The Three Layers: Fixtures → Flows → Pages

### What goes where

| Layer | Responsibility | Example |
|---|---|---|
| **Fixture** (`tc.fixture.js`) | Lifecycle hooks — login/logout, failure artifacts, injecting helpers | `tcLoggedIn` auto-logs-in before the test, attaches screenshot on failure |
| **Flow** (`TotalConnectFlow.js`) | Multi-step business actions across pages | `loginWithConfiguredUser()` = open page + consent + fill credentials + submit + dismiss popup |
| **Page Object** (`TotalConnectHomePage.js`) | Locators and single-step interactions for one page | `navigateToSecurity()` = click the Security sidebar link |
| **Test Spec** (`page-load-timings.spec.js`) | Test logic, assertions, Allure tags | Measure timing, attach metrics, assert threshold |

### Why this matters

- **A locator changes?** Update the page object. Flows and tests don't change.
- **Login flow changes?** Update the flow. Tests don't change.
- **Need failure screenshots?** The fixture handles it. Tests don't change.
- **Writing a new test?** Just destructure what you need: `{ page, tcLoggedIn, perf }`

---

## 4. How a Test Runs End-to-End

Example: `TC-PERF-03 — devices page load timing`

```
1. global-setup.js          → Wipes allure-results/ and allure-report/
2. Playwright creates a      → Fresh browser context (clean cookies, no state)
   new page
3. tc.fixture.js
   ├─ page fixture           → Wraps page to capture failure artifacts
   ├─ tcLoggedIn fixture     → Calls loginWithConfiguredUser():
   │   ├─ openLoginPage()        → TotalConnect2LoginPage.open()
   │   ├─ acceptConsentIfVisible()
   │   ├─ fillConfiguredCredentials() → reads test-data.config.js
   │   └─ submitLogin()          → TotalConnect2LoginPage.clickSignIn()
   │                                 + dismiss Security Notifications popup
   └─ perf fixture           → Makes measureNavigation/attachLoadMetrics available
4. Test body runs:
   ├─ perf.measureNavigation(page, action, options)
   │   ├─ Starts stopwatch
   │   ├─ Calls tc.navigateToDevices()       → TotalConnectHomePage.navigateToDevices()
   │   ├─ Waits for page to settle (DOM + readySelector)
   │   └─ Collects browser Performance API metrics
   ├─ perf.attachLoadMetrics(testInfo, …)    → JSON attachment in Allure
   └─ perf.assertOptionalLoadThreshold(…)    → Passes unless PW_TC_MAX_LOAD_MS is set
5. If test FAILS:
   ├─ page fixture captures: screenshot, URL, HTML source
   └─ Allure categorizes: "Element not found", "Assertion failure", etc.
6. Allure reporter writes result JSON to allure-results/
```

---

## 5. Running Tests — Single, Suite, All

### Run a single test by name

```bash
npx playwright test -g "TC-PERF-03" --project total-connect
```

The `-g` flag greps the test title. Partial matches work too:

```bash
npx playwright test -g "security page" --project total-connect
npx playwright test -g "TC-PERF-0[1-3]" --project total-connect   # regex
```

### Run a single test file

```bash
npx playwright test tests/total-connect/page-load-timings.spec.js --project total-connect
```

### Run all TC tests (cleans Allure + opens HTML report)

```bash
npm run test:tc
```

### Run all TC tests headed (visible browser)

```bash
npm run test:tc:headed
```

### Run with a load time threshold (fail if any page > 8 seconds)

```bash
npm run test:tc:perf
```

### Run all TC tests + generate & open Allure report

```bash
npm run test:tc:allure
```

### List all available tests without running them

```bash
npm run test:tc:list
```

### Run basic smoke tests only

```bash
npx playwright test tests/total-connect/basic-smoke-and-performance.spec.js --project total-connect
```

### Run demo app tests (auth, cart, checkout)

```bash
npm run test:flows                  # all flow tests
npm run test:auth                   # just auth
```

### Run AI-generated tests

```bash
npm run demo:test                   # headless
npm run demo:test:headed            # visible browser
npm run demo:smoke                  # only @smoke tagged
```

### Run a specific project

```bash
npx playwright test --project total-connect     # TC manual tests
npx playwright test --project tc-smoke          # AI-generated @smoke
npx playwright test --project tc-plan           # AI-generated @tc-plan
npx playwright test --project chrome            # All tests on Chrome
```

---

## 6. Reports — Allure & HTML

### Allure (primary report)

```bash
npm run report:allure           # Generate + open in browser
npm run report:allure:generate  # Generate only (no open)
npm run report:allure:open      # Open already-generated report
```

### Playwright HTML (backup report)

```bash
npm run report                  # Opens the built-in HTML report
```

Reports auto-clean on every run via `global-setup.js`, so you always see only the latest results.

---

## 7. AI Self-Healing — How to Enable & Use

### What it does

When a locator fails (e.g., a CSS selector changed after a deploy), instead of failing the test immediately:

1. **Popup interceptor** tries to dismiss any blocking dialog
2. **LangGraph healing graph** kicks in:
   - Extracts the page DOM
   - Sends it to GPT with the broken selector
   - GPT returns a healed selector
   - Framework retries the action with the new selector
3. If healed, the test **passes** and logs the healing event
4. If not healable, the test fails normally with full diagnostics

### How to enable

Create a `.env` file in the project root:

```env
AI_HEALING_ENABLED=true
OPENAI_API_KEY=sk-your-key-here
AI_HEALING_MODEL=gpt-4o-mini
AI_ANALYSIS_MODEL=gpt-4o
AI_HEALING_MAX_RETRIES=2
AI_HEALING_CONFIDENCE_THRESHOLD=0.7
```

### Run tests with healing active

```bash
npm run test:ai                      # All tests with healing
npm run demo:heal                    # AI-generated tests with healing (headed)
cross-env AI_HEALING_ENABLED=true npx playwright test -g "TC-PERF-03" --project total-connect
```

### How it works under the hood

```
Test uses tcLoggedIn fixture
  → tcLoggedIn uses page
     → (with AI_HEALING_ENABLED=true) page is wrapped by page-proxy.js
        → Every page.locator() call returns a proxied locator (locator-proxy.js)
           → On action failure:
              Step 1: popupInterceptor.dismissPopups()
              Step 2: runtime-graph.js (LangGraph state machine)
                 → locator-healer.agent.js
                    → openai-client.js → GPT-4o-mini
                       → Returns healed selector
              Step 3: Retry action with healed selector
```

### AI CLI scripts

| Command | What it does |
|---|---|
| `npm run ai:explore` | Crawls the app, discovers pages, generates page objects + test specs |
| `npm run ai:drift` | Detects UI changes between runs |
| `npm run ai:flaky` | Analyzes flaky test patterns |
| `npm run ai:review` | Reviews the healing event log |
| `npm run ai:metrics` | Computes healing success rate, latency stats |
| `npm run ai:audit` | Generates a full audit report |
| `npm run ai:index` | Indexes page object knowledge base in ChromaDB |
| `npm run ai:lifecycle:full` | Pre-analysis → Run tests with healing → Post-analysis |

---

## 8. AI Explore — Auto-Generate Page Objects & Tests

The exploration agent crawls the app (starting from the login page), discovers pages, and auto-generates:
- Page object files → `framework/pages/generated/`
- Test spec files → `tests/generated/`

```bash
npm run ai:explore                   # Explore without logging in first
npm run demo:explore:login           # Login first, then explore
```

Then run the generated tests:

```bash
npm run demo:test                    # Headless
npm run demo:test:headed             # Visible browser
npm run demo:smoke                   # Only @smoke tagged generated tests
npm run demo:full                    # Explore + test + report all in one
```

---

## 9. AI Natural Language Test Author — Describe → Execute → Generate

### What it does

Describe a test scenario in **plain English**, and the AI will:

1. **Parse** your instructions into structured steps (GPT-4o)
2. **Launch a real browser** and execute each step live
3. **Record every action** — selectors, Playwright code, timestamps, PASS/FAIL verdicts
4. **Generate proper artifacts** — Page Objects + Test Specs following the framework's exact patterns (fixtures, allure tags, testDataConfig)

You write English. You get a runnable Playwright test.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  YOU write plain English instructions                       │
│  "login, go to devices, verify device list is visible"      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Phase 1: parseInstructions                                 │
│  GPT-4o converts NL → structured steps                      │
│  [navigate, click, fill, assert_visible, assert_text, ...]  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Phase 2: launchBrowser                                     │
│  Opens headed Chrome, optional auto-login                   │
│  Uses ensurePageSettled() after every navigation             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Phase 3: executeStep (loops for each step)                 │
│  For each step:                                             │
│    1. ensurePageSettled() — wait for DOM + network           │
│    2. Extract DOM snapshot (cached if URL unchanged)         │
│    3. GPT resolves selector + Playwright code                │
│    4. Execute via Playwright                                 │
│    5. Record: selector, code, timestamp, PASS/FAIL           │
│    6. ensurePageSettled() after DOM-mutating actions          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Phase 4: generateArtifacts                                 │
│  Groups actions by page → generates POs + test spec via GPT │
│  All code includes: await, waitForLoadState, allure tags     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Phase 5: writeFiles                                        │
│  → framework/pages/generated/*.js     (Page Objects)        │
│  → tests/generated/*.spec.js          (Test Specs)          │
│  → ai-reports/nl-authoring/           (Action log + report) │
└─────────────────────────────────────────────────────────────┘
```

The graph is implemented as a **LangGraph state machine**:
`parseInstructions → launchBrowser → executeStep* → generateArtifacts → writeFiles → END`

### Files added

| File | Purpose |
|---|---|
| `framework/ai/prompts/nl-test-authoring.prompt.js` | 4 prompt builders: parse NL → resolve actions → generate PO → generate spec |
| `framework/ai/graph/nl-authoring-state.js` | LangGraph state schema for the NL authoring workflow |
| `framework/ai/graph/nl-authoring-conditions.js` | Edge routing — step loop vs. generation |
| `framework/ai/graph/nl-authoring-nodes.js` | Core engine — 5 graph nodes (parse, launch, execute, generate, write) |
| `framework/ai/graph/nl-authoring-graph.js` | LangGraph state machine wiring |
| `framework/ai/scripts/nl-test-author.js` | CLI entry point with interactive mode |

### How to run

#### Interactive mode (prompts you for instructions)

```bash
npm run ai:author
```

You'll see:
```
Describe what you want to test in plain English.
You can write multiple lines. Press Enter twice (empty line) when done.
```

Type your test scenario and press Enter twice.

#### Inline mode (pass instructions directly)

```bash
npm run ai:author -- --instructions "login to the app, dismiss cookie popup, go to devices page, verify device list is visible"
```

#### From a file

```bash
npm run ai:author -- --file my-test-steps.txt --login
```

#### With auto-login (uses credentials from test-data.config.js)

```bash
npm run ai:author:login -- --instructions "navigate to cameras, verify camera feed loads, go to activity, verify activity log"
```

#### Run the generated test afterward

```bash
npx playwright test tests/generated/<generated-file>.spec.js --headed
# or run all generated tests:
npm run demo:test:headed
```

### CLI options

| Option | Default | Description |
|---|---|---|
| `--instructions "..."` | — | Plain English test description (wrap in quotes) |
| `--file <path>` | — | Read instructions from a text file |
| `--url <URL>` | test-data.config.js | Override base URL |
| `--login` | `false` | Auto-login before executing steps |
| `--headless` | `false` (headed) | Run browser in headless mode |

### Example input

```
login to Total Connect, dismiss the cookie popup, go to the devices page,
verify the devices list is visible, click on the first device, verify device
details panel opens, go back to devices, navigate to activity page, verify
activity log entries are displayed
```

### Example console output

```
[NL-AUTHOR] [14:32:01] Phase 1: Parsing natural language instructions...
[NL-AUTHOR] [14:32:03]   → Test: "Devices and Activity Navigation"
[NL-AUTHOR] [14:32:03]   → Steps parsed: 9
[NL-AUTHOR] [14:32:03]     1. [navigate] Navigate to Total Connect login page
[NL-AUTHOR] [14:32:03]     2. [click] Dismiss cookie consent popup
[NL-AUTHOR] [14:32:03]     3. [fill] Enter username
[NL-AUTHOR] [14:32:03]     ...

[NL-AUTHOR] [14:32:05] Phase 2: Launching browser...
[NL-AUTHOR] [14:32:06]   → Browser ready at: https://qa2.totalconnect2.com/

[NL-AUTHOR] [14:32:07] ──── Step 1/9 ────
[NL-AUTHOR] [14:32:07]   Action:      navigate
[NL-AUTHOR] [14:32:07]   Description: Navigate to Total Connect login page
[NL-AUTHOR] [14:32:08]   → Navigated to: https://qa2.totalconnect2.com/login

[NL-AUTHOR] [14:32:09] ──── Step 5/9 ────
[NL-AUTHOR] [14:32:09]   Action:      assert_visible
[NL-AUTHOR] [14:32:09]   Description: Verify devices list is visible
[NL-AUTHOR] [14:32:09]   → DOM snapshot: reused from cache (saved tokens)
[NL-AUTHOR] [14:32:10]   → Resolved: await expect(page.locator('.device-list')).toBeVisible();
[NL-AUTHOR] [14:32:10]   → Selector:   locator(.device-list)
[NL-AUTHOR] [14:32:10]   → Confidence: 0.92
[NL-AUTHOR] [14:32:11]   → ✓ ASSERTION PASSED: Verify devices list is visible
[NL-AUTHOR] [14:32:11]   → Step 5 completed | Assertion: PASS | started: 14:32:09 | finished: 14:32:11
```

### Results summary

```
╔══════════════════════════════════════════════════════════╗
║   Results                                               ║
╠══════════════════════════════════════════════════════════╣
║  Steps Executed:     9                                   ║
║  Actions Passed:     6                                   ║
║  Actions Failed:     0                                   ║
║                                                          ║
║  Assertions Total:   3                                   ║
║  Assertions PASSED:  3                                   ║
║  Assertions FAILED:  0                                   ║
║                                                          ║
║  Page Objects:       2                                   ║
║  Test Specs:         1                                   ║
║                                                          ║
║  Generated Page Objects:                                 ║
║    → framework/pages/generated/DevicesPage.js            ║
║    → framework/pages/generated/ActivityPage.js           ║
║                                                          ║
║  Generated Test Specs:                                   ║
║    → tests/generated/devices-activity-flow.spec.js       ║
╚══════════════════════════════════════════════════════════╝
```

### What gets generated

#### Page Object (`framework/pages/generated/DevicesPage.js`)

```javascript
const { expect } = require('@playwright/test');

class DevicesPage {
  constructor(page) {
    this.page = page;
    this.deviceList = page.locator('.device-list');
    this.firstDevice = page.locator('.device-item').first();
    this.detailsPanel = page.locator('.device-details');
  }

  async open(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  async clickFirstDevice() {
    await this.firstDevice.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async verifyDeviceListVisible() {
    await this.page.waitForLoadState('networkidle');
    await expect(this.deviceList).toBeVisible();
  }
}

module.exports = { DevicesPage };
```

#### Test Spec (`tests/generated/devices-activity-flow.spec.js`)

```javascript
const { test, expect } = require('@playwright/test');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { DevicesPage } = require('../../framework/pages/generated/DevicesPage');

test.describe('Devices and Activity Navigation', () => {
  test('User navigates to devices and activity pages', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Navigation');
    await allure.story('Device and Activity page access');
    await allure.severity('critical');
    await allure.tags('tc', 'navigation', 'devices', 'activity');

    const devicesPage = new DevicesPage(page);

    await test.step('Navigate to devices page', async () => {
      await devicesPage.open(testDataConfig.targetApp.baseUrl + '/devices');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify devices list is visible', async () => {
      await devicesPage.verifyDeviceListVisible();
    });
    // ... more steps
  });
});
```

### Assertion tracking

Every step is categorised as either an **action** or an **assertion**:

| Step type | Detected via | Verdict |
|---|---|---|
| `assert_visible` | Step action type | `PASS` if `expect(locator).toBeVisible()` succeeds, `FAIL` if it throws |
| `assert_text` | Step action type | `PASS` if `expect(locator).toHaveText()` succeeds, `FAIL` if it throws |
| `assert_url` | Step action type | `PASS` if `expect(page).toHaveURL()` succeeds, `FAIL` if it throws |
| GPT sets `isAssertion: true` | GPT response flag | Same PASS/FAIL based on execution outcome |
| `click`, `fill`, etc. | Not an assertion | `success: true/false` — no assertion verdict |

Assertion verdicts are:
- Logged in real-time: `→ ✓ ASSERTION PASSED` or `→ ✗ ASSERTION FAILED`
- Included in the results summary (Assertions PASSED / FAILED counts)
- Written to the action log with `Verdict: PASS` or `Verdict: FAIL`

### DOM snapshot caching (token optimisation)

DOM snapshots are expensive to send to GPT. The system caches them:

| Cache layer | Scope | Eviction |
|---|---|---|
| **In-memory** | Same CLI run | Invalidated after `click`, `fill`, `select`, `press`, `navigate` |
| **Disk** (`ai-reports/nl-authoring/snapshot-cache/`) | Across CLI runs | Expires after 24 hours |

If two consecutive steps target the same page URL (e.g., fill username then fill password), the second step **reuses the cached snapshot** — zero extra tokens sent to GPT. The console shows:

```
[NL-AUTHOR] [14:32:09]   → DOM snapshot: reused from cache (saved tokens)
```

### IST timestamped action log

Every run produces a human-readable action log at `ai-reports/nl-authoring/action-log-*.txt`:

```
NL Test Authoring — Action Log
Generated: 19/4/2026, 2:32:15 pm IST
Instructions: login to Total Connect, go to devices, verify device list
──────────────────────────────────────────────────────────────────────────

SUMMARY
  Total steps:        9
  Actions:            6 passed, 0 failed
  Assertions:         3 PASSED, 0 FAILED (3 total)
──────────────────────────────────────────────────────────────────────────

[14:32:07] Step 1 — ✓ PASS
  Action:      navigate
  Description: Navigate to login page
  Code:        await page.goto('https://qa2.totalconnect2.com/', { waitUntil: 'networkidle' });
  Started:     14:32:07 IST
  Completed:   14:32:08 IST

[14:32:11] Step 5 — ✓ ASSERTION PASSED
  Action:      assert_visible
  Description: Verify devices list is visible
  Selector:    locator(.device-list)
  Code:        await expect(page.locator('.device-list')).toBeVisible();
  Confidence:  0.92
  Verdict:     PASS
  Started:     14:32:09 IST
  Completed:   14:32:11 IST
  Snapshot:    reused from cache
```

### Async/await & waitForLoadState — standard rules

All generated code follows mandatory wait rules enforced at **two layers**:

**Layer 1 — Runtime execution engine** (`nl-authoring-nodes.js`)

A central `ensurePageSettled(page)` helper is called at every transition point:

| When | What it waits for |
|---|---|
| After every `page.goto()` | `domcontentloaded` → `networkidle` |
| After auto-login URL change | `domcontentloaded` → `networkidle` |
| Before every DOM snapshot extraction | `domcontentloaded` → `networkidle` |
| After every `click`/`fill`/`select`/`press` | `domcontentloaded` (5s) → `networkidle` (3s) |
| After screenshot | `domcontentloaded` only |

**Layer 2 — GPT prompt rules** (all 4 prompt files)

Every GPT prompt that generates Playwright code includes these mandatory rules:

- Every Playwright call MUST use `await`
- After `page.goto()` → `await page.waitForLoadState('networkidle')`
- After navigation clicks → `await page.waitForLoadState('networkidle')`
- After DOM-mutating clicks (tabs, modals) → `await page.waitForLoadState('domcontentloaded')`
- After form submit → `await page.waitForLoadState('networkidle')`
- Before assertions on async content → `await page.waitForLoadState('networkidle')`
- Never use `Promise.all()` for sequential UI actions
- Every `test.step()` body must `await` every action

These rules apply to **all generated artifacts** across the framework — both the NL authoring pipeline and the exploration pipeline.

---

## 10. Writing a New Test — Step by Step

### 1. Create the spec file

```
tests/total-connect/my-new-test.spec.js
```

### 2. Import the TC fixture (not `@playwright/test`)

```javascript
const { test, expect } = require('../../framework/fixtures/tc.fixture');
const allure = require('allure-js-commons');
```

### 3. Pick the right fixture for your test

```javascript
// Need manual login control (measuring login timing):
test('my test', async ({ page, tc, perf }, testInfo) => {
  await tc.openLoginPage();
  await tc.fillConfiguredCredentials();
  await tc.submitLogin();
  // ... test logic
});

// Already logged in (most tests):
test('my test', async ({ page, tcLoggedIn, perf }, testInfo) => {
  await tcLoggedIn.navigateToSecurity();
  // ... test logic
});

// No perf measurement needed:
test('my test', async ({ page, tcLoggedIn }, testInfo) => {
  // ... test logic
});
```

### 4. Add Allure metadata

```javascript
await allure.epic('Total Connect');
await allure.feature('Security');
await allure.story('Arm Panel');
await allure.severity('critical');
await allure.tags('tc-only', 'security');
```

### 5. Run it

```bash
npx playwright test tests/total-connect/my-new-test.spec.js --project total-connect
```

---

## 11. Environment Variables Cheat Sheet

| Variable | Default | Purpose |
|---|---|---|
| `CI` | — | Set by GitHub Actions. Switches to headless, enables retries |
| `PW_OPEN_REPORT` | `false` | Auto-open HTML report after run |
| `PW_TC_MAX_LOAD_MS` | — | Optional max page load time (ms). Tests fail if exceeded |
| `AI_HEALING_ENABLED` | `false` | Master switch for AI self-healing |
| `OPENAI_API_KEY` | — | Required when `AI_HEALING_ENABLED=true` |
| `AI_HEALING_MODEL` | `gpt-4o-mini` | Model for locator healing |
| `AI_ANALYSIS_MODEL` | `gpt-4o` | Model for failure analysis |
| `AI_HEALING_MAX_RETRIES` | `2` | Max healing attempts per locator |
| `AI_HEALING_CONFIDENCE_THRESHOLD` | `0.7` | Min confidence to accept a healed selector |

---

## 12. npm Scripts Cheat Sheet

### Total Connect Tests

| Script | What it does |
|---|---|
| `npm run test:tc` | Clean Allure → run all TC tests → open HTML report |
| `npm run test:tc:headed` | Same but with visible browser |
| `npm run test:tc:perf` | Same + enforce 8s max load threshold |
| `npm run test:tc:allure` | Clean → run → generate + open Allure report |
| `npm run test:tc:list` | List all TC tests (no execution) |

### Reports

| Script | What it does |
|---|---|
| `npm run report` | Open Playwright HTML report |
| `npm run report:allure` | Generate + open Allure report |
| `npm run clean:allure` | Delete allure-results/ and allure-report/ |

### AI Features

| Script | What it does |
|---|---|
| `npm run test:ai` | Run all tests with self-healing enabled |
| `npm run ai:explore` | Crawl app + generate page objects + test specs |
| `npm run ai:author` | **NL Test Author** — interactive mode (prompts for English instructions) |
| `npm run ai:author:login` | NL Test Author with auto-login |
| `npm run ai:author:headless` | NL Test Author in headless mode |
| `npm run ai:drift` | Detect UI changes |
| `npm run ai:flaky` | Analyze flaky test patterns |
| `npm run ai:metrics` | Compute healing stats |
| `npm run ai:audit` | Full audit report |
| `npm run ai:lifecycle:full` | Pre + test with healing + post analysis |

### Demo Pipeline

| Script | What it does |
|---|---|
| `npm run demo:explore` | AI exploration |
| `npm run demo:test` | Run AI-generated tests |
| `npm run demo:heal` | Run AI-generated tests with self-healing (headed) |
| `npm run demo:full` | Explore → test → report in one command |

### CI / CD

| Script | What it does |
|---|---|
| `npm run ci:test` | Run generated tests headless (CI default) |
| `npm run ci:test:heal` | Re-run with AI healing + 1 retry |
| `npm run ci:report` | Generate Allure report from `allure-results/` |
| `npm run ai:author:suite -- <path>` | Run a markdown test suite end-to-end |

---

## 13. Quick Reference Card

> Print this page or keep it open during demos.

| What you want to do | Command |
|---|---|
| **Author a test from English** | `npm run ai:author -- --instructions "login, go to devices, verify list"` |
| **Author from a markdown suite** | `npm run ai:author:suite -- tests/suites/smoke.md` |
| **Run all generated tests (headed)** | `npm run demo:test:headed` |
| **Run a single test (headed)** | `npx playwright test tests/generated/login-flow.spec.js --headed` |
| **Run with AI self-healing** | `npm run demo:heal` |
| **Run smoke suite** | `npm run demo:smoke:headed` |
| **Generate & open Allure report** | `npm run demo:report` |
| **Full pipeline (explore → test → report)** | `npm run demo:full` |
| **CI — execute tests** | `npm run ci:test` |
| **CI — heal & retry** | `npm run ci:test:heal` |
| **CI — build report** | `npm run ci:report` |

### Key Environment Variables

| Variable | Purpose |
|---|---|
| `AI_HEALING_ENABLED=true` | Turns on the self-healing proxy |
| `OPENAI_API_KEY` | Required for authoring and healing |
| `CI=true` | Switches to headless mode (auto-set in GitHub Actions) |
| `PW_TC_MAX_LOAD_MS` | Optional max page-load threshold in ms |

---

## 14. Live Demo Walkthrough

A five-act demo you can deliver in ~15 minutes with a real Total Connect login.

### Prerequisites

1. `npm install` has been run
2. `OPENAI_API_KEY` is set in `.env`
3. Credentials in `framework/config/test-data.config.js` are valid
4. Chrome is installed

### Act 1 — Author a test from plain English

```powershell
npm run ai:author -- --instructions "login to the app, dismiss cookie popup, close any pop up that occurs by clicking on DONE, click on SELECT ALL, and click on ARM HOME, wait till the partitions status changes to Armed Home"
```

**What happens:** A headed browser opens. The AI parses your English into structured steps, drives the browser through each action in real time, records selectors, and generates a Page Object + test spec.

**Show the audience:**
- The live browser executing each step
- Console output with step-by-step verdicts
- Generated files in `framework/pages/generated/` and `tests/generated/`

### Act 2 — Run the generated test (no AI cost)

```powershell
npm run demo:test:headed
```

Or run a single spec:

```powershell
npx playwright test tests/generated/login-flow.spec.js --headed
```

**Key point:** The generated test is standard Playwright — no LLM tokens consumed at runtime. This is what runs daily in CI at zero AI cost.

### Act 3 — Demonstrate AI self-healing

```powershell
npm run demo:heal
```

This sets `AI_HEALING_ENABLED=true` and runs headed. If any selector has drifted since the test was authored, the healing agent intercepts the failure, sends the live DOM to GPT-4o-mini, gets a working selector back, and retries — all in real time.

**To prove healing works on stage:**

```powershell
# 1. Open a generated spec and break a selector on purpose
#    e.g. change '#txtUserName' → '#txtUserName_BROKEN'

# 2. Run with healing — watch the proxy fix it live
npm run demo:heal

# 3. Revert the edit after the demo
```

Healing reports are saved to `ai-reports/`.

### Act 4 — Run a markdown test suite

```powershell
npm run ai:author:suite -- tests/suites/smoke.md
```

Open `tests/suites/smoke.md` to show the audience the format:
- `# heading` = suite name
- `## TC-ID: Title` = test case
- `> login: true` = per-test config
- Plain English instructions in the body

Five test cases run sequentially; a suite report is generated at the end.

### Act 5 — Generate the Allure report

```powershell
npm run demo:report
```

Allure opens in the browser with epics, features, severity tags, trend history, and failure categories.

**In CI:** This report auto-deploys to GitHub Pages on every push via the multi-stage pipeline (execute → heal on failure → report → publish).

### Demo flow diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Act 1: NL Author          "describe in English"             │
│  npm run ai:author -- --instructions "..."                   │
│          │                                                   │
│          ▼                                                   │
│  Act 2: Execute             zero-cost Playwright run         │
│  npm run demo:test:headed                                    │
│          │                                                   │
│          ▼                                                   │
│  Act 3: Self-Heal           break a selector, watch it fix   │
│  npm run demo:heal                                           │
│          │                                                   │
│          ▼                                                   │
│  Act 4: Suite Run           QA writes markdown, not code     │
│  npm run ai:author:suite -- tests/suites/smoke.md            │
│          │                                                   │
│          ▼                                                   │
│  Act 5: Report              Allure with trends & categories  │
│  npm run demo:report                                         │
└──────────────────────────────────────────────────────────────┘
```
