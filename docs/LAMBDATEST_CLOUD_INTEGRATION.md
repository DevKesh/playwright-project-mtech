# LambdaTest Cloud Integration

## Overview

This document describes the full integration of **LambdaTest Cloud Execution** into our Playwright automation framework. The integration allows the same 8 Smoke Test Cases (and any other suite) to execute on LambdaTest's remote cloud browsers — **identically to local execution** — with a single environment toggle.

**Date Completed:** May 21, 2026  
**Approach:** Playwright Node.js SDK → `chromium.connect()` over CDP WebSocket  
**Toggle:** `EXECUTION_PLATFORM=local|lambda` (in `.env`)

---

## Architecture Decision

### Why Playwright Node.js SDK (CDP) over Manual WebSocket?

| Factor | Playwright Node SDK (CDP) | Manual WebSocket |
|--------|--------------------------|------------------|
| Test code changes | Minimal — swap `launch()` for `connect()` | Requires custom transport layer |
| Playwright features (locators, expect, auto-wait) | Fully preserved | Partially lost |
| Maintainability | High — same API surface | Low — custom abstractions |
| LambdaTest Dashboard integration | Native (video, logs, network) | Limited |
| Debugging | Standard Playwright traces | Custom debugging |

**Decision:** Use the Playwright Node SDK approach with `chromium.connect(wssEndpoint)` for LambdaTest, keeping `chromium.launch()` for local execution. Zero test code changes required.

---

## Implementation Details

### 1. Environment Configuration (`.env`)

```env
# Execution platform toggle — controls local vs cloud execution
EXECUTION_PLATFORM=local          # 'local' (default) or 'lambda'

# LambdaTest credentials
LT_USERNAME=keshav.naganathan
LT_ACCESS_KEY=<your-access-key>

# LambdaTest options (all optional — sensible defaults built in)
LT_BROWSER=Chrome
LT_BROWSER_VERSION=latest
LT_PLATFORM=Windows 11
LT_RESOLUTION=1920x1080
LT_VIDEO=true
LT_CONSOLE=true
LT_NETWORK=true
LT_TUNNEL=false
# LT_BUILD_NAME=       # Leave commented for dynamic build names
# LT_PROJECT_NAME=TC2-Automation
```

### 2. Browser Launcher (`framework/utils/browser-launcher.js`)

The centralized browser launch utility handles both execution modes:

```
┌──────────────────────────────────────────────────────────────┐
│                    launchBrowser()                            │
├──────────────────────────────────────────────────────────────┤
│  if EXECUTION_PLATFORM === 'lambda':                         │
│    → buildLambdaTestEndpoint() → WSS URL with caps           │
│    → chromium.connect(wss://cdp.lambdatest.com/playwright?)  │
│    → viewport: { width: 1920, height: 1080 }                │
│  else:                                                       │
│    → chromium.launch({ channel: 'chrome', args: [...] })     │
│    → viewport: null (maximized window)                       │
├──────────────────────────────────────────────────────────────┤
│  Both paths:                                                 │
│    → addCookies() (consent bypass)                           │
│    → newPage()                                               │
│    → return { browser, context, page }                       │
└──────────────────────────────────────────────────────────────┘
```

**Key capabilities sent to LambdaTest:**
- `browserName`, `browserVersion`, `platform`, `resolution`
- `build` (dynamic — includes suite name + timestamp)
- `project` (TC2-Automation)
- `video`, `console`, `network` capture flags
- `playwrightClientVersion` (must match local Playwright version)

### 3. Playwright Config Changes (`playwright.config.js`)

Conditional settings applied when `isLambda = true`:

| Setting | Local | Lambda | Reason |
|---------|-------|--------|--------|
| `timeout` | 60s | 120s | Cloud latency allowance |
| `actionTimeout` | 30s | 45s | Remote click/fill takes longer |
| `navigationTimeout` | 30s | 45s | Network routing through cloud |
| `video` | `retain-on-failure` | `off` | LT records natively; downloading over WS hangs |
| `trace` | `retain-on-failure` | `off` | Same as video — teardown timeout |
| `connectOptions` | Not set | `{ wsEndpoint: wss://... }` | CDP connection for fixture-based tests |

### 4. Dynamic Build Names

Build names are generated at runtime for readable LambdaTest dashboard entries:

```
TotalConnect QA - Smoke Suite (8 TCs) - May 21, 2026 11:15 PM
TotalConnect QA - Test Plan - All Tagged - May 21, 2026 2:30 PM
TotalConnect QA - Regression Suite - May 20, 2026 9:00 AM
```

Detection logic reads `process.env.npm_lifecycle_event` to determine which script triggered the run.

### 5. LambdaTest Session Status Marking (`framework/utils/lambdatest-status.js`)

Post-execution script that reads Allure results and marks LambdaTest sessions as PASSED/FAILED:

```
┌─────────────────────────────────────────────────────────────┐
│  1. Read allure-results/*.json                              │
│  2. Count: passed, failed, broken, skipped                  │
│  3. Determine status:                                       │
│     • failed > 0 OR broken > 0 → status = 'failed'         │
│     • All passed → status = 'passed'                        │
│  4. GET /automation/api/v1/sessions (find recent sessions)  │
│  5. PATCH /automation/api/v1/sessions/{id}                  │
│     → { status_ind: 'passed' | 'failed' }                  │
└─────────────────────────────────────────────────────────────┘
```

This ensures the LambdaTest dashboard shows red/green build status instead of just "Completed".

### 6. Slack Notifications (`framework/utils/slack-notify.js`)

Enhanced to include platform information:

- `:rocket: Platform` field → `:cloud: LambdaTest Cloud` or `:computer: Local`
- `:label: LT Build` field → Dynamic build name (Lambda only)
- Color-coded: green (all pass), red (any failure)

### 7. npm Scripts

All Lambda scripts chain: **test → status-mark → slack-notify**

```json
"test:lambda:smoke": "npm run clean:allure && cross-env EXECUTION_PLATFORM=lambda npx playwright test --project tc-smoke && cross-env EXECUTION_PLATFORM=lambda node framework/utils/lambdatest-status.js && cross-env EXECUTION_PLATFORM=lambda node framework/utils/slack-notify.js",
"execute:smoke:lambda": "npm run clean:allure && cross-env EXECUTION_PLATFORM=lambda npx playwright test tests/generated/smoke/smoke-suite.spec.js --project chrome && cross-env EXECUTION_PLATFORM=lambda node framework/utils/lambdatest-status.js && cross-env EXECUTION_PLATFORM=lambda node framework/utils/slack-notify.js",
"lt:status": "cross-env EXECUTION_PLATFORM=lambda node framework/utils/lambdatest-status.js",
"lambda": "npm run test:lambda:smoke"
```

### 8. Assertion Failure Classifier (`framework/utils/assertion-helper.js`)

New utility providing categorized, structured failure messages across 3 categories:

| Category | When | Example Error Pattern |
|----------|------|-----------------------|
| `GENUINE_FAILURE` | Functionality is broken — wrong state, assertion mismatch | `expect(received).toBe(expected)` |
| `SYNC_ERROR` | Element exists but can't interact (spinner, overlay, detached DOM) | `intercepts pointer events` |
| `TIMEOUT_ERROR` | Element never appeared or page too slow | `Timeout 45000ms exceeded` |

**Output format on failure:**
```
┌─────────────────────────────────────────────────────────
│ ❌ GENUINE FAILURE (Functionality Broken)
├─────────────────────────────────────────────────────────
│ Action:   Arm Home — system response
│ Page:     HomePage
│ Element:  Security system dialog
│ Expected: System should accept the Arm Home command
│ Platform: LambdaTest Cloud
│ Original: Expected "Armed" but received "Error"
└─────────────────────────────────────────────────────────
```

### 9. Cookie Consent Bypass

LambdaTest launches a **fresh browser** every session — no stored cookies. The TotalConnect2 site shows a cookie consent banner that blocks interaction.

**Two-layer solution:**

1. **Pre-injection** (browser-launcher.js): `context.addCookies()` injects both TrustArc and OneTrust consent cookies before any navigation
2. **Runtime dismissal** (LoginPage.js): `dismissCookieConsent()` clicks "ACCEPT ALL" if the banner still appears

Cookies injected:
- `notice_behavior` (TrustArc)
- `truste.eu.cookie.notice_gdpr_pr498` (TrustArc)
- `notice_gdpr_pr498` (TrustArc)
- `OptanonAlertBoxClosed` (OneTrust)
- `OptanonConsent` (OneTrust — all groups accepted)

---

## Challenges Faced & Solutions

### Challenge 1: Trace/Video Teardown Timeout (120s hang)

**Problem:** With `trace: 'retain-on-failure'` or `video: 'retain-on-failure'`, Playwright attempted to download trace/video data over the CDP WebSocket from LambdaTest's remote browser at test teardown. This caused a 120-second hang because the remote browser was already being cleaned up.

**Solution:** Disable trace and video recording on Lambda (`trace: 'off'`, `video: 'off'`). LambdaTest records video natively on their platform — no need for Playwright to duplicate this.

### Challenge 2: `viewport: null` Not Supported on Lambda CDP

**Problem:** Locally we use `viewport: null` (maximized window). On LambdaTest, this conflicted with `deviceScaleFactor` that the CDP endpoint sets internally, causing: `Error: 'deviceScaleFactor' option is not supported with null viewport`.

**Solution:** Use explicit `viewport: { width: 1920, height: 1080 }` for Lambda, `null` for local.

### Challenge 3: Cookie Consent Banner Blocking All Interactions

**Problem:** Every Lambda session starts with a fresh browser — no stored cookies. The TotalConnect2 site immediately shows a full-screen "Cookie Information" overlay that blocks the login form. The Sign In button resolves in the DOM but clicking it fails because the overlay intercepts pointer events.

**Initial Fix:** Pre-inject TrustArc cookies via `context.addCookies()`.  
**Problem Recurrence:** The site updated to an OneTrust-style consent banner. The old `#truste-consent-button` selector no longer matched. The cookie injection values also changed.

**Final Solution:** 
1. Added OneTrust cookies (`OptanonAlertBoxClosed`, `OptanonConsent`) alongside existing TrustArc cookies
2. Updated `LoginPage.dismissCookieConsent()` to try `getByRole('button', { name: 'ACCEPT ALL' })` first, with fallback to old `#truste-consent-button`
3. Added `waitFor({ state: 'hidden' })` after clicking to ensure overlay is gone before proceeding

### Challenge 4: LambdaTest Dashboard Showing "Completed" Instead of PASS/FAIL

**Problem:** By default, LambdaTest only marks sessions with a "Completed" status. There's no way to know from the dashboard which runs passed or failed.

**Solution:** Created `lambdatest-status.js` that runs post-execution:
1. Reads Allure results to determine actual test outcomes
2. Calls LambdaTest REST API (`PATCH /automation/api/v1/sessions/{id}`)
3. Marks sessions as `passed` or `failed` with status indicator

### Challenge 5: Assertion Error in JSDoc Comment Breaking Parser

**Problem:** The `assertion-helper.js` file had a JSDoc example containing `**/home` (a Playwright URL glob pattern). The Allure reporter's Babel transform parsed this as a syntax error: `Missing semicolon. (16:42)`, causing **all tests to fail with "No tests found"** and 0-second duration.

**Solution:** Removed the `**` prefix from the JSDoc example URL, changing it to just `/home`.

### Challenge 6: Spinner Overlays on Cameras Page (Intermittent)

**Problem:** On the Cameras page, a loading spinner `<div class="spinner">` occasionally intercepts pointer events when trying to click navigation elements.

**Solution:** The assertion-helper classifies this as `SYNC_ERROR` with a clear message indicating the element is blocked. The page object wraps all interactions with `classifyAndThrow()` so failures are immediately understandable rather than showing raw Playwright error dumps.

---

## Execution Commands

### Run on LambdaTest Cloud

```bash
# Smoke suite (8 TCs) — recommended
npm run execute:smoke:lambda

# All smoke tests via project config
npm run test:lambda:smoke

# All generated tests
npm run test:lambda:generated

# Full test run
npm run test:lambda

# Quick alias
npm run lambda
```

### Run Locally (default)

```bash
npm run execute:smoke        # Local Chrome
npm run smoke                # Alias
```

### Check/Set Platform

```bash
# In .env file:
EXECUTION_PLATFORM=local     # For IDE play-button / local runs
EXECUTION_PLATFORM=lambda    # For cloud execution

# Or via PowerShell for one-off:
$env:EXECUTION_PLATFORM="lambda"; npx playwright test tests/generated/smoke/smoke-suite.spec.js --project chrome
```

---

## Verification: All 8 TCs Passing on LambdaTest

```
Running 8 tests using 1 worker

[BrowserLauncher] Connecting to LambdaTest Cloud...
[BrowserLauncher] Build: TC2-2026-05-21 | Project: TC2-Automation
[BrowserLauncher] Connected to LambdaTest successfully
  ✓  1 TC-001: Verify home page is loaded after login (95ms)
  ✓  2 TC-002: Arm Home and Disarm partitions (21.2s)
  ✓  3 TC-003: Navigate to Devices page (4.1s)
  ✓  4 TC-004: Navigate to Cameras page (3.8s)
  ✓  5 TC-005: Navigate to Activity page and verify log (2.8s)
  ✓  6 TC-006: Verify all cameras are visible on Cameras page (3.8s)
  ✓  7 TC-007: Verify camera names are displayed on Cameras page (449ms)
  ✓  8 TC-008: Verify camera feed sections load on Cameras page (624ms)

  8 passed (1.2m)
```

---

## File Inventory (Modified/Created)

| File | Status | Purpose |
|------|--------|---------|
| `framework/utils/browser-launcher.js` | Modified | Dual-mode launch (local/lambda), cookie injection |
| `framework/utils/lambdatest-status.js` | **New** | POST-execution PASS/FAIL marking on LT dashboard |
| `framework/utils/assertion-helper.js` | **New** | Categorized failure classification (3 types) |
| `framework/utils/slack-notify.js` | Modified | Platform info + LT build name in notifications |
| `framework/config/runtime.config.js` | Modified | Added `lambda` config section with `get isLambda()` |
| `framework/pages/generated/smoke/LoginPage.js` | Modified | Updated cookie consent dismissal (ACCEPT ALL) |
| `framework/pages/generated/smoke/TotalConnectHomePage.js` | Modified | Wrapped all actions with assertion-helper |
| `playwright.config.js` | Modified | Conditional Lambda timeouts, connectOptions, trace/video off |
| `package.json` | Modified | Lambda npm scripts (test, status, slack chain) |
| `.env.example` | Modified | Lambda environment variables documented |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         npm run execute:smoke:lambda                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. clean:allure (clear previous results)                           │
│                    ↓                                                  │
│  2. EXECUTION_PLATFORM=lambda → playwright test                      │
│     ┌─────────────────────────────────────────────────────────┐     │
│     │  browser-launcher.js                                     │     │
│     │    → buildLambdaTestEndpoint() → WSS URL with caps       │     │
│     │    → chromium.connect(wss://cdp.lambdatest.com/...)      │     │
│     │    → context.addCookies() (consent bypass)               │     │
│     │    → page ready for tests                                │     │
│     └─────────────────────────────────────────────────────────┘     │
│     ┌─────────────────────────────────────────────────────────┐     │
│     │  Test Execution (smoke-suite.spec.js)                    │     │
│     │    → LoginPage.dismissCookieConsent()                    │     │
│     │    → LoginPage.login()                                   │     │
│     │    → TotalConnectHomePage actions (with assertion-helper) │     │
│     │    → Results → allure-results/*.json                     │     │
│     └─────────────────────────────────────────────────────────┘     │
│                    ↓                                                  │
│  3. lambdatest-status.js                                            │
│     → Read allure-results → Determine pass/fail                      │
│     → PATCH LambdaTest API → Mark session(s) PASSED/FAILED           │
│                    ↓                                                  │
│  4. slack-notify.js                                                  │
│     → Read allure-results → Build Slack payload                      │
│     → Include platform (:cloud: LambdaTest Cloud)                   │
│     → Include LT build name                                          │
│     → POST webhook → Slack channel notification                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Important Notes

1. **Default is LOCAL:** The `.env` should always have `EXECUTION_PLATFORM=local` for day-to-day IDE usage. Lambda scripts use `cross-env` to override for that run only.

2. **No test code changes needed:** The same `smoke-suite.spec.js` runs on both platforms. Only infrastructure code (`browser-launcher.js`, `playwright.config.js`) handles the platform difference.

3. **LambdaTest records video natively:** No need for Playwright's `video: 'on'` — the LT dashboard has full video replay, network logs, and console logs.

4. **Sequential execution:** Tests run with 1 worker on both platforms. Lambda session = single browser instance for the entire suite (login once, test 8 cases).

5. **Credentials:** `LT_USERNAME` and `LT_ACCESS_KEY` must be in `.env`. Never commit the actual key — `.env` is in `.gitignore`.
