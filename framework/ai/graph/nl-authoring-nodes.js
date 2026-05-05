/**
 * NL Authoring Nodes: node functions for the natural language test authoring graph.
 *
 * Flow: parseInstructions → launchBrowser → executeStep* → generateArtifacts → writeFiles → END
 *
 * This is the core engine that:
 * 1. Takes plain English test instructions
 * 2. Parses them into structured steps via GPT
 * 3. Opens a real browser and executes each step
 * 4. Records every action with selectors and IST timestamps
 * 5. Generates page objects + test specs from the recording
 *
 * Optimization: DOM snapshots are cached per URL. If the page URL has not
 * changed since the last extraction the cached snapshot is reused, avoiding
 * a redundant DOM scan and saving GPT input tokens on repeat interactions.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { createAIClient } = require('../core/ai-client-factory');
const {
  buildParseInstructionsPrompt,
  buildResolveActionPrompt,
  buildRecordedActionsToPageObjectPrompt,
  buildRecordedActionsToSpecPrompt,
} = require('../prompts/nl-test-authoring.prompt');
const { writeReport } = require('../storage/report-writer');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// ── DOM Snapshot Cache ─────────────────────────────────────────────
// Keyed by normalised URL. Reused when URL hasn't changed between steps.
const SNAPSHOT_CACHE_DIR = path.join(PROJECT_ROOT, 'ai-reports', 'nl-authoring', 'snapshot-cache');

const _snapshotMemory = {};  // { url → { snapshot, timestamp } }

/**
 * Persist a snapshot to disk so it survives across separate CLI runs.
 */
function _persistSnapshot(url, snapshot) {
  try {
    fs.mkdirSync(SNAPSHOT_CACHE_DIR, { recursive: true });
    const key = Buffer.from(url).toString('base64url').substring(0, 120);
    const payload = { url, snapshot, savedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(SNAPSHOT_CACHE_DIR, `${key}.json`), JSON.stringify(payload, null, 2), 'utf-8');
  } catch { /* best-effort */ }
}

/**
 * Try to load a cached snapshot from disk.
 * @returns {string|null}
 */
function _loadPersistedSnapshot(url) {
  try {
    const key = Buffer.from(url).toString('base64url').substring(0, 120);
    const filePath = path.join(SNAPSHOT_CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    // Expire disk cache after 1 hour (prevent stale post-login snapshots)
    if (Date.now() - new Date(data.savedAt).getTime() > 60 * 60 * 1000) return null;
    return data.snapshot;
  } catch { return null; }
}

/**
 * Remove a persisted disk snapshot for a given URL.
 * Called after login/navigation to ensure fresh DOM capture.
 */
function _invalidateDiskSnapshot(url) {
  try {
    const key = Buffer.from(url).toString('base64url').substring(0, 120);
    const filePath = path.join(SNAPSHOT_CACHE_DIR, `${key}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* best-effort */ }
}

// ── IST Timestamp Helper ──────────────────────────────────────────

/**
 * Return the current time in HH:MM:SS IST format.
 */
function istTimestamp() {
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

let testDataConfig = {};
try {
  testDataConfig = require('../../config/test-data.config').testDataConfig;
} catch {
  // Config not yet created
}

/**
 * Read a framework file to use as a pattern example.
 */
function readPatternExample(relativePath) {
  try {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf-8');
  } catch {
    return '// Pattern example not available';
  }
}

/**
 * Extract a compact DOM snapshot suitable for GPT.
 * Uses an in-memory + disk cache keyed by URL.  If the current URL matches
 * a previous extraction the cached value is returned immediately, saving
 * both page-evaluate overhead and GPT input tokens.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [opts]
 * @param {boolean} [opts.forceRefresh] - Ignore cache and re-extract.
 * @returns {Promise<{snapshot: string, fromCache: boolean}>}
 */
async function extractDOMSnapshot(page, opts = {}) {
  const currentUrl = page.url();

  // 1. Check in-memory cache (same process / same run)
  if (!opts.forceRefresh && _snapshotMemory[currentUrl]) {
    return { snapshot: _snapshotMemory[currentUrl].snapshot, fromCache: true };
  }

  // 2. Check disk cache (previous runs)
  if (!opts.forceRefresh) {
    const persisted = _loadPersistedSnapshot(currentUrl);
    if (persisted) {
      _snapshotMemory[currentUrl] = { snapshot: persisted, timestamp: Date.now() };
      return { snapshot: persisted, fromCache: true };
    }
  }

  // 3. Fresh extraction
  let snapshot;
  try {
    snapshot = await page.evaluate(() => {
      const MAX_LENGTH = 50000;
      const elements = [];

      // Headings
      document.querySelectorAll('h1, h2, h3, h4').forEach(h => {
        const text = (h.textContent || '').trim().substring(0, 200);
        if (text) elements.push(`<${h.tagName.toLowerCase()} id="${h.id || ''}">${text}</${h.tagName.toLowerCase()}>`);
      });

      // Form fields
      document.querySelectorAll('input, select, textarea').forEach(el => {
        if (['hidden'].includes(el.type)) return;
        const attrs = [];
        if (el.id) attrs.push(`id="${el.id}"`);
        if (el.name) attrs.push(`name="${el.name}"`);
        if (el.type) attrs.push(`type="${el.type}"`);
        if (el.placeholder) attrs.push(`placeholder="${el.placeholder}"`);
        if (el.getAttribute('aria-label')) attrs.push(`aria-label="${el.getAttribute('aria-label')}"`);
        const label = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
        if (label) attrs.push(`label="${(label.textContent || '').trim().substring(0, 50)}"`);
        elements.push(`<${el.tagName.toLowerCase()} ${attrs.join(' ')} />`);
      });

      // Buttons
      document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]').forEach(btn => {
        const text = (btn.textContent || btn.value || '').trim().substring(0, 100);
        const attrs = [];
        if (btn.id) attrs.push(`id="${btn.id}"`);
        if (btn.className) attrs.push(`class="${(btn.className || '').toString().split(' ').slice(0, 3).join(' ')}"`);
        if (btn.getAttribute('aria-label')) attrs.push(`aria-label="${btn.getAttribute('aria-label')}"`);
        elements.push(`<button ${attrs.join(' ')}>${text}</button>`);
      });

      // Links
      document.querySelectorAll('a[href]').forEach(a => {
        const text = (a.textContent || '').trim().substring(0, 80);
        if (!text) return;
        const attrs = [];
        if (a.id) attrs.push(`id="${a.id}"`);
        attrs.push(`href="${a.href}"`);
        const isNav = !!a.closest('nav, [role="navigation"], header, .navbar, .nav');
        if (isNav) attrs.push('data-nav="true"');
        elements.push(`<a ${attrs.join(' ')}>${text}</a>`);
      });

      // Tables (headers)
      document.querySelectorAll('table').forEach(t => {
        const headers = Array.from(t.querySelectorAll('th')).map(th => (th.textContent || '').trim()).join(' | ');
        const rows = t.querySelectorAll('tbody tr').length;
        if (headers) elements.push(`<table headers="${headers}" rows="${rows}" />`);
      });

      // Visible text blocks
      document.querySelectorAll('p, span, div, li').forEach(el => {
        if (el.children.length > 2) return; // Skip containers
        const text = (el.textContent || '').trim().substring(0, 150);
        if (text.length > 10 && el.offsetParent !== null) {
          elements.push(`<${el.tagName.toLowerCase()}>${text}</${el.tagName.toLowerCase()}>`);
        }
      });

      return elements.join('\n').substring(0, MAX_LENGTH);
    });
  } catch (err) {
    return { snapshot: `DOM extraction failed: ${err.message}`, fromCache: false };
  }

  // Store in caches
  _snapshotMemory[currentUrl] = { snapshot, timestamp: Date.now() };
  _persistSnapshot(currentUrl, snapshot);

  return { snapshot, fromCache: false };
}

/**
 * Resolve testDataConfig references in values.
 * e.g. "testDataConfig.targetApp.credentials.email" → actual value
 */
function resolveValue(valueSource, literalValue) {
  if (!valueSource || valueSource === 'literal') return literalValue;

  try {
    const path = valueSource.replace('testDataConfig.', '').split('.');
    let val = testDataConfig;
    for (const key of path) {
      val = val[key];
      if (val === undefined) return literalValue;
    }
    return String(val);
  } catch {
    return literalValue;
  }
}

/**
 * Create all NL authoring node functions.
 */
function createNLAuthoringNodes(config) {
  const aiClient = createAIClient(config);

  /**
   * Minimal page settle — just waits for DOM to be parsed.
   * Playwright's locator auto-waiting handles element readiness, so we
   * do NOT need networkidle or loader detection.  This keeps execution fast.
   *
   * @param {import('@playwright/test').Page} page
   * @param {object} [opts]
   * @param {number} [opts.timeout] - ms to wait for domcontentloaded (default 5000)
   */
  async function ensurePageSettled(page, opts = {}) {
    const { timeout = 5000 } = opts;
    try {
      await page.waitForLoadState('domcontentloaded', { timeout });
    } catch { /* proceed */ }
  }

  /**
   * Phase 1: Parse natural language instructions into structured steps.
   */
  async function parseInstructions(state) {
    console.log(`[NL-AUTHOR] [${istTimestamp()}] Phase 1: Parsing natural language instructions...`);
    console.log(`[NL-AUTHOR] [${istTimestamp()}]   Instructions: "${state.instructions.substring(0, 100)}${state.instructions.length > 100 ? '...' : ''}"`);

    const { systemPrompt, userPrompt } = buildParseInstructionsPrompt({
      instructions: state.instructions,
      testDataConfig,
    });

    const parsed = await aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
      model: config.analysisModel,
      maxTokens: 4096,
    });

    console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Test: "${parsed.testTitle}"`);
    console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Steps parsed: ${parsed.steps.length}`);
    parsed.steps.forEach((s, i) => {
      console.log(`[NL-AUTHOR] [${istTimestamp()}]     ${i + 1}. [${s.action}] ${s.description}`);
    });

    return {
      parsedInstructions: parsed,
      pendingSteps: parsed.steps,
      currentStepIndex: 0,
      currentPhase: 'execute',
    };
  }

  /**
   * Phase 2: Launch browser and navigate to the base URL.
   */
  async function launchBrowser(state) {
    console.log(`[NL-AUTHOR] [${istTimestamp()}] Phase 2: Launching browser...`);

    const browser = await chromium.launch({ headless: !state.headed });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    // Navigate to base URL if provided and first step isn't a navigate
    const firstStep = state.pendingSteps[0];
    const baseUrl = state.baseUrl || testDataConfig?.targetApp?.baseUrl;

    if (baseUrl && (!firstStep || firstStep.action !== 'navigate')) {
      console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Navigating to base URL: ${baseUrl}`);
      try {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (err) {
        console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Navigation warning: ${err.message}`);
      }
    }

    // Auto-login if requested
    if (state.autoLogin) {
      const creds = testDataConfig?.targetApp?.credentials;
      if (creds && creds.email && creds.password) {
        console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Auto-login: Attempting login with configured credentials...`);
        try {
          const loginUrl = testDataConfig?.targetApp?.loginUrl;
          if (loginUrl) {
            await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
          }

          // Try to dismiss cookie consent
          try {
            await page.locator('#truste-consent-button').click({ timeout: 3000 });
          } catch { /* no consent */ }

          const userSelectors = ['#UsernameInput', '#username', 'input[name="username"]', 'input[name="email"]', '#email'];
          const passSelectors = ['#PasswordInput', '#password', 'input[name="password"]', 'input[type="password"]'];
          const submitSelectors = ['#LoginButton', '#loginButton', 'button[type="submit"]', 'input[type="submit"]'];

          let filled = false;
          for (const sel of userSelectors) {
            if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
              await page.locator(sel).first().fill(creds.email);
              filled = true;
              break;
            }
          }
          if (filled) {
            for (const sel of passSelectors) {
              if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
                await page.locator(sel).first().fill(creds.password);
                break;
              }
            }
            for (const sel of submitSelectors) {
              if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
                await page.locator(sel).first().click();
                break;
              }
            }
            try {
              await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
              await ensurePageSettled(page);
              // Wait for actual page content to render (not just URL change)
              // The app shows "Signing in..." briefly before rendering the real page
              try {
                await page.waitForSelector('#body-container-layout, [ui-view], .main-content, nav, [role="navigation"]', { timeout: 10000 });
              } catch { /* proceed — page may use different layout markers */ }
              // Invalidate any stale disk-cached DOM snapshot for this URL
              const postLoginUrl = page.url();
              delete _snapshotMemory[postLoginUrl];
              _invalidateDiskSnapshot(postLoginUrl);
              console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Auto-login: Success — now at ${postLoginUrl}`);
            } catch {
              console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Auto-login: URL did not change — login may have failed`);
            }
          }
        } catch (err) {
          console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Auto-login error: ${err.message}`);
        }
      }
    }

    console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Browser ready at: ${page.url()}`);

    return {
      browser,
      page,
      currentPhase: 'execute',
    };
  }

  /**
   * Phase 3: Execute a single step — GPT reads the DOM, determines the action, Playwright executes it.
   */
  async function executeStep(state) {
    const stepIndex = state.currentStepIndex;
    const step = state.pendingSteps[stepIndex];

    if (!step) {
      return { currentPhase: 'generate', currentStepIndex: stepIndex };
    }

    const stepStartTime = istTimestamp();
    console.log(`[NL-AUTHOR] [${stepStartTime}] ──── Step ${step.stepNumber}/${state.pendingSteps.length} ────`);
    console.log(`[NL-AUTHOR] [${stepStartTime}]   Action:      ${step.action}`);
    console.log(`[NL-AUTHOR] [${stepStartTime}]   Description: ${step.description}`);
    if (step.target) console.log(`[NL-AUTHOR] [${stepStartTime}]   Target:      ${step.target}`);
    if (step.value) console.log(`[NL-AUTHOR] [${stepStartTime}]   Value:       ${step.valueSource && step.valueSource !== 'literal' ? step.valueSource : step.value}`);

    const page = state.page;
    let actionResult = null;

    try {
      // For navigate actions, go directly
      if (step.action === 'navigate') {
        const url = step.urlPattern || step.value || state.baseUrl || testDataConfig?.targetApp?.baseUrl;
        if (url && url.startsWith('http')) {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          // Invalidate snapshot cache — new page loaded
          delete _snapshotMemory[page.url()];
          actionResult = {
            stepNumber: step.stepNumber,
            action: step.action,
            description: step.description,
            playwrightCode: `await page.goto('${url}', { waitUntil: 'domcontentloaded' });`,
            selector: null,
            selectorStrategy: null,
            elementName: null,
            expectedPage: step.expectedPage,
            success: true,
            timestamp: istTimestamp(),
          };
          console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Navigated to: ${page.url()}`);
        }
      }
      // For screenshot actions, take screenshot directly
      else if (step.action === 'screenshot') {
        const screenshotDir = path.join(PROJECT_ROOT, 'ai-reports', 'nl-authoring');
        fs.mkdirSync(screenshotDir, { recursive: true });
        const screenshotPath = path.join(screenshotDir, `step-${step.stepNumber}.png`);
        await page.screenshot({ fullPage: true, path: screenshotPath });
        actionResult = {
          stepNumber: step.stepNumber,
          action: step.action,
          description: step.description,
          playwrightCode: `await page.screenshot({ fullPage: true });`,
          selector: null,
          selectorStrategy: null,
          elementName: null,
          expectedPage: step.expectedPage,
          success: true,
          timestamp: istTimestamp(),
        };
        console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Screenshot saved: ${screenshotPath}`);
      }
      // For all other actions, use GPT to resolve the selector and action
      else {
        // Get DOM snapshot (cached if URL unchanged)
        const { snapshot: domSnapshot, fromCache: snapshotCached } = await extractDOMSnapshot(page);
        if (snapshotCached) {
          console.log(`[NL-AUTHOR] [${istTimestamp()}]   → DOM snapshot: reused from cache (saved tokens)`);
        } else {
          console.log(`[NL-AUTHOR] [${istTimestamp()}]   → DOM snapshot: freshly extracted (${domSnapshot.length} chars)`);
        }
        const currentUrl = page.url();
        const pageTitle = await page.title();

        const { systemPrompt, userPrompt } = buildResolveActionPrompt({
          step,
          domSnapshot,
          currentUrl,
          pageTitle,
          previousActions: state.recordedActions,
          preferredLocators: state.preferredLocators,
        });

        const resolution = await aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
          model: config.analysisModel,
          maxTokens: 2048,
        });

        console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Resolved: ${resolution.playwrightCode}`);
        console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Selector:   ${resolution.selectorStrategy}(${resolution.selector})`);
        console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Confidence: ${resolution.confidence}`);

        if (resolution.confidence < 0.3) {
          console.log(`[NL-AUTHOR] [${istTimestamp()}]   ⚠ Low confidence (${resolution.confidence}) — ${resolution.notes}`);
        }

        // Execute the resolved Playwright code — Playwright auto-waits for element actionability
        let execSuccess = false;
        let execError = null;
        let usedFallback = false;

        try {
          let codeToExecute = resolution.playwrightCode;

          const asyncFn = new Function('page', 'expect', 'testDataConfig',
            `return (async () => { ${codeToExecute} })();`
          );
          const { expect } = require('@playwright/test');
          await asyncFn(page, expect, testDataConfig);

          execSuccess = true;
        } catch (primaryErr) {
          execError = primaryErr;

          // Try fallback code if available
          if (resolution.fallbackCode) {
            console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Primary failed, trying fallback: ${resolution.fallbackCode}`);
            try {
              const fallbackFn = new Function('page', 'expect', 'testDataConfig',
                `return (async () => { ${resolution.fallbackCode} })();`
              );
              const { expect } = require('@playwright/test');
              await fallbackFn(page, expect, testDataConfig);
              execSuccess = true;
              usedFallback = true;
              execError = null;
            } catch (fallbackErr) {
              execError = fallbackErr;
            }
          }
        }

        // Determine assertion verdict
        const isAssertionStep = resolution.isAssertion ||
          ['assert_visible', 'assert_text', 'assert_url'].includes(step.action);

        let assertionVerdict = null;  // null for non-assertion steps
        if (isAssertionStep) {
          assertionVerdict = execSuccess ? 'PASS' : 'FAIL';
        }

        // Log result with proper PASS/FAIL for assertions
        if (execSuccess) {
          if (isAssertionStep) {
            console.log(`[NL-AUTHOR] [${istTimestamp()}]   → ✓ ASSERTION PASSED: ${step.description}${usedFallback ? ' (via fallback)' : ''}`);
          } else {
            console.log(`[NL-AUTHOR] [${istTimestamp()}]   → ✓ Action executed successfully${usedFallback ? ' (via fallback)' : ''}`);
          }
        } else {
          if (isAssertionStep) {
            console.log(`[NL-AUTHOR] [${istTimestamp()}]   → ✗ ASSERTION FAILED: ${step.description}`);
            console.log(`[NL-AUTHOR] [${istTimestamp()}]   → ✗ Reason: ${execError?.message || 'Unknown error'}`);
          } else {
            console.log(`[NL-AUTHOR] [${istTimestamp()}]   → ✗ Action failed: ${execError?.message || 'Unknown error'}`);
          }
        }

        // Invalidate snapshot cache after DOM-mutating actions so next step gets fresh DOM
        if (['click', 'fill', 'select', 'press', 'navigate'].includes(step.action)) {
          // After click, the URL might change (login submit, navigation)
          // Give the page a moment to settle so next DOM extraction is accurate
          try { await ensurePageSettled(page, { timeout: 3000 }); } catch { /* proceed */ }
          const currentUrl = page.url();
          delete _snapshotMemory[currentUrl];
          _invalidateDiskSnapshot(currentUrl);
        }

        const stepEndTime = istTimestamp();
        actionResult = {
          stepNumber: step.stepNumber,
          action: step.action,
          description: step.description,
          playwrightCode: usedFallback ? resolution.fallbackCode : resolution.playwrightCode,
          selector: resolution.selector,
          selectorStrategy: resolution.selectorStrategy,
          elementName: resolution.elementName,
          isAssertion: isAssertionStep,
          assertionVerdict,              // 'PASS' | 'FAIL' | null (non-assertion)
          expectedPage: step.expectedPage,
          confidence: resolution.confidence,
          success: execSuccess,
          usedFallback,
          error: execError ? execError.message : null,
          currentUrl: page.url(),
          timestamp: stepEndTime,
          startedAt: stepStartTime,
          completedAt: stepEndTime,
          snapshotCached: snapshotCached,
        };

        console.log(`[NL-AUTHOR] [${stepEndTime}]   → Step ${step.stepNumber} ${execSuccess ? 'completed' : 'failed'}${isAssertionStep ? ` | Assertion: ${assertionVerdict}` : ''} | started: ${stepStartTime} | finished: ${stepEndTime}`);
      }
    } catch (err) {
      const failTime = istTimestamp();
      console.log(`[NL-AUTHOR] [${failTime}]   → ✗ Step failed: ${err.message}`);
      actionResult = {
        stepNumber: step.stepNumber,
        action: step.action,
        description: step.description,
        playwrightCode: `// Failed: ${err.message}`,
        selector: null,
        selectorStrategy: null,
        elementName: null,
        expectedPage: step.expectedPage,
        success: false,
        error: err.message,
        timestamp: failTime,
        startedAt: stepStartTime,
        completedAt: failTime,
      };
    }

    // Capture page snapshot after step
    let snapshot = null;
    try {
      snapshot = {
        stepNumber: step.stepNumber,
        url: page.url(),
        title: await page.title(),
        timestamp: istTimestamp(),
      };
    } catch { /* browser may be closed */ }

    return {
      recordedActions: actionResult ? [actionResult] : [],
      pageSnapshots: snapshot ? [snapshot] : [],
      currentStepIndex: stepIndex + 1,
    };
  }

  /**
   * Phase 4: Generate page objects and test spec from recorded actions.
   */
  async function generateArtifacts(state) {
    console.log(`[NL-AUTHOR] [${istTimestamp()}] Phase 4: Generating Page Objects and Test Spec from recording...`);

    // Log execution summary
    const successCount = state.recordedActions.filter(a => a.success).length;
    const failCount = state.recordedActions.filter(a => !a.success).length;
    const cachedCount = state.recordedActions.filter(a => a.snapshotCached).length;
    const assertionSteps = state.recordedActions.filter(a => a.isAssertion);
    const assertionsPassed = assertionSteps.filter(a => a.assertionVerdict === 'PASS').length;
    const assertionsFailed = assertionSteps.filter(a => a.assertionVerdict === 'FAIL').length;
    console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Execution summary: ${successCount} passed, ${failCount} failed, ${cachedCount} cache-hits`);
    if (assertionSteps.length > 0) {
      console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Assertions:        ${assertionsPassed} PASSED, ${assertionsFailed} FAILED (${assertionSteps.length} total)`);
    }

    const recordedActions = state.recordedActions;
    const parsed = state.parsedInstructions;

    // Close browser
    if (state.browser) {
      try { await state.browser.close(); } catch { /* ignore */ }
    }

    // Group actions by page (based on expectedPage or URL changes)
    const pageGroups = {};
    let currentPageName = 'MainPage';

    for (const action of recordedActions) {
      if (action.expectedPage && action.expectedPage !== 'Same page') {
        currentPageName = action.expectedPage.replace(/\s+/g, '');
      }
      if (!pageGroups[currentPageName]) {
        pageGroups[currentPageName] = {
          name: currentPageName,
          url: action.currentUrl || state.baseUrl,
          actions: [],
        };
      }
      pageGroups[currentPageName].actions.push(action);
    }

    // Read pattern examples
    const poPattern = readPatternExample('framework/pages/generated/TotalConnect2LoginPage.js')
      || readPatternExample('framework/pages/AuthPage.js');
    const specPattern = readPatternExample('tests/generated/login-flow.spec.js')
      || readPatternExample('tests/flows/auth/auth-flow.spec.js');

    // Generate page objects for each page group
    const generatedPOs = [];
    for (const [pageName, group] of Object.entries(pageGroups)) {
      // Skip pages with no meaningful actions (only navigate/screenshot)
      const meaningfulActions = group.actions.filter(a => a.selector || a.isAssertion);
      if (meaningfulActions.length === 0 && group.actions.every(a => a.action === 'navigate' || a.action === 'screenshot')) {
        continue;
      }

      console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Generating PO: ${pageName} (${group.actions.length} actions)`);

      try {
        const { systemPrompt, userPrompt } = buildRecordedActionsToPageObjectPrompt({
          recordedActions: group.actions,
          pageName,
          pageUrl: group.url || state.baseUrl,
          patternExample: poPattern,
          preferredLocators: state.preferredLocators,
        });

        const poResult = await aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
          model: config.analysisModel,
          maxTokens: 4096,
        });

        generatedPOs.push(poResult);
        console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Generated: ${poResult.className} (${(poResult.methods || []).length} methods)`);
      } catch (err) {
        console.log(`[NL-AUTHOR] [${istTimestamp()}]   → PO generation error for ${pageName}: ${err.message}`);
      }
    }

    // Generate test spec
    let generatedSpec = null;
    try {
      console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Generating test spec...`);
      const { systemPrompt, userPrompt } = buildRecordedActionsToSpecPrompt({
        parsedInstructions: parsed,
        recordedActions,
        pageObjects: generatedPOs,
        patternExample: specPattern,
        testDataConfig,
      });

      generatedSpec = await aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
        model: config.analysisModel,
        maxTokens: 8192,
      });

      console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Generated: ${generatedSpec.fileName} (${(generatedSpec.testCases || []).length} test cases)`);
    } catch (err) {
      console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Spec generation error: ${err.message}`);
    }

    return {
      generatedPageObjects: generatedPOs,
      generatedTestSpecs: generatedSpec ? [generatedSpec] : [],
      currentPhase: 'write',
      browser: null,
      page: null,
    };
  }

  /**
   * Phase 5: Write generated files to disk.
   */
  async function writeFiles(state) {
    console.log(`[NL-AUTHOR] [${istTimestamp()}] Phase 5: Writing generated files...`);

    // Use custom output dirs from suite config, or default paths
    const poDir = state.pagesDir
      ? path.resolve(PROJECT_ROOT, state.pagesDir)
      : path.join(PROJECT_ROOT, 'framework', 'pages', 'generated');
    const specDir = state.outputDir
      ? path.resolve(PROJECT_ROOT, state.outputDir)
      : path.join(PROJECT_ROOT, 'tests', 'generated');
    fs.mkdirSync(poDir, { recursive: true });
    fs.mkdirSync(specDir, { recursive: true });

    // Write page objects
    for (const po of state.generatedPageObjects) {
      if (!po.code || !po.fileName) continue;
      // Guard: reject placeholder code that GPT echoed from the prompt example
      if (po.code.length < 50 || !po.code.includes('class ')) {
        console.log(`[NL-AUTHOR] [${istTimestamp()}]   ⚠ Skipped PO ${po.fileName} — GPT returned placeholder instead of real code`);
        continue;
      }
      const filePath = path.join(poDir, po.fileName);
      fs.writeFileSync(filePath, po.code, 'utf-8');
      console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Wrote PO: framework/pages/generated/${po.fileName}`);
    }

    // Write test specs
    for (const spec of state.generatedTestSpecs) {
      if (!spec.code || !spec.fileName) continue;
      // Guard: reject placeholder code that GPT echoed from the prompt example
      if (spec.code.length < 80 || !spec.code.includes('test(')) {
        console.log(`[NL-AUTHOR] [${istTimestamp()}]   ⚠ Skipped spec ${spec.fileName} — GPT returned placeholder instead of real code`);
        continue;
      }
      const filePath = path.join(specDir, spec.fileName);
      fs.writeFileSync(filePath, spec.code, 'utf-8');
      console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Wrote spec: tests/generated/${spec.fileName}`);
    }

    // Write recording report
    try {
      const report = {
        timestamp: new Date().toISOString(),
        instructions: state.instructions,
        parsedInstructions: state.parsedInstructions,
        recordedActions: state.recordedActions,
        pageSnapshots: state.pageSnapshots,
        generatedPageObjects: state.generatedPageObjects.map(po => ({
          className: po.className,
          fileName: po.fileName,
          methods: po.methods,
          locators: po.locators,
        })),
        generatedTestSpecs: state.generatedTestSpecs.map(spec => ({
          fileName: spec.fileName,
          testCases: spec.testCases,
        })),
        errors: state.errors,
      };
      writeReport('nl-authoring', `recording-${Date.now()}`, report);
    } catch (err) {
      console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Report write warning: ${err.message}`);
    }

    // Write step-by-step action log as a separate human-readable report
    try {
      const actionLogPath = path.join(PROJECT_ROOT, 'ai-reports', 'nl-authoring', `action-log-${Date.now()}.txt`);
      const logLines = [
        `NL Test Authoring — Action Log`,
        `Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
        `Instructions: ${state.instructions}`,
        `${'─'.repeat(70)}`,
        '',
      ];

      // Summary counts
      const logAssertions = state.recordedActions.filter(a => a.isAssertion);
      const logPassed = logAssertions.filter(a => a.assertionVerdict === 'PASS').length;
      const logFailed = logAssertions.filter(a => a.assertionVerdict === 'FAIL').length;
      const logActions = state.recordedActions.filter(a => !a.isAssertion);
      const logActionsOk = logActions.filter(a => a.success).length;
      const logActionsFail = logActions.filter(a => !a.success).length;
      logLines.push(`SUMMARY`);
      logLines.push(`  Total steps:        ${state.recordedActions.length}`);
      logLines.push(`  Actions:            ${logActionsOk} passed, ${logActionsFail} failed`);
      logLines.push(`  Assertions:         ${logPassed} PASSED, ${logFailed} FAILED (${logAssertions.length} total)`);
      logLines.push(`${'─'.repeat(70)}`);
      logLines.push('');

      for (const a of state.recordedActions) {
        const status = a.isAssertion
          ? (a.assertionVerdict === 'PASS' ? '✓ ASSERTION PASSED' : '✗ ASSERTION FAILED')
          : (a.success ? '✓ PASS' : '✗ FAIL');
        logLines.push(`[${a.timestamp || '??:??:??'}] Step ${a.stepNumber} — ${status}`);
        logLines.push(`  Action:      ${a.action}`);
        logLines.push(`  Description: ${a.description}`);
        if (a.selector) logLines.push(`  Selector:    ${a.selectorStrategy}(${a.selector})`);
        if (a.playwrightCode) logLines.push(`  Code:        ${a.playwrightCode}`);
        if (a.confidence != null) logLines.push(`  Confidence:  ${a.confidence}`);
        if (a.isAssertion) logLines.push(`  Verdict:     ${a.assertionVerdict}`);
        if (a.usedFallback) logLines.push(`  Fallback:    used (primary selector failed)`);
        if (a.startedAt) logLines.push(`  Started:     ${a.startedAt} IST`);
        if (a.completedAt) logLines.push(`  Completed:   ${a.completedAt} IST`);
        if (a.snapshotCached) logLines.push(`  Snapshot:    reused from cache`);
        if (a.error) logLines.push(`  Error:       ${a.error}`);
        logLines.push('');
      }
      fs.mkdirSync(path.dirname(actionLogPath), { recursive: true });
      fs.writeFileSync(actionLogPath, logLines.join('\n'), 'utf-8');
      console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Wrote action log: ${path.relative(PROJECT_ROOT, actionLogPath)}`);
    } catch (err) {
      console.log(`[NL-AUTHOR] [${istTimestamp()}]   → Action log write warning: ${err.message}`);
    }

    return { currentPhase: 'done' };
  }

  return {
    parseInstructions,
    launchBrowser,
    executeStep,
    generateArtifacts,
    writeFiles,
  };
}

module.exports = { createNLAuthoringNodes };
