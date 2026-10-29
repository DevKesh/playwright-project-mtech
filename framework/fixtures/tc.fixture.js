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
const { createLoginSession } = require('../utils/login-session');
const { attachFailureArtifacts } = require('../utils/test-artifacts');
const {
  attachLoadMetrics,
  assertOptionalLoadThreshold,
  measureNavigation,
} = require('../utils/pageLoadMetrics');

const test = base.test.extend({
  credentialProfile: ['approved-monitor', { option: true }],
  sessionArtifacts: [true, { option: true }],
  pageArtifacts: [true, { option: true }],
  sessionFactory: async ({}, use) => {
    await use(createLoginSession);
  },
  authenticatedSession: [async ({ credentialProfile, sessionFactory, sessionArtifacts }, use, testInfo) => {
    let options = {};
    if (credentialProfile === 'approved-monitor') {
      const username = process.env.LOGIN_MONITOR_USERNAME;
      const password = process.env.LOGIN_MONITOR_PASSWORD;
      if (!username || !password) {
        throw new Error('Authenticated tests require LOGIN_MONITOR_USERNAME and LOGIN_MONITOR_PASSWORD for the approved equipment-enabled account.');
      }
      options = { username, password };
    } else if (credentialProfile !== 'configured') {
      throw new Error(`Unknown credential profile: ${credentialProfile}`);
    }
    if (sessionArtifacts) {
      options.onFailure = page => attachFailureArtifacts(page, testInfo, {
        force: true, includeUrl: false, screenshotName: 'login-setup-failure',
      });
    }
    const session = await sessionFactory(options);
    let useFailed = false;
    try {
      await use(session);
    } catch (error) {
      useFailed = true;
      throw error;
    } finally {
      if (sessionArtifacts) await attachFailureArtifacts(session.page, testInfo, { includeUrl: false });
      try {
        await session.close();
      } catch (error) {
        if (!useFailed && testInfo.status === testInfo.expectedStatus) throw error;
        testInfo.annotations.push({ type: 'cleanup-warning', description: 'Authenticated session teardown failed after the original test failure.' });
      }
    }
  }, { timeout: 180000 }],
  authenticatedPage: async ({ authenticatedSession }, use) => {
    await use(authenticatedSession.page);
  },
  /* ── failure artifacts (screenshot + URL + HTML) ────────────────── */
  page: async ({ page, pageArtifacts }, use, testInfo) => {
    await use(page);
    if (pageArtifacts) await attachFailureArtifacts(page, testInfo);
  },

  /* ── Total Connect flow helper (not logged in) ─────────────────── */
  tc: async ({ page }, use) => {
    const { createTotalConnectFlow } = require('../flows/totalconnect/TotalConnectFlow');
    await use(createTotalConnectFlow({ page, expect: base.expect }));
  },

  /* ── Pre-logged-in TC flow helper ──────────────────────────────── */
  tcLoggedIn: async ({ page }, use) => {
    const { createTotalConnectFlow } = require('../flows/totalconnect/TotalConnectFlow');
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
