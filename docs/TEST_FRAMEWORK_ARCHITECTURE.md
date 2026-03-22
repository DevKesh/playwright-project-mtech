# Multi-Agentic AI Self-Healing Test Automation Framework

## Mid-Semester Technical Report

**Degree**: MTech, Software Engineering
**Institution**: BITS Pilani (WILP)
**Project Type**: Thesis / Dissertation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Thesis Objectives](#3-thesis-objectives)
4. [Technology Stack](#4-technology-stack)
5. [Framework Architecture](#5-framework-architecture)
6. [The 6 AI Agents](#6-the-6-ai-agents)
7. [The 6-Phase QA Lifecycle](#7-the-6-phase-qa-lifecycle)
8. [LangGraph Orchestration (State Machines)](#8-langgraph-orchestration-state-machines)
9. [RAG Knowledge Base](#9-rag-knowledge-base)
10. [Formal Metrics Engine](#10-formal-metrics-engine)
11. [Audit Trail and Traceability](#11-audit-trail-and-traceability)
12. [Centralized Configuration and Demo Pipeline](#12-centralized-configuration-and-demo-pipeline)
13. [Generated Artifacts (Amazon Demo)](#13-generated-artifacts-amazon-demo)
14. [Reporting (Allure)](#14-reporting-allure)
15. [How to Run the Framework](#15-how-to-run-the-framework)
16. [Project Structure](#16-project-structure)
17. [Summary of Work Completed](#17-summary-of-work-completed)
18. [References](#18-references)

---

## 1. Project Overview

This project presents a **multi-agentic AI self-healing test automation framework** that fundamentally changes how end-to-end (E2E) web tests are created, maintained, and repaired. Traditional test automation is brittle -- when a developer changes a button's CSS class or moves an element on the page, dozens of tests break and a QA engineer must manually find and fix each one. This framework solves that problem by using multiple specialized AI agents, each responsible for a different aspect of the testing lifecycle, working together through orchestrated state machine workflows.

The framework is built on top of **Playwright** (Microsoft's modern browser automation tool), uses **OpenAI GPT models** for intelligent decision-making, and employs **LangGraph** (a state machine library from LangChain) to coordinate multi-step AI workflows. It also includes a **RAG (Retrieval Augmented Generation)** subsystem that learns from past healing events to improve future decisions.

**In simple terms**: Instead of a QA engineer manually writing tests and fixing them when they break, this framework has AI agents that can automatically explore a website, generate test code, detect when tests are about to break, and self-heal broken tests at runtime -- all orchestrated through a formal 6-phase lifecycle.

---

## 2. Problem Statement

Modern web applications change frequently. UI elements get redesigned, page layouts shift, and CSS selectors that tests depend on become outdated. This creates a significant maintenance burden:

- **Locator Fragility**: A test written to click `button#submit-order` breaks if the developer renames it to `button.order-submit`. Traditional frameworks require manual intervention to fix this.
- **Reactive Maintenance**: Teams discover broken tests only after they fail in CI/CD pipelines, leading to delayed feedback and wasted pipeline resources.
- **No Institutional Memory**: When a locator breaks and gets fixed, that knowledge is lost. If a similar locator breaks next week, the engineer starts from scratch.
- **Manual Test Creation**: Writing Page Objects and test specs for a new application is time-consuming and error-prone.
- **Lack of Formal Metrics**: There is no standardized way to measure how effective an AI-based healing system actually is.

This thesis addresses all five problems through a coordinated multi-agent approach.

---

## 3. Thesis Objectives

The project is built around **four core thesis objectives**, each implemented as a distinct subsystem:

| # | Objective | Implementation |
|---|-----------|----------------|
| 1 | **Lifecycle Orchestration** | A formal 6-phase QA lifecycle managed by a LangGraph state machine, covering discovery through post-execution synthesis |
| 2 | **RAG Knowledge Base** | A vector database that stores past healing events, failure patterns, and page structures to provide contextual knowledge to AI agents |
| 3 | **Formal Metrics** | Quantitative measures including Pass@k (healing success probability), Self-Healing Efficacy (SHE), and AI inference latency tracking |
| 4 | **Audit Trail** | Full provenance tracking with correlation IDs, allowing any healing decision to be traced back to its root cause, agent reasoning, and outcome |

---

## 4. Technology Stack

| Technology | Role | Why It Was Chosen |
|------------|------|-------------------|
| **Playwright** | Browser automation and test runner | Microsoft's modern E2E tool with auto-wait, multi-browser support, and built-in fixtures |
| **OpenAI GPT-4o / GPT-4o-mini** | AI reasoning engine | Provides structured JSON responses, vision capabilities (screenshot analysis), and function-calling for agent decision-making |
| **LangGraph** (LangChain) | Workflow orchestration | State machine library that manages multi-step AI workflows with conditional routing and shared state |
| **ChromaDB** | Vector database for RAG | Stores embeddings of past events for semantic similarity search; falls back to a lightweight JSON-based store |
| **OpenAI Embeddings** | Text vectorization | Converts healing events and page structures into numerical vectors for similarity retrieval (text-embedding-3-small, 1536 dimensions) |
| **Allure** | Test reporting | Industry-standard reporting tool with rich visual dashboards, test categorization, and historical trend tracking |
| **Node.js** | Runtime environment | JavaScript/CommonJS throughout the project for consistency with Playwright's native ecosystem |
| **dotenv** | Environment configuration | Manages API keys and feature flags securely via .env files |
| **cross-env** | Cross-platform env vars | Allows setting environment variables in npm scripts that work on both Windows and Unix |

---

## 5. Framework Architecture

The framework follows a layered architecture where each layer has a specific responsibility:

```
+------------------------------------------------------------------+
|                        CLI SCRIPTS / npm COMMANDS                  |
|   demo:explore | demo:test | demo:heal | demo:report | demo:full |
+------------------------------------------------------------------+
         |                |                |               |
         v                v                v               v
+------------------+  +--------+  +------------------+  +--------+
| Exploration      |  |Playwright| | Healing Reporter |  | Allure |
| Graph            |  |Test Run  | | (Post-Mortem)    |  | Report |
| (LangGraph)      |  |          | | (LangGraph)      |  |        |
+------------------+  +--------+  +------------------+  +--------+
         |                |                |
         v                v                v
+------------------------------------------------------------------+
|                     6 AI AGENTS                                    |
| Locator Healer | Failure Analyzer | Test Case Healer              |
| Drift Detector | Flaky Analyzer   | Exploratory Agent             |
+------------------------------------------------------------------+
         |                |                |
         v                v                v
+------------------------------------------------------------------+
|                 CORE AI INFRASTRUCTURE                             |
|  OpenAI Client | Page Proxy | Locator Proxy | Prompt Builders     |
+------------------------------------------------------------------+
         |                |                |
         v                v                v
+------------------------------------------------------------------+
|               SUPPORTING SUBSYSTEMS                                |
|  RAG (Vector DB) | Metrics Engine | Audit Trail | Storage/Reports |
+------------------------------------------------------------------+
         |
         v
+------------------------------------------------------------------+
|               CENTRALIZED CONFIGURATION                            |
|  ai.config.js | test-data.config.js | .env                        |
+------------------------------------------------------------------+
```

### How Components Connect

1. **CLI scripts** are the entry points -- a user runs `npm run demo:explore` or `npm run demo:test`
2. These scripts invoke **LangGraph state machines** that orchestrate multi-step workflows
3. Each step in a workflow delegates to a **specialized AI agent**
4. Each agent uses the **OpenAI Client** to communicate with GPT, guided by **prompt builders** that construct carefully engineered prompts
5. The **RAG subsystem** enriches prompts with relevant historical context
6. The **Metrics Engine** tracks quantitative performance data
7. The **Audit Trail** records every decision for full traceability
8. All data is persisted through the **Storage layer** to JSON files in `ai-reports/`

---

## 6. The 6 AI Agents

Each agent is a specialized class that handles one specific concern. This separation follows the **single responsibility principle** -- each agent is an expert in its domain.

### Agent 1: Locator Healer (`locator-healer.agent.js`)

**Purpose**: When a CSS selector or locator fails at runtime (e.g., `#submit-btn` no longer exists), this agent extracts the current page DOM, sends it to GPT, and gets alternative selectors that match the intended element.

**How it works**:
1. A test action fails (e.g., `page.click('#submit-btn')` throws "element not found")
2. The Locator Proxy intercepts the error and triggers the healing graph
3. The agent extracts a trimmed DOM snapshot from the live page (limited to prevent token waste)
4. GPT analyzes the DOM and suggests 3 alternative selectors ranked by confidence
5. Each suggestion is validated against the live page -- the framework checks if the selector actually finds an element
6. The first valid selector is used to retry the failed action
7. The result (success or failure) is logged to the healing history

**Significance**: This is the **core self-healing capability**. It requires zero code changes to existing tests -- the healing happens transparently through the Proxy pattern.

### Agent 2: Failure Analyzer (`failure-analyzer.agent.js`)

**Purpose**: Performs post-mortem root cause analysis on test failures. Rather than just saying "test failed," it categorizes the failure and explains why.

**Failure Categories**:
- `locator_broken` -- A UI element's selector has changed
- `assertion_mismatch` -- Expected value doesn't match actual
- `timeout` -- Element or page didn't load in time
- `network_error` -- API calls or page loads failed
- `data_issue` -- Test data is stale or invalid
- `app_bug` -- The application itself has a defect
- `test_logic_error` -- The test code has a bug
- `environment_issue` -- Infrastructure/config problems

**How it works**:
1. After a test fails, the AI Healing Reporter triggers this agent
2. The agent reads the test source file, error message, stack trace, and optionally a failure screenshot
3. For screenshot analysis, it uses GPT's vision capability to understand what was actually on screen
4. GPT categorizes the failure and provides a root cause explanation with confidence score

**Significance**: This classification drives the routing logic in the healing graph -- different failure types get different treatment (locator failures get healed, infrastructure issues get reported).

### Agent 3: Test Case Healer (`test-case-healer.agent.js`)

**Purpose**: When a test has broken logic or assertions (not just broken locators), this agent reads the test code and its dependencies, then suggests specific code changes.

**How it works**:
1. Triggered when the Failure Analyzer classifies a failure as `test_logic_error` or `assertion_mismatch`
2. Follows `require()` imports to gather full context (page objects, flow files, data files)
3. Sends the complete context to GPT, which produces minimal, targeted code fix suggestions
4. Suggestions are stored -- they are never auto-applied, maintaining human oversight

**Significance**: This agent addresses failures that go beyond simple locator changes. It understands the broader test structure and can suggest fixes to assertions, data, and test flow logic.

### Agent 4: Drift Detection (`drift-detection.agent.js`)

**Purpose**: Proactively identifies page object locators that are about to break, before tests actually fail.

**How it works**:
1. Takes a page object file and navigates to the corresponding page
2. Extracts the live DOM and compares it against every locator defined in the page object
3. Each locator gets a status: `ok` (still valid), `broken` (doesn't match anything), or `fragile` (matches but may break soon)
4. Also identifies new elements on the page that don't have corresponding locators

**Significance**: This shifts testing from **reactive** (fix after failure) to **proactive** (fix before failure). It's particularly valuable when the web application has frequent UI updates.

### Agent 5: Flaky Test Analyzer (`flaky-test.agent.js`)

**Purpose**: Identifies tests that pass sometimes and fail other times (flaky tests), and classifies the root cause of their instability.

**Flakiness Patterns**:
- `timing_sensitive` -- Race conditions or animation timing
- `data_dependent` -- Relies on dynamic or shared data
- `order_dependent` -- Passes alone but fails in a suite
- `environment_sensitive` -- Works locally but fails in CI
- `intermittent_locator` -- Element sometimes takes longer to appear

**How it works**:
1. Aggregates pass/fail statistics across multiple test runs from the run history
2. Identifies tests with inconsistent results (e.g., 7 passes and 3 failures out of 10 runs)
3. Sends the statistical profile to GPT for pattern classification
4. Produces actionable recommendations per flaky test

**Significance**: Flaky tests erode confidence in the test suite and waste CI resources. This agent provides data-driven insights instead of guesswork.

### Agent 6: Exploratory Agent (`exploratory.agent.js`)

**Purpose**: The only **proactive** agent -- instead of reacting to failures, it actively explores a web application, understands its structure, and generates Page Object classes and test specifications from scratch.

**How it works**:
1. Launches a real browser and navigates to the target URL
2. On each page, extracts the page structure: forms, buttons, links, inputs, navigation elements
3. Sends the structure to GPT for page classification (login page, dashboard, catalog, etc.)
4. Follows links to discover more pages (breadth-first crawl, respecting configurable depth and page limits)
5. After crawling, GPT analyzes all visited pages to identify user flows (e.g., "search and browse", "login flow", "change preferences")
6. For each discovered page, generates a Playwright Page Object class following existing code patterns
7. For each identified flow, generates a Playwright test spec with Allure tags and proper assertions

**Significance**: This agent can take a completely new website and produce a working test suite in a single run, dramatically accelerating test creation for new projects.

---

## 7. The 6-Phase QA Lifecycle

The lifecycle orchestration is the framework's approach to structuring the entire QA process into distinct, automated phases. This is managed by the **Lifecycle Graph** -- a LangGraph state machine.

```
Phase 1          Phase 2           Phase 3         Phase 4
DISCOVERY    ->  STRATEGY     ->   PRE-EXECUTION -> TEST EXECUTION
(Scan code)      (Risk analysis)   (Drift checks)   (Playwright runs)
    |                |                  |                  |
    v                v                  v                  v
Catalog all      AI identifies     Validate top       Actual tests run
page objects,    high-risk POs     drift candidates   with/without
test specs,      and scores them   against live DOM   self-healing
flow files       by likelihood                        enabled
                 of failure
                                                          |
                                                          v
                                         Phase 5              Phase 6
                                         RUNTIME HEALING  ->  SYNTHESIS
                                         (Self-healing)       (Aggregate)
                                              |                    |
                                              v                    v
                                         Locator Healer      Compute metrics,
                                         + Failure Analyzer   update RAG,
                                         + Test Case Healer   generate reports
```

### Phase 1: Discovery

**What happens**: The framework scans the entire codebase to build an inventory.

- Catalogs all page object files (`framework/pages/`)
- Catalogs all test spec files (`tests/`)
- Catalogs all flow files (`framework/flows/`)
- Builds a coverage map showing which page objects are used by which tests

**Why it matters**: You cannot manage what you cannot measure. This phase creates a baseline understanding of the test suite's current state.

### Phase 2: Strategy (AI-Powered Risk Analysis)

**What happens**: The framework sends the inventory from Phase 1 to GPT along with historical healing data and run history.

- GPT assigns a risk score (0-100) to each page object based on past failure frequency, healing events, and code complexity
- Identifies drift candidates -- page objects most likely to have broken locators
- Produces a prioritized list for Phase 3 to check

**Why it matters**: Instead of checking every page object against every page (which would be expensive and slow), the framework focuses on the highest-risk areas first. This is an intelligent allocation of AI resources.

### Phase 3: Pre-Execution (Proactive Drift Detection)

**What happens**: For the top drift candidates identified in Phase 2, the framework launches a headless browser and validates each locator against the live application.

- Each locator is classified as `ok`, `broken`, or `fragile`
- New elements not covered by any page object are flagged
- Any locators that need healing are noted for the execution phase

**Why it matters**: This phase catches problems *before* tests run, turning what would be runtime failures into pre-flight warnings.

### Phase 4: Test Execution

**What happens**: Standard Playwright test execution (`npx playwright test`).

- If self-healing is enabled (`AI_HEALING_ENABLED=true`), the Page Proxy and Locator Proxy intercept failures and trigger real-time healing
- If self-healing is disabled, tests run as normal Playwright tests with no AI overhead

**Why it matters**: The framework maintains backward compatibility -- it doesn't change how tests fundamentally work. The self-healing layer is transparent and optional.

### Phase 5: Runtime Healing

**What happens**: During test execution (Phase 4), when a locator fails:

1. The Locator Proxy catches the error
2. The Runtime Healing Graph (LangGraph) is invoked
3. It cycles through three strategies: CSS selectors, ARIA roles, and text-based matching
4. For each strategy, the Locator Healer Agent asks GPT for alternatives
5. Each suggestion is validated against the live page
6. If healing succeeds, the test continues transparently; if all strategies fail, the original error is thrown

The **AI Healing Reporter** also runs post-test, triggering the Post-Mortem Healing Graph for any failures. This graph classifies the failure (Agent 2) and routes to the appropriate healer (Agent 3 for logic errors) or simply reports it.

**Why it matters**: This is where the "self-healing" actually happens. The test doesn't know it was healed -- from the test's perspective, `page.click('#old-button')` just worked, even though the framework silently used a different selector.

### Phase 6: Synthesis

**What happens**: After all tests complete, the framework aggregates everything:

- Computes formal metrics (Pass@k, Self-Healing Efficacy, latency statistics)
- Updates the RAG knowledge base with new healing events and failure patterns
- Generates a comprehensive report with traceability matrix
- Saves all data to `ai-reports/`

**Why it matters**: This phase closes the feedback loop. The knowledge base grows over time, making future healing decisions more informed. The metrics provide quantitative evidence of the framework's effectiveness.

---

## 8. LangGraph Orchestration (State Machines)

The framework uses **three distinct LangGraph state machines** (graphs) to orchestrate different workflows. LangGraph is a library from LangChain that models workflows as directed graphs where nodes are functions and edges have conditions.

### Why State Machines?

AI workflows involve multiple steps with branching logic. For example, after classifying a failure, the next step depends on the category. A state machine makes this explicit and traceable -- you can see exactly which path was taken and why.

### Graph 1: Exploration Graph

```
START -> navigate -> discoverPage -> [condition: more pages?]
                                          |
                    +---------------------+--------------------+
                    |                                          |
                    v                                          v
               crawlNext -----> discoverPage            analyzeApp
                                                            |
                                                            v
                                                    generatePageObjects
                                                            |
                                                            v
                                                     generateTests
                                                            |
                                                            v
                                                       writeFiles -> END
```

**State**: Tracks the URL queue, visited pages, browser instance, generated code, and errors.
**Condition**: After discovering each page, checks if there are more URLs to visit and if the page limit hasn't been reached.

### Graph 2: Healing Graph (Post-Mortem)

```
START -> classifyFailure -> [condition: failure category]
                                    |
                    +---------------+----------------+
                    |                                |
                    v                                v
            healTestCase                       reportOnly
            (logic/assertion)                  (infra/app bug)
                    |                                |
                    +---------------+----------------+
                                    |
                                    v
                                summarize -> END
```

**State**: Tracks the test file, error details, failure category, and healing results.
**Condition**: Routes to `healTestCase` for test logic and assertion failures; routes to `reportOnly` for infrastructure issues and application bugs that can't be fixed at the test level.

### Graph 3: Runtime Healing Graph

```
START -> tryHealLocator -> [condition: healed?]
                                |
                    +-----------+-----------+
                    |                       |
                    v                       v
                   END                 nextStrategy
                (success)              (cycle CSS -> role -> text)
                                            |
                                            v
                                    tryHealLocator (retry)
                                            |
                                    [condition: all strategies exhausted?]
                                            |
                                            v
                                    END (failure -- throw original error)
```

**State**: Tracks the failed selector, current strategy, attempt count, page reference, and healing result.
**Condition**: After each attempt, checks if healing succeeded (continue test) or if all three strategies have been exhausted (give up).

### Graph 4: Lifecycle Graph

```
START -> [condition: mode?]
              |
    +---------+---------+
    |         |         |
    v         v         v
  (pre)    (post)    (full)
    |         |         |
    v         v         v
 discovery  synthesis  discovery -> strategy -> preExecution
    |         |             -> checkpoint -> synthesis
    v         |
 strategy     v
    |        END
    v
 preExecution
    |
    v
 checkpoint -> [condition: mode?]
                  |
           +------+------+
           |             |
           v             v
          END         synthesis -> END
         (pre)        (full)
```

**State**: Tracks the mode (pre/post/full), inventories from discovery, risk scores, drift reports, metrics, and synthesis results.
**Condition**: Routes based on the execution mode -- `pre` runs Phases 1-3 only, `post` runs Phase 6 only, `full` runs all phases.

---

## 9. RAG Knowledge Base

RAG (Retrieval Augmented Generation) is a technique where an AI model's prompts are enriched with relevant information retrieved from a knowledge base, rather than relying solely on the model's training data.

### How RAG Works in This Framework

```
     Test fails with error "Element #checkout-btn not found"
                         |
                         v
     +-------------------------------------------+
     | RAG Retriever: "Find me similar past       |
     | healing events for checkout buttons"        |
     +-------------------------------------------+
                         |
                         v
     +-------------------------------------------+
     | Vector DB: Cosine similarity search         |
     | across all stored healing events            |
     +-------------------------------------------+
                         |
                         v
     +-------------------------------------------+
     | Top 3 matches:                              |
     | 1. "#buy-btn healed to .purchase-button"   |
     | 2. "#order-submit changed to [data-action]"|
     | 3. "#cart-btn renamed to .cart-action"      |
     +-------------------------------------------+
                         |
                         v
     +-------------------------------------------+
     | Prompt to GPT now includes these examples   |
     | as context, helping it make better          |
     | healing suggestions                         |
     +-------------------------------------------+
```

### Components

1. **Embedding Service** (`embedding-service.js`): Converts text descriptions into 1536-dimensional numerical vectors using OpenAI's text-embedding-3-small model. Similar texts produce similar vectors.

2. **Vector Store** (`chroma-client.js`): Stores these vectors and supports cosine similarity search. Uses ChromaDB when available, or falls back to a lightweight JSON-file-based implementation with manual cosine similarity computation.

3. **RAG Indexer** (`rag-indexer.js`): Indexes four types of data:
   - Healing events (past selector fixes)
   - Failure reports (classified failures)
   - Page objects (current locator structures)
   - Test specs (test flows and assertions)

4. **RAG Retriever** (`rag-retriever.js`): Performs top-K similarity searches to find the most relevant past records for any given query.

5. **Prompt Enhancer** (`rag-prompt-enhancer.js`): Injects retrieved context into agent prompts, giving GPT historical examples to learn from.

### Significance

Without RAG, every healing attempt starts from zero knowledge. With RAG, the framework has institutional memory -- if a similar selector was healed before, that experience informs the current decision. Over time, as more healing events accumulate, the system becomes increasingly effective.

---

## 10. Formal Metrics Engine

The metrics engine (`metrics-engine.js`) computes quantitative measures of the framework's effectiveness:

### Pass@k

**Definition**: The probability that at least one correct healing suggestion is produced within the first k attempts.

**Formula**: Pass@k = 1 - (combinations(n-c, k) / combinations(n, k))
Where n = total suggestions, c = correct suggestions, k = attempts considered.

**What it tells you**: "If the system suggests 3 alternatives, what's the probability that at least one works?" A Pass@1 of 0.85 means 85% of the time, the very first suggestion is correct.

### Self-Healing Efficacy (SHE)

**Definition**: The ratio of successfully healed failures to total failures encountered.

**Formula**: SHE = successful heals / total failures

**What it tells you**: The overall success rate of the self-healing system. An SHE of 0.70 means 70% of all test failures were automatically repaired.

### Latency Statistics

Every AI API call is timed by the latency tracker (`latency-tracker.js`), which decorates the OpenAI client. The metrics engine computes:

- **Mean**: Average response time across all API calls
- **Median**: The middle value (less sensitive to outliers)
- **p95**: 95th percentile (95% of calls complete within this time)
- **p99**: 99th percentile (worst-case excluding extreme outliers)

**What it tells you**: Whether the AI healing adds acceptable latency to the test execution pipeline.

### Confidence Threshold Analysis

Analyzes the distribution of confidence scores across all healing events to determine if the configured threshold (default 0.7) is appropriate.

---

## 11. Audit Trail and Traceability

### Audit Trail (`audit-trail.js`)

Every significant event in the framework is recorded with:

- **Audit ID**: Unique identifier for this specific event
- **Correlation ID**: Links related events together (e.g., a failure and its subsequent healing attempt share a correlation ID)
- **Timestamp**: When the event occurred
- **Event Type**: What happened (test_start, test_fail, healing_attempted, healing_succeeded, run_complete)
- **Payload**: Full details of the event

This creates an **append-only event chain** that supports:
- **Provenance walking**: Starting from any healing decision, trace back to the original failure
- **Run querying**: Retrieve all events from a specific test run
- **Chain analysis**: Follow a correlation ID to see the complete heal-or-fail story

### Traceability Matrix (`traceability-matrix.js`)

Maps test coverage requirements to actual test outcomes:

- Extracts Allure tags (`epic`, `feature`, `story`) from test spec files
- Links each requirement to the test(s) that cover it
- Enriches with run outcomes (pass/fail/healed/skipped)
- Cross-references with healing data to show which requirements were maintained through self-healing

### Audit Report Generator (`audit-report-generator.js`)

Produces comprehensive audit reports combining:
- The traceability matrix
- Healing provenance chains for every healed failure
- Aggregated metrics (Pass@k, SHE, latency)
- Run-level statistics

**Significance**: In regulated environments or academic evaluations, being able to demonstrate *exactly* what happened and *why* is essential. The audit trail provides this transparency.

---

## 12. Centralized Configuration and Demo Pipeline

### Test Data Configuration (`framework/config/test-data.config.js`)

All application-specific test data is stored in a single configuration file:

```javascript
const testDataConfig = {
  targetApp: {
    name: 'Amazon',
    baseUrl: 'https://www.amazon.com',
    loginUrl: 'https://www.amazon.com/ap/signin',
    credentials: {
      email: 'testuser@example.com',
      password: 'SecurePassword123',
    },
    searchData: {
      department: 'Books',
      keywords: 'JavaScript programming',
    },
  },
  exploration: {
    maxPages: 5,
    maxDepth: 2,
  },
};
```

**Why this matters**: The GPT prompt rules are engineered so that all AI-generated test specs import data from this config file instead of hardcoding values. This means:
- Changing the target app or credentials is a one-file edit
- No API tokens are consumed when updating test data
- Generated tests remain valid across data changes

### Environment Configuration (`.env`)

Sensitive data like the OpenAI API key is stored in `.env` (gitignored):

```
OPENAI_API_KEY=sk-your-key-here
```

A `.env.example` template is committed to the repository for documentation.

### Demo Pipeline (npm scripts)

The framework provides a streamlined pipeline via npm scripts:

| Command | Uses API? | What it does |
|---------|-----------|--------------|
| `npm run demo:explore` | Yes (one-time) | AI explores the website, generates Page Objects and test specs |
| `npm run demo:test` | No | Runs the generated tests using pure Playwright |
| `npm run demo:test:headed` | No | Same as above but with visible browser |
| `npm run demo:report` | No | Generates and opens Allure test report |
| `npm run demo:full` | Yes (one-time) | Runs the complete pipeline: explore, test, report |
| `npm run demo:heal` | Yes (per failure) | Runs tests with AI self-healing enabled |

**Key insight**: The OpenAI API is only used during exploration (one-time) and healing (only when tests fail). Regular test execution is pure Playwright with zero AI overhead.

---

## 13. Generated Artifacts (Amazon Demo)

The framework has been demonstrated against **Amazon.com** as the target application. A single exploration run produced:

### Generated Page Objects (`framework/pages/generated/`)

| File | Page | Key Locators |
|------|------|-------------|
| `AmazonHomePage.js` | Amazon home page | Department select dropdown, search input |
| `AmazonLoginPage.js` | Amazon login page | Email input, continue button, password input, sign-in button |
| `AmazonLanguageCurrencySettingsPage.js` | Language/currency settings | Language radio buttons, currency radio buttons, save button |
| `AmazonSignInPage.js` | Amazon sign-in page | Email/password inputs, sign-in button |
| `AmazonRefNavLogoPage.js` | Amazon home (via logo) | Department select, search input |

### Generated Test Specs (`tests/generated/`)

| File | Flow | What it tests |
|------|------|---------------|
| `search-and-browse-flow.spec.js` | Search and Browse | Opens home page, selects department, searches for keywords, verifies results appear |
| `amazon-login-flow.spec.js` | Login | Navigates to sign-in, enters email and password through Amazon's multi-step login, verifies submission |
| `change-preferences-flow.spec.js` | Preferences | Opens settings page, changes language and currency preferences, saves changes |

All generated specs include Allure metadata tags (`epic`, `feature`, `story`, `severity`) for rich reporting.

---

## 14. Reporting (Allure)

The framework uses **Allure** for test reporting, configured in `playwright.config.js`:

- **HTML Report**: Playwright's built-in HTML reporter for quick local reviews
- **Allure Report**: Rich, interactive dashboards with:
  - Test execution timeline
  - Pass/fail/broken/skipped categorization
  - Epic/Feature/Story hierarchy from test tags
  - Historical trends across runs
  - Severity classification (critical, normal, minor)

When AI healing is enabled, the **AI Healing Reporter** (`ai-healing-reporter.js`) is additionally loaded. This custom Playwright reporter:
- Records audit trail events for every test start, pass, and failure
- Triggers the Post-Mortem Healing Graph for failed tests
- Appends healing events and run history to the storage layer

**To generate and view**: `npm run demo:report`

---

## 15. How to Run the Framework

### Prerequisites

1. Node.js (v18+)
2. An OpenAI API key

### Setup

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Create .env file with your API key
# (copy from .env.example and add your real key)
```

### Demo Workflow

```bash
# Step 1: One-time exploration (uses API)
npm run demo:explore

# Step 2: Run generated tests (no API needed)
npm run demo:test

# Step 3: Generate and view Allure report
npm run demo:report

# Or run everything in one command
npm run demo:full
```

### Self-Healing Demo

```bash
# Run tests with AI self-healing enabled (uses API only on failures)
npm run demo:heal
```

### Lifecycle Orchestration

```bash
# Pre-execution phases (discovery, strategy, drift checks)
npm run ai:lifecycle:pre

# Post-execution phase (synthesis, metrics, RAG update)
npm run ai:lifecycle:post

# Full lifecycle
npm run ai:lifecycle:full
```

### Individual AI Tools

```bash
npm run ai:drift        # Run drift detection against live pages
npm run ai:flaky        # Analyze flaky tests from run history
npm run ai:metrics      # Compute Pass@k, SHE, latency stats
npm run ai:audit        # Generate full audit report
npm run ai:index        # Build/rebuild RAG knowledge base
npm run ai:review       # Review all healing events
```

---

## 16. Project Structure

```
project-root/
|
|-- .env                          # API key (gitignored)
|-- .env.example                  # Template for new users
|-- package.json                  # Dependencies and npm scripts
|-- playwright.config.js          # Playwright + Allure + AI reporter config
|
|-- framework/
|   |-- config/
|   |   |-- test-data.config.js       # Centralized test data (URLs, credentials, search data)
|   |
|   |-- ai/
|   |   |-- config/
|   |   |   |-- ai.config.js          # AI feature flags, model names, thresholds
|   |   |
|   |   |-- core/
|   |   |   |-- openai-client.js       # OpenAI API wrapper with retry logic
|   |   |   |-- ai-client-factory.js   # Factory with optional latency tracking
|   |   |   |-- page-proxy.js          # Wraps Playwright Page for transparent healing
|   |   |   |-- locator-proxy.js       # Wraps Playwright Locator with healing on failure
|   |   |
|   |   |-- agents/                    # The 6 AI agents
|   |   |   |-- locator-healer.agent.js
|   |   |   |-- failure-analyzer.agent.js
|   |   |   |-- test-case-healer.agent.js
|   |   |   |-- drift-detection.agent.js
|   |   |   |-- flaky-test.agent.js
|   |   |   |-- exploratory.agent.js
|   |   |
|   |   |-- prompts/                   # Prompt engineering for each agent
|   |   |   |-- locator-healing.prompt.js
|   |   |   |-- failure-analysis.prompt.js
|   |   |   |-- test-case-healing.prompt.js
|   |   |   |-- drift-detection.prompt.js
|   |   |   |-- flaky-test.prompt.js
|   |   |   |-- risk-analysis.prompt.js
|   |   |   |-- exploration.prompt.js
|   |   |   |-- page-object-gen.prompt.js
|   |   |   |-- test-spec-gen.prompt.js
|   |   |
|   |   |-- graph/                     # LangGraph state machines
|   |   |   |-- exploration-graph.js   # Exploration workflow
|   |   |   |-- exploration-nodes.js
|   |   |   |-- exploration-state.js
|   |   |   |-- exploration-conditions.js
|   |   |   |-- healing-graph.js       # Post-mortem healing workflow
|   |   |   |-- runtime-graph.js       # Runtime healing workflow
|   |   |   |-- nodes.js              # Shared healing node functions
|   |   |   |-- state.js              # Shared healing state definitions
|   |   |   |-- conditions.js         # Shared routing conditions
|   |   |   |-- lifecycle-graph.js     # 6-phase lifecycle workflow
|   |   |   |-- lifecycle-nodes.js
|   |   |   |-- lifecycle-state.js
|   |   |   |-- lifecycle-conditions.js
|   |   |
|   |   |-- rag/                       # Retrieval Augmented Generation
|   |   |   |-- chroma-client.js       # Vector database (ChromaDB / JSON fallback)
|   |   |   |-- embedding-service.js   # OpenAI text embeddings
|   |   |   |-- rag-indexer.js         # Index data into vector store
|   |   |   |-- rag-retriever.js       # Similarity search
|   |   |   |-- rag-prompt-enhancer.js # Inject RAG context into prompts
|   |   |
|   |   |-- metrics/
|   |   |   |-- metrics-engine.js      # Pass@k, SHE, latency computation
|   |   |   |-- latency-tracker.js     # Per-call AI inference timing
|   |   |
|   |   |-- audit/
|   |   |   |-- audit-trail.js         # Append-only event chain with correlation IDs
|   |   |   |-- audit-report-generator.js  # Comprehensive report generation
|   |   |   |-- traceability-matrix.js     # Requirements-to-tests mapping
|   |   |
|   |   |-- storage/
|   |   |   |-- healing-history.js     # Persistent healing log and run history
|   |   |   |-- report-writer.js       # JSON report file management
|   |   |
|   |   |-- reporters/
|   |   |   |-- ai-healing-reporter.js # Playwright custom reporter for AI healing
|   |   |
|   |   |-- fixtures/
|   |   |   |-- app.ai.fixture.js      # AI-enhanced Playwright test fixture
|   |   |
|   |   |-- scripts/                   # CLI entry points
|   |       |-- explore-and-generate.js
|   |       |-- run-lifecycle.js
|   |       |-- compute-metrics.js
|   |       |-- generate-audit-report.js
|   |       |-- detect-drift.js
|   |       |-- analyze-flaky.js
|   |       |-- index-knowledge-base.js
|   |       |-- review-healing-log.js
|   |
|   |-- pages/
|   |   |-- AuthPage.js               # Manual page object (baseline app)
|   |   |-- ProductsPage.js
|   |   |-- generated/                 # AI-generated page objects (Amazon)
|   |       |-- AmazonHomePage.js
|   |       |-- AmazonLoginPage.js
|   |       |-- AmazonLanguageCurrencySettingsPage.js
|   |       |-- AmazonSignInPage.js
|   |       |-- AmazonRefNavLogoPage.js
|   |
|   |-- fixtures/
|   |   |-- app.fixture.js            # Base Playwright fixture
|   |
|   |-- flows/                         # Business flow abstractions
|   |   |-- auth/AuthFlow.js
|   |   |-- cart/CartFlow.js
|   |   |-- checkout/CheckoutFlow.js
|   |   |-- orders/OrdersFlow.js
|   |
|   |-- data/
|   |   |-- authAndCart.data.js        # Baseline test data
|   |
|   |-- utils/
|       |-- userFactory.js             # Unique user generators
|       |-- steps.js                   # Step logging utility
|       |-- runtimeInput.js            # Runtime env variable parsing
|
|-- tests/
|   |-- generated/                     # AI-generated test specs (Amazon)
|   |   |-- search-and-browse-flow.spec.js
|   |   |-- amazon-login-flow.spec.js
|   |   |-- change-preferences-flow.spec.js
|   |
|   |-- flows/                         # Manually authored test specs
|   |   |-- auth/
|   |   |   |-- register.spec.js
|   |   |   |-- register-login-flow.spec.js
|   |   |-- cart/
|   |   |   |-- add-zara-coat.spec.js
|   |   |-- checkout/
|   |       |-- order-and-checkout.spec.js
|   |
|   |-- smoke/
|       |-- basic-ui.spec.js
|       |-- example.spec.js
|
|-- ai-reports/                        # Generated reports and logs
|   |-- exploration/                   # Exploration run artifacts
|   |-- latency-log.json              # AI call timing data
|
|-- allure-results/                    # Raw Allure test results
|-- allure-report/                     # Generated Allure HTML report
|
|-- docs/
    |-- TEST_FRAMEWORK_ARCHITECTURE.md # This document
    |-- FLOW_BIFURCATION_MAP.md        # Domain-to-folder mapping guide
    |-- USER_FLOW_TEST_REQUEST.md      # Template for new test flow requests
```

---

## 17. Summary of Work Completed

### Foundation Layer
- Set up Playwright test automation framework with Page Object pattern
- Created manual tests for authentication, cart, checkout, and smoke flows
- Implemented shared fixtures, data files, and utility functions
- Configured Playwright with multi-browser support (Chrome, Firefox, WebKit)

### AI Self-Healing Core (5 Reactive Agents)
- Built the OpenAI client wrapper with retry logic and JSON parsing
- Implemented the Page Proxy and Locator Proxy using JavaScript's Proxy API for transparent healing
- Created 5 reactive AI agents: Locator Healer, Failure Analyzer, Test Case Healer, Drift Detector, Flaky Analyzer
- Engineered prompts for each agent with structured JSON output schemas
- Built the AI-enhanced Playwright fixture for easy test integration
- Created the custom AI Healing Reporter for post-mortem analysis

### LangGraph Orchestration (3 State Machines)
- Implemented the Runtime Healing Graph (real-time locator healing with strategy cycling)
- Implemented the Post-Mortem Healing Graph (failure classification and routing)
- Implemented the Lifecycle Graph (6-phase QA lifecycle orchestration)
- Defined state schemas, node functions, and conditional routing for all graphs

### Thesis Objective 1: Lifecycle Orchestration
- Implemented all 6 phases: Discovery, Strategy, Pre-Execution, Test Execution, Runtime Healing, Synthesis
- Created the lifecycle state machine with pre/post/full execution modes
- Built the discovery scanner that catalogs all framework artifacts
- Implemented AI-powered risk analysis for strategic prioritization

### Thesis Objective 2: RAG Knowledge Base
- Implemented vector embedding generation via OpenAI API
- Built a vector store with ChromaDB support and JSON-file fallback
- Created indexing pipeline for healing events, failures, page objects, and test specs
- Built the retrieval layer with cosine similarity search
- Implemented the prompt enhancer that injects RAG context into agent prompts

### Thesis Objective 3: Formal Metrics
- Implemented Pass@k computation with combinatorial formula
- Implemented Self-Healing Efficacy (SHE) calculation
- Built latency tracking that decorates every AI API call
- Created latency statistics computation (mean, median, p95, p99)
- Implemented confidence threshold analysis

### Thesis Objective 4: Audit Trail
- Built append-only event chain with unique audit IDs and correlation IDs
- Implemented provenance chain walking (trace any decision back to its origin)
- Created the traceability matrix (requirements to tests to outcomes)
- Built comprehensive audit report generation combining all subsystems

### Exploratory Agent (6th Agent -- Proactive)
- Implemented website crawling with breadth-first URL queue
- Built page structure extraction (forms, buttons, links, inputs)
- Implemented GPT-based page classification and flow identification
- Created Page Object code generation following existing code patterns
- Created test spec code generation with Allure tags
- Built the Exploration LangGraph with 7 nodes and conditional crawl loop

### Centralized Configuration and Demo Pipeline
- Created centralized test data config for one-file data management
- Updated prompt engineering to enforce config imports in generated code
- Built 7 npm demo scripts for streamlined pipeline execution
- Configured API token minimization (one-time exploration, pure Playwright execution)

### Amazon Demo Validation
- Ran exploration against Amazon.com producing 5 Page Objects and 3 test specs
- Resolved Amazon-specific challenges: multi-step login, lazy-loaded search results, bot detection redirects
- All 3 generated tests passing consistently
- Allure reports generating and displaying correctly

### Reporting
- Integrated Allure reporting with custom categories and environment info
- AI-generated tests include full Allure metadata (epic, feature, story, severity, tags)
- Configured both Playwright HTML and Allure reporters in parallel

---

## 18. References

1. **Playwright Documentation**: https://playwright.dev/
2. **LangGraph Documentation**: https://langchain-ai.github.io/langgraph/
3. **OpenAI API Reference**: https://platform.openai.com/docs/
4. **Allure Framework**: https://allurereport.org/
5. **ChromaDB**: https://www.trychroma.com/
6. **RAG (Retrieval Augmented Generation)**: Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," NeurIPS 2020
7. **Page Object Model Pattern**: Martin Fowler, https://martinfowler.com/bliki/PageObject.html
