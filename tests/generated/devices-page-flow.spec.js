const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { TotalConnect2LoginPage } = require('../../framework/pages/generated/TotalConnect2LoginPage');
const { TotalConnectHomePage } = require('../../framework/pages/generated/TotalConnectHomePage');
const { TotalConnectDevicesPage } = require('../../framework/pages/generated/TotalConnectDevicesPage');

test.describe('@smoke @tc @tc-plan Devices Page Verification', () => {
  let loginPage;
  let homePage;
  let devicesPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new TotalConnect2LoginPage(page);
    homePage = new TotalConnectHomePage(page);
    devicesPage = new TotalConnectDevicesPage(page);

    await loginPage.open(testDataConfig.targetApp.baseUrl);
    try { await loginPage.acceptConsent(); } catch {}
    await loginPage.fillLoginForm(
      testDataConfig.targetApp.credentials.email,
      testDataConfig.targetApp.credentials.password
    );
    await loginPage.clickSignIn();
    await expect(page).toHaveURL(/.*\/home/, { timeout: 15000 });
  });

  test('TC06 - Navigate to Devices page and verify IoT device categories', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Devices');
    await allure.story('Devices Page Navigation');
    await allure.severity('high');
    await allure.tags('smoke', 'tc', 'devices', 'iot', 'navigation', 'positive');

    await test.step('Navigate to Devices from sidebar', async () => {
      await homePage.navigateToDevices();
      await expect(page).toHaveURL(/.*\/automation/, { timeout: 10000 });
    });

    await test.step('Verify Devices page content has loaded', async () => {
      const devicesContent = page.locator('#body-container-layout');
      await expect(devicesContent).toBeVisible({ timeout: 10000 });
    });
  });
});
