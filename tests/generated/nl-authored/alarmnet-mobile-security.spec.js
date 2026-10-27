const { test, expect } = require('../../../framework/fixtures/login-security.fixture');
const { randomUUID } = require('node:crypto');
const allure = require('allure-js-commons');
const { observeSecurityChallenge, securitySettings, uniqueInvalidCredentials } = require('../../../framework/utils/login-security');

const MOBILE_URL = 'https://services.qa.alarmnet.com/AlarmNet360/Mobile';
const settings = securitySettings();
const runId = randomUUID();

test.describe('@nl-authored @login-security @alarmnet-mobile-security AlarmNet /AlarmNet360/Mobile', () => {
  for (let attempt = 1; attempt <= settings.attempts; attempt += 1) {
    test(`Attempt ${String(attempt).padStart(3, '0')}: Mobile synthetic invalid login and challenge check`, async ({ page }, testInfo) => {
      const credentials = uniqueInvalidCredentials(attempt, runId);
      await allure.epic('AlarmNet QA');
      await allure.feature('Mobile synthetic invalid login');
      await allure.story(MOBILE_URL);
      await allure.severity('critical');
      await allure.tag('nl-authored', 'alarmnet-mobile-security');

      await test.step('Open Mobile and observe for a Cloudflare challenge for 10 seconds', async () => {
        const response = await page.goto(MOBILE_URL, { waitUntil: 'domcontentloaded' });
        const observation = await observeSecurityChallenge(page);
        await testInfo.attach('Mobile security challenge observation', {
          body: Buffer.from(JSON.stringify({ requestedUrl: MOBILE_URL, status: response?.status(), ...observation }, null, 2)),
          contentType: 'application/json',
        });
        expect(observation.detected, `Cloudflare challenge detected on Mobile: ${observation.finalUrl}`).toBe(false);
        expect(response?.ok(), 'Mobile must return a successful HTTP response').toBe(true);
        await expect(page.locator('body')).toContainText(/\S/);
      });

      await test.step('Submit unique synthetic credentials once using the Mobile Login form', async () => {
        await page.getByPlaceholder('Username', { exact: true }).fill(credentials.username);
        await page.getByPlaceholder('Password', { exact: true }).fill(credentials.password);
        await page.getByRole('button', { name: 'Login', exact: true }).click();
        const observation = await observeSecurityChallenge(page);
        await testInfo.attach('Mobile post-submission challenge observation', {
          body: Buffer.from(JSON.stringify(observation, null, 2)),
          contentType: 'application/json',
        });
        expect(observation.detected, `Cloudflare challenge detected after Mobile Login: ${observation.finalUrl}`).toBe(false);
      });
    });
  }
});