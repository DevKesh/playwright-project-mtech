# Project Evolution — Playwright AI Self-Healing Framework

> **Repository:** playwright-project-mtech
> **Author:** Kesh
> **Started:** March 19, 2026
> **Current State:** May 14, 2026
> **Total Commits:** 22
> **Total Files:** 156 source files | 133 tracked by git
> **Codebase Size:** 26,528+ lines of code

---

## Table of Contents

1. [Project Timeline](#project-timeline)
2. [Phase 1: Foundation (Mar 19)](#phase-1-foundation--mar-19-2026)
3. [Phase 2: AI Multi-Agent Framework (Mar 22)](#phase-2-ai-multi-agent-framework--mar-22-2026)
4. [Phase 3: Thesis Objectives & Agents (Mar 22–23)](#phase-3-thesis-objectives--agents--mar-22-23-2026)
5. [Phase 4: POC Completion (Mar 24)](#phase-4-poc-completion--mar-24-2026)
6. [Phase 5: CI Pipeline & Stabilization (Apr 12)](#phase-5-ci-pipeline--stabilization--apr-12-2026)
7. [Phase 6: Runtime Self-Healing Demo (Apr 20–21)](#phase-6-runtime-self-healing-demo--apr-20-21-2026)
8. [Phase 7: Codegen & Page Registry (May 5–7)](#phase-7-codegen--page-registry--may-5-7-2026)
9. [Phase 8: Demo Ready & Usage Tracking (May 9–12)](#phase-8-demo-ready--usage-tracking--may-9-12-2026)
10. [Phase 9: Robustness & Portable Reports (May 14)](#phase-9-robustness--portable-reports--may-14-2026)
11. [Current Architecture](#current-architecture)
12. [Quick Reference](#quick-reference)

---

## Project Timeline

```
Mar 19 ──── Foundation: Playwright + base test structure
   │
Mar 22 ──── AI Framework: 6 agents, LangGraph, Allure, RAG, metrics
   │
Mar 24 ──── POC Complete: human-in-the-loop self-healing
   │
Apr 12 ──── CI Pipeline: GitHub Actions, headless, dry-run
   │
Apr 20 ──── Runtime Demo: monkey-patch locators, live healing
   │
May 05 ──── Codegen: Playwright recorder → page registry
   │
May 09 ──── Demo Ready: consolidated smoke suite, final fixes
   │
May 14 ──── Robustness: waitForPageReady, portable reports, report server
```

---

## Phase 1: Foundation — Mar 19, 2026

**Commit:** `6ee8f3f` — *Initial commit: Playwright test automation framework*
**Files:** 28 added | **+1,635 lines**

The project started as a standard Playwright test automation framework targeting the Total Connect 2.0 security application at `https://qa2.totalconnect2.com`.

**What was built:**
- Playwright project scaffold with `playwright.config.js`
- Base page object model structure under `framework/pages/`
- Test fixtures and configuration under `framework/config/`
- Authentication flows under `framework/flows/auth/`
- Initial test specs under `tests/`

**State after phase:** A working but conventional Playwright project — no AI, no self-healing, no NL authoring.

---

## Phase 2: AI Multi-Agent Framework — Mar 22, 2026

**Commit:** `e248cf5` — *Add multi-agentic AI self-healing framework, Allure reporting, and LangGraph orchestration*
**Files:** 39 changed | **+6,944 lines**

The biggest single commit in the project — transformed a vanilla Playwright project into an AI-powered framework.

**What was built:**
- **6 AI Agents** under `framework/ai/agents/`:
  - `healer-agent.js` — general failure healing
  - `locator-healer.agent.js` — locator-specific healing via GPT
  - `test-case-healer.agent.js` — test-case-level healing
  - `flaky-test.agent.js` — flaky test analysis
  - `failure-classifier.agent.js` — classifies failure root causes
  - `explore-agent.js` — exploratory test generation
- **LangGraph orchestration** under `framework/ai/graph/`:
  - `healing-graph.js` — orchestrates classification → routing → healing
  - State management, conditions, and node definitions
- **AI core runtime** under `framework/ai/core/`:
  - `page-proxy.js` — intercepts Playwright page calls at runtime
  - `locator-proxy.js` — wraps locator calls for transparent healing
- **Allure reporting** integration via `allure-playwright`
- **AI reporter** at `framework/ai/reporters/ai-healing-reporter.js`
- **Configuration** at `framework/ai/config/ai.config.js`
- **Prompt templates** under `framework/ai/prompts/`

**State after phase:** A multi-agent AI framework capable of intercepting test failures and routing them to specialized healing agents.

---

## Phase 3: Thesis Objectives & Agents — Mar 22–23, 2026

**Commit:** `39e1a98` — *Implement all 4 thesis objectives: lifecycle orchestration, RAG, metrics, and audit trail*
**Files:** 33 changed | **+2,735 lines**

**Commit:** `4650ee3` — *Add Exploratory Test Generation Agent (6th agent) with LangGraph orchestration*
**Files:** 13 changed | **+2,490 lines**

**Commit:** `2534a35` — *Complete final 6th phase lifecycle changes for demo*
**Files:** 18 changed | **+1,495 lines**

Implemented the four core thesis objectives:

1. **Lifecycle Orchestration** — `framework/ai/scripts/run-lifecycle.js`
   - Pre-test analysis, heal-enabled execution, post-test reporting
   - `npm run ai:lifecycle:full`

2. **RAG Knowledge Base** — `framework/ai/rag/`
   - Index past failures and healing actions
   - Query similar failures before invoking GPT
   - `npm run ai:index`

3. **Metrics & Analytics** — `framework/ai/metrics/`
   - Healing success rate, confidence tracking, cost logging
   - `npm run ai:metrics`

4. **Audit Trail** — `framework/ai/audit/`
   - Every AI decision logged with timestamp, model, cost, confidence
   - `npm run ai:audit`

5. **Exploratory Test Generation** — `framework/ai/agents/explore-agent.js`
   - AI browses the app and generates test cases automatically
   - `npm run ai:explore`

**State after phase:** All thesis objectives implemented with full audit trail and metrics collection.

---

## Phase 4: POC Completion — Mar 24, 2026

**Commit:** `ae51b08` — *POC completed: AI self-healing with human-in-the-loop Allure reporting*
**Files:** 18 changed | **+1,490 lines**

The POC milestone — self-healing works end-to-end with human approval via Allure reports.

**Key achievement:** When a test fails due to a broken locator:
1. AI detects the failure type (locator, assertion, timeout, etc.)
2. Routes to the appropriate healing agent
3. Agent proposes a fix with confidence score
4. Fix is logged to `ai-reports/healing-log.json`
5. Results appear in Allure report with healing annotations

**State after phase:** Working POC demonstrating AI self-healing with human-in-the-loop.

---

## Phase 5: CI Pipeline & Stabilization — Apr 12, 2026

**Commits:** `5c0fa1a` → `7a0cdb6` (5 commits)
**Files:** 22 changed | **+1,068 lines**

Focused on making the framework CI-ready for GitHub Actions.

**What was built:**
- GitHub Actions workflow with `RUN_TC_TESTS` gating variable
- Headless execution mode by default
- `package-lock.json` regeneration for CI compatibility
- Dry-run validation mode

**State after phase:** Framework runs in GitHub Actions CI with proper gating.

---

## Phase 6: Runtime Self-Healing Demo — Apr 20–21, 2026

**Commits:** `04094d7` → `7eb966f` (5 commits)
**Files:** 57 changed | **+4,403 lines**

The live demo phase — built the NL authoring system and runtime healing demonstrations.

**What was built:**
- **NL Test Authoring** — `framework/ai/scripts/nl-test-author.js`
  - Write tests in plain English in `.md` files
  - LangGraph workflow converts English → Playwright spec code
  - `framework/ai/graph/nl-authoring-graph.js` with nodes, state, and conditions
  - `framework/ai/utils/md-suite-parser.js` for markdown parsing
- **Runtime monkey-patching** for live self-healing demos
  - Deliberately break locators (e.g., 'Camera' instead of 'Cameras')
  - Watch AI heal them in real-time with anti-recursion guards
- **AI healing fixture** for per-test healing context
- **Multi-stage CI pipeline** improvements

**State after phase:** Full NL authoring pipeline + live self-healing demonstrations working.

---

## Phase 7: Codegen & Page Registry — May 5–7, 2026

**Commits:** `b287526` → `dd65fb9` (4 commits)
**Files:** 104+ changed | **+7,033 lines**

The largest phase by file count — introduced the page registry system.

**What was built:**
- **Codegen-to-Registry** — `framework/ai/scripts/codegen-to-registry.js`
  - Launch Playwright recorder, capture interactions, save to registry JSON
  - `npm run codegen:record:home`, `codegen:record:devices`, etc.
- **Page Registries** — `framework/pages/registry/*.registry.json`
  - `HomePage.registry.json`, `LoginPage.registry.json`
  - `DevicesPage.registry.json`, `CamerasPage.registry.json`
  - `ActivityPage.registry.json`
  - Stores verified locators with metadata (type, selector, description)
- **Registry Validator** — `framework/ai/scripts/validate-registry.js`
  - Validates registry locators against the live app
  - `npm run validate`
- **README.md** — comprehensive project documentation (1,369 lines)
- Agent improvements across all AI agents

**State after phase:** Registry-driven locator management with codegen recording and live validation.

---

## Phase 8: Demo Ready & Usage Tracking — May 9–12, 2026

**Commits:** `f1f6cbd` → `0e144a3` (2 commits)
**Files:** 28 changed | **+1,363 lines**

Final polish for the demo presentation.

**What was done:**
- Consolidated smoke test suite generation
- Final fixes across all page objects and test specs
- Usage tracking for AI API calls (cost logging, latency logging)
- `ai-reports/cost-log.json` and `ai-reports/latency-log.json`

**State after phase:** Demo-ready framework with full usage tracking.

---

## Phase 9: Robustness & Portable Reports — May 14, 2026

**Commit:** `94a4c96` — *feat: add self-healing robustness, waitForPageReady utility, portable Allure report bundler, and report server*
**Files:** 23 changed | **+1,256 lines**

The most recent phase — focused on eliminating false positives and making reports portable for CI.

### New Files

#### `framework/utils/waitForPageReady.js`
Shared utility that waits for all loaders/spinners to disappear before assertions.

- **Loader patterns:** `text=/Loading/i`, `md-progress-circular`, `[class*="spinner"]`, `[class*="loader"]`, `[class*="loading"]`, `[class*="progress"]`, `[role="progressbar"]`
- Waits for each visible loader to reach `state: 'hidden'` + 500ms stability delay
- Replaces all `waitForTimeout(2000)` calls across page objects

#### `framework/utils/bundle-allure-report.js`
Bundles Allure report into a **single self-contained HTML file** that works on `file://` protocol.

- Base64 encodes JS chunks → `new Function()` at runtime
- Base64 encodes JSON data → intercepts `fetch()` inline
- Inlines CSS with data URI fonts
- Removes `<base>` tag (caused CORS on `file://`)
- Output: ~10.7 MB single HTML file
- **Usage:** `npm run report:bundle:open`

#### `framework/utils/serve-report.js`
Zero-dependency Node.js static file server for Allure reports.

- Built-in `http`, `fs`, `path` only (no Express)
- Port `9090` (configurable via `REPORT_PORT`)
- Auto-opens browser, correct MIME types
- **Usage:** `npm run report:view`

#### `framework/reporters/allure-auto-reporter.js`
Auto-archives each run's report with timestamp to `allure-reports-history/allure-report-YYYY-MM-DD_HH-MM-SS/`.

### Key Modifications

| File | Change |
|------|--------|
| `validate-registry.js` | Strict `confirmAtHome()` polling, 60s timeouts, removed dead code |
| `DevicesPage.js` | `waitForTimeout` → `waitForPageReady` |
| `CamerasPage.js` | All 4 methods → `waitForPageReady` |
| `ActivityPage.js` | Added `waitForPageReady` before assertions |
| `locator-healer.agent.js` | Improved healing context |
| `locator-proxy.js` | Better proxy intercept reliability |
| `nl-test-author.js` | Better error handling in NL flow |
| `playwright.config.js` | Added auto-reporter, archive output dir |
| `package.json` | Added `report:view`, `report:bundle`, `report:bundle:open` |
| `.gitignore` | Excluded `allure-reports-history/`, portable HTML files |
| `smoke.md` | Added TC-SMOKE-005 through TC-SMOKE-008 |
| `smoke-suite.spec.js` | Regenerated from updated smoke.md |
| All 5 registry JSONs | Updated locator snapshots |

### Principles Established
1. **Never** use `waitForLoadState('networkidle')` — use concrete element waits
2. **Never** use `waitForTimeout()` — use `waitForPageReady()` loader detection
3. **Reports must work offline** — portable HTML for CI artifacts
4. **Strict login gates** — polling-based verification prevents false positives

---

## Current Architecture

```
playwright-project-mtech/
├── framework/
│   ├── ai/
│   │   ├── agents/          # 6 AI agents (healer, locator-healer, test-case-healer,
│   │   │                    #   flaky-test, failure-classifier, explore)
│   │   ├── audit/           # Audit trail generation
│   │   ├── config/          # AI configuration (models, thresholds, feature flags)
│   │   ├── core/            # Runtime proxies (page-proxy, locator-proxy)
│   │   ├── fixtures/        # AI healing test fixtures
│   │   ├── graph/           # LangGraph workflows (healing-graph, nl-authoring-graph)
│   │   ├── metrics/         # Healing metrics computation
│   │   ├── prompts/         # GPT prompt templates
│   │   ├── rag/             # RAG knowledge base indexing
│   │   ├── reporters/       # AI healing reporter for Playwright
│   │   ├── scripts/         # CLI tools (nl-test-author, validate-registry, codegen, etc.)
│   │   ├── storage/         # Healing cache, history persistence
│   │   └── utils/           # MD parser, helpers
│   ├── config/              # Framework configuration
│   ├── data/                # Test data
│   ├── fixtures/            # Playwright fixtures
│   ├── flows/               # Business flow helpers (auth, cart, checkout, orders, totalconnect)
│   ├── pages/
│   │   ├── generated/smoke/ # AI-generated page objects (Login, Home, Devices, Cameras, Activity)
│   │   └── registry/        # Locator registry JSONs (verified via codegen)
│   ├── reporters/           # Custom reporters (allure-auto-reporter)
│   └── utils/               # Utilities (waitForPageReady, serve-report, bundle-allure-report)
├── tests/
│   ├── suites/              # NL test suites in English (smoke.md, regression.md)
│   └── generated/smoke/     # Generated Playwright spec files
├── ai-reports/              # AI output: healing logs, cost logs, audit trail, run history
├── allure-results/          # Raw Allure test results
├── allure-report/           # Generated Allure HTML report
└── allure-reports-history/  # Timestamped report archives
```

### Technology Stack

| Component | Technology |
|-----------|-----------|
| Test Runner | Playwright Test (Node.js) |
| Language | JavaScript (ES2022) |
| AI Models | GPT-4o (analysis), GPT-4o-mini (healing) |
| Orchestration | LangGraph (state machine workflows) |
| Reporting | Allure 3.3.1 + custom portable bundler |
| CI/CD | GitHub Actions |
| Target App | Total Connect 2.0 (`qa2.totalconnect2.com`) |
| Node.js | v26.0.0 |

### Capability Matrix

| Capability | Status | Entry Point |
|-----------|--------|-------------|
| NL Test Authoring | ✅ Working | `npm run gen` / `npm run author` |
| AI Self-Healing (Locator) | ✅ Working | `npm run smoke:heal` |
| AI Self-Healing (Test Case) | ⚠️ Experimental | `AI_HEALING_TEST_CASE=true` |
| Failure Classification | ✅ Working | Automatic via AI reporter |
| Flaky Test Analysis | ✅ Working | `npm run ai:flaky` |
| RAG Knowledge Base | ⚠️ Optional | `AI_RAG_ENABLED=true` |
| Lifecycle Orchestration | ✅ Working | `npm run ai:lifecycle:full` |
| Codegen → Registry | ✅ Working | `npm run record` |
| Registry Validation | ✅ Working | `npm run validate` |
| Allure Reporting | ✅ Working | `npm run report:allure` |
| Portable HTML Report | ✅ Working | `npm run report:bundle:open` |
| Report Archive (timestamped) | ✅ Working | Automatic on every run |
| CI Pipeline | ✅ Working | GitHub Actions |
| Audit Trail | ✅ Working | `npm run ai:audit` |
| Cost & Latency Tracking | ✅ Working | `ai-reports/cost-log.json` |

---

## Commit Log (Complete)

| # | Date | Hash | Message | Files | Lines |
|---|------|------|---------|-------|-------|
| 1 | Mar 19 | `6ee8f3f` | Initial commit: Playwright test automation framework | 28 | +1,635 |
| 2 | Mar 22 | `e248cf5` | Add multi-agentic AI self-healing framework, Allure, LangGraph | 39 | +6,944 |
| 3 | Mar 22 | `39e1a98` | Implement all 4 thesis objectives: lifecycle, RAG, metrics, audit | 33 | +2,735 |
| 4 | Mar 22 | `4650ee3` | Add Exploratory Test Generation Agent (6th agent) | 13 | +2,490 |
| 5 | Mar 23 | `2534a35` | Complete final 6th phase lifecycle changes for demo | 18 | +1,495 |
| 6 | Mar 24 | `ae51b08` | POC completed: AI self-healing with human-in-the-loop | 18 | +1,490 |
| 7 | Apr 12 | `5c0fa1a` | All changes made after alterations | 17 | +887 |
| 8 | Apr 12 | `ed3bc65` | Saving .yml file changes | 1 | +1 |
| 9 | Apr 12 | `2435f19` | Changed headed to headless | 2 | +7 |
| 10 | Apr 12 | `833ee28` | Fix: regenerate package-lock.json for CI | 1 | +168 |
| 11 | Apr 12 | `7a0cdb6` | Fix: gate CI tests behind RUN_TC_TESTS variable | 1 | +5 |
| 12 | Apr 20 | `04094d7` | Feat: multi-stage CI pipeline, AI healing fixture, NL authoring | 38 | +3,929 |
| 13 | Apr 20 | `adeda3d` | Fixes | 1 | +1 |
| 14 | Apr 20 | `a016975` | Feat: runtime self-healing demo — monkey-patch locators | 12 | +424 |
| 15 | Apr 21 | `d826bab` | Demo: break Cameras locator for dual self-healing demo | 1 | +1 |
| 16 | Apr 21 | `7eb966f` | All fixes to monkey patch | 5 | +48 |
| 17 | May 05 | `b287526` | Feat: integrate Playwright codegen with page registry | 73 | +5,100 |
| 18 | May 06 | `65537de` | Created README.md | 1 | +1,369 |
| 19 | May 07 | `6a8ac67` | Push all new changes — all agents improvements | 30 | +564 |
| 20 | May 09 | `f1f6cbd` | Final working commit — demo ready | 24 | +1,017 |
| 21 | May 12 | `0e144a3` | Pushing all latest changes for usage tracking | 4 | +346 |
| 22 | May 14 | `94a4c96` | Feat: robustness, waitForPageReady, portable reports, report server | 23 | +1,256 |

**Cumulative total:** 133 files, 26,528+ lines of code

---

## Quick Reference

```bash
# ─── Authoring ───
npm run gen                     # Generate specs from smoke.md
npm run author                  # Interactive NL authoring with login
npm run author:tc -- --tc 6     # Author specific test case

# ─── Execution ───
npm run smoke                   # Run smoke tests (headed)
npm run smoke:heal              # Run with AI self-healing enabled
npm run ci:test:smoke           # Run headless (CI mode)

# ─── Reporting ───
npm run report:allure:generate  # Generate Allure report
npm run report:view             # View via local server (port 9090)
npm run report:bundle:open      # Portable single-file HTML report

# ─── AI Analysis ───
npm run ai:review               # Review healing log
npm run ai:flaky                # Analyze flaky tests
npm run ai:metrics              # Compute healing metrics
npm run ai:audit                # Generate audit trail report
npm run ai:drift                # Detect locator drift
npm run ai:lifecycle:full       # Full pre → test → post lifecycle

# ─── Registry ───
npm run record                  # Record with Playwright codegen
npm run validate                # Validate registry against live app
```
