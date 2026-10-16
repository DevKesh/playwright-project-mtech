const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const { setTimeout: pace } = require('node:timers/promises');
const { LoginPage } = require('../../../framework/pages/generated/smoke/LoginPage');
const {
  securitySettings, uniqueInvalidCredentials,
} = require('../../../framework/utils/login-security');

const ALARMNET_LOGIN_URL = 'https://services.qa.alarmnet.com/AlarmNet360/AlarmNetDirectV/Login/Login/SignIn?lang=en-US';
const settings = securitySettings();
const runId = randomUUID();

test.describe('@nl-authored @login-security AlarmNet synthetic invalid credentials', () => {
  test.afterEach(async () => {
    await pace(settings.intervalMs);
  });

  Array.from({ length: settings.attempts }, (_, index) => {
    const attempt = index + 1;
    test(`Attempt ${String(attempt).padStart(3, '0')}: submit unique synthetic credentials to AlarmNet`, async ({ page }) => {
      const credentials = uniqueInvalidCredentials(attempt, runId);
      const login = new LoginPage(page);

      await test.step('Open the AlarmNet sign-in page and reject a security challenge', async () => {
        await page.goto(ALARMNET_LOGIN_URL, { waitUntil: 'domcontentloaded' });
        const pageText = await page.locator('body').innerText();
        expect(pageText).not.toMatch(/Performing security verification|Verify you are human/i);
        await expect(page.getByRole('button', { name: /^Accept All$/i })).toBeHidden();
        await expect(page.getByRole('button', { name: /^Confirm my choices$/i })).toBeHidden();
      });

      await test.step('Fill unique credentials and click Sign In once', async () => {
        await login.login(credentials.username, credentials.password);
      });
    });
  });
});
