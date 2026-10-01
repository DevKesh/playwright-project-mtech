const { test } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const { setTimeout: pace } = require('node:timers/promises');
const { LoginPage } = require('../../../framework/pages/generated/smoke/LoginPage');
const {
  securitySettings, uniqueInvalidCredentials,
} = require('../../../framework/utils/login-security');

const settings = securitySettings();
const runId = randomUUID();

test.describe('@nl-authored @login-security Synthetic invalid credentials', () => {
  test.afterEach(async () => {
    await pace(settings.intervalMs);
  });

  // Standard page fixture: every attempt is independent, even after a failure.
  Array.from({ length: settings.attempts }, (_, index) => {
    const attempt = index + 1;
    test(`Attempt ${String(attempt).padStart(3, '0')}: submit unique synthetic credentials`, async ({ page }) => {
      const credentials = uniqueInvalidCredentials(attempt, runId);
      const login = new LoginPage(page);
      await test.step('Open the public login form', async () => {
        await page.goto('/login', { waitUntil: 'domcontentloaded' });
        await login.dismissCookieConsent();
      });
      await test.step('Fill unique credentials and click Sign In once', async () => {
        await login.login(credentials.username, credentials.password);
      });
    });
  });
});