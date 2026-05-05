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
    ...(process.env.AI_HEALING_ENABLED === 'true'
      ? [/** @type {const} */ (['./framework/ai/reporters/ai-healing-reporter.js'])]
      : []),
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  /* Global timeout per test (60s accounts for login + navigation + assertions on live QA app) */
  timeout: 60 * 1000,
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',
    browserName: 'chromium',

    /* Run headed locally, headless in CI. */
    headless: !!process.env.CI,

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

    {
      name: 'total-connect',
      testDir: './tests/total-connect',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },

    /* Total Connect Smoke Tests — runs only @smoke tagged tests from generated specs */
    {
      name: 'tc-smoke',
      testDir: './tests/generated',
      grep: /@smoke/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },

    /* Total Connect Test Plan — runs @tc-plan tagged tests (full test plan suite) */
    {
      name: 'tc-plan',
      testDir: './tests/generated',
      grep: /@tc-plan/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },


  ],
});

