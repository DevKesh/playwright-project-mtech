# Multi-Agentic AI Self-Healing Test Automation Framework

> **Application Under Test:** Total Connect 2.0 (Honeywell/Resideo Home Security)
> **Target Environment:** QA2 — `https://qa2.totalconnect2.com/`
> **Stack:** Playwright JS · OpenAI GPT · LangGraph · Allure Reporting · Slack Integration
> **Author:** Keshav — MTech Thesis, BITS Pilani WILP

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Project Structure](#2-project-structure)
3. [Architecture](#3-architecture)
4. [Smoke Suite — 8 Test Cases](#4-smoke-suite--8-test-cases)
5. [Running Tests](#5-running-tests)
6. [Slack Integration](#6-slack-integration)
7. [Allure Reporting](#7-allure-reporting)
8. [AI Self-Healing](#8-ai-self-healing)
9. [Natural Language Test Authoring](#9-natural-language-test-authoring)
10. [Configuration Reference](#10-configuration-reference)
11. [NPM Scripts Reference](#11-npm-scripts-reference)
12. [Troubleshooting](#12-troubleshooting)

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

**Latest execution:** 8/8 passed in **49 seconds** (May 19, 2026)

---

## 5. Running Tests

### Primary Commands

```bash
# Full pipeline: tests + report + Slack notification
npm run execute:smoke

# Just run tests (no Slack)
npx playwright test --project tc-smoke

# Run headed (visible browser)
npm run test:headed

# Run with AI self-healing enabled
npm run execute:smoke:heal

# Run specific test by name
npx playwright test -g "TC-002"
```

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

## 6. Slack Integration

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

## 7. Allure Reporting

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

## 8. AI Self-Healing

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

## 9. Natural Language Test Authoring

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

## 10. Configuration Reference

### .env Variables

| Variable | Default | Description |
|----------|---------|-------------|
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

## 11. NPM Scripts Reference

### Execution Pipeline

| Script | Description |
|--------|-------------|
| `execute:smoke` | **Full pipeline** — clean + test + report + Slack |
| `execute:smoke:heal` | Same but with AI healing enabled |
| `execute:smoke:gen` | Generate tests + execute |
| `execute:report` | Generate Allure report only |

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

## 12. Troubleshooting

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

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Camera tests always failing | Content inside iframe, `getByText` searched main page | Use `contentFrame()` on `#fenixPagetarget` |
| Slack not firing in pipeline | `execSync('allure generate --open')` blocking process exit | Separated into `execSync` (generate) + `exec` (open) |
| TC-002 hanging for 180s | `.click()` without timeout + default `actionTimeout: 0` | Added explicit `{ timeout: 10000 }` on all clicks, global `actionTimeout: 30s` |
| Suite taking 3m48s | Redundant navigations, 30s `waitForPageReady`, 15s cooldown | Skip nav when already on page, reduced timeouts → **49s** |
| Stale Slack summary data | Only read `allure-report/` which was outdated | 3-tier fallback: report → history → raw results |
| Slack emoji not rendering | `:green_square:` Slack shortcodes in progress bar | Replaced with Unicode ✅❌⬜ |

---

## License

This project is part of an MTech thesis at BITS Pilani WILP. For academic use only.
