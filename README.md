# Multi-Agentic AI Self-Healing Test Automation Framework

> **Application Under Test:** Total Connect 2.0 (Honeywell/Resideo Home Security)
> **Target Environment:** QA2 — `https://qa2.totalconnect2.com/`
> **Stack:** Playwright JS · OpenAI GPT · LangGraph · LambdaTest Cloud · Allure Reporting · Slack Integration
> **Author:** Keshav — MTech Thesis, BITS Pilani WILP

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Project Structure](#2-project-structure)
3. [Architecture](#3-architecture)
4. [Smoke Suite — 8 Test Cases](#4-smoke-suite--8-test-cases)
5. [Running Tests](#5-running-tests)
6. [LambdaTest Cloud Integration](#6-lambdatest-cloud-integration)
7. [Slack Integration](#7-slack-integration)
8. [Allure Reporting](#8-allure-reporting)
9. [AI Self-Healing](#9-ai-self-healing)
10. [Natural Language Test Authoring](#10-natural-language-test-authoring)
11. [Configuration Reference](#11-configuration-reference)
12. [NPM Scripts Reference](#12-npm-scripts-reference)
13. [Bug Fixes & Stability (May 2026)](#13-bug-fixes--stability-may-2026)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js     | ≥ 18.x  |
| npm         | ≥ 9.x   |
| OS          | Windows / macOS / Linux |

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Copy environment file and configure
copy .env.example .env
```

### Run Smoke Suite (Full Pipeline)

```bash
npm run execute:smoke
```

This single command:
1. Cleans previous Allure results
2. Runs all 8 smoke tests in Chrome
3. Generates a timestamped Allure report
4. Opens the report in browser
5. Sends a Slack notification with results

---

## 2. Project Structure

```
├── playwright.config.js              # Test runner config (projects, reporters, timeouts)
├── global-setup.js                   # Pre-run cleanup
├── package.json                      # 75 npm scripts
├── .env                              # Environment config (git-ignored)
│
├── framework/
│   ├── config/
│   │   ├── runtime.config.js         # ★ Centralized runtime config (.env → single source of truth)
│   │   └── test-data.config.js       # Test data (URLs, credentials, selectors)
│   │
│   ├── pages/generated/smoke/        # Page Objects (smoke suite)
│   │   ├── LoginPage.js              # Login form interactions
│   │   ├── TotalConnectHomePage.js   # Home page — arm/disarm, partition management
│   │   ├── DevicesPage.js            # Devices/automation page verification
│   │   ├── CamerasPage.js            # ★ Cameras page (iframe-based content)
│   │   └── ActivityPage.js           # Activity/events log verification
│   │
│   ├── utils/
│   │   ├── browser-launcher.js       # ★ Centralized browser/context/page factory
│   │   ├── slack-notify.js           # ★ Slack webhook notifier (Block Kit)
│   │   ├── bundle-allure-report.js   # Bundles Allure report into single portable HTML
│   │   ├── waitForPageReady.js       # SPA loader detection utility
│   │   ├── pageLoadMetrics.js        # Web Vitals measurement
│   │   └── popupInterceptor.js       # Cookie/modal popup dismissal
│   │
│   ├── reporters/
│   │   └── allure-auto-reporter.js   # ★ Auto-generates timestamped Allure reports
│   │
│   ├── ai/                           # AI Self-Healing Subsystem
│   │   ├── agents/                   # 6 AI agents (locator, failure, test-case, drift, flaky, exploratory)
│   │   ├── config/                   # ai.config.js — AI configuration
│   │   ├── core/                     # Page proxy, locator proxy, OpenAI client
│   │   ├── fixtures/                 # tc.ai.fixture.js — AI-enhanced test fixture
│   │   ├── graph/                    # LangGraph state machines (4 graphs)
│   │   ├── metrics/                  # Pass@k, SHE, latency tracking
│   │   ├── prompts/                  # GPT prompt templates
│   │   ├── rag/                      # ChromaDB vector search (optional)
│   │   ├── reporters/                # AI healing reporter (custom Playwright reporter)
│   │   ├── scripts/                  # 12 CLI scripts (explore, heal, drift, metrics, etc.)
│   │   ├── storage/                  # Healing log, audit trail, run history persistence
│   │   └── utils/                    # DOM trimmer, error normalizer, timing
│   │
│   ├── fixtures/                     # Playwright test fixtures
│   ├── flows/                        # Business action flows (TC, auth, cart, checkout)
│   └── data/                         # Test data files
│
├── tests/
│   ├── generated/smoke/
│   │   └── smoke-suite.spec.js       # ★ Consolidated 8-test smoke suite
│   ├── total-connect/                # Performance & timing tests
│   └── flows/                        # Business flow tests (demo app)
│
├── ai-reports/                       # AI output (healing logs, failure reports, audit trail)
├── allure-results/                   # Raw Allure results (auto-cleaned per run)
├── allure-reports-history/           # ★ Timestamped Allure reports archive
├── allure-report/                    # Latest generated report
├── docs/                             # Project documentation
├── test-results/                     # Screenshots, videos, traces
└── playwright-report/                # Playwright HTML report
```

---

## 3. Architecture

### Test Execution Flow

```
npm run execute:smoke
  │
  ├─ 1. clean:allure          → Wipe previous results
  ├─ 2. playwright test        → Run smoke-suite.spec.js
  │     │
  │     ├─ browser-launcher.js     → Launch Chrome (headed/headless per .env)
  │     ├─ LoginPage.js            → Login once, share session across all tests
  │     ├─ TotalConnectHomePage.js → Arm/disarm, navigate to sections
  │     ├─ CamerasPage.js         → Verify cameras inside iframe
  │     ├─ DevicesPage.js         → Verify device categories
  │     ├─ ActivityPage.js        → Verify event log
  │     │
  │     ├─ allure-auto-reporter   → Generate timestamped report + open in browser
  │     └─ ai-healing-reporter    → Analyze failures via LangGraph (if enabled)
  │
  └─ 3. slack-notify.js       → Send Block Kit notification to Slack
```

### AI Self-Healing Flow

```
Test action fails (e.g., click on stale locator)
  → locator-proxy intercepts the error
    → runtime-graph tries CSS → role → text healing strategies
      → locator-healer.agent asks GPT for alternative selectors
        → Healed locator retried → test continues if successful
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single browser session for smoke suite | Faster execution — login once, navigate between pages |
| Sequential test execution (`workers: 1`) | Tests share state; arm/disarm must complete before cameras |
| iframe-aware page objects | TC2 cameras page renders inside `#fenixPagetarget` iframe |
| Non-blocking report open | `allure-auto-reporter` uses `exec()` so Slack step runs after tests |
| 3-tier Allure summary loading | Slack reads from `allure-report/` → `allure-reports-history/` → raw `allure-results/` |
| Runtime config via `.env` | Single file controls headless, browser, Slack, AI — no code changes needed |

---

## 4. Smoke Suite — 8 Test Cases

All tests run sequentially in a single browser session.

| # | Test Case | What It Verifies | Timeout |
|---|-----------|------------------|---------|
| TC-001 | Verify home page loaded after login | URL contains `/home` | 60s |
| TC-002 | Arm Home and Disarm partitions | Full arm/disarm cycle with partition selection | 180s |
| TC-003 | Navigate to Devices page | URL contains `/automation`, device categories visible | 60s |
| TC-004 | Navigate to Cameras page | URL contains `/cameras`, cameras heading visible in iframe | 90s |
| TC-005 | Navigate to Activity page | URL contains `/events`, activity log entries visible | 60s |
| TC-006 | Verify all cameras visible | Camera name links (KITCHEN, LOBBY, DOMECB5) in iframe | 60s |
| TC-007 | Verify camera names displayed | Same as TC-006, skips navigation if already on cameras | 60s |
| TC-008 | Verify camera feeds loaded | Cameras visible = feeds rendered | 60s |

**Latest execution:** 8/8 passed in **44 seconds** (May 22, 2026) — Local | **53 seconds** — LambdaTest Cloud

---

## 5. Running Tests

### Execution Platforms

The framework supports two execution platforms, toggled via `EXECUTION_PLATFORM` in `.env`:

| Platform | How It Works | Browser |
|----------|-------------|---------|
| **Local** (`EXECUTION_PLATFORM=local`) | Opens Chrome on your machine via `chromium.launch()` | Default viewport, headed |
| **Lambda** (`EXECUTION_PLATFORM=lambda`) | Connects to LambdaTest cloud via CDP WebSocket | 1920×1080 full-screen on cloud VM |

### Primary Commands — Local Execution

```bash
# Full pipeline: clean + tests + Slack notification
npm run execute:smoke

# Just run the smoke suite (no Slack)
npx playwright test tests/generated/smoke/smoke-suite.spec.js --project chrome

# Run headed (visible browser)
npm run test:headed

# Run with AI self-healing enabled
npm run execute:smoke:heal

# Run specific test by name
npx playwright test -g "TC-002"
```

### Primary Commands — LambdaTest Cloud

```bash
# Smoke suite on LambdaTest (recommended for daily execution)
npm run execute:smoke:lambda

# Full test suite on LambdaTest
npm run test:lambda

# Smoke-only project on LambdaTest
npm run test:lambda:smoke

# Full test plan on LambdaTest
npm run test:lambda:plan

# All generated tests on LambdaTest
npm run test:lambda:generated
```

Each Lambda command:
1. Cleans previous Allure results
2. Runs tests on LambdaTest cloud (Chrome, Windows 11, 1920×1080)
3. Updates test session status on LambdaTest dashboard (`lambdatest-status.js`)
4. Sends Slack notification with results

### Other Test Suites

```bash
# Total Connect performance tests
npm run test:tc:perf

# Demo app flow tests
npm run test:flows

# Full test plan (all @tc-plan tagged tests)
npx playwright test --project tc-plan
```

### Codegen (Record & Inspect)

```bash
# Open Playwright codegen for cameras page
npm run codegen:record:cameras

# Generic codegen
npx playwright codegen https://qa2.totalconnect2.com/
```

---

## 6. LambdaTest Cloud Integration

### Overview

Tests run on LambdaTest's cloud infrastructure via Playwright's CDP (Chrome DevTools Protocol) connection. This provides:

- **Consistent environment** — Windows 11, Chrome latest, 1920×1080 resolution
- **Fast execution** — cloud VMs have low-latency connectivity to the QA server
- **Video recording** — every session recorded on LambdaTest dashboard
- **Network logs** — full HAR capture for debugging
- **Parallel-ready** — scale to multiple concurrent sessions (future)

### How It Works

```
browser-launcher.js
  │
  ├─ EXECUTION_PLATFORM=local  → chromium.launch({ channel: 'chrome' })
  │                              → context with default viewport
  │
  └─ EXECUTION_PLATFORM=lambda → chromium.connect(wss://cdp.lambdatest.com/...)
                                 → context with viewport: 1920×1080
                                 → 60s connection timeout
```

The CDP WebSocket URL includes encoded capabilities:
- Browser: Chrome (latest)
- Platform: Windows 11
- Resolution: 1920×1080
- Video, console, network logging enabled
- Build name auto-generated with suite + timestamp

### Configuration (.env)

```env
# Platform toggle
EXECUTION_PLATFORM=lambda          # 'local' or 'lambda'

# LambdaTest credentials
LT_USERNAME=your.username
LT_ACCESS_KEY=your-access-key

# Optional overrides
LT_BROWSER=Chrome                  # Browser name
LT_BROWSER_VERSION=latest          # Browser version
LT_PLATFORM=Windows 11             # OS
LT_RESOLUTION=1920x1080            # VM screen resolution
LT_BUILD_NAME=                     # Custom build name (auto-generated if empty)
LT_PROJECT_NAME=TC2-Automation     # Project name on dashboard
LT_VIDEO=true                      # Record video
LT_CONSOLE=true                    # Capture console logs
LT_NETWORK=true                    # Capture network HAR
LT_TUNNEL=false                    # Use LambdaTest tunnel (for private apps)
```

### LambdaTest Dashboard

After each Lambda run, `lambdatest-status.js` updates the session status (passed/failed) on the LambdaTest Automation dashboard. View results at:
`https://automation.lambdatest.com/build`

### Quick Switch Between Platforms

```bash
# Run locally (override .env)
$env:EXECUTION_PLATFORM="local"; npx playwright test tests/generated/smoke/smoke-suite.spec.js --project chrome

# Run on Lambda (override .env)
$env:EXECUTION_PLATFORM="lambda"; npx playwright test tests/generated/smoke/smoke-suite.spec.js --project chrome
```

---

## 7. Slack Integration

### How It Works

After test execution, `slack-notify.js` sends a rich Block Kit notification to a configured Slack channel:

- **Green sidebar** for all-pass, **red** for any failures
- Test counts with emoji indicators (✅ ❌ ⚠️ ⏩)
- Unicode progress bar visualization
- Duration, environment, AI healing status, timestamp
- Action buttons for pipeline/report links (when running in CI)

### Configuration

Set these in `.env`:

```env
SLACK_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Manual Trigger

```bash
# Send notification based on latest test results
node framework/utils/slack-notify.js
```

### Summary Data Sources (3-tier fallback)

1. `allure-report/widgets/summary.json` — standard Allure report
2. `allure-reports-history/<latest>/widgets/summary.json` — timestamped archive
3. `allure-results/*-result.json` — raw result files (built on-the-fly)

---

## 8. Allure Reporting

### Auto-Generated Reports

Every test run generates a timestamped report in `allure-reports-history/`:

```
allure-reports-history/
├── allure-report-2026-05-18_23-54-34/
├── allure-report-2026-05-19_00-11-22/
└── ...
```

### Report Commands

```bash
# Generate report from latest results
npm run report:allure:generate

# Generate and open
npm run report:allure

# View history — browse past reports
npm run report:view:history

# Bundle into single portable HTML file (share anywhere)
npm run report:bundle:open
```

### Portable Bundle

The bundler (`bundle-allure-report.js`) converts the multi-file Allure report into a **single self-contained HTML file** that works offline, on `file://`, on any machine:

```bash
npm run report:bundle        # → allure-report.html
npm run report:bundle:open   # → generates + opens in browser
```

---

## 9. AI Self-Healing

### Overview

The framework includes a multi-agent AI system powered by OpenAI GPT and LangGraph:

- **Runtime Healing:** Automatically fix broken locators during test execution
- **Post-Failure Analysis:** Classify failures and suggest fixes via LangGraph state machines
- **Exploratory Testing:** AI-driven page exploration to generate new test specs
- **Drift Detection:** Compare current UI against historical snapshots
- **Flaky Test Analysis:** Identify and rank flaky tests from run history
- **Natural Language Authoring:** Generate tests from plain English descriptions

### Enable AI Features

```env
AI_HEALING_ENABLED=true
OPENAI_API_KEY=sk-your-key-here
```

### AI Commands

```bash
# Run with healing enabled
npm run smoke:heal

# Explore app and generate new tests
npm run ai:explore

# Detect UI drift
npm run ai:drift

# Analyze flaky tests
npm run ai:flaky

# Review healing log
npm run ai:review

# Compute healing metrics (Pass@k, SHE)
npm run ai:metrics

# Generate audit report
npm run ai:audit
```

### AI Reports

All AI activity is logged in `ai-reports/`:

| File | Purpose |
|------|---------|
| `healing-log.json` | Every healing attempt (locator, strategy, outcome) |
| `audit-trail.json` | Chronological audit events with correlation IDs |
| `run-history.json` | Historical test outcomes across runs |
| `latency-log.json` | OpenAI API call latencies |
| `cost-log.json` | Token usage and cost tracking |
| `healing-cache.json` | Cached successful heals for reuse |
| `failure-reports/` | Detailed JSON per failure analysis |
| `test-healing/` | Healing process step-by-step details |

---

## 10. Natural Language Test Authoring

Generate test specs from plain English descriptions:

```bash
# Interactive NL authoring
npm run ai:author

# Generate smoke suite from NL
npm run ai:author:smoke

# Headless mode (CI-friendly)
npm run ai:author:headless
```

Example: *"Login to TC2, navigate to cameras page, verify KITCHEN camera is visible"* → generates a complete Playwright spec.

---

## 11. Configuration Reference

### .env Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EXECUTION_PLATFORM` | `local` | Execution target: `local` (your machine) or `lambda` (LambdaTest cloud) |
| `HEADLESS` | `false` (local) / `true` (CI) | Run browser in headless mode |
| `BROWSER_CHANNEL` | `chrome` | Browser channel (`chrome`, `msedge`, etc.) |
| `SLOW_MO` | `0` | Slow down actions by N ms (debugging) |
| `OPEN_REPORT` | `true` (local) | Auto-open Allure report after tests |
| `SLACK_ENABLED` | `true` | Send Slack notifications after tests |
| `SLACK_WEBHOOK_URL` | — | Slack incoming webhook URL |
| `NAV_TIMEOUT` | `15000` (local) / `30000` (CI) | Navigation timeout (ms) |
| `ACTION_TIMEOUT` | `10000` (local) / `15000` (CI) | Action timeout (ms) |
| `TEST_TIMEOUT` | `60000` (local) / `120000` (CI) | Per-test timeout (ms) |
| `OPENAI_API_KEY` | — | OpenAI API key (required for AI features) |
| `AI_HEALING_ENABLED` | `false` | Enable runtime AI self-healing |
| `AI_HEALING_MODEL` | `gpt-4o-mini` | Model for locator healing |
| `AI_ANALYSIS_MODEL` | `gpt-4o` | Model for failure analysis |

### runtime.config.js

All `.env` values are parsed into a clean config object:

```javascript
const runtime = require('./framework/config/runtime.config');

runtime.isCI                          // true in CI environments
runtime.mode                          // 'local' or 'ci'
runtime.browser.headless              // boolean
runtime.browser.channel               // 'chrome'
runtime.browser.slowMo                // number (ms)
runtime.reporting.openAfterRun        // boolean
runtime.reporting.slackEnabled        // boolean
runtime.reporting.slackWebhookUrl     // string
runtime.ai.healingEnabled             // boolean
runtime.ai.openaiApiKey               // string
runtime.timeouts.navigation           // ms
runtime.timeouts.action               // ms
runtime.timeouts.test                 // ms
```

### Playwright Config (playwright.config.js)

| Setting | Value |
|---------|-------|
| Workers | 1 (sequential) |
| Retries | 0 (local) / 2 (CI) |
| Screenshots | Every test |
| Video | Retain on failure |
| Trace | Retain on failure |
| Action timeout | 30s |
| Navigation timeout | 30s |

**Projects:**

| Project | Test Directory | Description |
|---------|----------------|-------------|
| `chrome` | `tests/` | All tests in Desktop Chrome |
| `tc-smoke` | `tests/generated/smoke/` | Smoke suite only (`smoke-suite.spec.js`) |
| `tc-plan` | `tests/generated/` | Full test plan (`@tc-plan` tag) |
| `total-connect` | `tests/total-connect/` | TC performance tests |

---

## 12. NPM Scripts Reference

### Execution Pipeline

| Script | Description |
|--------|-------------|
| `execute:smoke` | **Full pipeline** — clean + test + Slack (local) |
| `execute:smoke:lambda` | **Full pipeline on LambdaTest** — clean + test + status update + Slack |
| `execute:smoke:heal` | Same as execute:smoke but with AI healing enabled |
| `execute:smoke:gen` | Generate tests + execute |
| `execute:report` | Generate Allure report only |

### LambdaTest Cloud

| Script | Description |
|--------|-------------|
| `test:lambda` | All tests on LambdaTest + status + Slack |
| `test:lambda:smoke` | Smoke project on LambdaTest + status + Slack |
| `test:lambda:plan` | Full test plan on LambdaTest + status + Slack |
| `test:lambda:generated` | All generated tests on LambdaTest + status + Slack |

### Test Running

| Script | Description |
|--------|-------------|
| `test` | Run all tests (headless) |
| `test:headed` | Run all tests (visible browser) |
| `smoke` | Run smoke suite |
| `smoke:heal` | Run smoke with AI healing |
| `test:tc` | Run Total Connect tests |
| `test:tc:perf` | Run performance tests |

### Reporting

| Script | Description |
|--------|-------------|
| `report:allure` | Generate + open Allure report |
| `report:bundle:open` | Bundle into portable HTML + open |
| `report:view:history` | Browse timestamped report archive |
| `clean:allure` | Delete previous results/report |

### AI Features

| Script | Description |
|--------|-------------|
| `ai:explore` | AI-driven exploratory testing |
| `ai:author` | Natural language test authoring |
| `ai:drift` | UI drift detection |
| `ai:flaky` | Flaky test analysis |
| `ai:heal` | Manual healing trigger |
| `ai:metrics` | Compute healing metrics |
| `ai:review` | Review healing log |
| `ai:audit` | Generate audit report |

---

## 13. Bug Fixes & Stability (May 2026)

### Execution Consistency Fixes

The smoke suite now achieves **7/7 consecutive passes** on local execution and **8/8 on LambdaTest** — verified with back-to-back runs averaging 44s–1.5min.

#### Root Causes Identified & Fixed

| Issue | Root Cause | Fix Applied |
|-------|-----------|-------------|
| Login form never appearing (60s timeout) | Cookie consent banner blocked the main app JS bundle from loading | `Promise.race` approach — detect and dismiss cookie banner before waiting for login form |
| Tests failing after login with "Signing in..." | `waitForURL('**/home')` resolved on URL change, but app was still authenticating | Added explicit wait for Devices button (real content readiness signal) |
| `page.goto` timing out at 90s on slow network | `waitUntil: 'domcontentloaded'` too slow — full DOM parse takes 60-90s from local network | Switched to `waitUntil: 'commit'` (server response) + explicit element waits |
| TC-003 failing on navigation to `/automation` | URL glob `**/automation` didn't match sub-paths like `/automation/security` | Fixed to `**/automation**` (matches any sub-path) |
| Browser re-launching after mid-suite failure | `mode: 'serial'` skipped remaining tests; `mode: 'default'` restarted worker | Kept `mode: 'default'` + `ensureOnHomePage()` recovery helper for state reset |
| `--start-maximized` + `viewport:null` crash | `deviceScaleFactor:1` from `--project chrome` incompatible with `viewport:null` | Removed maximize args entirely; Lambda uses explicit 1920×1080, local uses default |
| Suite taking 3+ minutes | Redundant navigations, excessive `waitForTimeout`, hardcoded delays | `ensureOnHomePage()` skips navigation when already there; removed unnecessary waits |

#### Key Stability Patterns

```javascript
// 1. Cookie consent handling (blocks app load on first visit)
await Promise.race([
  cookieOk.waitFor({ state: 'visible', timeout: 30000 }),
  cookieAccept.waitFor({ state: 'visible', timeout: 30000 }),
  page.getByLabel('Username').waitFor({ state: 'visible', timeout: 30000 }),
]);

// 2. Content-based readiness (not just URL change)
await page.waitForURL('**/home', { waitUntil: 'commit' });
await page.getByRole('button', { name: 'Devices' }).first().waitFor({ state: 'visible', timeout: 45000 });

// 3. Page recovery helper (handles state corruption after failures)
async function ensureOnHomePage() {
  if (!page.url().includes('/home')) {
    await page.goto(homeUrl, { waitUntil: 'commit' });
  }
  await page.getByRole('button', { name: 'Devices' }).first().waitFor({ state: 'visible', timeout: 30000 });
}
```

### Slack Notification Fixes

| Issue | Fix |
|-------|-----|
| Slack not firing after `execute:smoke` | Separated report generation (`execSync`) from report open (`exec`) — no longer blocks process exit |
| Stale summary data in notifications | 3-tier fallback: `allure-report/` → `allure-reports-history/` → raw `allure-results/` |
| Emoji not rendering in Slack | Replaced `:green_square:` shortcodes with Unicode characters (✅ ❌ ⬜) |
| Lambda runs not triggering Slack | Added `cross-env EXECUTION_PLATFORM=lambda node framework/utils/slack-notify.js` to all Lambda scripts |

### LambdaTest Integration Fixes

| Issue | Fix |
|-------|-----|
| Connection timeout on slow networks | Set explicit 60s timeout on `chromium.connect()` |
| Tests failing due to small viewport on cloud | Explicit `viewport: { width: 1920, height: 1080 }` for Lambda context |
| Build names not distinguishing suites | Auto-generated build name includes suite type + date/time |
| Session status not updated on dashboard | Added `lambdatest-status.js` post-run step in all Lambda npm scripts |

### Verified Execution Results (May 22, 2026)

```
Local Execution — 7 consecutive runs:
  Run 1: 8 passed (1.5m)   ← cold start, cookie banner
  Run 2: 8 passed (58.6s)
  Run 3: 8 passed (50.2s)
  Run 4: 8 passed (49.9s)
  Run 5: 8 passed (44.2s)
  Run 6: 8 passed (1.1m)
  Run 7: 8 passed (1.1m)

LambdaTest Execution:
  8 passed (53.2s) — full-screen 1920×1080
```

---

## 14. Troubleshooting

### Common Issues

**Tests hang on cameras page**
Camera content loads inside an iframe (`#fenixPagetarget`). The `CamerasPage` page object accesses it via `page.locator('#fenixPagetarget').contentFrame()`. Never use `page.getByText()` for camera elements — use `frame.getByRole('link', { name })` instead.

**Slack notification doesn't fire after `execute:smoke`**
The `allure-auto-reporter` must use non-blocking `exec()` to open the report, not `execSync` with `--open` which blocks the process. Verify `SLACK_ENABLED=true` and `SLACK_WEBHOOK_URL` is set in `.env`.

**Arm/disarm fails with "Unable to perform the action"**
The security system needs cooldown time between operations. `ensureDisarmed()` includes a 5-second cooldown. If the system is stuck, manually disarm via the TC2 web app.

**AI healing not working**
Ensure `OPENAI_API_KEY` is set and valid (check for rate limiting / quota). Set `AI_HEALING_ENABLED=true` in `.env`.

**Allure report shows stale data**
Run `npm run clean:allure` before execution, or use `execute:smoke` which auto-cleans.

### Key Bug Fixes (May 2026)

See [Section 13 — Bug Fixes & Stability](#13-bug-fixes--stability-may-2026) for the complete list of fixes that achieved consistent daily execution.

---

## License

This project is part of an MTech thesis at BITS Pilani WILP. For academic use only.
