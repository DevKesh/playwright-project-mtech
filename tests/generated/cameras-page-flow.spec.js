const { test, expect } = require('@playwright/test');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { TotalConnect2LoginPage } = require('../../framework/pages/generated/TotalConnect2LoginPage');
const { TotalConnectHomePage } = require('../../framework/pages/generated/TotalConnectHomePage');
const { TotalConnectCamerasPage } = require('../../framework/pages/generated/TotalConnectCamerasPage');

test.describe('@smoke @tc @tc-plan Cameras Page Verification', () => {
  let loginPage;
  let homePage;
  let camerasPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new TotalConnect2LoginPage(page);
    homePage = new TotalConnectHomePage(page);
    camerasPage = new TotalConnectCamerasPage(page);

    await loginPage.open(testDataConfig.targetApp.baseUrl);
    try { await loginPage.acceptConsent(); } catch {}
    await loginPage.fillLoginForm(
      testDataConfig.targetApp.credentials.email,
      testDataConfig.targetApp.credentials.password
    );
    await loginPage.clickSignIn();
    await expect(page).toHaveURL(/.*\/home/, { timeout: 15000 });
  });

  test('TC07 - Navigate to Cameras page and verify camera feed section', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Cameras');
    await allure.story('Cameras Page Navigation');
    await allure.severity('high');
    await allure.tags('smoke', 'tc', 'cameras', 'surveillance', 'navigation', 'positive');

    await test.step('Navigate to Cameras from sidebar', async () => {
      await homePage.navigateToCameras();
      await expect(page).toHaveURL(/.*\/cameras/, { timeout: 10000 });
    });

    await test.step('Verify Cameras page content is loaded', async () => {
      const camerasContent = page.locator('#body-container-layout');
      await expect(camerasContent).toBeVisible({ timeout: 10000 });
    });
  });
});
