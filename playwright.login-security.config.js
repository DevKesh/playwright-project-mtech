const { defineConfig, devices } = require('@playwright/test');
const { QA_ORIGIN } = require('./framework/utils/login-security');

// Keep automatic DOM dumps off; failure screenshots below hide input fields.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

// Intentionally do NOT load dotenv, real credentials, healing or login monitor.
module.exports = defineConfig({
  testDir: './tests/generated/nl-authored',
  testMatch: 'login-security.spec.js',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  repeatEach: 1,
  maxFailures: 0,
  forbidOnly: true,
  timeout: 90000,
  outputDir: './test-results/login-security',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/login-security', open: 'never' }],
    ['json', { outputFile: 'test-results/login-security/results.json' }],
    ['allure-playwright', {
      resultsDir: 'allure-results/login-security',
      detail: false,
      suiteTitle: true,
      environmentInfo: {
        suite: 'Unique-credential login submissions',
        target: 'QA2',
        node_version: process.version,
      },
    }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    // Show Chrome for local monitored runs; hosted CI has no desktop display.
    headless: process.env.CI === 'true',
    baseURL: QA_ORIGIN,
    actionTimeout: 10000,
    navigationTimeout: 45000,
    screenshot: {
      mode: 'only-on-failure',
      style: 'input { visibility: hidden !important; }',
      timeout: 5000,
    },
    trace: 'off',
    video: 'off',
  },
});