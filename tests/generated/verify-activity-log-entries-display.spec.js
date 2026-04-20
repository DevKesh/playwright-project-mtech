const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { LoginPage } = require('../../framework/pages/generated/LoginPage.js');
const { DashboardPage } = require('../../framework/pages/generated/DashboardPage.js');
const { ActivityPage } = require('../../framework/pages/generated/ActivityPage.js');

test.describe('Total Connect - Activity Log', () => {
  test('Verify Activity Log Entries are Displayed', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Activity Log');
    await allure.story('User verifies that activity log entries are displayed on the Activity page');
    await allure.severity('normal');
    await allure.tags('login', 'activity-log', 'ui-verification');

    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const activityPage = new ActivityPage(page);

    await test.step('Navigate to login page', async () => {
      await loginPage.open(testDataConfig.targetApp.loginUrl);
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Fill in login credentials and submit', async () => {
      await loginPage.fillLoginForm(
        testDataConfig.targetApp.credentials.email,
        testDataConfig.targetApp.credentials.password
      );
      await dashboardPage.clickLoginButton();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Dismiss cookie popup if visible', async () => {
      await dashboardPage.dismissCookiePopup();
    });

    await test.step('Close any pop-up by clicking on DONE', async () => {
      await dashboardPage.closePopup();
    });

    await test.step('Navigate to Activity page', async () => {
      await activityPage.navigateToActivityPage();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify the activity log entries are displayed', async () => {
      await activityPage.verifyActivityLogEntriesVisible();
    });
  });
});