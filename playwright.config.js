const { defineConfig, devices } = require('@playwright/test');

const repetitions = Number(process.env.LOGIN_MONITOR_REPETITIONS ?? '20');
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 100) {
  throw new Error('LOGIN_MONITOR_REPETITIONS must be an integer between 1 and 100.');
}

const securityUse = {
  ...devices['Desktop Chrome'],
  channel: 'chrome',
  baseURL: 'https://services.qa.alarmnet.com',
  storageState: { cookies: [], origins: [] },
  actionTimeout: 10000,
  navigationTimeout: 45000,
  screenshot: { mode: 'only-on-failure', style: 'input { visibility: hidden !important; }', timeout: 5000 },
  trace: 'off',
  video: 'off',
};

module.exports = defineConfig({
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 4,
  timeout: 90000,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['allure-playwright', {
      resultsDir: process.env.ALLURE_RESULTS_DIR || 'allure-results',
      detail: false,
      suiteTitle: true,
    }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    headless: process.env.HEADLESS !== undefined ? process.env.HEADLESS === 'true' : !!process.env.CI,
    baseURL: 'https://qa2.totalconnect2.com',
    screenshot: { mode: 'only-on-failure', style: 'input { visibility: hidden !important; }' },
    trace: 'off',
    video: 'off',
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  projects: [
    {
      name: 'tc2',
      testDir: './tests/tc2',
      testMatch: '**/*.spec.js',
      metadata: { live: true },
      workers: 1,
      retries: 0,
      outputDir: './test-results/tc2',
    },
    {
      name: 'monitoring',
      testDir: './tests/monitoring',
      testMatch: '**/*.spec.js',
      metadata: { live: true },
      workers: 1,
      retries: 0,
      repeatEach: repetitions,
      expect: { timeout: 15000 },
      outputDir: './test-results/monitoring',
      use: { actionTimeout: 15000, baseURL: process.env.LOGIN_MONITOR_BASE_URL || 'https://qa2.totalconnect2.com' },
    },
    {
      name: 'alarmnet-login-security',
      testDir: './tests/security',
      testMatch: 'alarmnet-security.spec.js',
      metadata: { live: true },
      fullyParallel: true,
      retries: 0,
      outputDir: './test-results/alarmnet-login-security',
      use: securityUse,
    },
    {
      name: 'alarmnet-mobile-security',
      testDir: './tests/security',
      testMatch: 'alarmnet-mobile-security.spec.js',
      metadata: { live: true },
      fullyParallel: true,
      retries: 0,
      outputDir: './test-results/alarmnet-mobile-security',
      use: securityUse,
    },
    {
      name: 'alarmnet-forgot-login-security',
      testDir: './tests/security',
      testMatch: 'alarmnet-forgot-login-security.spec.js',
      metadata: { live: true },
      fullyParallel: true,
      retries: 0,
      outputDir: './test-results/alarmnet-forgot-login-security',
      use: securityUse,
    },
    {
      name: 'framework',
      testDir: './framework/utils/__tests__/fixtures',
      testMatch: 'fixture-contract.spec.js',
      metadata: { offline: true },
      workers: 1,
      retries: 0,
      outputDir: './test-results/framework',
      use: { headless: true, trace: 'off', video: 'off', screenshot: 'off' },
    },
  ],
});

