// @ts-check
import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';

/**
 * Read environment variables from .env file.
 */
import 'dotenv/config';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporters: Allure (primary) + HTML (backup) + AI reporter (conditional) */
  reporter: [
    ['html'],
    ['allure-playwright', {
      resultsDir: 'allure-results',
      detail: true,
      suiteTitle: true,
      environmentInfo: {
        os_platform: os.platform(),
        os_release: os.release(),
        node_version: process.version,
        framework: 'Playwright',
        app_url: 'https://rahulshettyacademy.com/client',
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
    ...(process.env.AI_HEALING_ENABLED === 'true'
      ? [['./framework/ai/reporters/ai-healing-reporter.js']]
      : []),
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',
    browserName: 'chromium',

    /* Run tests in headed mode locally. */
    headless: false,

    /* Capture screenshot on every test (Allure attaches them automatically). */
    screenshot: 'on',

    /* Keep video artifacts for failed tests. */
    video: 'retain-on-failure',

    /* Keep trace artifacts for failed tests for debugging. */
    trace: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});

