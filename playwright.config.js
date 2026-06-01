// @ts-check
import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';

/**
 * Read environment variables from .env file.
 */
import 'dotenv/config';

// ─── LambdaTest CDP connection (for fixture-based tests when EXECUTION_PLATFORM=lambda) ───
const isLambda = process.env.EXECUTION_PLATFORM === 'lambda';
let lambdaConnectOptions = undefined;

/** Generate dynamic build name: TotalConnect QA - {Suite Description} - May 21, 2026 9:45 PM */
function generateBuildName() {
  if (process.env.LT_BUILD_NAME) return process.env.LT_BUILD_NAME;
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
}

if (isLambda) {
  const ltUsername = process.env.LT_USERNAME;
  const ltAccessKey = process.env.LT_ACCESS_KEY;

  if (!ltUsername || !ltAccessKey) {
    throw new Error('[PlaywrightConfig] EXECUTION_PLATFORM=lambda but LT_USERNAME / LT_ACCESS_KEY not set in .env');
  }

  const capabilities = {
    browserName: process.env.LT_BROWSER || 'Chrome',
    browserVersion: process.env.LT_BROWSER_VERSION || 'latest',
    'LT:Options': {
      platform: process.env.LT_PLATFORM || 'Windows 11',
      build: generateBuildName(),
      name: 'Playwright Fixture Test',
      project: process.env.LT_PROJECT_NAME || 'TC2-Automation',
      resolution: process.env.LT_RESOLUTION || '1920x1080',
      user: ltUsername,
      accessKey: ltAccessKey,
      video: process.env.LT_VIDEO !== 'false',
      console: process.env.LT_CONSOLE !== 'false',
      network: process.env.LT_NETWORK !== 'false',
      tunnel: process.env.LT_TUNNEL === 'true',
      ...(process.env.LT_TUNNEL_NAME ? { tunnelName: process.env.LT_TUNNEL_NAME } : {}),
    },
  };

  lambdaConnectOptions = {
    wsEndpoint: `wss://cdp.lambdatest.com/playwright?capabilities=${encodeURIComponent(JSON.stringify(capabilities))}`,
  };
}

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  globalSetup: './global-setup.js',
  testDir: './tests',
  /* Run tests sequentially (one after another) for stable execution against live app */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Sequential execution: 1 worker ensures tests run one-by-one */
  workers: 1,
  /* Reporters: Allure (primary) + HTML (backup) + AI reporter (conditional) */
  reporter: [
    ['html', {
      open: process.env.CI
        ? 'never'
        : (process.env.PW_OPEN_REPORT === 'true' ? 'always' : 'never'),
    }],
    ['allure-playwright', {
      resultsDir: 'allure-results',
      detail: true,
      suiteTitle: true,
      environmentInfo: {
        os_platform: os.platform(),
        os_release: os.release(),
        node_version: process.version,
        framework: 'Playwright',
        app_url: 'https://qa2.totalconnect2.com/',
      },
      categories: [
        {
          name: 'Assertion failures',
          messageRegex: '.*expect.*|.*assert.*',
          matchedStatuses: ['failed'],
        },
        {
          name: 'Element not found',
          messageRegex: '.*waiting for locator.*|.*TimeoutError.*',
          matchedStatuses: ['broken'],
        },
        {
          name: 'Network / API errors',
          messageRegex: '.*net::ERR.*|.*ECONNREFUSED.*|.*fetch failed.*',
          matchedStatuses: ['broken'],
        },
        {
          name: 'Test logic errors',
          messageRegex: '.*Error.*',
          matchedStatuses: ['failed'],
        },
      ],
    }],
    ['./framework/reporters/allure-auto-reporter.js', {
      resultsDir: 'allure-results',
      outputDir: 'allure-reports-history',
    }],
    ...(process.env.AI_HEALING_ENABLED === 'true'
      ? [/** @type {const} */ (['./framework/ai/reporters/ai-healing-reporter.js'])]
      : []),
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  /* Global timeout per test (90s local, 120s on LambdaTest to account for cloud latency) */
  timeout: isLambda ? 120 * 1000 : 90 * 1000,
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',
    browserName: 'chromium',

    /* LambdaTest: connect to cloud browser via CDP WebSocket */
    ...(lambdaConnectOptions ? { connectOptions: lambdaConnectOptions } : {}),

    /* Run headed locally, headless in CI. Controlled by HEADLESS in .env */
    headless: process.env.HEADLESS !== undefined
      ? process.env.HEADLESS === 'true'
      : !!process.env.CI,

    /* Capture screenshot only on failure (Allure attaches them automatically). */
    screenshot: 'only-on-failure',
    

    /* Video & trace: OFF on LambdaTest (LT records video natively on their dashboard;
       attempting to download trace/video over WebSocket causes teardown timeouts).
       OFF in CI too — screenshots cover failure capture and avoids FFmpeg download.
       Locally: retain on failure for debugging. */
    video: (isLambda || process.env.CI) ? 'off' : 'retain-on-failure',
    trace: (isLambda || process.env.CI) ? 'off' : 'retain-on-failure',

    /* Safety net: no single action (click, fill, etc.) should hang more than 30s (45s on cloud) */
    actionTimeout: isLambda ? 45000 : 30000,
    navigationTimeout: isLambda ? 45000 : 60000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chrome',
      /* Exclude smoke suite — it has its own dedicated tc-smoke project to avoid double-counting */
      testIgnore: '**/smoke/smoke-suite.spec.js',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },

    {
      name: 'total-connect',
      testDir: './tests/total-connect',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },

    /* Total Connect Smoke Tests — runs the consolidated smoke suite serially */
    {
      name: 'tc-smoke',
      testDir: './tests/generated/smoke',
      testMatch: 'smoke-suite.spec.js',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },

    /* Total Connect Test Plan — runs @tc-plan tagged tests (full test plan suite) */
    {
      name: 'tc-plan',
      testDir: './tests/generated',
      /* Exclude smoke suite — tc-smoke project owns it; tc-plan picks up other @tc-plan specs */
      testIgnore: '**/smoke/smoke-suite.spec.js',
      grep: /@tc-plan/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },


  ],
});

