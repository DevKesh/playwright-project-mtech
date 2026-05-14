/**
 * Shared utility: Waits for any loading indicators to disappear before proceeding.
 * 
 * This SPA (Total Connect 2) shows various loaders like "Loading devices", 
 * "Loading cameras", spinners, and progress indicators. Tests MUST wait for 
 * these to disappear before asserting content.
 *
 * Usage:
 *   const { waitForPageReady } = require('../../utils/waitForPageReady');
 *   await waitForPageReady(page);
 */

/**
 * Common loader selectors found in the TC2 SPA.
 * Add new patterns here as they're discovered.
 */
const LOADER_PATTERNS = [
  // Text-based loaders (e.g., "Loading devices", "Loading cameras", "Loading...")
  'text=/Loading/i',
  // Material Design circular progress spinners
  'md-progress-circular',
  // Common CSS class patterns for spinners/loaders
  '[class*="spinner"]',
  '[class*="loader"]',
  '[class*="loading"]',
  '[class*="progress"]',
  // Role-based progress indicators
  '[role="progressbar"]',
];

/**
 * Waits until all visible loaders/spinners disappear from the page.
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {object} options
 * @param {number} options.timeout - Max time to wait for loaders to disappear (default 30s)
 * @param {number} options.stabilityDelay - Extra wait after loaders disappear to ensure page is stable (default 500ms)
 */
async function waitForPageReady(page, { timeout = 30000, stabilityDelay = 500 } = {}) {
  const startTime = Date.now();

  for (const pattern of LOADER_PATTERNS) {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(timeout - elapsed, 1000);

    try {
      const locator = page.locator(pattern).first();
      const isVisible = await locator.isVisible().catch(() => false);

      if (isVisible) {
        // Loader found — wait for it to disappear
        await locator.waitFor({ state: 'hidden', timeout: remaining });
      }
    } catch {
      // Timeout waiting for this loader to disappear — continue checking others
      // (the page may just be genuinely slow)
    }
  }

  // Brief stability delay — ensures any post-loader re-renders complete
  if (stabilityDelay > 0) {
    await page.waitForTimeout(stabilityDelay);
  }
}

module.exports = { waitForPageReady, LOADER_PATTERNS };
