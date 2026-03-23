const { test, expect } = require('@playwright/test');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { TotalConnect2LoginPage } = require('../../framework/pages/generated/TotalConnect2LoginPage');
const { TotalConnectHomePage } = require('../../framework/pages/generated/TotalConnectHomePage');
const { TotalConnectScenesPage } = require('../../framework/pages/generated/TotalConnectScenesPage');

test.describe('@smoke @tc @tc-plan Scenes Page Verification', () => {
  let loginPage;
  let homePage;
  let scenesPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new TotalConnect2LoginPage(page);
    homePage = new TotalConnectHomePage(page);
    scenesPage = new TotalConnectScenesPage(page);

    await loginPage.open(testDataConfig.targetApp.baseUrl);
    try { await loginPage.acceptConsent(); } catch {}
    await loginPage.fillLoginForm(
      testDataConfig.targetApp.credentials.email,
      testDataConfig.targetApp.credentials.password
    );
    await loginPage.clickSignIn();
    await expect(page).toHaveURL(/.*\/home/, { timeout: 15000 });
  });

  test('TC09 - Navigate to Scenes page and verify automation scenes', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Scenes');
    await allure.story('Scenes Page Navigation');
    await allure.severity('medium');
    await allure.tags('smoke', 'tc', 'scenes', 'automation', 'navigation', 'positive');

    await test.step('Navigate to Scenes from sidebar', async () => {
      await homePage.navigateToScenes();
      await expect(page).toHaveURL(/.*\/smartscenes/, { timeout: 10000 });
    });

    await test.step('Verify Scenes page has loaded', async () => {
      const scenesContent = page.locator('#body-container-layout');
      await expect(scenesContent).toBeVisible({ timeout: 10000 });
    });
  });
});
