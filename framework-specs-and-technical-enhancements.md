# Multi-Agentic AI Self-Healing Test Automation Framework

## Framework Specifications & Technical Enhancements

**Author:** Kesh (MTech — Software Engineering, BITS Pilani WILP)
**Repository:** https://github.com/DevKesh/playwright-project-mtech.git
**Target Application:** https://rahulshettyacademy.com/client/
**Date:** March 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Foundation Layer — Test Automation Framework](#3-foundation-layer--test-automation-framework)
4. [AI Layer — Multi-Agent Self-Healing System](#4-ai-layer--multi-agent-self-healing-system)
5. [LangGraph Orchestration — State Machine Workflows](#5-langgraph-orchestration--state-machine-workflows)
6. [Thesis Objective 1 — 6-Phase Lifecycle Orchestration](#6-thesis-objective-1--6-phase-lifecycle-orchestration)
7. [Thesis Objective 2 — RAG with ChromaDB for Intelligent Impact Analysis](#7-thesis-objective-2--rag-with-chromadb-for-intelligent-impact-analysis)
8. [Thesis Objective 3 — Reliability Metrics (Pass@k, SHE, Latency)](#8-thesis-objective-3--reliability-metrics-passk-she-latency)
9. [Thesis Objective 4 — Assurance & Traceability with Deterministic Audit Trail](#9-thesis-objective-4--assurance--traceability-with-deterministic-audit-trail)
10. [Reporting Infrastructure](#10-reporting-infrastructure)
11. [CI/CD Integration](#11-cicd-integration)
12. [Complete File Inventory](#12-complete-file-inventory)
13. [Environment Setup & Configuration](#13-environment-setup--configuration)
14. [How to Test & Use — Full Operational Guide](#14-how-to-test--use--full-operational-guide)
15. [Demonstrating Results to Stakeholders](#15-demonstrating-results-to-stakeholders)
16. [Adapting to Your Own Web Application](#16-adapting-to-your-own-web-application)
17. [Design Decisions & Trade-offs](#17-design-decisions--trade-offs)
18. [Enhancement Changelog](#18-enhancement-changelog)

---

## 1. Executive Summary

This framework is a production-grade, multi-agentic AI self-healing test automation system built on Playwright. It extends traditional end-to-end test automation with five specialized AI agents orchestrated through LangGraph state machines, providing:

- **Runtime self-healing**: Broken locators are automatically repaired during test execution using a JavaScript Proxy pattern, with zero changes to existing test code
- **Post-mortem analysis**: Failed tests are classified, root-cause analyzed with GPT-4o vision, and healing suggestions are generated
- **Full QA lifecycle orchestration**: A 6-phase LangGraph state machine covers discovery, risk-based strategy, pre-execution drift detection, test execution, post-mortem healing, and synthesis
- **RAG-augmented intelligence**: Historical healing events, failure reports, page objects, and test specs are vectorized and retrieved to enhance AI prompts with contextual knowledge
- **Formal reliability metrics**: Pass@k, Self-Healing Efficacy (SHE), AI inference latency statistics (mean/p95/p99), and confidence threshold analysis
- **Deterministic audit trail**: Every healing event, classification, and decision is recorded with UUID-based correlation IDs, provenance chains, and full traceability matrices

The framework addresses four thesis objectives covering the complete QA lifecycle as a single, integrated system.

---

## 2. Architecture Overview

### High-Level Component Diagram

```
+------------------------------------------------------------------------+
|                           PLAYWRIGHT ENGINE                             |
|  +-----------+  +-----------+  +-------------+  +------------------+   |
|  | Test Specs|  | Page      |  | Flow Objects|  | Fixtures         |   |
|  | (6 specs) |  | Objects   |  | (Auth, Cart |  | (Base + AI)      |   |
|  |           |  | (Auth,    |  |  Checkout,  |  |                  |   |
|  |           |  |  Products)|  |  Orders)    |  |                  |   |
|  +-----------+  +-----------+  +-------------+  +------------------+   |
+------------------------------------------------------------------------+
         |                    |                          |
         v                    v                          v
+------------------------------------------------------------------------+
|                      AI PROXY INTERCEPTION LAYER                        |
|  +------------------+     +-------------------+                        |
|  | page-proxy.js    |---->| locator-proxy.js  |                        |
|  | (wraps Page)     |     | (wraps Locator)   |                        |
|  | JS Proxy pattern |     | intercepts 22     |                        |
|  |                  |     | action methods     |                        |
|  +------------------+     +-------------------+                        |
+------------------------------------------------------------------------+
         |                           |
         v                           v
+------------------------------------------------------------------------+
|                         AI AGENT SYSTEM                                 |
|  +------------------+  +------------------+  +-------------------+     |
|  | LocatorHealer    |  | FailureAnalyzer  |  | TestCaseHealer    |     |
|  | (runtime healing)|  | (root cause +    |  | (code fix         |     |
|  | DOM snapshot     |  |  screenshot/     |  |  suggestions)     |     |
|  | + GPT-4o-mini    |  |  vision analysis)|  |  GPT-4o           |     |
|  +------------------+  +------------------+  +-------------------+     |
|  +------------------+  +------------------+                            |
|  | DriftDetection   |  | FlakyTest        |                            |
|  | (live DOM vs     |  | (run history     |                            |
|  |  page objects)   |  |  aggregation +   |                            |
|  |  GPT-4o          |  |  pattern detect) |                            |
|  +------------------+  +------------------+                            |
+------------------------------------------------------------------------+
         |                           |
         v                           v
+------------------------------------------------------------------------+
|                    LANGGRAPH STATE MACHINES                             |
|  +--------------------+  +-------------------+  +------------------+   |
|  | Runtime Healing     |  | Post-Mortem       |  | Lifecycle        |   |
|  | Graph               |  | Healing Graph     |  | Orchestration    |   |
|  | CSS->Role->Text     |  | Classify->Route-> |  | 6-Phase QA      |   |
|  | strategy loop       |  | Heal/ReportOnly-> |  | State Machine    |   |
|  |                     |  | Summarize         |  |                  |   |
|  +--------------------+  +-------------------+  +------------------+   |
+------------------------------------------------------------------------+
         |                           |
         v                           v
+------------------------------------------------------------------------+
|                    SUPPORTING SUBSYSTEMS                                |
|  +------------------+  +------------------+  +-------------------+     |
|  | RAG System        |  | Metrics Engine   |  | Audit Trail       |    |
|  | ChromaDB/Local    |  | Pass@k, SHE,    |  | Correlation IDs,  |    |
|  | Embeddings,       |  | Latency Stats,  |  | Provenance Chains,|    |
|  | Retriever,        |  | Confidence      |  | Traceability      |    |
|  | Prompt Enhancer   |  | Analysis        |  | Matrix            |    |
|  +------------------+  +------------------+  +-------------------+     |
+------------------------------------------------------------------------+
         |                           |
         v                           v
+------------------------------------------------------------------------+
|                       OUTPUT & REPORTING                                |
|  +------------------+  +------------------+  +-------------------+     |
|  | Allure Reports    |  | HTML Reports     |  | ai-reports/       |    |
|  | (categorized      |  | (Playwright      |  | JSON logs, audit  |    |
|  |  defects, env     |  |  built-in)       |  | trail, metrics,   |    |
|  |  info, tags)      |  |                  |  | vector store      |    |
|  +------------------+  +------------------+  +-------------------+     |
+------------------------------------------------------------------------+
```

### Data Flow During a Test Run with AI Enabled

```
1. Test starts → Playwright creates Page
2. AI fixture wraps Page in Proxy → createPageProxy(page, {healerAgent, config})
3. Test calls page.locator('.btn') → Proxy intercepts → createLocatorProxy(locator, context)
4. Locator.click() called → Proxy wraps in try/catch
5a. Success → pass through normally, no AI overhead
5b. Failure (TimeoutError) → trigger Runtime Healing Graph:
    → tryHealLocator (CSS strategy) → GPT → suggest → validate on live DOM → retry
    → if failed → nextStrategy (role) → tryHealLocator → GPT → validate → retry
    → if failed → nextStrategy (text) → tryHealLocator → GPT → validate → retry
    → if all fail → throw original error
6. Test completes → Reporter.onTestEnd fires
7. If test failed → Post-Mortem Healing Graph:
    → classifyFailure (FailureAnalyzerAgent + screenshot vision)
    → route: locator/assertion → healTestCase | network/timeout → reportOnly
    → summarize → save reports to ai-reports/
8. Reporter.onEnd → write run history, record audit events
```

---

## 3. Foundation Layer — Test Automation Framework

### 3.1 Test Configuration

**File:** `playwright.config.js`

The Playwright configuration defines:
- **Test directory:** `./tests`
- **Parallelism:** Fully parallel locally, sequential on CI
- **Retries:** 2 on CI, 0 locally
- **Browser:** Chromium (Desktop Chrome channel)
- **Artifacts:** Screenshots on every test, video and trace retained on failure
- **Reporters:** Allure (primary), HTML (backup), AI Healing Reporter (conditional — only when `AI_HEALING_ENABLED=true`)

The AI reporter is conditionally attached using a ternary spread:
```js
...(process.env.AI_HEALING_ENABLED === 'true'
  ? [['./framework/ai/reporters/ai-healing-reporter.js']]
  : []),
```

### 3.2 Page Objects

| File | Class | Locators | Purpose |
|------|-------|----------|---------|
| `framework/pages/AuthPage.js` | `AuthPage` | 13 locators | Login page, registration page, shared feedback elements |
| `framework/pages/ProductsPage.js` | `ProductsPage` | 3 locators | Product cards, cart button, toast messages |

**Locator strategies used:** `page.locator()` (CSS), `page.getByText()`, `page.getByRole()` — demonstrating multiple strategies that the AI can reason about.

### 3.3 Flow Objects (Business Logic Layer)

| File | Factory Function | Purpose |
|------|-----------------|---------|
| `framework/flows/auth/AuthFlow.js` | `createAuthFlow()` | `loginWithValidUser()`, `registerNewUser()` — orchestrates AuthPage methods |
| `framework/flows/cart/CartFlow.js` | `createCartFlow()` | `resolveProductCard()`, `addSingleProductAndValidateBasics()` — cart operations |
| `framework/flows/checkout/CheckoutFlow.js` | `createCheckoutFlow()` | `openCart()`, `proceedToCheckout()`, `fillCountry()`, `placeOrderSuccessfully()`, `captureOrderId()` |
| `framework/flows/orders/OrdersFlow.js` | `createOrdersFlow()` | `verifyExactOrderIdInOrdersPage()`, `openOrderDetails()`, `verifyProductInOrderDetails()` |

### 3.4 Fixtures

| File | Fixture Name | Description |
|------|-------------|-------------|
| `framework/fixtures/app.fixture.js` | `test` (base) | Extends Playwright's `test` with page objects, flow objects, and failure artifact capture (screenshot, URL, HTML source on failure) |
| `framework/ai/fixtures/app.ai.fixture.js` | `test` (AI) | Extends base with `aiPage` — wraps `page` in the AI proxy. All POs and flows receive the proxied page automatically |

### 3.5 Test Specs

| File | Tests | Allure Tags |
|------|-------|-------------|
| `tests/smoke/basic-ui.spec.js` | 2 smoke tests (browser launch, page navigation) | epic: E-Commerce App, feature: Smoke Tests |
| `tests/smoke/example.spec.js` | Playwright example test | epic: E-Commerce App, feature: Smoke Tests |
| `tests/flows/auth/register.spec.js` | User registration flow | epic: E-Commerce App, feature: Authentication |
| `tests/flows/auth/register-login-flow.spec.js` | Full register → login flow | epic: E-Commerce App, feature: Authentication |
| `tests/flows/cart/add-zara-coat.spec.js` | Add product to cart | epic: E-Commerce App, feature: Cart |
| `tests/flows/checkout/order-and-checkout.spec.js` | Full checkout journey with negative tests | epic: E-Commerce App, feature: Checkout |

### 3.6 Test Data & Utilities

| File | Purpose |
|------|---------|
| `framework/data/authAndCart.data.js` | Login credentials, registration data, cart selection, base URL |
| `framework/utils/steps.js` | `logStep()` — prefixes test steps with `STEP >>` |
| `framework/utils/runtimeInput.js` | `buildCartItemRequest()` — runtime cart item construction |

---

## 4. AI Layer — Multi-Agent Self-Healing System

### 4.1 OpenAI Client (`framework/ai/core/openai-client.js`)

The foundation API wrapper providing:
- `chatCompletionJSON(systemPrompt, userPrompt, options)` — chat completion with `response_format: { type: 'json_object' }`, exponential backoff retry (2^attempt * 1000ms), configurable model/maxTokens
- `visionCompletionJSON(systemPrompt, textPrompt, imageBuffer, options)` — multimodal analysis with base64-encoded screenshots, same retry logic

Both methods enforce JSON response format to ensure structured, parseable output.

### 4.2 AI Client Factory (`framework/ai/core/ai-client-factory.js`)

Factory function that wraps AIClient creation:
```js
function createAIClient(config) {
  const client = new AIClient(config);
  if (config.metricsEnabled) {
    return wrapWithLatencyTracking(client);
  }
  return client;
}
```
All 5 agents use `createAIClient(config)` instead of `new AIClient(config)`, enabling transparent latency measurement across the entire framework.

### 4.3 Agent 1: LocatorHealerAgent (`framework/ai/agents/locator-healer.agent.js`)

**Purpose:** Runtime self-healing of broken CSS selectors and locators.

**How it works:**
1. Extracts a trimmed DOM snapshot from the live page (keeps only structural and interactive elements, strips scripts/styles/SVG, limits class lists to 5 entries, truncates at 60,000 chars)
2. Sends the failed selector + DOM + error context to GPT-4o-mini
3. Receives ranked suggestions with confidence scores and locator types (CSS, getByRole, getByText, getByLabel, getByPlaceholder, getByTestId)
4. Validates each suggestion against the live page (`locator.count() > 0`)
5. Retries the original action (click, fill, etc.) with the healed locator
6. Logs success/failure to `ai-reports/healing-log.json`

**Key method:** `heal({ page, failedSelector, error, action, actionArgs, strategyHint })`

The `strategyHint` parameter allows the runtime graph to constrain healing to specific locator types (CSS, role-based, text-based) across retry cycles.

### 4.4 Agent 2: FailureAnalyzerAgent (`framework/ai/agents/failure-analyzer.agent.js`)

**Purpose:** Post-mortem root cause analysis of test failures.

**How it works:**
1. Reads the test source code from disk
2. If a failure screenshot exists, uses GPT-4o Vision API for multimodal analysis (falls back to text-only if vision fails)
3. Produces a categorized report: `locator_broken`, `assertion_mismatch`, `data_issue`, `app_bug`, `network_error`, `timeout`
4. Saves the report to `ai-reports/failure-reports/`

### 4.5 Agent 3: TestCaseHealerAgent (`framework/ai/agents/test-case-healer.agent.js`)

**Purpose:** Suggest code fixes for broken test logic, assertions, or flow steps.

**How it works:**
1. Reads the test source code and all its transitive require() dependencies (page objects, flows, fixtures — 2 levels deep)
2. Checks recent healing log entries for context on what was already tried
3. Sends everything to GPT-4o for code fix suggestions
4. Produces SUGGESTIONS ONLY — changes are never auto-applied. Results saved to `ai-reports/test-healing/`

### 4.6 Agent 4: DriftDetectionAgent (`framework/ai/agents/drift-detection.agent.js`)

**Purpose:** Validate page object locators against the live DOM to detect selector drift.

**How it works:**
1. Takes a Playwright Page (navigated to the target URL) and a page object file path
2. Extracts a DOM snapshot from the live page
3. Reads the page object source code
4. Sends both to GPT-4o for comparison
5. Reports which locators still match and which have drifted

**CLI usage:** `npm run ai:drift`

### 4.7 Agent 5: FlakyTestAgent (`framework/ai/agents/flaky-test.agent.js`)

**Purpose:** Identify unstable tests from accumulated run history.

**How it works:**
1. Reads `ai-reports/run-history.json` (populated by the AI reporter after each run)
2. Aggregates per-test statistics: pass/fail counts, duration variance, flakiness percentage
3. Sends aggregated stats to GPT-4o for pattern classification
4. Needs at least 2 test runs to detect flakiness

**CLI usage:** `npm run ai:flaky`

### 4.8 Proxy Interception Layer

**File:** `framework/ai/core/page-proxy.js`

Uses JavaScript `Proxy` to wrap the Playwright `Page` object. Intercepts 8 locator-creating methods (`locator`, `getByRole`, `getByText`, `getByLabel`, `getByPlaceholder`, `getByAltText`, `getByTitle`, `getByTestId`). Each returned locator is wrapped with `createLocatorProxy()`.

**File:** `framework/ai/core/locator-proxy.js`

Uses JavaScript `Proxy` to wrap each Playwright `Locator`. Intercepts 22 action methods (`click`, `fill`, `hover`, `waitFor`, `textContent`, etc.) and 12 locator-returning methods (`first`, `last`, `nth`, `filter`, etc.).

When a healable action throws (`TimeoutError`, `waiting for locator`, `strict mode violation`), it triggers the Runtime Healing Graph. Non-healable errors (assertion errors, etc.) propagate normally.

**Design principle:** By injecting the proxy at the fixture level, all downstream page objects, flows, and test specs gain self-healing with zero code changes.

### 4.9 Prompt Engineering

Each agent has a dedicated prompt builder:

| File | Agent | Key Features |
|------|-------|-------------|
| `framework/ai/prompts/locator-healing.prompt.js` | LocatorHealer | `strategyHint` to constrain locator type, `ragContext` for historical cases |
| `framework/ai/prompts/failure-analysis.prompt.js` | FailureAnalyzer | Screenshot context flag, `ragContext` |
| `framework/ai/prompts/test-case-healing.prompt.js` | TestCaseHealer | Related file sources, healing history context, `ragContext` |
| `framework/ai/prompts/drift-detection.prompt.js` | DriftDetection | Page object source + live DOM comparison |
| `framework/ai/prompts/flaky-test.prompt.js` | FlakyTest | Aggregated test statistics |
| `framework/ai/prompts/risk-analysis.prompt.js` | Lifecycle Strategy | Page object inventory, healing history, run history, coverage map |

All prompts enforce JSON output and provide structured schemas for the expected response.

---

## 5. LangGraph Orchestration — State Machine Workflows

### 5.1 State Schema Design

LangGraph uses `Annotation.Root()` to define typed state channels with reducers:

- **Replace reducer** `(_, b) => b` — last write wins (used for scalar fields)
- **Append reducer** `(existing, newItems) => [...existing, ...newItems]` — accumulates arrays (used for reports, attempts, errors)

Three state schemas exist:

| Schema | File | Fields | Used By |
|--------|------|--------|---------|
| `HealingState` | `framework/ai/graph/state.js` | 14 fields (testFile, errorMessage, failureCategory, healingResult, correlationId, runId, reports...) | Post-mortem healing graph |
| `RuntimeHealingState` | `framework/ai/graph/state.js` | 11 fields (page, failedSelector, currentStrategy, attempts, healed, healedSelector...) | Runtime healing graph |
| `LifecycleState` | `framework/ai/graph/lifecycle-state.js` | 18 fields (pageObjects, testSpecs, riskAssessment, driftCandidates, metrics, synthesisReport...) | Lifecycle graph |

### 5.2 Post-Mortem Healing Graph

**File:** `framework/ai/graph/healing-graph.js`

```
__start__ → classifyFailure → [conditional routing]
                                  ├→ locator_broken/assertion_mismatch → healTestCase → summarize → END
                                  └→ network_error/timeout/unknown     → reportOnly   → summarize → END
```

**Nodes:** `classifyFailure` (FailureAnalyzerAgent), `healTestCase` (TestCaseHealerAgent), `reportOnly` (logs skip), `summarize` (decision tracking)

**Routing:** `routeAfterClassification()` in `conditions.js` categorizes failures into locator/logic (healable) vs infrastructure (not healable).

### 5.3 Runtime Healing Graph

**File:** `framework/ai/graph/runtime-graph.js`

```
__start__ → tryHealLocator → [conditional routing]
                               ├→ healed=true         → END (success)
                               ├→ attempts exhausted   → END (failure)
                               └→ attempts remaining   → nextStrategy → tryHealLocator (loop)
```

**Strategy cycling:** CSS → Role → Text. Each strategy constrains GPT's suggestions to a specific locator type via the `strategyHint` parameter.

**Routing:** `routeAfterHealAttempt()` checks `state.healed`, `state.attemptCount >= state.maxAttempts`, and `state.currentStrategy === 'exhausted'`.

---

## 6. Thesis Objective 1 — 6-Phase Lifecycle Orchestration

### 6.1 Concept

The QA lifecycle is divided into 6 phases, with phases 1-3 and 6 managed by a LangGraph state machine, while phases 4-5 are external (Playwright test execution + existing healing graphs):

| Phase | Name | Managed By | Purpose |
|-------|------|-----------|---------|
| 1 | Discovery | `lifecycle-nodes.js → discovery()` | Scan codebase: find page objects, test specs, flows; count locators; build coverage map |
| 2 | Strategy | `lifecycle-nodes.js → strategy()` | AI risk analysis: score page objects by healing frequency, failure history, test coverage; identify drift candidates |
| 3 | Pre-Execution | `lifecycle-nodes.js → preExecution()` | Run drift checks on top-3 high-risk page objects |
| 4 | Execution | `npx playwright test` (external) | Runtime healing via locator-proxy + runtime-graph |
| 5 | Post-Mortem | `ai-healing-reporter.js` (external) | Post-mortem healing via healing-graph |
| 6 | Synthesis | `lifecycle-nodes.js → synthesis()` | Aggregate metrics (Pass@k, SHE, latency), update RAG knowledge base, generate synthesis report |

### 6.2 Graph Structure

**File:** `framework/ai/graph/lifecycle-graph.js`

```
__start__ → router → [routeFromStart]
                       ├→ mode='post' → synthesis → END
                       └→ mode='pre'/'full' → discovery → strategy → preExecution → checkpoint → [routeAfterCheckpoint]
                                                                                                   ├→ mode='pre' → END
                                                                                                   └→ mode='full' → synthesis → END
```

### 6.3 Key Files

| File | Purpose |
|------|---------|
| `framework/ai/graph/lifecycle-state.js` | LifecycleState schema with 18 annotated fields |
| `framework/ai/graph/lifecycle-conditions.js` | `routeFromStart()`, `routeAfterCheckpoint()` routing functions |
| `framework/ai/graph/lifecycle-nodes.js` | All 5 node functions (discovery, strategy, preExecution, checkpoint, synthesis) |
| `framework/ai/graph/lifecycle-graph.js` | StateGraph definition and compilation |
| `framework/ai/prompts/risk-analysis.prompt.js` | Prompt for Phase 2 AI risk analysis |
| `framework/ai/scripts/run-lifecycle.js` | CLI entry point with `--phase pre/post/full` |

### 6.4 Usage

```bash
# Pre-test phases (1-3): discovery, strategy, pre-execution drift check
npm run ai:lifecycle:pre

# Post-test phase (6): synthesis + metrics aggregation
npm run ai:lifecycle:post

# Full lifecycle: phases 1-3 → playwright test → phase 6
npm run ai:lifecycle:full
```

---

## 7. Thesis Objective 2 — RAG with ChromaDB for Intelligent Impact Analysis

### 7.1 Concept

RAG (Retrieval Augmented Generation) enhances AI prompts with contextual knowledge from historical healing events, failure reports, page objects, and test specs. Instead of each AI call operating in isolation, the RAG system provides "memory" by retrieving similar past cases.

### 7.2 Component Pipeline

```
1. INDEXING (offline)
   Test specs, page objects, healing events, failure reports
      ↓
   EmbeddingService (OpenAI text-embedding-3-small)
      ↓
   ChromaStore (ChromaDB native OR local JSON fallback)
      ↓
   4 collections: healing_events, failure_reports, page_objects, test_specs

2. RETRIEVAL (at prompt build time)
   Query string (e.g., "button[routerlink] click timeout")
      ↓
   EmbeddingService → query vector
      ↓
   ChromaStore.query() → cosine similarity search
      ↓
   Top-K similar documents

3. ENHANCEMENT (prompt injection)
   Retrieved documents
      ↓
   RAGPromptEnhancer → formats as "Similar past cases" context block
      ↓
   Appended to agent prompts (locator healing, failure analysis, test case healing)
```

### 7.3 Key Files

| File | Purpose |
|------|---------|
| `framework/ai/rag/embedding-service.js` | Wraps OpenAI `text-embedding-3-small` API. `embed(text)` for single, `embedBatch(texts)` for batch (2048-chunk size) |
| `framework/ai/rag/chroma-client.js` | Dual-mode vector store: tries native ChromaDB client, falls back to local JSON with cosine similarity. Collections stored at `ai-reports/chromadb/*.json` |
| `framework/ai/rag/rag-indexer.js` | Indexes 4 collection types: `indexHealingEvents()`, `indexFailureReports()`, `indexPageObjects()`, `indexTestSpecs()`, plus `indexAll()` |
| `framework/ai/rag/rag-retriever.js` | Top-K similarity search: `retrieveSimilarHealingEvents()`, `retrieveSimilarFailures()`, `retrieveRelevantPageObjects()`, `findRelatedTests()` |
| `framework/ai/rag/rag-prompt-enhancer.js` | Formats retrieved results into prompt context: `enhanceLocatorHealingPrompt()`, `enhanceFailureAnalysisPrompt()`, `enhanceTestCaseHealingPrompt()` |
| `framework/ai/scripts/index-knowledge-base.js` | CLI: indexes all sources into the vector store |

### 7.4 Local Fallback Design

Since ChromaDB requires a server or native bindings that may not be available on all environments, the `ChromaStore` class implements a complete local fallback:

```js
// Cosine similarity computed in pure Node.js
function cosineSimilarity(a, b) {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

Collections are persisted as JSON files at `ai-reports/chromadb/`, with full embedding vectors stored for offline similarity search.

### 7.5 Usage

```bash
# Index all knowledge sources (run after test runs to populate)
npm run ai:index

# Enable RAG in .env
AI_RAG_ENABLED=true
```

---

## 8. Thesis Objective 3 — Reliability Metrics (Pass@k, SHE, Latency)

### 8.1 Metrics Definitions

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| **Pass@1** | P(at least 1 successful heal in the first attempt) | First-try healing accuracy |
| **Pass@2** | P(at least 1 successful heal in 2 attempts) | Two-try healing accuracy |
| **Pass@3** | P(at least 1 successful heal in 3 attempts) | Three-try healing accuracy (matches maxRetries default) |
| **SHE** | `successful_heals / total_test_failures` | Self-Healing Efficacy — are test failures actually being healed? |
| **Heal Success Rate** | `successful_heals / total_heal_attempts` | Per-attempt success rate |
| **AI Latency** | Timing of every `chatCompletionJSON` and `visionCompletionJSON` call | mean, median, p95, p99, min, max, grouped by method |
| **Confidence Analysis** | Success rates at thresholds [0.5, 0.6, 0.7, 0.8, 0.9] | Helps tune `AI_HEALING_CONFIDENCE_THRESHOLD` |

### 8.2 Latency Tracking Architecture

**File:** `framework/ai/metrics/latency-tracker.js`

Uses the **decorator pattern** to transparently wrap AIClient methods:

```js
function wrapWithLatencyTracking(aiClient) {
  const originalChat = aiClient.chatCompletionJSON.bind(aiClient);
  const originalVision = aiClient.visionCompletionJSON.bind(aiClient);

  aiClient.chatCompletionJSON = async function (...args) {
    const start = Date.now();
    try {
      const result = await originalChat(...args);
      appendLatencyEntry({ method: 'chatCompletionJSON', durationMs: Date.now() - start, success: true });
      return result;
    } catch (err) {
      appendLatencyEntry({ method: 'chatCompletionJSON', durationMs: Date.now() - start, success: false });
      throw err;
    }
  };
  // ... same for visionCompletionJSON
}
```

Entries are saved to `ai-reports/latency-log.json`.

### 8.3 Session Grouping for Pass@k

The MetricsEngine groups healing events into "sessions" — events with the same `originalSelector` within a 60-second window are considered part of a single session. This correctly handles the multi-strategy retry pattern where a single locator failure may generate 1-3 healing events.

### 8.4 Key Files

| File | Purpose |
|------|---------|
| `framework/ai/metrics/latency-tracker.js` | Decorator wrapping AIClient; appends to `ai-reports/latency-log.json` |
| `framework/ai/core/ai-client-factory.js` | Factory that conditionally applies latency tracking |
| `framework/ai/metrics/metrics-engine.js` | `computePassAtK()`, `computeSHE()`, `computeLatencyStats()`, `computeConfidenceAnalysis()`, `computeAll()` |
| `framework/ai/scripts/compute-metrics.js` | CLI: `npm run ai:metrics` or `npm run ai:metrics -- --json` |

### 8.5 Usage

```bash
# Run tests a few times to accumulate data
npm run test:ai
npm run test:ai
npm run test:ai

# Compute and display metrics
npm run ai:metrics

# Save as JSON
npm run ai:metrics -- --json
# Outputs to: ai-reports/metrics/metrics-{timestamp}.json
```

---

## 9. Thesis Objective 4 — Assurance & Traceability with Deterministic Audit Trail

### 9.1 Audit Trail Design

**File:** `framework/ai/audit/audit-trail.js`

Every significant framework event is recorded with:

| Field | Purpose |
|-------|---------|
| `auditId` | `aud-{crypto.randomUUID()}` — globally unique event identifier |
| `timestamp` | ISO 8601 timestamp |
| `type` | Event type: `run_start`, `test_start`, `test_fail`, `healing_attempted`, `healing_succeeded`, `healing_failed`, `run_complete` |
| `correlationId` | Links related events (e.g., a test failure and its healing attempts) |
| `runId` | Links all events in the same test run |
| `parentAuditId` | Provenance chain — links to the parent event |
| `data` | Event-specific payload (error messages, confidence scores, etc.) |

### 9.2 Provenance Chains

Each healing attempt links to its parent failure event, creating a chain:

```
test_fail (auditId: aud-abc)
  └→ healing_attempted (parentAuditId: aud-abc, auditId: aud-def)
       └→ healing_succeeded (parentAuditId: aud-def, auditId: aud-ghi)
```

The `getProvenance(auditId)` method walks back through parent links to retrieve the full chain from root to leaf.

### 9.3 Traceability Matrix

**File:** `framework/ai/audit/traceability-matrix.js`

Scans test spec files for Allure tags (`allure.epic()`, `allure.feature()`, `allure.story()`) and builds a requirement-to-test mapping:

```
Requirement (epic/feature/story) → Test File → Test Status → Healing Data
```

`buildFromTestSpecs(paths)` → `enrichWithOutcomes(matrix, runHistory)` → `enrichWithHealingData(matrix, healingLog)` → `generateReport(matrix)`

### 9.4 Audit Report Generator

**File:** `framework/ai/audit/audit-report-generator.js`

Combines AuditTrail, TraceabilityMatrix, and MetricsEngine into a comprehensive audit report:
- Latest run events and timeline
- Provenance chains for every healing event
- Traceability matrix with coverage rate
- Metrics summary (Pass@k, SHE, latency)

### 9.5 Key Files

| File | Purpose |
|------|---------|
| `framework/ai/audit/audit-trail.js` | Append-only event recording with UUID correlation IDs and provenance queries |
| `framework/ai/audit/traceability-matrix.js` | Requirement-to-test mapping via Allure tags |
| `framework/ai/audit/audit-report-generator.js` | Comprehensive audit report combining trail + matrix + metrics |
| `framework/ai/scripts/generate-audit-report.js` | CLI: `npm run ai:audit` |

### 9.6 Usage

```bash
# Generate audit report
npm run ai:audit

# Generate audit report for specific run
npm run ai:audit -- --runId run-1711100400000

# JSON output
npm run ai:audit -- --json
```

---

## 10. Reporting Infrastructure

### 10.1 Allure Reporting

Configured in `playwright.config.js` with:
- **Environment info:** OS platform, OS release, Node version, framework, app URL
- **Defect categories:** Assertion failures, Element not found, Network/API errors, Test logic errors
- **Allure tags in tests:** Every test spec uses `allure.epic()`, `allure.feature()`, `allure.story()`, `allure.severity()`, `allure.tags()`

```bash
# Generate and open Allure report
npm run report:allure

# Or separately
npm run report:allure:generate
npm run report:allure:open
```

### 10.2 AI Reports Directory

All AI framework outputs are stored in `ai-reports/` (gitignored):

```
ai-reports/
├── healing-log.json         # All healing events (success + failure)
├── run-history.json         # Per-run test results
├── latency-log.json         # AI API call timings
├── audit-trail.json         # Full audit event chain
├── failure-reports/         # Per-failure analysis reports
├── test-healing/            # Test case healing suggestions
├── lifecycle/               # Lifecycle phase reports (strategy, pre-execution, synthesis)
├── metrics/                 # Computed metrics snapshots
├── chromadb/                # RAG vector store (JSON collections)
└── audit/                   # Generated audit reports
```

### 10.3 Storage Layer

**File:** `framework/ai/storage/healing-history.js`
- `appendHealingEvent(entry)` — append to `healing-log.json` with correlationId support
- `loadHealingLog()` — read entire healing log
- `appendRunHistory(runData)` — append to `run-history.json`
- `loadRunHistory()` — read entire run history

**File:** `framework/ai/storage/report-writer.js`
- `writeReport(subdir, filename, data)` — write JSON report to `ai-reports/{subdir}/{filename}`

---

## 11. CI/CD Integration

### 11.1 GitHub Actions Workflow

**File:** `.github/workflows/playwright.yml`

```yaml
- Triggers: push/PR to main/master
- Runner: ubuntu-latest
- Steps:
  1. Checkout code
  2. Setup Node.js (LTS)
  3. npm ci
  4. Install Playwright browsers
  5. Run tests (with conditional AI_HEALING_ENABLED based on OPENAI_API_KEY secret)
  6. Generate Allure report
  7. Upload artifacts: playwright-report, allure-report, ai-reports (30-day retention)
```

### 11.2 Required Secrets

| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | OpenAI API key — if present, AI healing is automatically enabled |

---

## 12. Complete File Inventory

### New Files (20 files, ~2,735 lines)

| # | File | Lines | Category |
|---|------|-------|----------|
| 1 | `framework/ai/metrics/latency-tracker.js` | ~100 | Objective 3 |
| 2 | `framework/ai/core/ai-client-factory.js` | ~28 | Objective 3 |
| 3 | `framework/ai/metrics/metrics-engine.js` | ~242 | Objective 3 |
| 4 | `framework/ai/scripts/compute-metrics.js` | ~90 | Objective 3 |
| 5 | `framework/ai/audit/audit-trail.js` | ~173 | Objective 4 |
| 6 | `framework/ai/audit/traceability-matrix.js` | ~200 | Objective 4 |
| 7 | `framework/ai/audit/audit-report-generator.js` | ~130 | Objective 4 |
| 8 | `framework/ai/scripts/generate-audit-report.js` | ~90 | Objective 4 |
| 9 | `framework/ai/rag/embedding-service.js` | ~55 | Objective 2 |
| 10 | `framework/ai/rag/chroma-client.js` | ~226 | Objective 2 |
| 11 | `framework/ai/rag/rag-indexer.js` | ~160 | Objective 2 |
| 12 | `framework/ai/rag/rag-retriever.js` | ~85 | Objective 2 |
| 13 | `framework/ai/rag/rag-prompt-enhancer.js` | ~95 | Objective 2 |
| 14 | `framework/ai/scripts/index-knowledge-base.js` | ~100 | Objective 2 |
| 15 | `framework/ai/graph/lifecycle-state.js` | ~55 | Objective 1 |
| 16 | `framework/ai/graph/lifecycle-conditions.js` | ~29 | Objective 1 |
| 17 | `framework/ai/graph/lifecycle-nodes.js` | ~354 | Objective 1 |
| 18 | `framework/ai/graph/lifecycle-graph.js` | ~62 | Objective 1 |
| 19 | `framework/ai/prompts/risk-analysis.prompt.js` | ~90 | Objective 1 |
| 20 | `framework/ai/scripts/run-lifecycle.js` | ~100 | Objective 1 |

### Modified Files (13 files)

| # | File | Change |
|---|------|--------|
| 1 | `framework/ai/config/ai.config.js` | Added `metricsEnabled`, `auditEnabled`, `ragEnabled`, `embeddingModel`, `lifecycleEnabled` |
| 2 | `framework/ai/agents/locator-healer.agent.js` | Factory import + `strategyHint` plumbing |
| 3 | `framework/ai/agents/failure-analyzer.agent.js` | Factory import |
| 4 | `framework/ai/agents/test-case-healer.agent.js` | Factory import |
| 5 | `framework/ai/agents/drift-detection.agent.js` | Factory import |
| 6 | `framework/ai/agents/flaky-test.agent.js` | Factory import |
| 7 | `framework/ai/graph/state.js` | Added `correlationId`, `runId` to HealingState |
| 8 | `framework/ai/storage/healing-history.js` | Added `correlationId` to `appendHealingEvent` |
| 9 | `framework/ai/reporters/ai-healing-reporter.js` | Complete rewrite: AuditTrail integration, runId generation, audit events at onBegin/onTestBegin/onTestEnd/onEnd |
| 10 | `framework/ai/prompts/locator-healing.prompt.js` | Added `strategyHint` + `ragContext` |
| 11 | `framework/ai/prompts/failure-analysis.prompt.js` | Added `ragContext` |
| 12 | `framework/ai/prompts/test-case-healing.prompt.js` | Added `ragContext` |
| 13 | `package.json` | Added `chromadb` dependency + 6 new npm scripts |

### Pre-existing Files (30+ files)

All files from the original two commits (`6ee8f3f` and `e248cf5`) including page objects, flow objects, fixtures, test specs, agents, prompts, graph definitions, storage, and configuration.

---

## 13. Environment Setup & Configuration

### 13.1 Prerequisites

- **Node.js** 18+ (for `crypto.randomUUID()` support)
- **npm** 9+
- **OpenAI API Key** with access to `gpt-4o`, `gpt-4o-mini`, and `text-embedding-3-small`

### 13.2 Installation

```bash
git clone https://github.com/DevKesh/playwright-project-mtech.git
cd playwright-project-mtech
npm install
npx playwright install --with-deps
```

### 13.3 Environment Variables

Create a `.env` file in the project root:

```env
# Required
OPENAI_API_KEY=sk-your-openai-api-key

# Master switch (enables all AI features)
AI_HEALING_ENABLED=true

# Models (defaults shown)
AI_HEALING_MODEL=gpt-4o-mini
AI_ANALYSIS_MODEL=gpt-4o
AI_EMBEDDING_MODEL=text-embedding-3-small

# Feature flags
AI_HEALING_LOCATOR=true         # Runtime locator healing
AI_HEALING_ANALYSIS=true        # Post-mortem failure analysis
AI_HEALING_TEST_CASE=true       # Test case healing suggestions
AI_METRICS_ENABLED=true         # Latency tracking (default: true)
AI_AUDIT_ENABLED=true           # Audit trail recording (default: true when AI enabled)
AI_RAG_ENABLED=true             # RAG enhancement (default: false — opt-in)
AI_LIFECYCLE_ENABLED=true       # Lifecycle orchestration (default: false — opt-in)

# Healing parameters
AI_HEALING_MAX_RETRIES=2        # Max retry attempts per strategy
AI_HEALING_CONFIDENCE_THRESHOLD=0.7  # Minimum confidence to accept a suggestion

# Timeouts and limits
AI_OPENAI_TIMEOUT=30000         # OpenAI API timeout (ms)
AI_MAX_DOM_LENGTH=60000         # Max DOM snapshot chars
```

---

## 14. How to Test & Use — Full Operational Guide

### 14.1 Step 1: Run Tests WITHOUT AI (Baseline)

```bash
# Standard Playwright run — no AI involvement
npm test

# View results
npm run report                 # HTML report
npm run report:allure          # Allure report
```

This establishes your baseline: which tests pass, which fail, and the standard execution time.

### 14.2 Step 2: Run Tests WITH AI Healing

```bash
# Enable AI healing for this run
npm run test:ai

# This sets AI_HEALING_ENABLED=true and runs all tests.
# You will see console output like:
#   [AI-REPORTER] AI Healing Reporter active (LangGraph orchestration)
#   [AI-REPORTER] Invoking healing graph for: <test title>
#   [GRAPH] Classifying failure...
#   [GRAPH] Failure classified: locator_broken (confidence: 0.85)
#   [AI-HEAL] Locator failed: page.locator('.btn-submit') → invoking healing graph...
#   [GRAPH] Locator heal attempt 1/3 (strategy: css)
#   [AI-HEAL] Graph healed: ".btn-submit" → ".submit-button" (confidence: 0.92, attempts: 1)
```

After the run, check:
```bash
# See what AI produced
ls ai-reports/

# Key files:
#   ai-reports/healing-log.json    → All healing events
#   ai-reports/run-history.json    → Test results per run
#   ai-reports/latency-log.json    → AI API call timings
#   ai-reports/audit-trail.json    → Full audit event chain
#   ai-reports/failure-reports/    → Per-failure analysis (JSON)
#   ai-reports/test-healing/       → Code fix suggestions (JSON)
```

### 14.3 Step 3: Simulate a Broken Locator (Self-Healing Demo)

To demonstrate self-healing to stakeholders:

1. **Break a locator intentionally:**
   Open `framework/pages/AuthPage.js` and change a locator:
   ```js
   // Change this:
   this.loginButton = page.locator('#login');
   // To this (broken):
   this.loginButton = page.locator('#login-button-BROKEN');
   ```

2. **Run with AI using the AI fixture:**
   Modify a test file to import from the AI fixture instead:
   ```js
   // Change this:
   const { test, expect } = require('../../../framework/fixtures/app.fixture');
   // To this:
   const { test, expect } = require('../../../framework/ai/fixtures/app.ai.fixture');
   ```

3. **Run the test:**
   ```bash
   npm run test:ai
   ```

4. **Expected output:**
   ```
   [AI-HEAL] Locator failed: page.locator('#login-button-BROKEN') → invoking healing graph...
   [GRAPH] Locator heal attempt 1/3 (strategy: css)
   [AI-HEAL] Graph healed: "#login-button-BROKEN" → "#login" (confidence: 0.95, attempts: 1)
   ```

5. **Revert the change** after the demo.

### 14.4 Step 4: Run Multiple Times for Metrics

```bash
# Run 3-5 times to build up data for metrics
npm run test:ai
npm run test:ai
npm run test:ai

# Now compute metrics
npm run ai:metrics

# Expected output:
# ┌─────────────────────────────────┐
# │ Pass@1: 0.7500 (3/4 sessions)  |
# │ Pass@3: 1.0000 (4/4 sessions)  |
# │ SHE: 0.6667 (2/3 failures)     |
# │ Latency: mean=2340ms p95=4200ms|
# │ Total AI calls: 12              |
# └─────────────────────────────────┘
```

### 14.5 Step 5: Run Drift Detection

```bash
npm run ai:drift
```

This launches a browser, navigates to the app, and compares each page object's locators against the live DOM. Reports which locators are still valid and which have drifted.

### 14.6 Step 6: Run Flaky Test Analysis

```bash
# Requires 2+ runs in run-history.json
npm run ai:flaky
```

### 14.7 Step 7: Index Knowledge Base (RAG)

```bash
# Add AI_RAG_ENABLED=true to .env first
npm run ai:index

# This indexes:
#   - Healing events from healing-log.json
#   - Failure reports from ai-reports/failure-reports/
#   - Page objects from framework/pages/
#   - Test specs from tests/
```

### 14.8 Step 8: Run Full Lifecycle Orchestration

```bash
# Full 6-phase lifecycle run:
npm run ai:lifecycle:full

# This executes:
#   Phase 1: Discovery — scans codebase (page objects, tests, flows)
#   Phase 2: Strategy — AI risk analysis, identifies drift candidates
#   Phase 3: Pre-Execution — checks top-3 high-risk page objects
#   Phase 4: Execution — runs 'npx playwright test' with AI healing
#   Phase 5: Post-Mortem — reporter triggers healing graph on failures
#   Phase 6: Synthesis — aggregates metrics, updates RAG, generates report

# Or run phases separately:
npm run ai:lifecycle:pre    # Phases 1-3 only
npm run ai:lifecycle:post   # Phase 6 only
```

### 14.9 Step 9: Generate Audit Report

```bash
npm run ai:audit

# Outputs:
#   - Audit timeline (all events in chronological order)
#   - Provenance chains (failure → heal attempt → outcome)
#   - Traceability matrix (requirement → test → status → healing data)
#   - Metrics summary
```

### 14.10 Complete Demo Workflow (All Features)

```bash
# 1. Install and configure
npm install
npx playwright install --with-deps
# Edit .env with your OPENAI_API_KEY
# Set AI_HEALING_ENABLED=true, AI_RAG_ENABLED=true, AI_LIFECYCLE_ENABLED=true

# 2. Run baseline (no AI)
npm test

# 3. Run with full AI lifecycle (3+ times for metrics)
npm run ai:lifecycle:full
npm run ai:lifecycle:full
npm run ai:lifecycle:full

# 4. Index knowledge base
npm run ai:index

# 5. Compute metrics
npm run ai:metrics

# 6. Run drift detection
npm run ai:drift

# 7. Run flaky analysis
npm run ai:flaky

# 8. Generate audit report
npm run ai:audit

# 9. Generate Allure report
npm run report:allure

# 10. Review all outputs
ls ai-reports/
ls ai-reports/lifecycle/
ls ai-reports/metrics/
ls ai-reports/failure-reports/
ls allure-report/
```

---

## 15. Demonstrating Results to Stakeholders

### 15.1 What to Show

| Demonstration | Command | Evidence |
|--------------|---------|----------|
| **Self-healing in action** | Break a locator, run `npm run test:ai` | Console logs showing `[AI-HEAL]` messages + test still passes |
| **Failure analysis** | Run with a real failure | `ai-reports/failure-reports/*.json` with category, root cause, suggestions |
| **Metrics dashboard** | `npm run ai:metrics` | Pass@k rates, SHE ratio, latency percentiles |
| **Audit trail** | `npm run ai:audit` | Timeline of events with correlation IDs, provenance chains |
| **Traceability matrix** | `npm run ai:audit` | Requirement → test → status mapping from Allure tags |
| **Lifecycle orchestration** | `npm run ai:lifecycle:full` | Console output showing all 6 phases executing in sequence |
| **Drift detection** | `npm run ai:drift` | Report showing which locators match/don't match the live DOM |
| **RAG enhancement** | `npm run ai:index` then run tests | Prompts enriched with similar past cases |
| **Allure report** | `npm run report:allure` | Professional test report with categories, environment info, test history |
| **CI/CD pipeline** | Push to GitHub | GitHub Actions artifacts: playwright-report, allure-report, ai-reports |

### 15.2 Key Numbers to Present

- **Number of AI agents:** 5 (LocatorHealer, FailureAnalyzer, TestCaseHealer, DriftDetection, FlakyTest)
- **Number of LangGraph workflows:** 3 (Runtime Healing, Post-Mortem Healing, Lifecycle Orchestration)
- **Lifecycle phases managed:** 6 (Discovery, Strategy, Pre-Execution, Execution, Post-Mortem, Synthesis)
- **Healing strategies:** 3 (CSS → Role → Text, cycled by the runtime graph)
- **Locator methods intercepted:** 22 action methods + 12 locator-returning methods
- **RAG collections:** 4 (healing_events, failure_reports, page_objects, test_specs)
- **Metrics computed:** 7 (Pass@1, Pass@2, Pass@3, SHE, mean/p95/p99 latency)
- **Audit event types:** 7 (run_start, test_start, test_fail, healing_attempted, healing_succeeded, healing_failed, run_complete)
- **Total framework files:** 63 source files (20 new + 13 modified + 30 pre-existing)
- **Total AI code:** ~2,735 lines across the 4 thesis objective implementations

### 15.3 Thesis Objective Completion Matrix

| Objective | Description | Status | Key Evidence |
|-----------|-------------|--------|-------------|
| 1 | 6-Phase Lifecycle Orchestration via LangGraph | Implemented | `lifecycle-graph.js`, `lifecycle-nodes.js`, `run-lifecycle.js` |
| 2 | RAG with ChromaDB for Impact Analysis | Implemented | `chroma-client.js`, `rag-indexer.js`, `rag-retriever.js`, `rag-prompt-enhancer.js` |
| 3 | Reliability Metrics (Pass@k, SHE, Latency) | Implemented | `metrics-engine.js`, `latency-tracker.js`, `compute-metrics.js` |
| 4 | Assurance & Traceability with Audit Trail | Implemented | `audit-trail.js`, `traceability-matrix.js`, `audit-report-generator.js` |

---

## 16. Adapting to Your Own Web Application

### 16.1 Step 1: Replace the Target Application

1. Update `framework/data/authAndCart.data.js` with your app's credentials and URLs
2. Create new page objects in `framework/pages/` for your app's pages
3. Create new flows in `framework/flows/` for your app's business workflows
4. Update `playwright.config.js` with your app's base URL and browser settings

### 16.2 Step 2: Write Test Specs

Write tests in `tests/` using the fixture pattern:

```js
const { test, expect } = require('../../framework/fixtures/app.fixture');
const allure = require('allure-js-commons');

test.describe('Your Feature', () => {
  test('your test case', async ({ page, yourPageObject, yourFlow }) => {
    await allure.epic('Your App');
    await allure.feature('Your Feature');
    await allure.story('Your Story');

    // Your test steps...
  });
});
```

### 16.3 Step 3: Enable AI Self-Healing

For tests that should have AI self-healing:
```js
// Import from the AI fixture instead of the base fixture
const { test, expect } = require('../../framework/ai/fixtures/app.ai.fixture');
```

Or run the entire suite with AI:
```bash
npm run test:ai
```

### 16.4 Step 4: Add Allure Tags for Traceability

Ensure every test has Allure tags so the traceability matrix can map requirements to tests:
```js
await allure.epic('Your Epic');
await allure.feature('Your Feature');
await allure.story('Your Story');
await allure.severity('critical');
await allure.tags('tag1', 'tag2');
```

---

## 17. Design Decisions & Trade-offs

### 17.1 JavaScript Proxy for Interception

**Decision:** Use `Proxy` to wrap Playwright's `Page` and `Locator` objects instead of subclassing or monkey-patching.

**Rationale:** Proxies are transparent — page objects, flows, and test specs don't need to know they're being intercepted. This is the key enabler for "zero code changes" self-healing. The proxy correctly handles method chaining (`.locator().first().click()`) by re-proxying locator-returning methods.

### 17.2 CommonJS (require/module.exports) Throughout

**Decision:** All framework code uses CommonJS modules, even though `playwright.config.js` uses ESM.

**Rationale:** All AI framework modules are consumed by the reporter (which runs in Node.js CJS context) and CLI scripts. Keeping everything in CJS avoids interop issues. The config file uses ESM because that's Playwright's default template.

### 17.3 ChromaDB with Local JSON Fallback

**Decision:** Try native ChromaDB first, fall back to a pure-Node.js local vector store.

**Rationale:** ChromaDB requires either a server process or native bindings that may not install cleanly on all platforms (especially Windows). The local fallback implements cosine similarity in JavaScript and stores collections as JSON files, ensuring the RAG system works everywhere without external dependencies.

### 17.4 Suggestions Only — No Auto-Apply for Test Code

**Decision:** TestCaseHealerAgent produces suggestions saved to JSON files, never auto-applies code changes.

**Rationale:** Auto-modifying test source code is dangerous — it could mask real bugs, introduce regressions, or violate the test's intent. The framework provides AI-powered suggestions for human review.

### 17.5 Factory Pattern for Latency Tracking

**Decision:** Replace direct `new AIClient(config)` with `createAIClient(config)` factory.

**Rationale:** The factory transparently wraps with latency tracking when `metricsEnabled` is true, without changing any agent code. This follows the Open/Closed Principle — agents are open for extension (latency tracking) without modification.

### 17.6 Correlation IDs via crypto.randomUUID()

**Decision:** Use Node's built-in `crypto.randomUUID()` instead of the `uuid` npm package.

**Rationale:** Avoids adding another dependency. `crypto.randomUUID()` is available in Node 18+ and produces v4 UUIDs.

---

## 18. Enhancement Changelog

### Commit `6ee8f3f` — Initial Framework

- Playwright test framework with page objects, flows, fixtures
- Test specs for auth, cart, checkout, orders
- Test data and utilities

### Commit `e248cf5` — Multi-Agent AI System

- 5 AI agents (LocatorHealer, FailureAnalyzer, TestCaseHealer, DriftDetection, FlakyTest)
- JavaScript Proxy interception (page-proxy.js, locator-proxy.js)
- 2 LangGraph workflows (Post-Mortem Healing, Runtime Healing)
- AI-enhanced fixture (app.ai.fixture.js)
- Prompt engineering for all agents
- Storage layer (healing-log.json, run-history.json)
- AI Healing Reporter (Playwright custom reporter)
- Allure reporting integration with categories, severity, tags
- CI/CD via GitHub Actions
- 6 prompt builders
- CLI scripts (drift, flaky, review)

### Commit `39e1a98` — Thesis Objectives Implementation

**Phase A (Objective 3 — Metrics):**
- AI Client Factory with latency tracking decorator
- MetricsEngine: Pass@k, SHE, latency stats, confidence analysis
- All 5 agents migrated to factory pattern
- `npm run ai:metrics` CLI

**Phase B (Objective 4 — Audit Trail):**
- Append-only AuditTrail with UUID correlation IDs and provenance chains
- TraceabilityMatrix scanning Allure tags for requirement-to-test mapping
- AuditReportGenerator combining trail + matrix + metrics
- Reporter rewritten to record audit events at every lifecycle point
- `npm run ai:audit` CLI

**Phase C (Objective 2 — RAG):**
- EmbeddingService (OpenAI text-embedding-3-small)
- ChromaStore with local JSON fallback and cosine similarity
- RAGIndexer (4 collection types)
- RAGRetriever (top-K similarity search)
- RAGPromptEnhancer (context injection into agent prompts)
- All 3 prompt builders updated to accept `ragContext`
- `strategyHint` gap fixed in LocatorHealerAgent
- `npm run ai:index` CLI

**Phase D (Objective 1 — Lifecycle):**
- LifecycleState schema (18 annotated fields)
- Lifecycle routing conditions (mode-based: pre/post/full)
- 5 lifecycle node functions (discovery, strategy, preExecution, checkpoint, synthesis)
- Lifecycle StateGraph definition
- Risk analysis prompt for Phase 2
- `npm run ai:lifecycle:pre/post/full` CLI scripts
- `chromadb` npm dependency added

---

## npm Scripts Reference

| Script | Command |
|--------|---------|
| `npm test` | Run all Playwright tests |
| `npm run test:headed` | Run tests with visible browser |
| `npm run test:auth` | Run auth tests only |
| `npm run test:smoke` | Run smoke tests only |
| `npm run test:web` | Run all flow tests |
| `npm run test:ai` | Run all tests with AI healing enabled |
| `npm run report` | Open Playwright HTML report |
| `npm run report:allure` | Generate and open Allure report |
| `npm run ai:drift` | Run drift detection on page objects |
| `npm run ai:flaky` | Analyze flaky tests from run history |
| `npm run ai:review` | Review recent healing log |
| `npm run ai:metrics` | Compute and display reliability metrics |
| `npm run ai:audit` | Generate comprehensive audit report |
| `npm run ai:index` | Index knowledge base for RAG |
| `npm run ai:lifecycle:pre` | Run lifecycle phases 1-3 |
| `npm run ai:lifecycle:post` | Run lifecycle phase 6 |
| `npm run ai:lifecycle:full` | Run full 6-phase lifecycle |
