const { test, expect } = require('@playwright/test');
const { testDataConfig } = require('../../../framework/config/test-data.config');
const { LoginPage } = require('../../../framework/pages/generated/smoke/LoginPage');
const { HomePage } = require('../../../framework/pages/generated/smoke/HomePage');

test.describe('@smoke @tc @tc-plan TC-SMOKE-001: Login and Verify Home Page', () => {
  test('should login and see the home page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);

    await test.step('Navigate to login page', async () => {
      await page.goto(testDataConfig.targetApp.loginUrl);
    });

    await test.step('Dismiss cookie popup if visible', async () => {
      await loginPage.dismissCookieConsent();
    });

    await test.step('Login with credentials', async () => {
      await loginPage.login(testDataConfig.targetApp.credentials.email, testDataConfig.targetApp.credentials.password);
      await page.waitForURL('**/home', { timeout: 15000 });
    });

    await test.step('Close DONE popup if visible', async () => {
      await homePage.closeDonePopup();
    });

    await test.step('Verify home page is loaded', async () => {
      await expect(page).toHaveURL(/.*\/home/);
    });
  });
});