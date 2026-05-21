/**
 * Browser Launcher Utility
 * 
 * Centralized browser launch logic — reads settings from .env via runtime config.
 * Supports two execution modes:
 *   - LOCAL (default): launches Chrome on local machine via chromium.launch()
 *   - LAMBDA: connects to LambdaTest cloud via chromium.connect() over CDP
 *
 * Toggle via EXECUTION_PLATFORM env var ('local' | 'lambda').
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
 * Build LambdaTest WSS endpoint URL with capabilities.
 * @returns {string} WebSocket URL for chromium.connect()
 */
function buildLambdaTestEndpoint() {
  const username = process.env.LT_USERNAME;
  const accessKey = process.env.LT_ACCESS_KEY;

  if (!username || !accessKey) {
    throw new Error(
      '[BrowserLauncher] LambdaTest credentials missing. Set LT_USERNAME and LT_ACCESS_KEY in .env'
    );
  }

  const capabilities = {
    browserName: process.env.LT_BROWSER || 'Chrome',
    browserVersion: process.env.LT_BROWSER_VERSION || 'latest',
    'LT:Options': {
      platform: process.env.LT_PLATFORM || 'Windows 11',
      build: process.env.LT_BUILD_NAME || (() => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const script = process.env.npm_lifecycle_event || '';
        let suite = 'Full Test Run';
        if (script.includes('smoke')) suite = 'Smoke Suite (8 TCs)';
        else if (script.includes('plan')) suite = 'Test Plan - All Tagged';
        else if (script.includes('regression')) suite = 'Regression Suite';
        else if (script.includes('heal')) suite = 'AI Healing Run';
        return `TotalConnect QA - ${suite} - ${dateStr} ${timeStr}`;
      })(),
      name: process.env.LT_TEST_NAME || 'Playwright Test',
      project: process.env.LT_PROJECT_NAME || 'TC2-Automation',
      resolution: process.env.LT_RESOLUTION || '1920x1080',
      user: username,
      accessKey: accessKey,
      video: process.env.LT_VIDEO !== 'false',
      console: process.env.LT_CONSOLE !== 'false',
      network: process.env.LT_NETWORK !== 'false',
      tunnel: process.env.LT_TUNNEL === 'true',
      ...(process.env.LT_TUNNEL_NAME ? { tunnelName: process.env.LT_TUNNEL_NAME } : {}),
      playwrightClientVersion: require('@playwright/test/package.json').version,
    },
  };

  const encodedCaps = encodeURIComponent(JSON.stringify(capabilities));
  return `wss://cdp.lambdatest.com/playwright?capabilities=${encodedCaps}`;
}

/**
 * Launch a browser — locally or on LambdaTest cloud depending on EXECUTION_PLATFORM.
 * Returns { browser, context, page } ready to use.
 *
 * @param {object} [options] - Override any launch option
 * @param {boolean} [options.headless] - Override headless setting (local only)
 * @param {string} [options.channel] - Override browser channel (local only)
 * @param {number} [options.slowMo] - Override slowMo (local only)
 * @returns {Promise<{ browser: import('@playwright/test').Browser, context: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page }>}
 */
async function launchBrowser(options = {}) {
  const platform = process.env.EXECUTION_PLATFORM || 'local';

  let browser;

  if (platform === 'lambda') {
    // ─── LambdaTest Cloud Execution ─────────────────────────────────────────
    const wssEndpoint = buildLambdaTestEndpoint();
    console.log(`[BrowserLauncher] Connecting to LambdaTest Cloud...`);
    console.log(`[BrowserLauncher] Build: ${process.env.LT_BUILD_NAME || `TC2-${new Date().toISOString().slice(0, 10)}`} | Project: ${process.env.LT_PROJECT_NAME || 'TC2-Automation'}`);

    browser = await chromium.connect(wssEndpoint, {
      timeout: 60000, // 60s connection timeout for cloud
    });

    console.log(`[BrowserLauncher] Connected to LambdaTest successfully`);
  } else {
    // ─── Local Execution (default — unchanged behavior) ─────────────────────
    const config = getConfig();

    const launchOptions = {
      headless: options.headless !== undefined ? options.headless : config.headless,
      channel: options.channel || config.channel,
      slowMo: options.slowMo !== undefined ? options.slowMo : config.slowMo,
      args: ['--start-maximized'],
    };

    console.log(`[BrowserLauncher] Launching ${launchOptions.channel} | headless=${launchOptions.headless} | slowMo=${launchOptions.slowMo} | maximized`);

    browser = await chromium.launch(launchOptions);
  }

  // Local: viewport null = use full maximized window. Lambda: explicit resolution (viewport:null not supported on cloud CDP)
  const contextOptions = platform === 'lambda'
    ? { viewport: { width: 1920, height: 1080 } }
    : { viewport: null };
  const context = await browser.newContext(contextOptions);

  // Pre-inject cookie consent cookies to bypass the "We Value Your Privacy" banner.
  // Covers both TrustArc and OneTrust implementations.
  await context.addCookies([
    {
      name: 'notice_behavior',
      value: 'implied,eu',
      domain: '.totalconnect2.com',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 86400 * 365,
    },
    {
      name: 'truste.eu.cookie.notice_gdpr_pr498',
      value: '2',
      domain: '.totalconnect2.com',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 86400 * 365,
    },
    {
      name: 'notice_gdpr_pr498',
      value: '1,2',
      domain: '.totalconnect2.com',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 86400 * 365,
    },
    // OneTrust consent cookies
    {
      name: 'OptanonAlertBoxClosed',
      value: new Date().toISOString(),
      domain: '.totalconnect2.com',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 86400 * 365,
    },
    {
      name: 'OptanonConsent',
      value: 'isGpcEnabled=0&datestamp=' + encodeURIComponent(new Date().toISOString()) + '&version=202301.1.0&isIABGlobal=false&hosts=&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1',
      domain: '.totalconnect2.com',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 86400 * 365,
    },
  ]);

  const page = await context.newPage();

  return { browser, context, page };
}

module.exports = { launchBrowser, buildLambdaTestEndpoint };
