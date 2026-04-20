const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { LoginPage } = require('../../framework/pages/generated/LoginPage');
const { DashboardPage } = require('../../framework/pages/generated/DashboardPage');
const { DashboardwithArmedHomestatus } = require('../../framework/pages/generated/DashboardwithArmedHomestatus');

test.describe('Arm Home After Login', () => {
  test('User logs in and arms the system to Home mode', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Device Management');
    await allure.story('User logs in and arms the system to Home mode');
    await allure.severity('critical');
    await allure.tags('login', 'device-management', 'arm-home');

    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const dashboardWithArmedHomeStatus = new DashboardwithArmedHomestatus(page);

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
      await page.waitForLoadState('networkidle');
    });

    await test.step('Dismiss cookie popup if visible', async () => {
      await dashboardPage.dismissCookiePopup();
    });

    await test.step('Close any pop-up by clicking on DONE', async () => {
      await dashboardPage.closePopup();
    });

    await test.step('Select all partitions and arm home', async () => {
      await dashboardPage.selectAllPartitions();
      await dashboardPage.armHome();
    });

    await test.step('Verify system is armed to Home mode', async () => {
      await dashboardWithArmedHomeStatus.waitForArmedHomeStatus();
      await expect(page.getByText('Armed Home')).toBeVisible();
    });
  });
});