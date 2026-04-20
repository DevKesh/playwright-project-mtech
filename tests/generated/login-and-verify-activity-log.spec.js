const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { LoginPage } = require('../../framework/pages/generated/LoginPage.js');
const { HomePage } = require('../../framework/pages/generated/HomePage.js');
const { ActivityPage } = require('../../framework/pages/generated/ActivityPage.js');

test.describe('Total Connect - Activity Log Verification', () => {
  test('Login and Verify Activity Log Entries', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Activity Log Verification');
    await allure.story('User logs in and verifies activity log entries are displayed');
    await allure.severity('normal');
    await allure.tags('login', 'activity-log', 'verification');

    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);
    const activityPage = new ActivityPage(page);

    await test.step('Navigate to login page', async () => {
      await loginPage.open(testDataConfig.targetApp.loginUrl);
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Fill login form and submit', async () => {
      await loginPage.fillLoginForm(
        testDataConfig.targetApp.credentials.email,
        testDataConfig.targetApp.credentials.password
      );
      await homePage.clickLoginButton();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Dismiss cookie popup if visible', async () => {
      await homePage.dismissCookiePopup();
    });

    await test.step('Close any popup by clicking on DONE if visible', async () => {
      await homePage.closePopupIfVisible();
    });

    await test.step('Navigate to Activity page', async () => {
      await activityPage.open();
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Verify the activity log entries are displayed', async () => {
      await activityPage.verifyActivityLogEntriesVisible();
    });
  });
});