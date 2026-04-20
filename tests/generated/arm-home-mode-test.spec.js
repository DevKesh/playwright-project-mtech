// actual complete runnable test spec code
const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { LoginPage } = require('../../framework/pages/generated/LoginPage.js');
const { DashboardPage } = require('../../framework/pages/generated/DashboardPage.js');

test.describe('Total Connect Security System Management', () => {
  test('Test the Arm Home functionality in Total Connect', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Security System Management');
    await allure.story('User arms the security system to Home mode');
    await allure.severity('critical');
    await allure.tags('security', 'arm-home', 'popup-handling');

    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await test.step('Navigate to the login page', async () => {
      await loginPage.open(testDataConfig.targetApp.loginUrl);
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Fill in login credentials and submit', async () => {
      await loginPage.fillLoginForm(
        testDataConfig.targetApp.credentials.email,
        testDataConfig.targetApp.credentials.password
      );
      await page.click('#LoginButton');
    });

    await test.step('Wait for the dashboard to load', async () => {
      await page.waitForLoadState('networkidle');
    });

    await test.step('Dismiss cookie popup if visible', async () => {
      await dashboardPage.dismissCookiePopup();
    });

    await test.step('Close any pop-up by clicking on DONE', async () => {
      await dashboardPage.closePopup();
    });

    await test.step('Select all partitions', async () => {
      await dashboardPage.selectAllPartitions();
    });

    await test.step('Arm the system in Home mode', async () => {
      await dashboardPage.armHome();
    });

    await test.step('Verify the partition status is Armed Home', async () => {
      await expect(page.getByText('Armed Home')).toBeVisible();
    });
  });
});
