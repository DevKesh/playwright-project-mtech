const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config({ quiet: true });

// Load configured credentials for createLoginSession, but keep this monitor local.
// No global setup, AI healing, shared-results cleanup, or automatic Slack calls.
// CI (or explicit opt-in) writes isolated Allure results for the workflow to publish.
process.env.EXECUTION_PLATFORM = 'local';
const allureEnabled = process.env.CI === 'true' || process.env.LOGIN_MONITOR_ALLURE === 'true';
module.exports = defineConfig({
  testDir: './tests/generated/nl-authored',
  testMatch: 'login-forgot-password-repeat.spec.js',
  fullyParallel: false,
  workers: 1,
  // Exactly two tests per batch. The login test itself performs five real logins.
  repeatEach: 1,
  retries: 0,
  maxFailures: 0,
  forbidOnly: !!process.env.CI,
  timeout: 90000,
  expect: { timeout: 15000 },
  outputDir: './test-results/login-monitor',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/login-monitor', open: 'never' }],
    ...(allureEnabled ? [['allure-playwright', {
      resultsDir: 'allure-results/login-monitor',
      // Keep named test.step cycles, but omit automatic fill steps that may expose credentials.
      detail: false,
      suiteTitle: true,
      environmentInfo: {
        suite: 'Login and Forgot Password',
        login_logout_cycles: '5',
        forgot_password_cycles: '3',
        node_version: process.version,
      },
    }]] : []),
  ],
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    baseURL: process.env.LOGIN_MONITOR_BASE_URL || 'https://qa2.totalconnect2.com',
    headless: process.env.HEADLESS === 'true' || !!process.env.CI,
    actionTimeout: 15000,
    navigationTimeout: 60000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
});