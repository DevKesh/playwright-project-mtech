/**
 * Popup Interceptor: detects and dismisses unexpected popups, modals, banners,
 * and overlays that block test actions.
 *
 * Two modes:
 *   1. Pattern-based (fast, no AI) — tries a list of known dismiss selectors
 *   2. AI-powered (fallback) — takes a DOM snapshot, asks GPT to find the dismiss button
 *
 * Usage:
 *   const { dismissPopups } = require('./popupInterceptor');
 *   const dismissed = await dismissPopups(page);           // pattern only
 *   const dismissed = await dismissPopups(page, aiClient); // pattern + AI fallback
 */

// Common selectors for popup dismiss/close buttons (ordered by specificity)
const KNOWN_DISMISS_SELECTORS = [
  // Cookie consent banners
  '#truste-consent-button',
  '#onetrust-accept-btn-handler',
  '#cookie-accept',
  'button[id*="cookie"][id*="accept"]',
  'button[id*="consent"]',
  '[class*="cookie"] button:has-text("Accept")',
  '[class*="cookie"] button:has-text("OK")',
  '[class*="cookie"] button:has-text("Got it")',

  // App-specific dialogs (Total Connect)
  '.md-dialog-container button:has-text("LATER")',
  '.md-dialog-container button:has-text("DONE")',
  '.md-dialog-container button:has-text("OK")',
  '.md-dialog-container button:has-text("Close")',

  // Generic close buttons (X icons)
  '[aria-label="Close"]',
  '[aria-label="close"]',
  '[aria-label="Dismiss"]',
  'button.close',
  '.modal .close',
  '.modal-close',
  '[data-dismiss="modal"]',
  '.dialog-close',

  // Common modal/dialog dismiss patterns
  '.modal-footer button:has-text("OK")',
  '.modal-footer button:has-text("Close")',
  '.modal-footer button:has-text("Got it")',
  '.modal-footer button:has-text("Dismiss")',
  'button:has-text("No thanks")',
  'button:has-text("Maybe later")',
  'button:has-text("Not now")',
  'button:has-text("Skip")',

  // Overlay/backdrop close areas
  '.modal-backdrop',
];

// Selectors that indicate a blocking overlay is present
const OVERLAY_INDICATORS = [
  '.modal.show',
  '.modal.in',
  '[role="dialog"]:visible',
  '.overlay:visible',
  '[class*="popup"]:visible',
  '[class*="modal"]:visible',
  '.MuiDialog-root',
  '.ant-modal-wrap',
];

/**
 * Try to dismiss any visible popup/modal/banner using known patterns.
 * Returns details of what was dismissed, or null if nothing found.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{selector: string, method: string}|null>}
 */
async function dismissByPattern(page) {
  for (const selector of KNOWN_DISMISS_SELECTORS) {
    try {
      const el = page.locator(selector).first();
      // Use a short timeout — we're just scanning, not waiting
      const visible = await el.isVisible({ timeout: 500 }).catch(() => false);
      if (visible) {
        await el.click({ timeout: 2000 });
        // Small wait for animation to complete
        await page.waitForTimeout(300);
        console.log(`[POPUP-INTERCEPT] Dismissed popup via pattern: ${selector}`);
        return { selector, method: 'pattern' };
      }
    } catch {
      // Selector didn't match or click failed — move on
    }
  }
  return null;
}

/**
 * Check if a blocking overlay/modal is currently visible on the page.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
async function hasBlockingOverlay(page) {
  // Check via evaluate for speed (single round-trip)
  return page.evaluate(() => {
    // Look for elements with high z-index covering the viewport
    const elements = document.querySelectorAll(
      '.modal, [role="dialog"], [class*="popup"], [class*="overlay"], [class*="modal"]'
    );
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      if (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity) > 0 &&
        el.offsetHeight > 100
      ) {
        return true;
      }
    }
    return false;
  }).catch(() => false);
}

/**
 * AI-powered popup dismissal: extracts the DOM around the overlay,
 * asks GPT to identify the dismiss/close element, then clicks it.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} aiClient - The AIClient instance (from ai-client-factory)
 * @param {object} config - AI config
 * @returns {Promise<{selector: string, method: string}|null>}
 */
async function dismissByAI(page, aiClient, config) {
  if (!aiClient) return null;

  try {
    // Extract a focused DOM snapshot of overlaying elements
    const overlayDOM = await page.evaluate(() => {
      function serialize(el, depth) {
        if (depth > 6) return '';
        const tag = el.tagName?.toLowerCase();
        if (!tag || ['script', 'style', 'noscript', 'svg'].includes(tag)) return '';

        const attrs = [];
        for (const attr of ['id', 'class', 'role', 'aria-label', 'type', 'data-testid', 'data-dismiss']) {
          if (el.hasAttribute(attr)) {
            attrs.push(`${attr}="${el.getAttribute(attr)}"`);
          }
        }
        const text = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
          ? el.childNodes[0].textContent.trim().substring(0, 50)
          : '';

        const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
        const textStr = text ? text : '';
        const indent = '  '.repeat(depth);

        const children = Array.from(el.children)
          .map(c => serialize(c, depth + 1))
          .filter(Boolean)
          .join('\n');

        if (children) {
          return `${indent}<${tag}${attrStr}>${textStr}\n${children}\n${indent}</${tag}>`;
        }
        return `${indent}<${tag}${attrStr}>${textStr}</${tag}>`;
      }

      // Find the overlay container
      const overlays = document.querySelectorAll(
        '.modal, [role="dialog"], [class*="popup"], [class*="overlay"], [class*="modal"]'
      );
      const visible = Array.from(overlays).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 50;
      });

      if (visible.length === 0) return null;
      return visible.map(el => serialize(el, 0)).join('\n---\n');
    });

    if (!overlayDOM) return null;

    // Ask GPT to find the dismiss button
    const systemPrompt = `You are a test automation assistant. Given a DOM snippet of a popup/modal/overlay, identify the best CSS selector to click to dismiss/close it. Return JSON: {"selector": "css-selector-here", "reasoning": "brief explanation"}. If no dismiss button exists, return {"selector": null, "reasoning": "..."}. Prefer button clicks over backdrop clicks.`;

    const userPrompt = `An unexpected popup appeared during a Playwright test. Here is the DOM of the overlay:\n\n${overlayDOM}\n\nWhat CSS selector should I click to dismiss this popup?`;

    const result = await aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
      model: config.healingModel || 'gpt-4o-mini',
    });

    if (result?.selector) {
      const el = page.locator(result.selector).first();
      const visible = await el.isVisible({ timeout: 2000 }).catch(() => false);
      if (visible) {
        await el.click({ timeout: 3000 });
        await page.waitForTimeout(300);
        console.log(
          `[POPUP-INTERCEPT] AI dismissed popup via: ${result.selector} (${result.reasoning})`
        );
        return { selector: result.selector, method: 'ai', reasoning: result.reasoning };
      }
    }
  } catch (err) {
    console.log(`[POPUP-INTERCEPT] AI dismissal failed: ${err.message}`);
  }
  return null;
}

/**
 * Main entry: try to dismiss any blocking popup.
 * First tries known patterns (fast), then falls back to AI (if provided).
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [aiClient] - Optional AIClient for AI fallback
 * @param {object} [config] - Optional AI config
 * @returns {Promise<{selector: string, method: string, reasoning?: string}|null>}
 */
async function dismissPopups(page, aiClient, config) {
  // Quick check: is there even an overlay?
  const hasOverlay = await hasBlockingOverlay(page);
  if (!hasOverlay) {
    // Still try known banners (cookie consent etc. may not match overlay check)
    return dismissByPattern(page);
  }

  // Try pattern-based dismissal first (fast)
  const patternResult = await dismissByPattern(page);
  if (patternResult) return patternResult;

  // Fall back to AI-powered dismissal
  return dismissByAI(page, aiClient, config);
}

module.exports = { dismissPopups, dismissByPattern, dismissByAI, hasBlockingOverlay };
