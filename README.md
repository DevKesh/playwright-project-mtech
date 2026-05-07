# Multi-Agentic AI Self-Healing Test Automation Framework — Complete Usage Guide

> **Application Under Test:** Total Connect 2.0 (Honeywell/Resideo home security)  
> **Target Environment:** QA2 — `https://qa2.totalconnect2.com/`  
> **Stack:** Playwright JS + OpenAI GPT + LangGraph + ChromaDB + Allure Reporting  
> **Purpose:** End-to-end test automation with runtime AI self-healing (MTech thesis, BITS Pilani WILP)

---

## Table of Contents

1. [Prerequisites & Setup](#1-prerequisites--setup)
2. [Project Structure Overview](#2-project-structure-overview)
3. [Architecture Layers](#3-architecture-layers)
4. [Running Tests](#4-running-tests)
5. [AI Self-Healing — How It Works](#5-ai-self-healing--how-it-works)
6. [Healing Failed Test Cases](#6-healing-failed-test-cases)
7. [Adding New Test Cases](#7-adding-new-test-cases)
8. [AI Exploration — Auto-Generating Tests](#8-ai-exploration--auto-generating-tests)
9. [Natural Language Test Authoring](#9-natural-language-test-authoring)
10. [Reporting & Metrics](#10-reporting--metrics)
11. [Environment Variables Reference](#11-environment-variables-reference)
12. [NPM Scripts Quick Reference](#12-npm-scripts-quick-reference)
13. [Troubleshooting & Common Issues](#13-troubleshooting--common-issues)

---

## 1. Prerequisites & Setup

### System Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 18.x |
| npm | ≥ 9.x |
| OS | Windows / macOS / Linux |
| Browser | Chromium (installed via Playwright) |

### Installation

```bash
# Clone or navigate to project root
cd "Kesh Automation projects"

# Install all dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Copy environment file
copy .env.example .env
# Then edit .env and add your OPENAI_API_KEY
```

### Required Environment Setup

Create a `.env` file in project root:

```env
# REQUIRED for AI features
OPENAI_API_KEY=sk-your-key-here

# OPTIONAL overrides (defaults shown)
# AI_HEALING_ENABLED=true
# AI_HEALING_MODEL=gpt-4o-mini
# AI_ANALYSIS_MODEL=gpt-4o
# AI_HEALING_MAX_RETRIES=2
# AI_HEALING_CONFIDENCE_THRESHOLD=0.7
```

**Without `OPENAI_API_KEY`:** Tests run normally, but all AI healing/exploration features are disabled.  
**Without `AI_HEALING_ENABLED=true`:** Post-failure analysis in reporter still works, but runtime locator healing is off.

---

## 2. Project Structure Overview

```
├── playwright.config.js          # Test runner configuration (projects, reporters, timeouts)
├── global-setup.js               # Pre-run cleanup (wipes old Allure results)
├── package.json                  # 53 npm scripts, all dependencies
├── jsconfig.json                 # Path alias: framework/* → framework/*
├── .env                          # API keys & feature flags (git-ignored)
│
├── framework/                    # Reusable automation core
│   ├── ai/                       # AI self-healing subsystem
│   │   ├── agents/               # 6 AI agents (locator, failure, test-case, drift, flaky, exploratory)
│   │   ├── audit/                # Audit trail with correlation IDs
│   │   ├── config/               # ai.config.js — central AI configuration
│   │   ├── core/                 # page-proxy, locator-proxy, openai-client
│   │   ├── fixtures/             # tc.ai.fixture.js — AI-enhanced test fixture
│   │   ├── graph/                # LangGraph state machines (4 graphs)
│   │   ├── metrics/              # Pass@k, SHE, latency tracking
│   │   ├── prompts/              # GPT prompt templates for each agent
│   │   ├── rag/                  # ChromaDB vector search (optional)
│   │   ├── reporters/            # ai-healing-reporter.js (custom Playwright reporter)
│   │   ├── scripts/              # CLI entry points (explore, heal, drift, metrics)
│   │   ├── storage/              # Read/write healing-log, audit-trail, run-history
│   │   └── utils/                # DOM trimmer, error normalizer, timing
│   ├── config/
│   │   └── test-data.config.js   # Centralized test data (URLs, credentials)
│   ├── data/
│   │   └── authAndCart.data.js   # Demo app test data
│   ├── fixtures/
│   │   ├── tc.fixture.js         # Total Connect fixture (login, perf, artifacts)
│   │   └── app.fixture.js        # Demo app fixture (auth, cart, checkout flows)
│   ├── flows/
│   │   ├── totalconnect/         # TotalConnectFlow.js — TC business actions
│   │   ├── auth/                 # AuthFlow.js
│   │   ├── cart/                 # CartFlow.js
│   │   ├── checkout/             # CheckoutFlow.js
│   │   └── orders/               # OrdersFlow.js
│   ├── pages/
│   │   ├── AuthPage.js           # Demo app pages (hand-written)
│   │   ├── ProductsPage.js
│   │   └── generated/            # AI-generated page objects (13+ pages)
│   │       ├── TotalConnect2LoginPage.js
│   │       ├── TotalConnectHomePage.js
│   │       ├── TotalConnectDevicesPage.js
│   │       └── ... (8 more)
│   └── utils/
│       ├── pageLoadMetrics.js    # Web Vitals measurement
│       ├── popupInterceptor.js   # Dismiss cookie/modal popups
│       ├── steps.js              # Allure step decorators
│       ├── runtimeInput.js       # Dynamic test data injection
│       └── userFactory.js        # Test user helpers
│
├── tests/                        # All test specs (4 lanes)
│   ├── flows/                    # Hand-authored business tests (demo app)
│   ├── generated/                # AI-explored TC tests (9 specs, @smoke/@tc-plan tags)
│   ├── suites/                   # Reserved for suite definitions
│   └── total-connect/            # Hand-authored TC performance/smoke tests
│
├── ai-reports/                   # AI system output logs
│   ├── healing-log.json          # All healing attempts
│   ├── audit-trail.json          # Chronological audit events
│   ├── run-history.json          # Historical test outcomes
│   ├── latency-log.json          # OpenAI API latencies
│   ├── exploration/              # Exploration artifacts
│   ├── failure-reports/          # One JSON per failure analysis
│   ├── nl-authoring/             # NL author action logs
│   └── test-healing/             # Healing process details
│
├── docs/                         # Project documentation
├── allure-results/               # Allure raw results (auto-cleaned per run)
├── playwright-report/            # HTML report output
└── test-results/                 # Playwright trace/video/screenshot artifacts
```

---

## 3. Architecture Layers

### Execution Flow (hand-authored tests)

```
test.spec.js
  → framework/fixtures/tc.fixture.js    (dependency injection: page, tc, tcLoggedIn, perf)
    → framework/flows/TotalConnectFlow.js (multi-step business actions)
      → framework/pages/generated/*.js    (locator definitions + atomic interactions)
        → Playwright API                  (browser automation)
```

### Execution Flow (AI-generated tests with healing)

```
tests/generated/*.spec.js
  → framework/ai/fixtures/tc.ai.fixture.js   (patches page with healing proxy)
    → framework/ai/core/locator-proxy.js      (intercepts action failures)
      → framework/ai/graph/runtime-graph.js   (CSS→role→text healing loop)
        → framework/ai/agents/locator-healer.agent.js (GPT locator suggestions)
          → OpenAI API (gpt-4o-mini)
```

### Post-Test Analysis Flow

```
All tests finish
  → framework/ai/reporters/ai-healing-reporter.js
    → framework/ai/graph/healing-graph.js     (classify failure + suggest fix)
      → framework/ai/agents/failure-analyzer.agent.js
      → framework/ai/agents/test-case-healer.agent.js
    → Injects results into Allure report
    → Writes: healing-log.json, audit-trail.json, run-history.json
```

---

## 4. Running Tests

### Basic Commands

```bash
# Run ALL tests (headless)
npm test

# Run ALL tests (visible browser)
npm run test:headed

# Run Total Connect tests only
npm run test:tc
npm run test:tc:headed

# Run demo app auth tests
npm run test:auth

# Run ALL demo app flow tests
npm run test:flows
```

### Running Generated (AI-Explored) Tests

```bash
# Run all generated TC tests (headless)
npm run demo:test

# Run generated tests (headed/visible)
npm run demo:test:headed

# Run only @smoke tagged tests
npm run demo:smoke
npm run demo:smoke:headed

# Run only @tc-plan tagged tests (full test plan)
npm run demo:plan
npm run demo:plan:headed
```

### Running with AI Healing Enabled

```bash
# Run ALL tests with runtime AI healing
npm run test:ai

# Run generated tests with healing (headed)
npm run demo:heal

# Phase 1: Post-mortem analysis only (no runtime healing)
npm run demo:phase1

# Phase 2: Full runtime healing enabled
npm run demo:phase2
```

### Running Specific Tests

```bash
# Single file
npx playwright test tests/generated/login-flow.spec.js

# By grep (test title)
npx playwright test --grep "TC01"

# By tag
npx playwright test --grep "@smoke"

# Specific project
npx playwright test --project chrome
npx playwright test --project tc-smoke

# With retries
npx playwright test tests/generated/ --retries 2

# With specific workers
npx playwright test --workers 4
```

### Running the Full Pipeline (Explore → Test → Report)

```bash
# Full automated pipeline (headless)
npm run demo:full

# Full pipeline (headed)
npm run demo:full:headed
```

### Performance Tests

```bash
# Run TC page load timing tests
npm run test:tc:perf

# Custom threshold (fail if any page takes >5000ms)
cross-env PW_TC_MAX_LOAD_MS=5000 npm run test:tc
```

---

## 5. AI Self-Healing — How It Works

### Overview

The framework has **two healing layers**:

| Layer | When | What Happens | Triggered By |
|-------|------|-------------|-------------|
| **Runtime Healing** | During test execution | Broken locator → GPT suggests fix → retry action | `AI_HEALING_ENABLED=true` + `AI_HEALING_LOCATOR=true` |
| **Post-Mortem Analysis** | After all tests finish | Failed test → classify root cause → suggest code changes | `AI_HEALING_ENABLED=true` (reporter) |

### Runtime Healing Flow

```
1. Test action fails (e.g., page.locator('#oldButton').click() times out)
2. Locator proxy catches the error (after 7s quick timeout)
3. Step 1: Try dismissing blocking popups
   - If popup dismissed and retry succeeds → done
4. Step 2: Invoke RuntimeHealingGraph
   a. CSS Strategy:
      - Extract targeted DOM context around failed element
      - Send to GPT: "Given this DOM, suggest CSS selectors for [description]"
      - GPT returns 3-5 candidate selectors with confidence scores
      - Validate each candidate against live page (isVisible check)
      - If valid candidate found → retry original action
   b. Role Strategy (if CSS fails):
      - Ask GPT for getByRole() alternatives
      - Validate and retry
   c. Text Strategy (if role fails):
      - Ask GPT for getByText() alternatives
      - Validate and retry
5. If any strategy succeeds:
   - Log successful healing to healing-log.json
   - Continue test execution normally
6. If all strategies fail:
   - Log failed healing attempt
   - Throw original error (test fails as normal)
```

### Post-Mortem Analysis Flow

```
1. Test finishes with status 'failed' or 'timedOut'
2. AI Healing Reporter collects:
   - Error message + stack trace
   - Test step names and nested errors
   - Screenshot (if available)
   - Test file path + title
3. Invokes HealingGraph:
   a. classifyFailure node:
      - Categories: locator_broken, assertion_mismatch, network_error,
                    timeout, test_logic_error, infrastructure
      - Returns: category, confidence (0-1), root cause explanation
   b. Routing:
      - locator_broken/assertion_mismatch → healTestCase node
      - network_error/timeout → reportOnly (no code fix suggested)
   c. healTestCase node:
      - Reads test source code + page object
      - Suggests specific code changes
      - Returns: suggestedChanges[], changeType, confidence
4. Results injected into Allure report:
   - [AI-INTERVENTION] prefix on test name
   - Healing analysis in description
   - Suggested fix as markdown attachment
5. Results written to:
   - ai-reports/healing-log.json
   - ai-reports/failure-reports/failure-*.json
   - ai-reports/audit-trail.json
```

### Configuration

```env
# Master switch
AI_HEALING_ENABLED=true

# Feature flags (all default true when master is on)
AI_HEALING_LOCATOR=true          # Runtime locator healing
AI_HEALING_ANALYSIS=true         # Post-mortem failure analysis
AI_HEALING_TEST_CASE=false       # Test case code suggestions (experimental)

# Models
AI_HEALING_MODEL=gpt-4o-mini    # Fast model for runtime healing
AI_ANALYSIS_MODEL=gpt-4o        # Powerful model for analysis

# Thresholds
AI_HEALING_MAX_RETRIES=2        # Max healing attempts per action
AI_HEALING_CONFIDENCE_THRESHOLD=0.7  # Min confidence to apply healing
AI_OPENAI_TIMEOUT=30000         # API timeout in ms
AI_MAX_DOM_LENGTH=60000         # Max DOM chars sent to GPT
```

---

## 6. Healing Failed Test Cases

### Step 1: Run Tests and Identify Failures

```bash
# Run tests with AI analysis enabled
npm run demo:phase1

# Or run with full runtime healing
npm run demo:heal
```

### Step 2: Review Failure Reports

After a run with `AI_HEALING_ENABLED=true`, check:

```bash
# View healing log (all healing attempts)
npm run ai:review

# Check failure reports directory
ls ai-reports/failure-reports/

# Each file contains:
# - failureCategory (locator_broken, assertion_mismatch, etc.)
# - rootCause explanation
# - suggestedChanges (if applicable)
# - affectedLocator
# - confidence score
```

### Step 3: Apply Suggested Fixes

**For locator_broken failures:**
1. Open the page object file mentioned in the failure report
2. Find the broken locator (identified in `affectedLocator` field)
3. Replace with the suggested selector from `suggestedChanges`
4. Re-run the test to verify

**For assertion_mismatch failures:**
1. Check if the expected value has changed in the app
2. Update the assertion in the test spec
3. Or update the page object if a new element appeared

**For test_logic_error failures:**
1. Review the `suggestedChanges` code diff
2. Apply the suggested code changes to the spec file
3. Re-run to verify

### Step 4: Proactive Drift Detection

```bash
# Scan all page objects against live app for broken locators
npm run ai:drift

# Output: ai-reports/drift-reports/drift-*.json
# Shows: broken, fragile, valid, and new elements
```

### Step 5: Analyze Flaky Tests

```bash
# Identify patterns in test instability
npm run ai:flaky

# Uses run-history.json to find tests that pass/fail inconsistently
```

### Step 6: Compute Healing Metrics

```bash
# Human-readable metrics
npm run ai:metrics

# JSON output for CI integration
node framework/ai/scripts/compute-metrics.js --json
```

**Metrics reported:**
- **Pass@1:** Tests passing without healing
- **Pass@2/3:** Tests passing with ≤2/3 healing attempts
- **SHE (Self-Healing Efficacy):** successful heals / total failures × 100
- **Latency:** Mean/median/p95/p99 GPT API response times

### Step 7: Full Lifecycle Healing

```bash
# Pre-execution: drift detection + strategy
npm run ai:lifecycle:pre

# Post-execution: analysis + synthesis
npm run ai:lifecycle:post

# Complete 6-phase lifecycle
npm run ai:lifecycle:full
```

---

## 7. Adding New Test Cases

### Option A: Hand-Authored Test (Recommended for Critical Flows)

#### Step 1: Create/Identify the Page Object

If the page isn't covered yet, create a page object in `framework/pages/generated/`:

```javascript
// framework/pages/generated/TotalConnectNewPage.js
class TotalConnectNewPage {
  constructor(page) {
    this.page = page;
    // Define locators as class properties
    this.heading = page.locator('h1.page-title');
    this.submitButton = page.locator('#submit-btn');
    this.inputField = page.locator('input[name="field"]');
  }

  async fillField(value) {
    await this.inputField.fill(value);
  }

  async submit() {
    await this.submitButton.click();
  }
}

module.exports = { TotalConnectNewPage };
```

#### Step 2: Add Navigation to the Flow (if needed)

Edit `framework/flows/totalconnect/TotalConnectFlow.js`:

```javascript
const { TotalConnectNewPage } = require('../../pages/generated/TotalConnectNewPage');

// Inside createTotalConnectFlow():
const newPage = new TotalConnectNewPage(page);

const navigateToNewPage = async () => {
  await homePage.newPageNav.click();
  await expect(page).toHaveURL(/.*\/new-page/, { timeout: 10000 });
};

// Add to return object:
return { ...existing, newPage, navigateToNewPage };
```

#### Step 3: Write the Test Spec

Create `tests/total-connect/new-feature.spec.js`:

```javascript
const { test, expect } = require('../../framework/fixtures/tc.fixture');
const { allure } = require('allure-playwright');

test.describe('@tc-only New Feature Tests', () => {
  test('TC-NEW-01 - should perform new feature action', async ({ page, tcLoggedIn, perf }, testInfo) => {
    await allure.epic('Total Connect');
    await allure.feature('New Feature');
    await allure.severity('critical');
    await allure.tags('tc-only', 'new-feature');

    await test.step('Navigate to new page', async () => {
      await tcLoggedIn.navigateToNewPage();
    });

    await test.step('Fill form and submit', async () => {
      await tcLoggedIn.newPage.fillField('test value');
      await tcLoggedIn.newPage.submit();
    });

    await test.step('Verify success', async () => {
      await expect(page).toHaveURL(/.*\/success/);
      await expect(page.locator('.success-message')).toBeVisible();
    });
  });
});
```

#### Step 4: Run & Verify

```bash
npx playwright test tests/total-connect/new-feature.spec.js --headed
```

### Option B: AI-Generated Test (Quick Bootstrap)

#### Step 1: Run Exploration

```bash
# Explore the app and auto-generate page objects + test specs
npm run demo:explore

# With auto-login (explores authenticated pages)
npm run demo:explore:login

# Custom URL and limits
node framework/ai/scripts/explore-and-generate.js --url https://qa2.totalconnect2.com/ --maxPages 10 --maxDepth 3 --login
```

**Output:**
- Page objects → `framework/pages/generated/`
- Test specs → `tests/generated/`

#### Step 2: Run Generated Tests

```bash
npm run demo:test:headed
```

#### Step 3: Refine

Generated tests may need minor fixes. Review and adjust:
- Locator specificity
- Assertion accuracy
- Wait conditions

### Option C: Natural Language Test Authoring

#### Interactive Mode

```bash
npm run ai:author
# Prompt: "login to the app, go to devices page, verify thermostat is displayed"
```

#### Single Instruction Mode

```bash
npm run ai:author -- --instructions "navigate to cameras page, verify at least one camera feed is visible"
npm run ai:author:login   # with auto-login
npm run ai:author:headless  # headless execution
```

#### Suite Mode — .md-Driven Test Workflow (Recommended)

The most powerful way to create tests. Write test cases in plain English `.md` files, and the AI agent executes them in a real browser, captures DOM, generates page objects and test specs — all from your markdown.

**Key Features:**
- `.md` files are the **single source of truth** for all test cases
- **Preferred locators:** getByRole, getByLabel, getByText (resilient, self-healing friendly)
- **DOM caching:** DOM snapshots cached per URL (saves GPT tokens, speeds up execution)
- **Custom output folders:** Each suite gets its own page-object and spec directories
- **Entry/Exit criteria:** Define preconditions and expected outcomes per test case
- **Suite-level defaults:** Set options once, they apply to all test cases in the suite

**Folder hierarchy:**
```
tests/suites/          ← .md files (source of truth)
  smoke.md
  regression.md
framework/pages/generated/   ← Page Objects
  smoke/
  regression/
tests/generated/             ← Test Specs
  smoke/
  regression/
```

**Suite .md format:**

```markdown
# My Test Suite

> login: true
> locators: getByRole, getByLabel, getByText
> output: tests/generated/smoke
> pages: framework/pages/generated/smoke
> tags: @smoke @tc @tc-plan

---

## TC-001: Verify login works
**Entry:** User is on the login page (unauthenticated)
**Exit:** User sees the home page with security panel visible

Navigate to Total Connect, enter valid credentials, submit login form, verify home page appears

## TC-002: Navigate to security panel
**Entry:** User is logged in and on home page
**Exit:** Security panel tabs (Security, Partitions, Sensors) are visible

After login, click Security in sidebar, verify security panel tabs are visible

## TC-003: Check devices page
**Entry:** User is logged in and on home page
**Exit:** Devices page shows at least one device category

Navigate to Devices page from sidebar, verify automation devices are listed
```

**Suite-level options (> lines before first ##):**

| Option | Description | Example |
|--------|-------------|---------|
| `login` | Auto-login before each test case | `> login: true` |
| `locators` | Preferred locator strategies (comma-separated) | `> locators: getByRole, getByLabel, getByText` |
| `output` | Custom directory for generated test specs | `> output: tests/generated/smoke` |
| `pages` | Custom directory for generated page objects | `> pages: framework/pages/generated/smoke` |
| `tags` | Default tags for all test cases | `> tags: @smoke @tc @tc-plan` |
| `url` | Override base URL | `> url: https://qa2.totalconnect2.com/` |
| `headless` | Run headless | `> headless: true` |
| `cache` | Enable DOM caching (on by default) | `> cache: true` |

**Test case markers:**

| Marker | Purpose | Example |
|--------|---------|---------|
| `**Entry:**` | Precondition (tells GPT what state to expect) | `**Entry:** User is logged in` |
| `**Exit:**` | Expected outcome (becomes assertion prompt) | `**Exit:** Devices page visible` |
| `> key: value` | Per-test overrides (overrides suite defaults) | `> login: false` |

**Run commands:**

```bash
# Run the smoke suite (headed, with login)
npm run ai:author:smoke

# Run the regression suite (headed, with login)
npm run ai:author:regression

# Run any custom suite
npm run ai:author:suite -- tests/suites/my-suite.md --login

# Run headless
npm run ai:author:suite:headless -- tests/suites/smoke.md

# Then execute the generated tests
npm run ci:test:smoke
npm run ci:test:regression
```

**What happens when you run a suite:**

1. Parser reads the `.md` file and extracts suite options + test cases
2. For each test case:
   - Injects entry/exit criteria into GPT instructions
   - Launches browser, navigates to base URL, auto-logs in (if configured)
   - GPT parses instructions into structured steps
   - Each step is executed live in the browser
   - DOM snapshot is captured (cached per URL for token savings)
   - GPT resolves each action using **preferred locators** (getByRole > getByLabel > getByText)
   - Results tracked: actions passed/failed, assertions passed/failed
3. After execution:
   - Page Objects generated using semantic locators → written to `pages` dir
   - Test Specs generated with proper imports → written to `output` dir
   - Suite report (JSON + TXT) → `ai-reports/nl-authoring/`

**Existing suite files:**
- `tests/suites/smoke.md` — 5 high-priority smoke test cases
- `tests/suites/regression.md` — 10 end-to-end regression test cases

### Option D: Adding Tests to the Existing Smoke Plan

Add `@smoke` or `@tc-plan` tags to the test describe block:

```javascript
test.describe('@smoke @tc-plan New Smoke Test', () => {
  test('TC-NEW - description', async ({ page }) => {
    // ...
  });
});
```

These will automatically be included when running:
```bash
npm run demo:smoke    # picks up @smoke
npm run demo:plan     # picks up @tc-plan
```

---

## 8. AI Exploration — Auto-Generating Tests

### How It Works

The Exploration Graph (LangGraph state machine) autonomously:

1. **Launches browser** and navigates to start URL
2. **Discovers page elements** (links, buttons, forms, inputs)
3. **Crawls** breadth-first up to `maxPages` / `maxDepth` limits
4. **Classifies** each page (login, dashboard, list, form, detail, etc.)
5. **Generates page objects** with locators for all interactive elements
6. **Generates test specs** covering discovered user flows
7. **Writes files** to `framework/pages/generated/` and `tests/generated/`

### Writing Effective Exploration Prompts in English

The quality of generated page objects and tests depends on how well you **describe your app in plain English**. Before running exploration, provide context about your app's structure, workflows, and critical paths.

#### **Exploration Prompt Formula**

Use this template to structure your exploration request:

```
App name: [what app is this?]

Main sections/pages: [list key areas users navigate to]

Critical user workflows: [describe 2-3 main end-to-end flows]

Page structure: [hierarchy of navigation, tabs, modals, etc.]

Dynamic content: [lists, pagination, lazy loading, real-time updates]

Authentication: [login required? multi-factor? session management?]

Blockers to handle: [popups, modals, consent screens that must be dismissed]

Focus areas: [which sections are most important to test?]

Avoid: [admin panels, debug pages, etc.]
```

#### **Example: Well-Structured Exploration Prompt** ✅

```
App name: Total Connect 2.0 Home Security Dashboard

Main sections: 
  - Login & Authentication
  - Dashboard/Home (overview of security status)
  - Security Panel (manage armed state, view sensors)
  - Devices (control thermostats, locks, cameras)
  - Activity Log (view historical events)
  - Scenes (automation workflows)

Critical user workflows:
  1. User logs in → sees dashboard → verifies all zones are secure
  2. User navigates to Security Panel → arms the system → checks sensor status
  3. User goes to Devices → controls thermostat temperature

Page structure:
  - Sidebar navigation with 6 main links
  - Security Panel has 3 tabs (Partitions, Sensors, Cameras)
  - Devices page shows grid of expandable device cards
  - Each device card has controls (toggles, sliders, dropdowns)

Dynamic content:
  - Sensor list varies by location (5-20 sensors)
  - Activity log is paginated (50 items per page)
  - Device controls vary by device type

Authentication: 
  - Email/password login required for all pages
  - Session persists across navigation
  - Logout available in sidebar

Blockers:
  - "Security Notifications" modal appears after login (toggle checkbox, click DONE)
  - Cookie consent banner at top (can be closed)

Focus areas: 
  - Login flow and credential validation
  - Security panel arm/disarm workflow
  - Device control (thermostat temperature, lock state)
  - Activity log filtering and pagination

Avoid: 
  - Developer settings (if any)
  - Mobile-responsive menu patterns (focus on desktop)
  - Admin-only configuration pages
```

#### **Example: Poor Exploration Prompt** ❌

```
"Explore the app"
```

**Why it fails:** No context. AI will crawl generic pages and miss critical workflows. Generated tests will be shallow.

---

### **Exploration Difficulty Levels**

Choose your approach based on app complexity:

#### **Level 1: Simple Static Site**
```bash
node framework/ai/scripts/explore-and-generate.js \
  --url https://example.com \
  --maxPages 5 \
  --maxDepth 2
```

**English description:** "Marketing website with public pages: Home, Features, Pricing, Blog, Contact, FAQ. Include links and form fields. No authentication required."

---

#### **Level 2: Medium App (Dashboard, CMS, etc.)**
```bash
node framework/ai/scripts/explore-and-generate.js \
  --url https://qa2.totalconnect2.com/ \
  --maxPages 8 \
  --maxDepth 3 \
  --login
```

**English description:** "Home security dashboard. After login, users can navigate to: Dashboard, Security Settings (3 tabs), Devices (list), Activity, Scenes. Focus on core user workflows: login, navigate sections, view status, toggle controls."

---

#### **Level 3: Complex SPA with Rich Interactivity**
```bash
node framework/ai/scripts/explore-and-generate.js \
  --url https://qa2.totalconnect2.com/login \
  --maxPages 12 \
  --maxDepth 4 \
  --login
```

**English description:** "Complex SPA with authentication required. Main workflows: (1) User logs in via email/password, (2) Dismisses security popup, (3) Views dashboard, (4) Navigates to security panel with tabs, (5) Arms/disarms system, (6) Controls devices via expand/collapse cards, (7) Checks activity history. Device controls vary by type (thermostat has temperature slider, lock has on/off toggle, camera has stream player). Priority: stable selectors for all device controls and tab switches."

---

### **Best Practices for English Descriptions**

✅ **DO:**
- **Be specific about user workflows**: "Users enable motion sensors by clicking checkboxes" vs generic "there's a list"
- **Describe page relationships**: "The Security Panel's 'Armed' status depends on all partition states"
- **Mention dynamic behavior**: "Devices list lazy-loads 5 at a time as user scrolls"
- **Call out blockers**: "A popup with Terms of Service appears once per session and must be dismissed"
- **Specify selector priorities**: "Prefer aria-labels for buttons; fall back to CSS if needed"
- **Include error cases**: "Invalid login shows error message below password field"

❌ **AVOID:**
- Vague descriptions: "explore all pages"
- Implementation details: "Use `querySelector('#btn-primary')` instead of text selector"
- Contradictions: "Skip these pages, but also include them"
- Over-specification: "Use this exact CSS" (let AI decide selectors)
- Missing context: "Login works" without mentioning credential format or redirect behavior

---

### **Iterative Refinement Workflow**

Run exploration multiple times, refining your English description each time:

**Round 1: Initial Discovery**
```bash
npm run demo:explore:login
# Review output in framework/pages/generated/ and tests/generated/
# Check: Are all pages covered? Are locators stable? Do tests align with your workflows?
```

**Round 2: If page objects are incomplete**

Add missing elements to your English description:
```
"I noticed the Device Detail modal wasn't captured. 
It appears when clicking a device card. 
It shows: device name, current state, adjustment sliders, save/cancel buttons."
```

Then re-run with `--maxPages 10` for deeper crawl.

**Round 3: If test specs are too generic**

Describe specific workflows you want tested:
```
"Tests should cover the full security arm/disarm workflow:
1. Navigate to Security Panel
2. Click 'Arm' button
3. Verify confirmation dialog
4. Click confirm
5. Verify 'Armed' status displays"
```

**Round 4: If certain flows aren't covered**

Start exploration from a specific URL:
```bash
# Bypass login, explore device controls directly
node framework/ai/scripts/explore-and-generate.js \
  --url https://qa2.totalconnect2.com/automation \
  --maxPages 8 \
  --login
```

---

### **Common English Prompts by Use Case**

**For Login/Auth Testing:**
> "Generate page objects for: login form, forgot password flow, password reset, error messages. Include: field validation, credential requirement, success redirect. Capture error states: invalid email format, wrong password, account locked."

**For Device Control Workflows:**
> "Generate stable page objects for device controls. Each device type has different UI: thermostats have temperature sliders, locks have on/off toggles, cameras have play buttons. Ensure selectors work across all device types. Include feedback elements: status lights, confirmation dialogs, load spinners."

**For Navigation Patterns:**
> "Map all navigation paths. Generate page objects for: sidebar links, breadcrumbs, back buttons, modal close buttons. Include page title verification for each section. Test all navigation combinations: direct links, nested navigation, back navigation."

**For Dynamic/Paginated Lists:**
> "The list lazy-loads 50 items at a time as user scrolls. Generate page objects for: list items, load more button/infinite scroll, pagination controls. Include item attributes: name, status, action buttons. Test: initial load, scroll to bottom, load next page."

**For Real-time Dashboards:**
> "Dashboard widgets auto-update every 30 seconds. Generate stable selectors for: metric values, status indicators, refresh buttons. Use data attributes when available. Include assertions that account for changing values. Avoid assertions on exact numbers (use ranges instead)."

**For Multi-step Wizards:**
> "Users complete a 4-step process: Step 1 (Personal Info), Step 2 (Address), Step 3 (Preferences), Step 4 (Confirmation). Generate page objects for each step. Include: form fields, validation errors, next/back buttons, progress indicator. Test: sequential flow, error recovery, back navigation."

---

### Commands

```bash
# Default exploration (uses test-data.config.js baseUrl)
npm run demo:explore

# With auto-login (explores post-login pages)
npm run demo:explore:login

# Custom parameters
node framework/ai/scripts/explore-and-generate.js \
  --url https://qa2.totalconnect2.com/ \
  --maxPages 8 \
  --maxDepth 3 \
  --login
```

### Configuration

In `framework/config/test-data.config.js`:

```javascript
exploration: {
  maxPages: 8,    // Max URLs to crawl
  maxDepth: 3,    // Max link depth from start
}
```

### Generated Output Structure

```
framework/pages/generated/
  └── TotalConnect<PageName>Page.js  # Class with locators + methods

tests/generated/
  └── <flow-name>-flow.spec.js       # Ready-to-run test with @smoke/@tc-plan tags
```

---

## 9. Natural Language Test Authoring

### Overview

Write tests in plain English. The NL Authoring Graph:
1. Parses instructions into actionable steps (GPT)
2. Launches a real browser
3. Executes each step (navigate, click, fill, assert)
4. Records all actions + outcomes
5. Optionally generates page objects and test specs

### Modes

| Mode | Command | Use Case |
|------|---------|----------|
| Interactive | `npm run ai:author` | Conversational test writing |
| Single instruction | `npm run ai:author -- --instructions "..."` | Quick one-shot |
| With login | `npm run ai:author:login` | Tests requiring authentication |
| Headless | `npm run ai:author:headless` | CI-friendly |
| Suite | `npm run ai:author:suite -- --suite path.md` | Batch execution |

### Suite Markdown Format

```markdown
# Suite Title

## TC-ID: Test Case Title
> login: true|false
> headless: true|false
> url: https://custom-url.com

Plain English test instructions here.
Multiple sentences are fine.
Each sentence becomes one or more test steps.
```

### Output Artifacts

All outputs go to `ai-reports/nl-authoring/`:
- `action-log-{timestamp}.txt` — Human-readable execution log
- Suite reports include: pass rate, action counts, assertion verdicts

---

## 10. Reporting & Metrics

### Playwright HTML Report

```bash
# View last run's HTML report
npm run report

# Auto-opens if PW_OPEN_REPORT=true was set
```

### Allure Report (Primary Production Report)

```bash
# Generate + open
npm run report:allure

# Generate only
npm run report:allure:generate

# Open existing report
npm run report:allure:open
```

**Allure features:**
- Test categorization (assertion failures, element not found, network errors)
- Screenshots attached to every test
- Step-level breakdown (via `test.step()`)
- Performance metrics (via `perf.attachLoadMetrics()`)
- AI healing evidence (when healing is active):
  - `[AI-INTERVENTION]` prefix on healed tests
  - Markdown summary of root cause + suggested fix
  - JSON attachment with full analysis

### AI Metrics Dashboard

```bash
# Compute healing effectiveness
npm run ai:metrics

# Outputs:
# - Pass@1, Pass@2, Pass@3 rates
# - SHE (Self-Healing Efficacy) percentage
# - Heal success rate
# - API latency statistics (mean, median, p95, p99)
# - Confidence threshold analysis
```

### Audit Trail

```bash
# Generate audit report from trail
npm run ai:audit

# View raw audit trail
# File: ai-reports/audit-trail.json
# Contains: run_start, test_start, healing_attempted, healing_result events
# Each event has: type, runId, correlationId, timestamp, data
```

### AI Report Files Reference

| File | Purpose | Updated |
|------|---------|---------|
| `ai-reports/healing-log.json` | All healing attempts (success/fail) | Per healing event |
| `ai-reports/audit-trail.json` | Chronological trace with correlation IDs | Per event |
| `ai-reports/run-history.json` | Test pass/fail history (for flaky analysis) | Per run |
| `ai-reports/latency-log.json` | GPT API call timing | Per API call |
| `ai-reports/failure-reports/*.json` | Detailed per-failure analysis | Per failure |
| `ai-reports/nl-authoring/*.txt` | NL authoring action logs | Per authoring session |

---

## 11. Environment Variables Reference

### AI System

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (required) | OpenAI API authentication key |
| `AI_HEALING_ENABLED` | `false` | Master switch for all AI features |
| `AI_HEALING_MODEL` | `gpt-4o-mini` | Model for runtime healing (fast) |
| `AI_ANALYSIS_MODEL` | `gpt-4o` | Model for post-test analysis (powerful) |
| `AI_HEALING_LOCATOR` | `true` | Enable runtime locator healing |
| `AI_HEALING_ANALYSIS` | `true` | Enable post-mortem failure analysis |
| `AI_HEALING_TEST_CASE` | `false` | Enable test case code suggestions |
| `AI_HEALING_MAX_RETRIES` | `2` | Max healing attempts per action |
| `AI_HEALING_CONFIDENCE_THRESHOLD` | `0.7` | Min confidence to accept a heal |
| `AI_OPENAI_TIMEOUT` | `30000` | API call timeout (ms) |
| `AI_MAX_DOM_LENGTH` | `60000` | Max DOM characters sent to GPT |
| `AI_METRICS_ENABLED` | `true` | Track healing metrics |
| `AI_AUDIT_ENABLED` | `true` | Write audit trail events |
| `AI_RAG_ENABLED` | `false` | Use RAG (vector search) for context |
| `AI_LIFECYCLE_ENABLED` | `false` | Full 6-phase lifecycle orchestration |
| `AI_EXPLORATION_ENABLED` | `true` | Enable exploration features |

### Test Runner

| Variable | Default | Description |
|----------|---------|-------------|
| `CI` | (unset) | Set in CI environments (enables retries, headless) |
| `PW_OPEN_REPORT` | (unset) | Set to `true` to auto-open HTML report |
| `PW_TC_MAX_LOAD_MS` | (unset) | Performance threshold in ms (fail if exceeded) |

---

## 12. NPM Scripts Quick Reference

### Testing

| Script | Description |
|--------|-------------|
| `npm test` | Run all tests headless |
| `npm run test:headed` | Run all tests with visible browser |
| `npm run test:tc` | TC tests (clean Allure + run + open report) |
| `npm run test:tc:headed` | TC tests headed |
| `npm run test:tc:perf` | TC tests with 8s load threshold |
| `npm run test:tc:allure` | TC tests → Allure report |
| `npm run test:auth` | Demo app auth tests |
| `npm run test:flows` | All demo app flow tests |
| `npm run test:ai` | All tests with AI healing enabled |

### Demo Pipeline

| Script | Description |
|--------|-------------|
| `npm run demo:explore` | Auto-explore app → generate POs + specs |
| `npm run demo:explore:login` | Explore with auto-login |
| `npm run demo:test` | Run generated tests (headless) |
| `npm run demo:test:headed` | Run generated tests (headed) |
| `npm run demo:smoke` | Run @smoke tagged tests |
| `npm run demo:plan` | Run @tc-plan tagged tests |
| `npm run demo:full` | Explore → Test → Report (headless) |
| `npm run demo:heal` | Run generated tests with healing |
| `npm run demo:phase1` | Post-mortem only (no runtime healing) |
| `npm run demo:phase2` | Full runtime healing |

### AI Tools

| Script | Description |
|--------|-------------|
| `npm run ai:drift` | Scan page objects for broken locators |
| `npm run ai:flaky` | Analyze flaky test patterns |
| `npm run ai:review` | Review healing log |
| `npm run ai:metrics` | Compute Pass@k, SHE, latency |
| `npm run ai:audit` | Generate audit report |
| `npm run ai:index` | Index knowledge base in ChromaDB |
| `npm run ai:explore` | Auto-explore and generate tests |
| `npm run ai:author` | NL test authoring (interactive) |
| `npm run ai:author:login` | NL authoring with login |
| `npm run ai:author:suite` | NL authoring from suite file |
| `npm run ai:lifecycle:full` | Full 6-phase lifecycle |

### Reporting

| Script | Description |
|--------|-------------|
| `npm run report` | Open Playwright HTML report |
| `npm run report:allure` | Generate + open Allure report |
| `npm run report:allure:generate` | Generate Allure only |
| `npm run report:allure:open` | Open existing Allure report |
| `npm run clean:allure` | Delete old Allure data |

### CI

| Script | Description |
|--------|-------------|
| `npm run ci:test` | CI: run generated tests |
| `npm run ci:test:heal` | CI: run with healing + 1 retry |
| `npm run ci:report` | CI: generate Allure report |

---

## 13. Troubleshooting & Common Issues

### Issue: Tests fail with "waiting for locator" / TimeoutError

**Cause:** Element locator is stale (UI changed) or element blocked by popup.

**Fix:**
1. Run `npm run ai:drift` to check which locators are broken
2. If healing is enabled, check `ai-reports/healing-log.json` for suggestions
3. Update the locator in the page object file
4. Common blockers: cookie consent, security notification popups

### Issue: AI healing not activating

**Check:**
1. `.env` has `AI_HEALING_ENABLED=true`
2. `.env` has valid `OPENAI_API_KEY`
3. Test imports from `framework/ai/fixtures/tc.ai.fixture` (not regular fixture)
4. For runtime healing: `AI_HEALING_LOCATOR=true`

### Issue: OpenAI API timeout

**Fix:**
- Increase: `AI_OPENAI_TIMEOUT=60000` in `.env`
- Or reduce DOM size: `AI_MAX_DOM_LENGTH=30000`
- Check API key quota at https://platform.openai.com/usage

### Issue: Allure report not showing AI healing data

**Check:**
1. `AI_HEALING_ENABLED=true` was set during the test run
2. The reporter `./framework/ai/reporters/ai-healing-reporter.js` is listed in `playwright.config.js`
3. Look for `[AI-INTERVENTION]` prefixed tests in the report

### Issue: Exploration generates empty/wrong page objects

**Fix:**
- Increase `maxPages` for deeper exploration
- Use `--login` flag if pages require authentication
- Check if the app has heavy SPA routing (may need longer waits)

### Issue: Infinite healing loop / test timeout at 120s

**Cause:** Healing is trying repeatedly but failing.

**Fix:**
- Reduce `AI_HEALING_MAX_RETRIES=1`
- Increase confidence threshold: `AI_HEALING_CONFIDENCE_THRESHOLD=0.85`
- Check `healing-log.json` — if `applied: false` repeatedly, the locator may need manual fix

### Issue: Proxy/fixture compatibility errors

**Background:** The framework uses monkey-patching (not ES6 Proxy) because Playwright internals require real Locator instances. If you see `expect(locator)` errors, ensure you're using the correct fixture import.

**Correct imports:**
```javascript
// For TC tests with AI healing:
const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');

// For TC tests without AI:
const { test, expect } = require('../../framework/fixtures/tc.fixture');

// For demo app tests:
const { test, expect } = require('../../framework/fixtures/app.fixture');
```

### Issue: Security Notifications popup blocks tests

**Built-in handling:** The `TotalConnectFlow.submitLogin()` method already dismisses this popup. If it still appears:
- The `popupInterceptor.js` utility handles common patterns
- Runtime healing will attempt to dismiss before healing

---

## Appendix: Test Credentials

Configured in `framework/config/test-data.config.js`:

| Field | Value |
|-------|-------|
| Base URL | `https://qa2.totalconnect2.com/` |
| Login URL | `https://qa2.totalconnect2.com/login` |
| Username | `tmsqa@1` |
| Password | `Password@3` |
| Display Name | `Keshav QA_Testt` |

> **Note:** These are QA environment credentials. Never commit production credentials.

---

## Appendix: Fixture-Provided Objects

### `tc.fixture.js` provides:

| Fixture | Type | Description |
|---------|------|-------------|
| `page` | Page | Playwright page with auto-failure artifact capture |
| `tc` | Object | TotalConnectFlow (not logged in) — call `tc.loginWithConfiguredUser()` manually |
| `tcLoggedIn` | Object | TotalConnectFlow (pre-logged in — ready to navigate) |
| `perf` | Object | `{ measureNavigation, attachLoadMetrics, assertOptionalLoadThreshold }` |

### `tc.ai.fixture.js` provides:

Same as `tc.fixture.js` but with:
- Page patched with healing proxy (when `AI_HEALING_ENABLED=true`)
- Extended timeout (120s) for healing attempts
- All locator-creating methods intercepted

---

## Appendix: Writing a Complete Test — Checklist

1. **Identify the page** — Does a page object exist in `framework/pages/generated/`?
2. **Identify the flow** — Is navigation already in `TotalConnectFlow.js`?
3. **Choose the fixture** — `tc.fixture` (manual) or `tc.ai.fixture` (with healing)?
4. **Add tags** — `@smoke`, `@tc-plan`, `@tc-only`, `@tc-perf` as appropriate
5. **Add Allure metadata** — `epic`, `feature`, `story`, `severity`, `tags`
6. **Use `test.step()`** — Wrap logical blocks for clear reporting
7. **Handle optional elements** — Use try/catch for popups, non-blocking elements
8. **Add assertions with timeouts** — Always specify timeout for async operations
9. **Run and verify** — `npx playwright test path/to/test.spec.js --headed`
10. **Check Allure** — `npm run report:allure` to verify step display
