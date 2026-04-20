// actual complete runnable test spec code
const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { LoginPage } = require('../../framework/pages/generated/LoginPage.js');
const { DashboardPage } = require('../../framework/pages/generated/DashboardPage.js');
const { ArmedHomeStatusPage } = require('../../framework/pages/generated/ArmedHomeStatusPage.js');

test.describe('Arm Home Mode After Login', () => {
  test('User logs in and arms the system to Home mode', async ({ page }) => {
    await allure.epic('Total Connect');
    await allure.feature('Security System Management');
    await allure.story('User logs in and arms the system to Home mode');
    await allure.severity('critical');
    await allure.tags('login', 'security', 'arm-home');

    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const armedHomeStatusPage = new ArmedHomeStatusPage(page);

    await test.step('Navigate to login page', async () => {
      await loginPage.open(testDataConfig.targetApp.loginUrl);
      await page.waitForLoadState('networkidle');
    });

    await test.step('Fill in login credentials', async () => {
      await loginPage.fillLoginForm(
        testDataConfig.targetApp.credentials.email,
        testDataConfig.targetApp.credentials.password
      );
    });

    await test.step('Click login button', async () => {
      await dashboardPage.clickLoginButton();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Dismiss cookie popup if visible', async () => {
      try {
        await dashboardPage.dismissCookiePopup();
        await page.waitForLoadState('domcontentloaded');
      } catch {
        // No cookie popup present
      }
    });

    await test.step('Close any popup by clicking on DONE', async () => {
      try {
        await dashboardPage.closePopup();
        await page.waitForLoadState('domcontentloaded');
      } catch {
        // No popup present
      }
    });

    await test.step('Select all and arm home', async () => {
      await dashboardPage.selectAll();
      await dashboardPage.armHome();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify system is armed to Home mode', async () => {
      await armedHomeStatusPage.waitForArmedHomeStatus();
      await expect(page).toHaveText('text=Armed Home');
    });
  });
});
