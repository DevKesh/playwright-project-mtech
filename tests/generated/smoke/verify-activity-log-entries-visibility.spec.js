const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { LoginPage } = require('../../framework/pages/generated/LoginPage.js');
const { HomePage } = require('../../framework/pages/generated/HomePage.js');
const { ActivityPage } = require('../../framework/pages/generated/ActivityPage.js');

test.describe('Total Connect', () => {
  test('Verify Activity Log Entries are Visible with Timestamps', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Activity Log Navigation and Verification');
    await allure.story('User navigates to the Activity page and verifies log entries');
    await allure.severity('normal');
    await allure.tag('navigation', 'activity-log', 'verification');

    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);
    const activityPage = new ActivityPage(page);

    await test.step('Navigate to the login page', async () => {
      await loginPage.open();
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Fill in the login form and submit', async () => {
      await loginPage.fillLoginForm(testDataConfig.targetApp.credentials.email, testDataConfig.targetApp.credentials.password);
      await homePage.clickLoginButton();
      await page.waitForURL(/./, { timeout: 10000 });
    });

    await test.step('Dismiss any popups', async () => {
      await homePage.dismissCookiePopup();
      await homePage.closePopup();
    });

    await test.step('Navigate to the Activity page', async () => {
      await activityPage.navigateToActivityLogs();
      await page.waitForURL(/./, { timeout: 10000 });
    });

    await test.step('Verify the activity log entries are displayed', async () => {
      await activityPage.verifyActivityLogEntriesVisible();
    });

    await test.step('Verify the activity log entries have timestamps', async () => {
      await activityPage.verifyActivityLogTimestamps();
    });
  });
});