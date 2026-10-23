const { defineConfig, devices } = require('@playwright/test');
const ALARMNET_ORIGIN = 'https://services.qa.alarmnet.com';
const suiteNames = {
  'alarmnet-login-security': 'AlarmNet Sign In - synthetic invalid credentials',
  'alarmnet-mobile-security': 'AlarmNet Mobile - synthetic invalid credentials and challenge check',
  'alarmnet-forgot-login-security': 'AlarmNet Forgot Login - Cloudflare challenge check',
};
const suite = process.env.LOGIN_SECURITY_SUITE || 'alarmnet-login-security';
if (!Object.hasOwn(suiteNames, suite)) {
  throw new Error(`Unknown LOGIN_SECURITY_SUITE: ${suite}`);
}
const isLoginSuite = suite === 'alarmnet-login-security';

// Keep automatic DOM dumps off; failure screenshots below hide input fields.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

// Intentionally do NOT load dotenv, real credentials, healing or login monitor.
module.exports = defineConfig({
  globalSetup: isLoginSuite ? './framework/utils/alarmnet-storage-setup.js' : undefined,
  testDir: './tests/generated/nl-authored',
  testMatch: '**/*.spec.js',
  grep: new RegExp(`(?:^|\\s)@${suite}(?=\\s|$)`),
  workers: 5,
  fullyParallel: true,
  retries: 0,
  repeatEach: 1,
  maxFailures: 0,
  forbidOnly: true,
  timeout: 90000,
  outputDir: `./test-results/${suite}`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `playwright-report/${suite}`, open: 'never' }],
    ['json', { outputFile: `test-results/${suite}/results.json` }],
    ['allure-playwright', {
      resultsDir: `allure-results/${suite}`,
      detail: false,
      suiteTitle: true,
      environmentInfo: {
        suite: suiteNames[suite],
        target: 'AlarmNet QA',
        node_version: process.version,
      },
    }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    // Show Chrome for local monitored runs; hosted CI has no desktop display.
    headless: process.env.CI === 'true',
    baseURL: ALARMNET_ORIGIN,
    storageState: isLoginSuite ? './test-results/alarmnet-storage-state.json' : { cookies: [], origins: [] },
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