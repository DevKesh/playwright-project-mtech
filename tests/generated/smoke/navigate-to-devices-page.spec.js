const { test, expect } = require('@playwright/test');
const { testDataConfig } = require('../../../framework/config/test-data.config');
const { LoginPage } = require('../../../framework/pages/generated/smoke/LoginPage');
const { HomePage } = require('../../../framework/pages/generated/smoke/HomePage');
const { DevicesPage } = require('../../../framework/pages/generated/smoke/DevicesPage');

test.describe('@smoke @tc @tc-plan TC-SMOKE-003: Navigate to Devices Page', () => {
  test('should navigate to devices and verify page loaded', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);
    const devicesPage = new DevicesPage(page);

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

    await test.step('Navigate to Devices page', async () => {
      await homePage.navigateToDevices();
    });

    await test.step('Verify URL contains /automation', async () => {
      await expect(page).toHaveURL(/.*\/automation/);
    });

    await test.step('Verify device categories are visible', async () => {
      await devicesPage.verifyDeviceCategoriesVisible();
    });
  });
});