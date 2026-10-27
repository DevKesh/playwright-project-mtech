const { defineConfig } = require('@playwright/test');

process.env.EXECUTION_PLATFORM = 'local';
process.env.AI_HEALING_ENABLED = 'false';
process.env.LOGIN_MONITOR_USERNAME = 'offline-fixture-user';
process.env.LOGIN_MONITOR_PASSWORD = 'offline-fixture-password';

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'fixture-contract.spec.js',
  workers: 1,
  retries: 0,
  fullyParallel: false,
  reporter: 'list',
  outputDir: '../../../../test-results/fixture-contract',
  use: { channel: 'chrome', headless: true, trace: 'off', video: 'off', screenshot: 'off' },
});