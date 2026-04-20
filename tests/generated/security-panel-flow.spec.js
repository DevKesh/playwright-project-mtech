const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { TotalConnect2LoginPage } = require('../../framework/pages/generated/TotalConnect2LoginPage');
const { TotalConnectHomePage } = require('../../framework/pages/generated/TotalConnectHomePage');

test.describe('@smoke @tc @tc-plan Security Panel Verification', () => {
  let loginPage;
  let homePage;

  test.beforeEach(async ({ page }) => {
    loginPage = new TotalConnect2LoginPage(page);
    homePage = new TotalConnectHomePage(page);

    await loginPage.open(testDataConfig.targetApp.baseUrl);
    try { await loginPage.acceptConsent(); } catch {}
    await loginPage.fillLoginForm(
      testDataConfig.targetApp.credentials.email,
      testDataConfig.targetApp.credentials.password
    );
    await loginPage.clickSignIn();
    await expect(page).toHaveURL(/.*\/home/, { timeout: 15000 });
  });

  test('TC04 - Verify home page loads with security panel and activity feed', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Security');
    await allure.story('Home Page Load');
    await allure.severity('critical');
    await allure.tags('smoke', 'tc', 'security', 'home', 'positive');

    await test.step('Verify Security navigation is visible', async () => {
      await expect(homePage.securityNav).toBeVisible();
    });

    await test.step('Verify Today\'s Activities feed is displayed', async () => {
      await expect(homePage.todaysActivities).toBeVisible({ timeout: 10000 });
    });

    await test.step('Verify all sidebar navigation items are present', async () => {
      await expect(homePage.devicesNav).toBeVisible();
      await expect(homePage.camerasNav).toBeVisible();
      await expect(homePage.activityNav).toBeVisible();
      await expect(homePage.scenesNav).toBeVisible();
    });
  });

  test('TC05 - Navigate through Security, Partitions and Sensors tabs', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Security');
    await allure.story('Security Panel Tab Navigation');
    await allure.severity('high');
    await allure.tags('smoke', 'tc', 'security', 'partitions', 'sensors', 'positive');

    await test.step('Switch to Partitions tab', async () => {
      await homePage.switchToPartitionsTab();
      await expect(homePage.partitionsTab).toBeVisible();
      // Verify tab became active via aria or class attribute
      await expect(homePage.partitionsTab).toHaveClass(/md-active/, { timeout: 5000 });
    });

    await test.step('Switch to Sensors tab', async () => {
      await homePage.switchToSensorsTab();
      await expect(homePage.sensorsTab).toBeVisible();
      await expect(homePage.sensorsTab).toHaveClass(/md-active/, { timeout: 5000 });
    });

    await test.step('Switch back to Security tab', async () => {
      await homePage.securityTab.click();
      await expect(homePage.securityTab).toBeVisible();
      await expect(homePage.securityTab).toHaveClass(/md-active/, { timeout: 5000 });
    });
  });
});
