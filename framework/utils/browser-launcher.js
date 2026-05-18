/**
 * Browser Launcher Utility
 * 
 * Centralized browser launch logic — reads settings from .env via runtime config.
 * Spec files call this instead of chromium.launch() directly.
 *
 * Usage:
 *   const { launchBrowser } = require('../../framework/utils/browser-launcher');
 *
 *   test.beforeAll(async () => {
 *     const session = await launchBrowser();
 *     browser = session.browser;
 *     context = session.context;
 *     page = session.page;
 *   });
 */

const { chromium } = require('@playwright/test');

function getConfig() {
  // Read directly from process.env (already populated by dotenv/config in playwright.config.js)
  const isCI = process.env.CI === 'true';

  return {
    headless: process.env.HEADLESS !== undefined
      ? process.env.HEADLESS === 'true'
      : isCI,
    channel: process.env.BROWSER_CHANNEL || 'chrome',
    slowMo: parseInt(process.env.SLOW_MO || '0', 10),
  };
}

/**
 * Launch a browser with settings from .env / CI environment.
 * Returns { browser, context, page } ready to use.
 *
 * @param {object} [options] - Override any launch option
 * @param {boolean} [options.headless] - Override headless setting
 * @param {string} [options.channel] - Override browser channel
 * @param {number} [options.slowMo] - Override slowMo
 * @returns {Promise<{ browser: import('@playwright/test').Browser, context: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page }>}
 */
async function launchBrowser(options = {}) {
  const config = getConfig();

  const launchOptions = {
    headless: options.headless !== undefined ? options.headless : config.headless,
    channel: options.channel || config.channel,
    slowMo: options.slowMo !== undefined ? options.slowMo : config.slowMo,
  };

  console.log(`[BrowserLauncher] Launching ${launchOptions.channel} | headless=${launchOptions.headless} | slowMo=${launchOptions.slowMo}`);

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext();
  const page = await context.newPage();

  return { browser, context, page };
}

module.exports = { launchBrowser };
