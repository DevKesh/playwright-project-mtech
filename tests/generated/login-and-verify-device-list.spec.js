// actual complete runnable test spec code
const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { LoginPage } = require('../../framework/pages/generated/LoginPage.js');
const { DashboardPage } = require('../../framework/pages/generated/DashboardPage.js');
const { DevicesPage } = require('../../framework/pages/generated/DevicesPage.js');

test.describe('Login and Device List Verification', () => {
  test('Login and Verify Device List Visibility', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Device Management');
    await allure.story('User navigates to devices page and verifies device list');
    await allure.severity('critical');
    await allure.tags('login', 'device-list', 'ui-verification');

    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const devicesPage = new DevicesPage(page);

    await test.step('Navigate to login page', async () => {
      await loginPage.open(testDataConfig.targetApp.loginUrl);
      await page.waitForLoadState('networkidle');
    });

    await test.step('Fill in login credentials', async () => {
      await loginPage.fillLoginForm(
        testDataConfig.targetApp.credentials.email,
        testDataConfig.targetApp.credentials.password
      );
    });

    await test.step('Click login button', async () => {
      await dashboardPage.clickLoginButton();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Dismiss cookie popup', async () => {
      await dashboardPage.dismissCookiePopup();
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Navigate to devices page', async () => {
      await devicesPage.navigateToDevicesPage();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify device list is visible', async () => {
      await devicesPage.verifyDevicesListVisible();
      await page.waitForLoadState('networkidle');
    });
  });
});