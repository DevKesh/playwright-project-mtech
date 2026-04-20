/**
 * Total Connect test fixture
 *
 * Provides pre-logged-in `tc` flow helper and `perf` utilities so that
 * spec files only contain the navigation-under-test — no boilerplate.
 *
 * Usage in a spec:
 *   const { test, expect } = require('../../framework/fixtures/tc.fixture');
 */

const base = require('@playwright/test');
const allure = require('allure-js-commons');
const { createTotalConnectFlow } = require('../flows/totalconnect/TotalConnectFlow');
const {
  attachLoadMetrics,
  assertOptionalLoadThreshold,
  measureNavigation,
} = require('../utils/pageLoadMetrics');

const test = base.test.extend({
  /* ── failure artifacts (screenshot + URL + HTML) ────────────────── */
  page: async ({ page }, use, testInfo) => {
    await use(page);

    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
        if (screenshot) {
          await testInfo.attach('failure-screenshot', { body: screenshot, contentType: 'image/png' });
        }
        await testInfo.attach('failure-url', { body: page.url(), contentType: 'text/plain' });
        const html = await page.content().catch(() => null);
        if (html) {
          await testInfo.attach('failure-page-source', { body: html, contentType: 'text/html' });
        }
      } catch { /* browser may already be closed */ }
    }
  },

  /* ── Total Connect flow helper (not logged in) ─────────────────── */
  tc: async ({ page }, use) => {
    await use(createTotalConnectFlow({ page, expect: base.expect }));
  },

  /* ── Pre-logged-in TC flow helper ──────────────────────────────── */
  tcLoggedIn: async ({ page }, use) => {
    const tc = createTotalConnectFlow({ page, expect: base.expect });
    await tc.loginWithConfiguredUser();
    await use(tc);
  },

  /* ── Performance measurement helpers bundled together ───────────── */
  perf: async ({}, use) => {
    await use({ measureNavigation, attachLoadMetrics, assertOptionalLoadThreshold });
  },
});

module.exports = { test, expect: base.expect };
