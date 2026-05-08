const { test, expect } = require('@playwright/test');
const { testDataConfig } = require('../../../framework/config/test-data.config');
const { LoginPage } = require('../../../framework/pages/generated/smoke/LoginPage');
const { HomePage } = require('../../../framework/pages/generated/smoke/HomePage');
const { ActivityPage } = require('../../../framework/pages/generated/smoke/ActivityPage');

test.describe('@smoke @tc @tc-plan TC-SMOKE-005: Navigate to Activity Page', () => {
  test('should navigate to activity and verify log entries', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);
    const activityPage = new ActivityPage(page);

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

    await test.step('Dismiss cookie popup on home page if visible', async () => {
      await homePage.dismissCookiePopup();
    });

    await test.step('Close DONE popup if visible', async () => {
      await homePage.closeDonePopup();
    });

    await test.step('Navigate to Activity page', async () => {
      await homePage.navigateToActivity();
    });

    await test.step('Verify URL contains /events', async () => {
      await expect(page).toHaveURL(/.*\/events/);
    });

    await test.step('Verify activity log entries are displayed', async () => {
      await activityPage.verifyActivityLogEntries();
    });
  });
});