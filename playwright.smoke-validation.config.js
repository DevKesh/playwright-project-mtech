const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config({ quiet: true });

// Isolated validation: the smoke spec selects the approved account. Avoid AI
// repairs, report publication and cleanup of other suites' artifacts.
process.env.EXECUTION_PLATFORM = 'local';
process.env.AI_HEALING_ENABLED = 'false';
process.env.HEADLESS = 'true';

module.exports = defineConfig({
  testDir: './tests/generated/smoke',
  testMatch: 'smoke-suite.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 15000 },
  outputDir: './test-results/smoke-validation',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/smoke-validation', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    headless: true,
    actionTimeout: 15000,
    navigationTimeout: 60000,
    trace: 'off',
    video: 'off',
  },
});