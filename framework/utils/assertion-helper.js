/**
 * Test Assertion Failure Classifier
 *
 * Provides structured, meaningful error messages for test failures.
 * Classifies failures into 3 categories:
 *
 *   1. GENUINE FAILURE  — Functionality is broken (element wrong state, assertion mismatch, business logic)
 *   2. SYNC ERROR       — Element exists but interaction blocked (spinner overlay, detached DOM, intercepted clicks)
 *   3. TIMEOUT ERROR    — Element not found or page too slow to load (network delay, missing element, navigation hung)
 *
 * Usage in page objects or test steps:
 *   const { assertVisible, assertClickable, assertNavigation, classifyAndThrow } = require('../../framework/utils/assertion-helper');
 *
 *   await assertVisible(page.locator('#my-element'), 'Dashboard widget');
 *   await assertClickable(page.locator('button'), 'Submit button');
 *   await assertNavigation(page, '/home', 'Home page after login');
 */

const { expect } = require('@playwright/test');

// ─── Failure Categories ─────────────────────────────────────────────────────

const FAILURE_CATEGORY = {
  GENUINE: 'GENUINE_FAILURE',
  SYNC: 'SYNC_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
};

const CATEGORY_LABELS = {
  [FAILURE_CATEGORY.GENUINE]: '❌ GENUINE FAILURE (Functionality Broken)',
  [FAILURE_CATEGORY.SYNC]: '🔄 SYNC ERROR (Element Blocked / DOM Detached)',
  [FAILURE_CATEGORY.TIMEOUT]: '⏱️ TIMEOUT ERROR (Slow Load / Element Not Found)',
};

// ─── Error Classification ───────────────────────────────────────────────────

/**
 * Classifies a Playwright error into one of the 3 failure categories.
 * @param {Error} error - The caught error
 * @returns {{ category: string, label: string }}
 */
function classifyError(error) {
  const msg = (error.message || '').toLowerCase();

  // SYNC errors: element exists but can't be interacted with
  if (
    msg.includes('intercepts pointer events') ||
    msg.includes('element was detached') ||
    msg.includes('element is not visible') ||
    msg.includes('element is not enabled') ||
    msg.includes('element is not stable') ||
    msg.includes('spinner') ||
    msg.includes('overlay') ||
    msg.includes('retrying click action')
  ) {
    return { category: FAILURE_CATEGORY.SYNC, label: CATEGORY_LABELS[FAILURE_CATEGORY.SYNC] };
  }

  // TIMEOUT errors: element never appeared or page never loaded
  if (
    msg.includes('timeout') ||
    msg.includes('waiting for locator') ||
    msg.includes('waiting for selector') ||
    msg.includes('navigation') && msg.includes('exceeded') ||
    msg.includes('net::err') ||
    msg.includes('page.goto') ||
    msg.includes('waiting for url')
  ) {
    return { category: FAILURE_CATEGORY.TIMEOUT, label: CATEGORY_LABELS[FAILURE_CATEGORY.TIMEOUT] };
  }

  // GENUINE: everything else — actual assertion failures, wrong values, broken logic
  return { category: FAILURE_CATEGORY.GENUINE, label: CATEGORY_LABELS[FAILURE_CATEGORY.GENUINE] };
}

// ─── Structured Error Thrower ───────────────────────────────────────────────

/**
 * Classifies an error and throws a structured failure message.
 * Use in catch blocks to provide meaningful, categorized errors.
 *
 * @param {Error} error - The original error
 * @param {string} context - What was being attempted (e.g., "Click ARM HOME button")
 * @param {object} [meta] - Additional metadata
 * @param {string} [meta.page] - Page name (e.g., "HomePage")
 * @param {string} [meta.element] - Element description
 * @param {string} [meta.expected] - What was expected
 */
function classifyAndThrow(error, context, meta = {}) {
  const { category, label } = classifyError(error);
  const platform = process.env.EXECUTION_PLATFORM || 'local';

  const parts = [
    `\n┌─────────────────────────────────────────────────────────`,
    `│ ${label}`,
    `├─────────────────────────────────────────────────────────`,
    `│ Action:   ${context}`,
  ];

  if (meta.page) parts.push(`│ Page:     ${meta.page}`);
  if (meta.element) parts.push(`│ Element:  ${meta.element}`);
  if (meta.expected) parts.push(`│ Expected: ${meta.expected}`);
  parts.push(`│ Platform: ${platform === 'lambda' ? 'LambdaTest Cloud' : 'Local'}`);
  parts.push(`│ Original: ${error.message.split('\n')[0]}`);
  parts.push(`└─────────────────────────────────────────────────────────\n`);

  const structured = new Error(parts.join('\n'));
  structured.category = category;
  structured.originalError = error;
  throw structured;
}

// ─── Assertion Helpers ──────────────────────────────────────────────────────

/**
 * Assert an element is visible within timeout. Throws categorized error on failure.
 * @param {import('@playwright/test').Locator} locator
 * @param {string} description - Human-readable element name
 * @param {object} [options]
 * @param {number} [options.timeout] - Override timeout (ms)
 * @param {string} [options.page] - Page name for error context
 */
async function assertVisible(locator, description, options = {}) {
  try {
    await expect(locator).toBeVisible({ timeout: options.timeout || 15000 });
  } catch (error) {
    classifyAndThrow(error, `Verify "${description}" is visible`, {
      page: options.page,
      element: description,
      expected: 'Element should be visible on the page',
    });
  }
}

/**
 * Assert an element is clickable (visible + enabled + no overlay). Throws categorized error on failure.
 * @param {import('@playwright/test').Locator} locator
 * @param {string} description - Human-readable element name
 * @param {object} [options]
 * @param {number} [options.timeout] - Override timeout (ms)
 * @param {string} [options.page] - Page name for error context
 */
async function assertClickable(locator, description, options = {}) {
  try {
    await locator.click({ timeout: options.timeout || 15000, trial: true });
  } catch (error) {
    classifyAndThrow(error, `Click "${description}"`, {
      page: options.page,
      element: description,
      expected: 'Element should be clickable (visible, enabled, no overlay)',
    });
  }
}

/**
 * Assert page navigates to expected URL pattern. Throws categorized error on failure.
 * @param {import('@playwright/test').Page} page
 * @param {string|RegExp} urlPattern - Expected URL pattern
 * @param {string} description - Where we expected to navigate
 * @param {object} [options]
 * @param {number} [options.timeout] - Override timeout (ms)
 * @param {string} [options.fromPage] - Page we navigated from
 */
async function assertNavigation(page, urlPattern, description, options = {}) {
  try {
    await page.waitForURL(urlPattern, { timeout: options.timeout || 30000 });
  } catch (error) {
    classifyAndThrow(error, `Navigate to "${description}"`, {
      page: options.fromPage,
      element: `URL: ${urlPattern}`,
      expected: `Page should navigate to ${urlPattern}`,
    });
  }
}

/**
 * Assert element has expected text content. Throws categorized error on failure.
 * @param {import('@playwright/test').Locator} locator
 * @param {string|RegExp} expected - Expected text
 * @param {string} description - Human-readable element name
 * @param {object} [options]
 * @param {number} [options.timeout] - Override timeout (ms)
 * @param {string} [options.page] - Page name for error context
 */
async function assertText(locator, expected, description, options = {}) {
  try {
    if (expected instanceof RegExp) {
      await expect(locator).toHaveText(expected, { timeout: options.timeout || 15000 });
    } else {
      await expect(locator).toContainText(expected, { timeout: options.timeout || 15000 });
    }
  } catch (error) {
    classifyAndThrow(error, `Verify text of "${description}"`, {
      page: options.page,
      element: description,
      expected: `Should contain: "${expected}"`,
    });
  }
}

/**
 * Wrap any async action with failure classification.
 * Use for custom actions that don't fit the specific helpers above.
 *
 * @param {Function} action - Async function to execute
 * @param {string} context - Description of what's being attempted
 * @param {object} [meta] - Additional metadata for error message
 *
 * @example
 *   await withFailureContext(
 *     () => page.locator('#spinner').waitFor({ state: 'hidden', timeout: 10000 }),
 *     'Wait for loading spinner to disappear',
 *     { page: 'HomePage', element: 'Loading spinner' }
 *   );
 */
async function withFailureContext(action, context, meta = {}) {
  try {
    return await action();
  } catch (error) {
    classifyAndThrow(error, context, meta);
  }
}

module.exports = {
  FAILURE_CATEGORY,
  CATEGORY_LABELS,
  classifyError,
  classifyAndThrow,
  assertVisible,
  assertClickable,
  assertNavigation,
  assertText,
  withFailureContext,
};
