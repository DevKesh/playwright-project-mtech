# AI Self-Healing Framework — Technical Reference (Q&A)

> Important technical points about the Multi-Agentic AI Self-Healing Test Automation Framework.
> Use this as a quick reference for thesis defense, demos, and documentation.

---

## 1. On what basis does the AI recommend a specific locator fix?

The `TestCaseHealerAgent` (`framework/ai/agents/test-case-healer.agent.js`) sends **three key pieces of context** to GPT-4o:

| Context | Source | Purpose |
|---------|--------|---------|
| **Full test source code** | Reads the `.spec.js` file | Understands the test flow and where the failure occurred |
| **All imported page objects** | Follows `require()` imports one level deep | Sees every locator definition in the page object |
| **Error message + stack trace** | Playwright failure output | Contains the exact failing selector string |

### How the recommendation works (example)

When `camerasNav` breaks (`span.navLabel` instead of `span.menuName`):

1. **Error message** tells the AI: `locator('span.navLabel').filter({ hasText: 'Cameras' }) — element(s) not found`
2. **Page object source** shows the AI that line 10 has `span.navLabel` while **9 other locators** in the same file all use `span.menuName`
3. The AI recognizes the pattern inconsistency — one locator deviates from the established convention — and recommends changing `span.navLabel` → `span.menuName`

The AI is **not guessing**. It has the actual source code, sees the pattern, and makes a targeted recommendation based on the codebase context.

### Additional context sources (when RAG is enabled)

- **Past failure reports** — similar failures that occurred before and how they were resolved
- **Past healing events** — previous locator fixes from `healing-log.json`
- These are fetched via similarity search from the vector store and injected into the prompt as `ragContext`

---

## 2. On what basis is the confidence score calculated?

The confidence score is **self-assessed by the LLM** as part of a structured JSON response. The prompt explicitly requires:

```json
{
  "confidence": 0.0-1.0
}
```

### What influences the confidence value

The LLM evaluates its own certainty based on:

- **Clarity of the error** — A Playwright error that literally names the failing selector (`locator('span.navLabel')...not found`) gives high confidence (0.9) because the diagnosis is unambiguous
- **Strength of the evidence** — When 9 other locators in the same file use `span.menuName` and only the broken one uses `span.navLabel`, the fix is obvious → high confidence
- **Complexity of the fix** — Simple locator replacements get higher confidence than multi-file flow changes

### Where confidence is used as a hard gate

| Agent | Threshold | Behavior |
|-------|-----------|----------|
| Runtime Locator Healer | `0.7` (configurable via `AI_HEALING_CONFIDENCE_THRESHOLD`) | Suggestions below 0.7 are **skipped entirely** — the healer won't even try them on the live page |
| Failure Classifier | No hard gate | Confidence is recorded for audit trail and reporting |
| Test Case Healer | No hard gate | Confidence is recorded; human decides whether to act on it |

### Typical confidence values observed

| Scenario | Classification Confidence | Healing Confidence |
|----------|--------------------------|-------------------|
| Clear locator mismatch (selector not found) | 0.85–0.95 | 0.85–0.95 |
| Assertion text changed | 0.75–0.85 | 0.70–0.85 |
| Ambiguous timeout (could be network or app) | 0.50–0.65 | N/A (skipped) |

---

## 3. How does the AI know it's exactly that locator that's broken?

Three signals converge to pinpoint the exact broken locator:

### Signal 1: Playwright Error Message (Direct Evidence)

Playwright errors are highly specific. They name the exact failing selector:

```
locator('span.navLabel').filter({ hasText: 'Cameras' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found
```

This **directly identifies** which locator failed and what was expected.

### Signal 2: Source Code Analysis (Contextual Evidence)

The Failure Analyzer reads:
- The **test spec file** — to see which step failed and what page object method was called
- The **page object file** — to see the locator definition on the exact line

It can see that `camerasNav` on line 10 uses `span.navLabel` while **every other nav locator** uses `span.menuName`. This inconsistency pattern is a strong signal.

### Signal 3: Stack Trace (Execution Evidence)

The stack trace points to the exact line in the spec where the assertion failed:

```
at security-panel-flow.spec.js:XX
  → calls homePage.camerasNav
    → defined in TotalConnectHomePage.js:10
```

The agent traces the failure from the test step → page object method → locator definition.

### Why it doesn't blame other things

The system prompt instructs the AI to categorize failures into specific buckets: `locator_broken`, `assertion_mismatch`, `timeout`, `network_error`, `data_issue`, `app_bug`, `test_logic_error`, `environment_issue`. Given:
- The error says "element(s) not found" → not an assertion mismatch or network error
- The selector string is explicitly named → not a timeout or environment issue
- The locator pattern is inconsistent with the rest of the file → `locator_broken`

The classification prompt also asks for `affectedLocator` as a required field, forcing the AI to be explicit about which selector is the problem.

---

## 4. How much do AI tokens cost for this? Is it expensive?

### Per-failure cost breakdown

Each time a test fails and healing is triggered, **two API calls** are made:

| Step | Model | Est. Input Tokens | Est. Output Tokens | Approx. Cost |
|------|-------|-------------------|-------------------|--------------|
| Failure Classification | `gpt-4o` | 2,000–3,000 | ~500 | $0.01–0.02 |
| Test Case Healing | `gpt-4o` | 3,000–5,000 (includes source code) | ~500 | $0.02–0.03 |
| **Total per failure** | | | | **$0.03–0.05** |

### Cost optimization settings in the framework

| Setting | Value | Impact |
|---------|-------|--------|
| `temperature` | `0.2` | Minimizes randomness, reduces token waste from verbose outputs |
| `maxTokens` | `4096` | Caps response size |
| `response_format` | `json_object` | Forces structured output, prevents prose |
| Runtime healing model | `gpt-4o-mini` | Uses the cheaper model for real-time locator healing |
| Post-mortem analysis model | `gpt-4o` | Uses capable model only for deeper analysis |
| Passing tests | No API calls | Zero cost when tests pass — AI only activates on failures |

### Real-world cost projections

| Scenario | Failures/Run | Runs/Day | Monthly Cost (est.) |
|----------|-------------|----------|-------------------|
| Dev local (your demo) | 1 | 5 | ~$7.50 |
| CI pipeline (small team) | 2–3 | 10 | ~$45–75 |
| CI pipeline (large team) | 5–10 | 20 | ~$150–300 |

**Bottom line:** For a 9-test suite with 1 failure, each run costs about **5 cents**. Running the full demo cycle 100 times would cost ~$5. This is negligible compared to developer time spent manually debugging locator failures.

### Optional: RAG embedding costs

If `AI_RAG_ENABLED=true`:
- Embedding model: `text-embedding-3-small` — **$0.00002 per 1K tokens**
- Indexing page objects and test specs is a one-time cost
- Query embeddings per failure: ~500 tokens = ~$0.00001
- Effectively free

---

## 5. Is LangGraph, RAG, or ChromaDB used? In what capacity?

### LangGraph — Core Orchestration Layer

The framework has **two compiled LangGraph state graphs**:

#### Graph 1: Post-Mortem Healing Graph

**File:** `framework/ai/graph/healing-graph.js`
**When:** Runs after a test has already failed (in the Playwright reporter's `onTestEnd()`)

```
START → classifyFailure → [conditional route] → healTestCase OR reportOnly → summarize → END
```

| Node | What it does |
|------|-------------|
| `classifyFailure` | Calls `FailureAnalyzerAgent.analyze()`, writes failure report, sets category + confidence |
| `healTestCase` | Calls `TestCaseHealerAgent.analyze()`, writes healing suggestions for human review |
| `reportOnly` | Logs that the category is not healable (e.g., network/timeout), sets decision to `skipped_healing` |
| `summarize` | Sets final decision: `healing_suggested` or `analyzed_only` |

**Conditional routing** (defined in `framework/ai/graph/conditions.js`):

| Failure Category | Route | Rationale |
|-----------------|-------|-----------|
| `locator_broken`, `element_not_found` | → `healTestCase` | Locator issues are fixable |
| `assertion_mismatch`, `data_issue`, `app_bug` | → `healTestCase` | May need test code updates |
| `network_error`, `timeout`, `unknown` | → `reportOnly` | Infrastructure issues — not healable by test changes |

#### Graph 2: Runtime Healing Graph

**File:** `framework/ai/graph/runtime-graph.js`
**When:** Runs during live test execution when a locator action fails

```
START → tryHealLocator → [loop] → nextStrategy → tryHealLocator → ... → END
```

Cycles through strategies: `css` → `role` → `text` (max 3 attempts). Uses `gpt-4o-mini` for speed. Validates each suggestion against the live page before accepting.

### RAG (Retrieval-Augmented Generation) — Historical Memory

**Files:** `framework/ai/rag/`
**Status:** Built and integrated, **off by default** (`AI_RAG_ENABLED=true` to enable)

| Component | File | Purpose |
|-----------|------|---------|
| Vector Store Client | `chroma-client.js` | Abstracts ChromaDB; falls back to local JSON store |
| Embedding Service | `embedding-service.js` | Generates embeddings via OpenAI `text-embedding-3-small` |
| Indexer | `rag-indexer.js` | Indexes data into 4 collections |
| Retriever | `rag-retriever.js` | Top-K similarity search |
| Prompt Enhancer | `rag-prompt-enhancer.js` | Injects retrieved context into agent prompts |

#### 4 Vector Store Collections

| Collection | What's Indexed | Used By |
|------------|---------------|---------|
| `healing-events` | Past locator healing attempts from `healing-log.json` | Locator Healer Agent |
| `failure-reports` | Post-mortem failure analysis reports | Failure Analyzer Agent |
| `page-objects` | Page object source code | All agents |
| `test-specs` | Test spec source code | Test Case Healer Agent |

#### How RAG enhances prompts

1. Query string (e.g., the error message) is **embedded** using `text-embedding-3-small`
2. **Similarity search** finds the top-K most relevant past entries
3. Results are formatted with relevance scores: `(relevance: 0.85)`
4. Injected as `ragContext` into the agent's prompt
5. The AI can reference past failures and fixes to make better recommendations

### ChromaDB — Vector Database

**Primary:** ChromaDB via `chromadb` npm package (requires ChromaDB server running)
**Fallback:** Local JSON file-based store in `ai-reports/chromadb/` — implements cosine similarity in pure Node.js. No external server needed.

This fallback ensures the framework works out-of-the-box without requiring ChromaDB infrastructure, while supporting the full ChromaDB experience when available.

---

## Architecture Summary

```
Test Execution (Playwright)
    │
    ├── Test Passes → No AI involvement (zero cost)
    │
    └── Test Fails
         │
         ├── Runtime Healing Graph (LangGraph)
         │   └── LocatorHealerAgent (gpt-4o-mini)
         │       └── Tries CSS → Role → Text strategies
         │       └── Validates against live DOM
         │
         └── Post-Mortem Healing Graph (LangGraph)
             ├── classifyFailure → FailureAnalyzerAgent (gpt-4o)
             │   └── Reads: error, stack, source code, page objects, [RAG context]
             │   └── Outputs: category, rootCause, confidence, affectedLocator
             │
             └── healTestCase → TestCaseHealerAgent (gpt-4o)
                 └── Reads: test source, page objects, error, [RAG context]
                 └── Outputs: suggestedChanges[], confidence, analysis
                 └── HUMAN DECIDES whether to apply the fix
```

### Key Differentiator: Human-in-the-Loop

Unlike blind self-healing frameworks that silently fix and show green:

1. AI **diagnoses** the failure with full audit trail
2. AI **recommends** fixes with confidence scores
3. **Human reviews** the recommendations in the Allure report
4. Human **decides**: apply the fix, log a ticket, or discuss with the team
5. Complete **traceability**: every recommendation is logged with Run ID, Correlation ID, and timestamp

**AI is the advisor. Human is the decision maker.**

---

## Configuration Quick Reference

| Env Variable | Default | Purpose |
|-------------|---------|---------|
| `AI_HEALING_ENABLED` | `false` | Master switch |
| `AI_HEALING_MODEL` | `gpt-4o-mini` | Runtime locator healing |
| `AI_ANALYSIS_MODEL` | `gpt-4o` | Failure classification + test case healing |
| `AI_EMBEDDING_MODEL` | `text-embedding-3-small` | RAG embeddings |
| `AI_HEALING_CONFIDENCE_THRESHOLD` | `0.7` | Min confidence to try a locator fix |
| `AI_HEALING_MAX_RETRIES` | `2` | Max retry count |
| `AI_MAX_DOM_LENGTH` | `60000` | DOM snapshot truncation limit |
| `AI_RAG_ENABLED` | `false` | Enable RAG with vector store |
| `AI_METRICS_ENABLED` | `true` | Track latency metrics |
| `AI_AUDIT_ENABLED` | `true` | Record audit trail events |
