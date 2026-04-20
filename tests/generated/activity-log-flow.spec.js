const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { TotalConnect2LoginPage } = require('../../framework/pages/generated/TotalConnect2LoginPage');
const { TotalConnectHomePage } = require('../../framework/pages/generated/TotalConnectHomePage');
const { TotalConnectActivityPage } = require('../../framework/pages/generated/TotalConnectActivityPage');

test.describe('@smoke @tc @tc-plan Activity Log Verification', () => {
  let loginPage;
  let homePage;
  let activityPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new TotalConnect2LoginPage(page);
    homePage = new TotalConnectHomePage(page);
    activityPage = new TotalConnectActivityPage(page);

    await loginPage.open(testDataConfig.targetApp.baseUrl);
    try { await loginPage.acceptConsent(); } catch {}
    await loginPage.fillLoginForm(
      testDataConfig.targetApp.credentials.email,
      testDataConfig.targetApp.credentials.password
    );
    await loginPage.clickSignIn();
    await expect(page).toHaveURL(/.*\/home/, { timeout: 15000 });
  });

  test('TC08 - Navigate to Activity page and verify event log', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Activity');
    await allure.story('Activity Log Navigation');
    await allure.severity('high');
    await allure.tags('smoke', 'tc', 'activity', 'events', 'navigation', 'positive');

    await test.step('Navigate to Activity from sidebar', async () => {
      await homePage.navigateToActivity();
      await expect(page).toHaveURL(/.*\/events/, { timeout: 10000 });
    });

    await test.step('Verify Activity page has loaded with event content', async () => {
      const activityContent = page.locator('#body-container-layout');
      await expect(activityContent).toBeVisible({ timeout: 10000 });
    });
  });
});
