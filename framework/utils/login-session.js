/**
 * Login Session Utility
 *
 * Provides a single function to launch a browser, login to TC2, and return
 * a fully authenticated session ready for business logic testing.
 *
 * Handles all known quirks of the QA app:
 *   - Cookie consent banner blocking page load
 *   - Slow SPA rendering on local network
 *   - "Signing in..." intermediate state before home page renders
 *   - Cookie/notification popups after login
 *
 * Usage (in any test file):
 *
 *   const { createLoginSession } = require('../../framework/utils/login-session');
 *
 *   test.describe('My Business Logic Tests', () => {
 *     let session;
 *
 *     test.beforeAll(async () => {
 *       test.setTimeout(180000);
 *       session = await createLoginSession();
 *     });
 *
 *     test.afterAll(async () => {
 *       await session.close();
 *     });
 *
 *     test('my test', async () => {
 *       const { page } = session;
 *       // page is on /home, fully loaded, ready for interaction
 *       await page.getByRole('button', { name: 'Cameras' }).click();
 *     });
 *   });
 */

const { launchBrowser } = require('./browser-launcher');
const { testDataConfig } = require('../config/test-data.config');

/**
 * Create an authenticated session — launches browser, logs in, and waits
 * for the home page to fully render.
 *
 * @param {object} [options]
 * @param {string} [options.username] - Override username (defaults to .env credentials)
 * @param {string} [options.password] - Override password (defaults to .env credentials)
 * @param {object} [options.launchOptions] - Override browser launch options (headless, channel, slowMo)
 * @returns {Promise<{ browser, context, page, close: () => Promise<void> }>}
 */
async function createLoginSession(options = {}) {
  const { browser, context, page } = await launchBrowser(options.launchOptions);

  const loginUrl = testDataConfig.targetApp.loginUrl;
  const username = options.username || testDataConfig.targetApp.credentials.email;
  const password = options.password || testDataConfig.targetApp.credentials.password;

  // 1. Navigate to login page (commit = fastest, server responded)
  await page.goto(loginUrl, { waitUntil: 'commit' });

  // 2. Handle cookie consent — may block the app JS bundle from loading
  const cookieOk = page.locator('#truste-consent-button');
  const cookieAccept = page.getByRole('button', { name: 'ACCEPT ALL' });
  try {
    await Promise.race([
      cookieOk.waitFor({ state: 'visible', timeout: 30000 }),
      cookieAccept.waitFor({ state: 'visible', timeout: 30000 }),
      page.getByLabel('Username').waitFor({ state: 'visible', timeout: 30000 }),
    ]);
    if (await cookieAccept.isVisible().catch(() => false)) await cookieAccept.click();
    else if (await cookieOk.isVisible().catch(() => false)) await cookieOk.click();
  } catch {
    // Neither appeared in 30s — continue
  }

  // 3. Wait for login form to render
  await page.getByLabel('Username').waitFor({ state: 'visible', timeout: 60000 });

  // 4. Submit credentials
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // 5. Wait for URL to change to /home
  await page.waitForURL('**/home', { timeout: 45000, waitUntil: 'commit' });

  // 6. Wait for home page content to ACTUALLY render (not just URL change)
  await page.getByRole('button', { name: 'Devices' }).first().waitFor({ state: 'visible', timeout: 45000 });

  // 7. Dismiss any remaining popups
  const dismissPopup = async (locator, timeout = 3000) => {
    if (await locator.isVisible({ timeout }).catch(() => false)) {
      await locator.click();
    }
  };
  await dismissPopup(page.locator('#truste-consent-button'));
  await dismissPopup(page.getByRole('button', { name: 'DONE' }));

  console.log('[LoginSession] Authenticated and home page ready');

  return {
    browser,
    context,
    page,
    /** Close the browser session */
    async close() {
      if (browser) await browser.close();
    },
  };
}

module.exports = { createLoginSession };
