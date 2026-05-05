/**
 * Heal-on-Failure Agent
 * 
 * This agent activates ONLY when a generated spec fails during Playwright execution.
 * It performs targeted healing:
 *   1. Reads the failure report (which selector/step failed)
 *   2. Opens browser to the failing page
 *   3. Captures fresh DOM for ONLY the broken element
 *   4. Makes 1 API call to find the correct selector
 *   5. Updates the Page Registry so future generations use the fixed selector
 *   6. Optionally patches the failing spec file
 * 
 * This is the "self-healing" in your multi-agentic framework — it's surgical,
 * not wasteful. It only runs when something breaks.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { createAIClient } = require('../core/ai-client-factory');
const { testDataConfig } = require('../../config/test-data.config');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTRY_DIR = path.join(PROJECT_ROOT, 'framework', 'pages', 'registry');
const HEALING_LOG = path.join(PROJECT_ROOT, 'ai-reports', 'healing-log.json');

/**
 * Extract DOM snapshot from page (same as nl-authoring-nodes but standalone)
 */
async function extractDOM(page) {
  return await page.evaluate(() => {
    const MAX_LENGTH = 50000;
    const elements = [];

    document.querySelectorAll('h1, h2, h3, h4').forEach(h => {
      const text = (h.textContent || '').trim().substring(0, 200);
      if (text) elements.push(`<${h.tagName.toLowerCase()} id="${h.id || ''}">${text}</${h.tagName.toLowerCase()}>`);
    });

    document.querySelectorAll('input, select, textarea').forEach(el => {
      if (['hidden'].includes(el.type)) return;
      const attrs = [];
      if (el.id) attrs.push(`id="${el.id}"`);
      if (el.name) attrs.push(`name="${el.name}"`);
      if (el.type) attrs.push(`type="${el.type}"`);
      if (el.placeholder) attrs.push(`placeholder="${el.placeholder}"`);
      if (el.getAttribute('aria-label')) attrs.push(`aria-label="${el.getAttribute('aria-label')}"`);
      elements.push(`<${el.tagName.toLowerCase()} ${attrs.join(' ')} />`);
    });

    document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]').forEach(btn => {
      const text = (btn.textContent || btn.value || '').trim().substring(0, 100);
      const attrs = [];
      if (btn.id) attrs.push(`id="${btn.id}"`);
      if (btn.className) attrs.push(`class="${(btn.className || '').toString().split(' ').slice(0, 3).join(' ')}"`);
      if (btn.getAttribute('aria-label')) attrs.push(`aria-label="${btn.getAttribute('aria-label')}"`);
      if (btn.getAttribute('ng-click')) attrs.push(`ng-click="${btn.getAttribute('ng-click')}"`);
      elements.push(`<button ${attrs.join(' ')}>${text}</button>`);
    });

    document.querySelectorAll('a[href]').forEach(a => {
      const text = (a.textContent || '').trim().substring(0, 80);
      if (!text) return;
      const attrs = [];
      if (a.id) attrs.push(`id="${a.id}"`);
      attrs.push(`href="${a.href}"`);
      elements.push(`<a ${attrs.join(' ')}>${text}</a>`);
    });

    document.querySelectorAll('p, span, div, li, label').forEach(el => {
      if (el.children.length > 2) return;
      const text = (el.textContent || '').trim().substring(0, 150);
      if (text.length > 5 && el.offsetParent !== null) {
        const attrs = [];
        if (el.id) attrs.push(`id="${el.id}"`);
        if (el.className && typeof el.className === 'string') attrs.push(`class="${el.className.split(' ').slice(0, 2).join(' ')}"`);
        elements.push(`<${el.tagName.toLowerCase()} ${attrs.join(' ')}>${text}</${el.tagName.toLowerCase()}>`);
      }
    });

    return elements.join('\n').substring(0, MAX_LENGTH);
  });
}

/**
 * Navigate to the target page state (login + navigate to the failing page).
 */
async function navigateToPage(page, targetUrl) {
  const creds = testDataConfig?.targetApp?.credentials;
  const loginUrl = testDataConfig?.targetApp?.loginUrl;

  if (loginUrl) {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Dismiss cookie
    try { await page.locator('#truste-consent-button').click({ timeout: 3000 }); } catch {}

    // Login
    try {
      await page.locator('#UsernameInput').fill(creds.email);
      await page.locator('#PasswordInput').fill(creds.password);
      await page.locator('#LoginButton').click();
      await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
      // Wait for page content
      await page.waitForSelector('#body-container-layout, [ui-view], .main-content', { timeout: 10000 }).catch(() => {});
    } catch (err) {
      console.warn(`[HEALER] Login failed: ${err.message}`);
    }

    // Dismiss popups
    try {
      const done = page.getByRole('button', { name: 'DONE' });
      if (await done.isVisible({ timeout: 3000 }).catch(() => false)) await done.click();
    } catch {}
  }

  // If target URL is different from current, navigate
  if (targetUrl && !page.url().includes(targetUrl)) {
    try { await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }); } catch {}
  }
}

/**
 * Heal a broken selector by capturing live DOM and using GPT to find the correct one.
 * 
 * @param {object} params
 * @param {string} params.elementName - Registry element name that failed (e.g., 'armHomeAllButton')
 * @param {string} params.failedSelector - The selector that didn't work
 * @param {string} params.errorMessage - The error from Playwright
 * @param {string} params.pageUrl - URL where the failure occurred
 * @param {string} params.pageName - Registry page name (e.g., 'HomePage')
 * @param {string} params.elementContext - Description of what the element does
 * @param {object} [params.preConditions] - Steps to take before looking for element (e.g., click SELECT ALL first)
 * @returns {Promise<{ healed: boolean, newSelector: string, confidence: number }>}
 */
async function healSelector({ elementName, failedSelector, errorMessage, pageUrl, pageName, elementContext, preConditions }) {
  console.log(`[HEALER] ──── Healing: ${pageName}.${elementName} ────`);
  console.log(`[HEALER] Failed selector: ${failedSelector}`);
  console.log(`[HEALER] Error: ${errorMessage}`);

  const startTime = Date.now();
  let browser, page;

  try {
    // Launch browser and navigate
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await context.newPage();

    await navigateToPage(page, pageUrl);
    console.log(`[HEALER] Navigated to: ${page.url()}`);

    // Execute pre-conditions if any (e.g., click SELECT ALL before looking for Arm Home)
    if (preConditions && preConditions.length > 0) {
      for (const pre of preConditions) {
        console.log(`[HEALER] Pre-condition: ${pre.description}`);
        try {
          const fn = new Function('page', `return (async () => { ${pre.code} })();`);
          await fn(page);
          await page.waitForTimeout(1000); // brief settle after pre-condition
        } catch (err) {
          console.warn(`[HEALER] Pre-condition failed: ${err.message}`);
        }
      }
    }

    // Capture fresh DOM
    const dom = await extractDOM(page);
    console.log(`[HEALER] DOM captured: ${dom.length} chars`);

    // Ask GPT to find the correct selector (1 API call)
    const aiClient = createAIClient({ analysisModel: 'gpt-4o' });
    const systemPrompt = `You are a Playwright selector expert. A test selector failed. Given the current DOM, find the correct Playwright selector for the target element.

RULES:
- Use semantic locators: getByRole, getByLabel, getByText (preferred)
- The selector must be a valid Playwright locator expression starting with "page."
- If the element exists with different text/attributes, provide the updated selector
- If the element is genuinely not present, say so
- Respond with JSON only

RESPOND:
{
  "found": true/false,
  "selector": "page.getByRole('button', { name: 'Exact Text' })",
  "confidence": 0.0-1.0,
  "reason": "Brief explanation of what changed"
}`;

    const userPrompt = `## Failed Element:
- Name: ${elementName}
- Failed Selector: ${failedSelector}
- Error: ${errorMessage}
- Context: ${elementContext}
- Page URL: ${page.url()}

## Current DOM:
${dom}

Find the correct selector for this element.`;

    const result = await aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
      model: 'gpt-4o',
      maxTokens: 1024,
    });

    const durationMs = Date.now() - startTime;

    if (result.found && result.confidence >= 0.7) {
      console.log(`[HEALER] ✓ Healed: ${result.selector} (confidence: ${result.confidence})`);
      console.log(`[HEALER]   Reason: ${result.reason}`);

      // Update the page registry
      updateRegistry(pageName, elementName, result.selector, result.reason);

      // Log healing event
      logHealing({
        pageName,
        elementName,
        oldSelector: failedSelector,
        newSelector: result.selector,
        reason: result.reason,
        confidence: result.confidence,
        durationMs,
      });

      return { healed: true, newSelector: result.selector, confidence: result.confidence, reason: result.reason };
    } else {
      console.log(`[HEALER] ✗ Could not heal: ${result.reason || 'Element not found'}`);
      return { healed: false, newSelector: null, confidence: result.confidence || 0, reason: result.reason };
    }
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Update a page registry file with a healed selector.
 */
function updateRegistry(pageName, elementName, newSelector, reason) {
  const regPath = path.join(REGISTRY_DIR, `${pageName}.registry.json`);
  if (!fs.existsSync(regPath)) {
    console.warn(`[HEALER] Registry not found: ${regPath}`);
    return;
  }

  const registry = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
  if (registry.elements[elementName]) {
    const old = registry.elements[elementName].selector;
    registry.elements[elementName].selector = newSelector;
    registry.elements[elementName].lastHealed = new Date().toISOString();
    registry.elements[elementName].healReason = reason;
    registry.elements[elementName].previousSelector = old;
    fs.writeFileSync(regPath, JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`[HEALER] ✓ Registry updated: ${pageName}.${elementName}`);

    // Also patch the page object file if it exists
    patchPageObject(pageName, elementName, old, newSelector);
  }
}

/**
 * Patch an existing Page Object file to use the healed selector.
 * This avoids requiring a full re-generation after healing.
 */
function patchPageObject(pageName, elementName, oldSelector, newSelector) {
  // Search common PO locations
  const searchDirs = [
    path.join(PROJECT_ROOT, 'framework', 'pages', 'generated', 'smoke'),
    path.join(PROJECT_ROOT, 'framework', 'pages', 'generated'),
  ];

  for (const dir of searchDirs) {
    const poPath = path.join(dir, `${pageName}.js`);
    if (!fs.existsSync(poPath)) continue;

    let code = fs.readFileSync(poPath, 'utf-8');
    // Extract just the locator part from "page.xxx" → "xxx" for matching within constructor
    const oldLocatorPart = oldSelector.replace(/^page\./, '');
    const newLocatorPart = newSelector.replace(/^page\./, '');

    if (code.includes(oldLocatorPart)) {
      code = code.replace(oldLocatorPart, newLocatorPart);
      fs.writeFileSync(poPath, code, 'utf-8');
      console.log(`[HEALER] ✓ Page Object patched: ${poPath}`);
      return;
    }
  }
}

/**
 * Log healing event for audit trail.
 */
function logHealing(entry) {
  entry.timestamp = new Date().toISOString();
  try {
    const existing = JSON.parse(fs.readFileSync(HEALING_LOG, 'utf-8'));
    existing.push(entry);
    fs.writeFileSync(HEALING_LOG, JSON.stringify(existing, null, 2), 'utf-8');
  } catch {
    fs.writeFileSync(HEALING_LOG, JSON.stringify([entry], null, 2), 'utf-8');
  }
}

/**
 * Parse a Playwright test failure and attempt to heal it.
 * 
 * @param {object} failure - { specFile, testName, error, failedLine }
 * @returns {Promise<{ healed: boolean, patchedSpec: boolean }>}
 */
async function healFromFailure(failure) {
  console.log(`[HEALER] Analyzing failure: ${failure.testName}`);
  console.log(`[HEALER] Error: ${failure.error.substring(0, 200)}`);

  // Extract selector from error message
  const selectorMatch = failure.error.match(/waiting for (.*?)$/m) ||
    failure.error.match(/locator\.(click|fill|isVisible)\b/) ||
    failure.error.match(/(getBy\w+\([^)]+\))/);

  if (!selectorMatch) {
    console.log(`[HEALER] Could not extract failed selector from error`);
    return { healed: false, patchedSpec: false };
  }

  // Determine which page and element failed
  // This is heuristic — in production you'd use source maps
  const failedSelector = selectorMatch[1] || selectorMatch[0];

  // Try to match against registry
  const registryFiles = fs.readdirSync(REGISTRY_DIR).filter(f => f.endsWith('.registry.json'));
  for (const file of registryFiles) {
    const reg = JSON.parse(fs.readFileSync(path.join(REGISTRY_DIR, file), 'utf-8'));
    for (const [elemName, elem] of Object.entries(reg.elements)) {
      if (elem.selector.includes(failedSelector) || failedSelector.includes(elemName)) {
        // Found the element — heal it
        const result = await healSelector({
          elementName: elemName,
          failedSelector: elem.selector,
          errorMessage: failure.error,
          pageUrl: reg.url,
          pageName: reg.pageName,
          elementContext: elem.context,
        });

        return { healed: result.healed, patchedSpec: false, ...result };
      }
    }
  }

  console.log(`[HEALER] No matching registry element found for: ${failedSelector}`);
  return { healed: false, patchedSpec: false };
}

module.exports = {
  healSelector,
  healFromFailure,
  updateRegistry,
  extractDOM,
  navigateToPage,
};
