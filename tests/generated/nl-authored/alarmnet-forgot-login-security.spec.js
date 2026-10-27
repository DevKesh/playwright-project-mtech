const { test, expect } = require('../../../framework/fixtures/login-security.fixture');
const allure = require('allure-js-commons');
const { observeSecurityChallenge, securitySettings } = require('../../../framework/utils/login-security');

const FORGOT_LOGIN_URL = 'https://services.qa.alarmnet.com/AlarmNet360/AlarmNetDirectV/UserManagement/UserRegistration/ForgotLogin';
const settings = securitySettings();

test.describe('@nl-authored @login-security @alarmnet-forgot-login-security AlarmNet /AlarmNet360/AlarmNetDirectV/UserManagement/UserRegistration/ForgotLogin', () => {
  for (let attempt = 1; attempt <= settings.attempts; attempt += 1) {
    test(`Attempt ${String(attempt).padStart(3, '0')}: Forgot Login challenge check without recovery submission`, async ({ page }, testInfo) => {
      await allure.epic('AlarmNet QA');
      await allure.feature('Forgot Login security challenge observation');
      await allure.story(FORGOT_LOGIN_URL);
      await allure.severity('critical');
      await allure.tag('nl-authored', 'alarmnet-forgot-login-security');

      await test.step('Open Forgot Login and observe for a Cloudflare challenge for 10 seconds', async () => {
        const response = await page.goto(FORGOT_LOGIN_URL, { waitUntil: 'domcontentloaded' });
        const observation = await observeSecurityChallenge(page);
        await testInfo.attach('Forgot Login security challenge observation', {
          body: Buffer.from(JSON.stringify({ requestedUrl: FORGOT_LOGIN_URL, status: response?.status(), ...observation }, null, 2)),
          contentType: 'application/json',
        });
        expect(observation.detected, `Cloudflare challenge detected on Forgot Login: ${observation.finalUrl}`).toBe(false);
        expect(response?.ok(), 'Forgot Login must return a successful HTTP response').toBe(true);
        await expect(page.locator('body')).toContainText(/\S/);
      });
    });
  }
});